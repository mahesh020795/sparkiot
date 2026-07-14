# Spark IoT Deployment

This repository supports three workflows:

1. Local development with Docker Compose.
2. Manual VPS deployment from a GitHub checkout.
3. GitHub Actions deployment to a VPS over SSH.

## Repository layout

```text
backend/              FastAPI modular monolith
frontend/             React/Vite web dashboard
infra/mosquitto/      MQTT broker config
examples/arduino/     ESP32 and ESP8266 sketches
docs/                 API, MQTT, board testing, operations and deployment guides
scripts/              Release packaging and VPS deployment automation
.github/workflows/    CI and optional VPS deployment workflows
```

## Required VPS environment

- Debian/Ubuntu VM
- Docker Engine
- Docker Compose plugin
- Git
- At least 2 GB RAM or 1 GB RAM plus swap for builds

For the current Google Cloud VM, keep swap enabled:

```bash
free -h
```

## First deployment on VPS

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/mahesh020795/sparkiot.git ~/spark-iot
cd ~/spark-iot
cp .env.example .env
nano .env
docker compose up -d --build
docker compose ps
```

Set these values for the current demo VPS:

```env
CORS_ORIGINS=http://localhost:5173,http://localhost:8080,http://34.73.29.12:5173,http://34.73.29.12:8000
VITE_API_BASE=http://34.73.29.12:8000/api/v1
```

## Repeat deployment from VPS

After code is pushed to GitHub:

```bash
cd ~/spark-iot
git pull --ff-only origin main
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health/ready
```

Or use the deploy script:

```bash
cd ~/spark-iot
bash scripts/deploy_vps.sh
```

## GitHub Actions VPS deployment

The workflow `.github/workflows/deploy-vps.yml` deploys on pushes to `main` when these GitHub repository secrets are configured:

```text
VPS_HOST=34.73.29.12
VPS_USER=maheshvaran_rajagopal
VPS_SSH_KEY=<private SSH key allowed to access the VM>
VPS_APP_DIR=/home/maheshvaran_rajagopal/spark-iot
```

The workflow SSHes into the VPS and runs:

```bash
bash scripts/deploy_vps.sh
```

## Release ZIP

Create a Linux-safe ZIP artifact:

```bash
python scripts/package_release.py
```

The ZIP is created at `outputs/Spark-IoT-MVP.zip`. It excludes `.env`, `.git`, `node_modules`, build output, caches and local databases.

## Health checks

```bash
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready
curl http://localhost:8000/api/v1/demo/projects/project-irrigation/board-test
```

## Production hardening checklist

- Use a domain and HTTPS reverse proxy.
- Replace all default secrets in `.env`.
- Restrict public database and Valkey ports.
- Add off-server PostgreSQL backups and restore tests.
- Use a commercial-safe map tile provider.
- Add monitoring and log retention.
- Move camera relay/video streaming into a separate cost-controlled service.
