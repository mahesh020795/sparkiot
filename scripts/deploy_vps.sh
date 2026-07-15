#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/spark-iot}"
REPO_URL="${REPO_URL:-https://github.com/mahesh020795/sparkiot.git}"
BRANCH="${BRANCH:-main}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/spark-iot-backups}"

echo "Spark IoT deploy"
echo "APP_DIR=$APP_DIR"
echo "REPO_URL=$REPO_URL"
echo "BRANCH=$BRANCH"

mkdir -p "$BACKUP_DIR"
PRESERVED_ENV="$BACKUP_DIR/.env.preserved"
rm -f "$PRESERVED_ENV"

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
else
  if [ -d "$APP_DIR" ]; then
    if [ -f "$APP_DIR/.env" ]; then
      cp "$APP_DIR/.env" "$PRESERVED_ENV"
    fi
    mv "$APP_DIR" "$BACKUP_DIR/spark-iot-$(date +%Y%m%d-%H%M%S)"
  fi
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  if [ -f "$PRESERVED_ENV" ]; then
    cp "$PRESERVED_ENV" .env
  fi
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Edit production secrets before public launch."
fi

docker compose up -d --build
docker update --restart unless-stopped \
  spark-iot-postgres-1 \
  spark-iot-valkey-1 \
  spark-iot-mosquitto-1 \
  spark-iot-api-1 \
  spark-iot-worker-1 \
  spark-iot-frontend-1 >/dev/null

docker compose ps
curl -fsS http://localhost:8000/health/ready >/dev/null
curl -fsS http://localhost/health/frontend >/dev/null
echo "Deploy complete: API and frontend ready"
