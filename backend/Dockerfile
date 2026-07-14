FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN adduser --disabled-password --gecos "" spark
COPY pyproject.toml ./
RUN pip install --no-cache-dir ".[dev]"
COPY app ./app
USER spark
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
