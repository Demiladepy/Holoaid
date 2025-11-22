"""Real-time navigation supervisor that posts obstacle decisions to the FastAPI backend."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import time
from dataclasses import dataclass

import cv2
import httpx
import numpy as np
import supervision as sv
from dotenv import load_dotenv
from ultralytics import YOLO

try:  # optional dependency for LiveKit subscription
    from livekit import rtc
except Exception:  # pragma: no cover - optional dependency
    rtc = None

if rtc is not None:  # pragma: no cover - optional dependency
    try:
        from livekit.rtc import VideoBufferType  # type: ignore
    except Exception:
        try:
            from livekit.proto import video_pb2 as _proto_video  # type: ignore

            VideoBufferType = getattr(_proto_video, "VideoBufferType", None)
        except Exception:
            VideoBufferType = None
else:  # pragma: no cover - optional dependency
    VideoBufferType = None

from ..config import get_settings
from ..models.schemas import NavigationCommand
from ..services.livekit import LiveKitTokenService

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class VisionConfig:
    model_path: str = "yolov8n-seg.pt"
    video_source: str = "0"
    api_base_url: str = "http://127.0.0.1:8080"
    api_token: str | None = None
    livekit_room: str = "vision-nav-room"
    livekit_url: str | None = None
    livekit_api_key: str | None = None
    livekit_api_secret: str | None = None
    livekit_identity: str = "vision-supervisor"
    use_livekit: bool = True
    display: bool = False
    min_confidence: float = 0.35
    obstacle_threshold: float = 0.4

    @classmethod
    def load(cls) -> "VisionConfig":
        settings = get_settings()
        livekit_url = os.getenv("LIVEKIT_URL") or settings.livekit_server_url
        return cls(
            model_path=os.getenv("YOLO_MODEL_PATH", cls.model_path),
            video_source=os.getenv("VIDEO_SOURCE", cls.video_source),
            api_base_url=(os.getenv("FASTAPI_BASE_URL") or "http://127.0.0.1:8080").rstrip("/"),
            api_token=os.getenv("VISION_API_TOKEN") or settings.vision_api_token,
            livekit_room=os.getenv("LIVEKIT_ROOM", settings.obs_room),
            livekit_url=livekit_url,
            livekit_api_key=os.getenv("LIVEKIT_API_KEY") or settings.livekit_api_key,
            livekit_api_secret=os.getenv("LIVEKIT_API_SECRET") or settings.livekit_api_secret,
            livekit_identity=os.getenv("VISION_IDENTITY", "vision-supervisor"),
            use_livekit=os.getenv("VISION_USE_LIVEKIT", "1") != "0",
            display=os.getenv("VISION_DISPLAY", "0") == "1",
            min_confidence=float(os.getenv("VISION_MIN_CONF", str(cls.min_confidence))),
            obstacle_threshold=float(os.getenv("VISION_COST_THRESHOLD", str(cls.obstacle_threshold))),
        )

    def parsed_video_source(self) -> int | str:
        try:
            return int(self.video_source)
        except ValueError:
            return self.video_source

    def livekit_ready(self) -> bool:
        return bool(self.livekit_url and self.livekit_api_key and self.livekit_api_secret)


class NavigationSupervisor:
    def __init__(self, cfg: VisionConfig) -> None:
        self.cfg = cfg
        self.model = YOLO(cfg.model_path)
        self.box_annotator = sv.BoxAnnotator(color=sv.Color.RED, thickness=2)
        self.label_annotator = sv.LabelAnnotator(text_color=sv.Color.WHITE, text_scale=0.5)
        self._last_publish = 0.0
        self._frame_queue: asyncio.Queue[np.ndarray] | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._frame_task: asyncio.Task[None] | None = None
        self._track_tasks: dict[str, asyncio.Task[None]] = {}

    def run(self) -> None:
        use_livekit = self.cfg.use_livekit and self.cfg.livekit_ready() and rtc is not None
        if use_livekit:
            logger.info("Starting LiveKit subscriber for room %s", self.cfg.livekit_room)
            asyncio.run(self._run_livekit())
            return

        if self.cfg.use_livekit and not self.cfg.livekit_ready():
            logger.warning("LiveKit credentials missing; falling back to local video source %s", self.cfg.video_source)
        elif self.cfg.use_livekit and rtc is None:
            logger.warning("livekit Python package not available; falling back to local video source %s", self.cfg.video_source)
        self._run_camera()

    def _run_camera(self) -> None:
        src = self.cfg.parsed_video_source()
        cap = cv2.VideoCapture(src)
        if not cap.isOpened():
            raise RuntimeError(f"Unable to open video source: {src}")

        self._last_publish = 0.0
        try:
            while True:
                success, frame = cap.read()
                if not success:
                    time.sleep(0.05)
                    continue

                decision, annotated = self._analyze_frame(frame)
                if self._ready_to_publish():
                    self._publish(decision)
                if self.cfg.display:
                    self._display_frame(annotated, decision)
        except KeyboardInterrupt:  # pragma: no cover - manual stop
            logger.info("Camera supervisor interrupted; shutting down")
        finally:
            cap.release()
            if self.cfg.display:
                cv2.destroyAllWindows()

    async def _run_livekit(self) -> None:
        assert rtc is not None  # for type checkers
        if not self.cfg.livekit_ready():
            raise RuntimeError("LiveKit credentials are not configured")

        token_service = LiveKitTokenService(
            api_key=self.cfg.livekit_api_key,
            api_secret=self.cfg.livekit_api_secret,
        )
        token = token_service.issue_token(
            room=self.cfg.livekit_room,
            identity=self.cfg.livekit_identity,
            name=f"Vision Supervisor ({self.cfg.livekit_identity})",
        )

        room = rtc.Room()
        self._frame_queue = asyncio.Queue(maxsize=1)
        self._loop = asyncio.get_running_loop()
        self._last_publish = 0.0
        closed_event = asyncio.Event()

        @room.on("track_subscribed")
        def _on_track(track, publication, participant) -> None:
            if not isinstance(track, rtc.RemoteVideoTrack):
                return
            logger.info("Subscribed to %s from %s", publication.sid, participant.identity)
            self._attach_track(publication.sid, track, participant.identity)

        @room.on("track_unsubscribed")
        def _on_unsubscribed(track, publication, participant) -> None:
            if isinstance(track, rtc.RemoteVideoTrack):
                logger.info("Video track %s from %s ended", publication.sid, participant.identity)
                self._detach_track(publication.sid)

        @room.on("connection_state_changed")
        def _on_state(state) -> None:
            state_name = getattr(state, "name", str(state))
            logger.info("LiveKit connection state: %s", state_name)

        @room.on("disconnected")
        def _on_disconnected(reason=None) -> None:
            logger.info("LiveKit disconnected: %s", reason or "unknown")
            closed_event.set()

        await room.connect(
            self.cfg.livekit_url,
            token,
            options=rtc.RoomOptions(auto_subscribe=True),
        )
        logger.info("LiveKit room joined; waiting for remote video tracks")

        self._frame_task = asyncio.create_task(self._process_frames())
        try:
            await closed_event.wait()
        finally:
            await self._cleanup_track_tasks()
            if self._frame_task:
                self._frame_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await self._frame_task
            if self.cfg.display:
                cv2.destroyAllWindows()
            with contextlib.suppress(Exception):
                await room.disconnect()
            self._frame_queue = None
            self._loop = None

    def _attach_track(self, sid: str, track, identity: str) -> None:
        if self._loop is None or self._frame_queue is None or rtc is None:
            return

        loop = self._loop

        def _start_consumer() -> None:
            if sid in self._track_tasks:
                return
            task = loop.create_task(self._consume_video_track(track, identity, sid))
            self._track_tasks[sid] = task

        loop.call_soon_threadsafe(_start_consumer)

    def _detach_track(self, sid: str) -> None:
        task = self._track_tasks.pop(sid, None)
        if task:
            task.cancel()

    async def _cleanup_track_tasks(self) -> None:
        if not self._track_tasks:
            return
        tasks = list(self._track_tasks.values())
        for task in tasks:
            task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await asyncio.gather(*tasks, return_exceptions=True)
        self._track_tasks.clear()

    async def _consume_video_track(self, track, identity: str, sid: str) -> None:
        if rtc is None:
            return
        try:
            async for event in rtc.VideoStream(track):
                frame = getattr(event, "frame", None)
                if frame is None:
                    continue
                ndarray = self._video_frame_to_bgr(frame)
                if ndarray is None:
                    continue
                self._enqueue_frame(ndarray)
        except asyncio.CancelledError:  # pragma: no cover - task cancellation
            logger.info("LiveKit video task cancelled for %s", identity)
            raise
        except Exception as exc:  # pragma: no cover - network callback errors
            logger.warning("LiveKit ingestion error (%s): %s", identity, exc)
        finally:
            self._track_tasks.pop(sid, None)

    def _video_frame_to_bgr(self, video_frame) -> np.ndarray | None:
        try:
            if hasattr(video_frame, "to_ndarray"):
                return video_frame.to_ndarray(format="bgr24")
        except Exception:
            pass

        if not hasattr(video_frame, "data"):
            return None

        frame = video_frame
        target_format = None
        if VideoBufferType is not None:
            target_format = getattr(VideoBufferType, "RGB24", getattr(VideoBufferType, "VIDEO_BUFFER_TYPE_RGB24", None))

        try:
            if target_format is not None and getattr(video_frame, "type", target_format) != target_format:
                frame = video_frame.convert(target_format)
        except Exception:
            frame = video_frame

        try:
            data = np.frombuffer(frame.data, dtype=np.uint8)
            array = data.reshape((frame.height, frame.width, 3))
        except Exception:
            return None
        return cv2.cvtColor(array, cv2.COLOR_RGB2BGR)

    def _enqueue_frame(self, frame: np.ndarray) -> None:
        if not self._frame_queue:
            return
        if self._frame_queue.full():
            try:
                self._frame_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        try:
            self._frame_queue.put_nowait(frame)
        except asyncio.QueueFull:  # pragma: no cover - guard
            pass

    async def _process_frames(self) -> None:
        if not self._frame_queue:
            return
        try:
            while True:
                frame = await self._frame_queue.get()
                decision, annotated = await asyncio.to_thread(self._analyze_frame, frame)
                if self._ready_to_publish():
                    await asyncio.to_thread(self._publish, decision)
                if self.cfg.display:
                    await asyncio.to_thread(self._display_frame, annotated, decision)
        except asyncio.CancelledError:  # pragma: no cover - task cancellation
            logger.info("Frame processor cancelled")
            raise

    def _predict(self, frame: np.ndarray) -> tuple[sv.Detections, np.ndarray]:
        results = self.model.predict(frame, verbose=False, conf=self.cfg.min_confidence)
        detection = sv.Detections.empty()
        if results:
            detection = sv.Detections.from_ultralytics(results[0])

        names = self.model.names or {}
        confidences = getattr(detection, "confidence", None)
        class_ids = getattr(detection, "class_id", None)
        if confidences is None or (hasattr(confidences, "size") and confidences.size == 0):
            confidences = []
        if class_ids is None or (hasattr(class_ids, "size") and class_ids.size == 0):
            class_ids = []
        labels: list[str] = []
        for conf, class_id in zip(confidences, class_ids):
            label = names.get(int(class_id), "obj") if isinstance(class_id, (int, np.integer)) else names.get(class_id, "obj")
            labels.append(f"{label} {conf:.2f}")

        annotated = self.box_annotator.annotate(scene=frame.copy(), detections=detection)
        if labels:
            annotated = self.label_annotator.annotate(scene=annotated, detections=detection, labels=labels)
        return detection, annotated

    def _analyze_frame(self, frame: np.ndarray) -> tuple[NavigationCommand, np.ndarray]:
        detections, annotated = self._predict(frame)
        decision = self._decide(detections, frame.shape[:2])
        return decision, annotated

    def _decide(self, detections: sv.Detections, shape: tuple[int, int]) -> NavigationCommand:
        h, w = shape
        mask = np.zeros((h, w), dtype=np.uint8)
        if detections.mask is not None:
            for mm in detections.mask:
                if mm is None:
                    continue
                resized = cv2.resize((mm > 0).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
                mask = cv2.bitwise_or(mask, resized)
        else:
            for xyxy in detections.xyxy:
                x0, y0, x1, y1 = map(int, xyxy)
                mask[y0:y1, x0:x1] = 1

        if not np.any(mask):
            return NavigationCommand.MOVE_FORWARD

        left = np.mean(mask[:, : w // 3])
        center = np.mean(mask[:, w // 3 : 2 * w // 3])
        right = np.mean(mask[:, 2 * w // 3 :])

        if center > self.cfg.obstacle_threshold:
            if left < right:
                return NavigationCommand.TURN_LEFT
            if right < left:
                return NavigationCommand.TURN_RIGHT
            return NavigationCommand.STOP

        if left > self.cfg.obstacle_threshold * 1.2:
            return NavigationCommand.TURN_RIGHT
        if right > self.cfg.obstacle_threshold * 1.2:
            return NavigationCommand.TURN_LEFT
        return NavigationCommand.MOVE_FORWARD

    def _ready_to_publish(self) -> bool:
        now = time.time()
        if now - self._last_publish < 0.5:
            return False
        self._last_publish = now
        return True

    def _publish(self, decision: NavigationCommand) -> None:
        if not self.cfg.api_base_url:
            return
        payload = {
            "room": self.cfg.livekit_room,
            "command": decision.value,
            "message": _describe_command(decision),
            "source": "vision",
        }
        headers = {"Authorization": f"Bearer {self.cfg.api_token}"} if self.cfg.api_token else None
        try:
            httpx.post(
                f"{self.cfg.api_base_url}/api/navigation/decision",
                json=payload,
                headers=headers,
                timeout=5.0,
            )
        except Exception:
            # best-effort for now
            pass

    def _display_frame(self, frame: np.ndarray, decision: NavigationCommand) -> None:
        overlay = frame.copy()
        cv2.putText(
            overlay,
            decision.value.replace("_", " "),
            (12, 36),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (0, 255, 200) if decision == NavigationCommand.MOVE_FORWARD else (30, 144, 255),
            2,
            cv2.LINE_AA,
        )
        cv2.imshow("Vision Supervisor", overlay)
        cv2.waitKey(1)


def _describe_command(decision: NavigationCommand) -> str:
    mapping = {
        NavigationCommand.MOVE_FORWARD: "Clear path ahead",
        NavigationCommand.TURN_LEFT: "Obstacle ahead, veer left",
        NavigationCommand.TURN_RIGHT: "Obstacle ahead, veer right",
        NavigationCommand.STOP: "Stop immediately",
    }
    return mapping.get(decision, decision.value.replace("_", " "))


def main() -> None:
    load_dotenv()
    cfg = VisionConfig.load()
    supervisor = NavigationSupervisor(cfg)
    supervisor.run()


if __name__ == "__main__":
    main()