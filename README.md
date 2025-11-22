# Hhackathon App Monorepo

A full-stack workspace for the Vision Navigation companion consisting of:

- **apps/mobile** – Expo (React Native) client with Google Maps, LiveKit streaming, and assistive controls.
- **apps/api** – FastAPI backend that issues LiveKit tokens, handles navigation intents/decisions, and serves server-side speech.
- **apps/api/api/workers** – YOLOv8 + supervision worker that runs alongside FastAPI to watch the LiveKit stream and push obstacle instructions.
- **packages/** (future) – Shared contracts/utilities that can be consumed by both the mobile app and backend.

## Getting started

### Prerequisites
- Node.js ≥ 18.18 with pnpm ≥ 8 (`corepack enable pnpm`).
- Python ≥ 3.11 (for FastAPI + vision service).
- LiveKit Cloud or self-hosted server (API key/secret + WebSocket URL).
- Google Maps SDK key + optional Google Cloud Text-to-Speech credentials.

### Install dependencies
```bash
pnpm install
```

### Mobile app (Expo)
```bash
cd apps/mobile
pnpm start
```
Set the required env vars before launching Metro:
```bash
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="<maps-key>"
export EXPO_PUBLIC_API_BASE_URL="http://192.168.1.5:8000"
export EXPO_PUBLIC_LIVEKIT_URL="ws://192.168.1.5:7880"
```
Then scan the QR code with Expo Go or press `a`/`i` to open a simulator. Use the **“Remote guardian stream”** button to start video streaming once the backend is running; obstacle instructions will play automatically from the FastAPI navigation endpoint.

#### Native modules / LiveKit dev client
`@livekit/react-native` and `react-native-webrtc` ship native code and cannot run inside Expo Go. If you see `...doesn't seem to be linked` errors, build a custom dev client once per platform:

```bash
cd apps/mobile
pnpm prebuild            # generates ios/ and android/ directories (run after installing native deps)
pnpm run:android         # or pnpm run:ios (requires Android Studio / Xcode)
pnpm dev-client          # starts Metro in dev-client mode for the custom build
```

On iOS you may need `cd ios && pod install` after prebuild. Re-run `pnpm prebuild` whenever you add/remove native packages so the LiveKit module stays linked.

### API server
```bash
cd apps/api
cp .env.example .env
uv run uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```
The LiveKit token endpoint will be available at `POST /api/livekit/token`. When `AUTO_START_VISION_WORKER=1` (default in `.env`), the YOLO-based navigation worker launches automatically alongside FastAPI so obstacle decisions begin streaming as soon as the server boots. Set `AUTO_START_VISION_WORKER=0` if you prefer to run the worker manually.

#### Navigation & decision endpoints
- `POST /api/navigation/destination` — store a destination (latitude/longitude) for the active LiveKit room.
- `GET /api/navigation/destination/{room}` — retrieve the last destination that the mobile client pinned.
- `POST /api/navigation/decision` — secured endpoint (requires `VISION_API_TOKEN` bearer) used by the YOLO worker to submit `MOVE_FORWARD | TURN_LEFT | TURN_RIGHT | STOP` decisions.
- `GET /api/navigation/decision/latest?room=vision-nav-room` — polled by the mobile client to announce the newest instruction.

Set `VISION_API_TOKEN` in `apps/api/.env` to secure writes; share the token with the worker via the same-named env var.

#### Google Cloud Text-to-Speech setup
1. Open the [Google Cloud Console](https://console.cloud.google.com/) and pick/create a project.
2. Go to **APIs & Services → Enable APIs and Services**, search for **Cloud Text-to-Speech API**, and enable it.
3. Navigate to **IAM & Admin → Service Accounts**, create a new service account, and add a key → JSON. Download the JSON file.
4. In `apps/api/.env`, set `GOOGLE_CREDENTIALS_FILE=/absolute/path/to/key.json`. If you can’t host files, paste the JSON into `GOOGLE_CREDENTIALS_JSON='{"type":"service_account",...}'`.
5. Optionally tweak `TTS_VOICE`/`TTS_LANGUAGE_CODE` to switch voices.
6. Restart `uvicorn`. You can now call `POST /api/tts/speak` with `{ "text": "Obstacle ahead" }` to receive a base64 MP3 payload that the mobile app plays via `expo-av`.

### Vision service prototype
```bash
pnpm vision:run
```
The command runs `python -m api.workers.vision_supervisor` within the FastAPI virtual environment. This is now optional if `AUTO_START_VISION_WORKER=1` because the API server launches the worker automatically, but keeping the script available is useful for debugging or custom deployments. By default it joins your LiveKit room using `LIVEKIT_URL`, subscribes to the walker’s camera stream, performs YOLOv8 segmentation, and posts decisions to `/api/navigation/decision` every ~500ms. Set the following env vars in `apps/api/.env` (or your shell) before launching:

- `VISION_USE_LIVEKIT=1` to pull frames from LiveKit (set to `0` to fall back to `VIDEO_SOURCE` / webcam input).
- `VISION_IDENTITY=vision-supervisor` so the worker is identifiable inside the room.
- `FASTAPI_BASE_URL` (or `WORKER_FASTAPI_BASE_URL`), `VISION_API_TOKEN` for authenticated decision posts.
- `YOLO_MODEL_PATH`, `VISION_MIN_CONF`, `VISION_COST_THRESHOLD`, `VISION_DISPLAY` for detection tuning.

Ensure the LiveKit credentials (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) match the backend `.env` so the worker can mint its own access token.

## Project scripts
| Command | Description |
| --- | --- |
| `pnpm dev:mobile` | Start Expo dev server (runs from repo root). |
| `pnpm api:dev` | Launch FastAPI via Uvicorn using `uv`. |
| `pnpm vision:run` | Run the YOLO-based navigation supervisor (now inside `apps/api`). |
| `pnpm --filter @hhackathon/mobile prebuild` | Generate native projects so LiveKit can link. |
| `pnpm --filter @hhackathon/mobile run:android` | Build/install the Android custom dev client. |
| `pnpm lint` | Run TypeScript checks for the mobile app. |

## Folder structure
```
apps/
  mobile/      # Expo client
  api/         # FastAPI backend + workers
    api/
      workers/ # computer-vision supervisor
packages/      # shared libraries (placeholder)
```

## Next steps
- Implement authenticated endpoints for destination intents and navigation decisions.
- Wire the vision service to LiveKit’s subscriber SDK instead of local camera when available.
- Move shared DTOs into `packages/contracts` and generate both TS + Pydantic models automatically.
- Add CI to build/test both the Expo and FastAPI projects.
