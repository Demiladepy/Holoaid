# syntax=docker/dockerfile:1.7

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY api ./api
COPY yolov8n-seg.pt ./

RUN python -m pip install --upgrade pip setuptools wheel \
    && pip install .

EXPOSE 8080

CMD ["sh", "-c", "python -m api.workers.vision_supervisor & uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
