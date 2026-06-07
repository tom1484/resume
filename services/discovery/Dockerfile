FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev
COPY src ./src
COPY config ./config
RUN uv sync --frozen --no-dev
ENV CONFIG_DIR=/app/config

# supercronic: cron for containers (logs to stdout, no daemon assumptions)
ARG TARGETARCH
ADD https://github.com/aptible/supercronic/releases/download/v0.2.33/supercronic-linux-${TARGETARCH} /usr/local/bin/supercronic
RUN chmod +x /usr/local/bin/supercronic
COPY crontab /app/crontab

CMD ["supercronic", "/app/crontab"]
