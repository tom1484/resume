FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev
COPY src ./src
RUN uv sync --frozen --no-dev

# In-process DB-driven scheduler (DECISIONS req 6) — replaces supercronic.
# A long-running process that reads ScheduleConfig from the `config` table each
# tick and triggers discovery when the cron is due; a UI edit takes effect on the
# next tick with no restart.
CMD ["uv", "run", "--no-sync", "python", "-m", "discovery.scheduler"]
