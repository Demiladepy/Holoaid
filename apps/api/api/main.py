from __future__ import annotations

import datetime as dt
import logging
import os
import subprocess
import sys
import threading
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .models.schemas import HealthResponse
from .routers import livekit, navigation, tts


logger = logging.getLogger(__name__)
_worker_lock = threading.Lock()
_worker_process: subprocess.Popen[str] | None = None


def _start_worker_process() -> None:
    settings = get_settings()
    if not settings.auto_start_vision_worker:
        logger.info("Vision worker auto-start disabled; skipping launch")
        return

    with _worker_lock:
        global _worker_process
        if _worker_process and _worker_process.poll() is None:
            logger.info("Vision worker already running (pid=%s)", _worker_process.pid)
            return

        root_dir = Path(__file__).resolve().parents[1]
        cmd = [sys.executable, "-m", "api.workers.vision_supervisor"]
        env = os.environ.copy()
        env.setdefault("FASTAPI_BASE_URL", settings.worker_fastapi_base_url.rstrip("/"))
        logger.info("Starting vision worker via %s", " ".join(cmd))
        try:
            _worker_process = subprocess.Popen(cmd, cwd=root_dir, env=env)
            logger.info("Vision worker launched (pid=%s)", _worker_process.pid)
        except Exception as exc:  # pragma: no cover - startup failure
            logger.exception("Failed to start vision worker: %s", exc)
            _worker_process = None


def _stop_worker_process() -> None:
    with _worker_lock:
        global _worker_process
        if not _worker_process:
            return

        proc = _worker_process
        _worker_process = None
        if proc.poll() is not None:
            return

        logger.info("Stopping vision worker (pid=%s)", proc.pid)
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            logger.warning("Vision worker did not exit in time; killing")
            proc.kill()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Vision Navigation API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", response_model=HealthResponse)
    def healthcheck() -> HealthResponse:  # pragma: no cover - trivial
        return HealthResponse(status="ok", timestamp=dt.datetime.now(dt.timezone.utc))

    @app.on_event("startup")
    async def _launch_workers() -> None:  # pragma: no cover - integration
        _start_worker_process()

    @app.on_event("shutdown")
    async def _shutdown_workers() -> None:  # pragma: no cover - integration
        _stop_worker_process()

    app.include_router(livekit.router, prefix=settings.api_prefix)
    app.include_router(navigation.router, prefix=settings.api_prefix)
    app.include_router(tts.router, prefix=settings.api_prefix)
    return app


app = create_app()
