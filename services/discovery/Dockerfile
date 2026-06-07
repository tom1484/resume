FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev
COPY src ./src
COPY config ./config
RUN uv sync --frozen --no-dev
ENV CONFIG_DIR=/app/config
CMD ["uv", "run", "--no-sync", "python", "-m", "discovery.main", "--all"]
