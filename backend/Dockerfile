FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends graphviz graphviz-dev gcc g++ \
    && pip install --no-cache-dir uv \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

RUN mkdir -p /app/backend/data

COPY app ./backend/app
COPY default_assets ./backend/default_assets

ENV PATH="/app/.venv/bin:$PATH"
ENV OASIS_DATA_DIR="/app/backend/data"

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
