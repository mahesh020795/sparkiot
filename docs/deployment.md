# Spark IoT Deployment

This repository supports three workflows:

1. Local development with Docker Compose.
2. Manual VPS deployment from a GitHub checkout.
3. GitHub Actions deployment to a VPS over SSH.

## Repository layout

```text
backend/              FastAPI modular monolith
frontend/             React/Vite web dashboard
arduino/SparkIoT/     Installable Arduino IDE library for ESP32 and ESP8266
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
CORS_ORIGINS=http://localhost,http://localhost:5173,http://localhost:8080,http://34.73.29.12,http://34.73.29.12:5173
VITE_API_BASE=/api/v1
```

The Docker frontend image serves the built React app with Nginx. Vite dev server is not used in the production Compose stack.
Open the current demo VPS at `http://34.73.29.12`. The compatibility URL `http://34.73.29.12:5173` is also mapped to the same Nginx container during testing.

For VPS use, prefer the deploy script instead of plain Compose. It layers `docker-compose.prod.yml` over `docker-compose.yml`, so PostgreSQL and Valkey are not exposed publicly, and the direct API port 8000 is bound to localhost only. HTTP fallback should use `http://YOUR_VPS_IP/api/v1` through Nginx, while MQTT devices continue to use public port 1883.

## Repeat deployment from VPS

After code is pushed to GitHub:

```bash
cd ~/spark-iot
git pull --ff-only origin main
bash scripts/deploy_vps.sh
curl http://localhost:8000/health/ready
```

Or use the deploy script:

```bash
cd ~/spark-iot
bash scripts/deploy_vps.sh
```

## GitHub Actions production VPS deployment

The workflow `.github/workflows/deploy-vps.yml` deploys automatically after the `ci` workflow passes on the `main` branch. This gives the production path:

```text
git push origin main
→ GitHub CI tests/build/package
→ GitHub deploy-vps
→ SSH into VPS
→ git pull + docker compose up -d --build
→ health check
```

The workflow can also be run manually from the GitHub Actions tab.

Configure these GitHub repository secrets:

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

### One-time SSH key setup

Create a dedicated deploy key on the VPS:

```bash
ssh-keygen -t ed25519 -C "github-actions-spark-iot" -f ~/.ssh/spark_iot_github_actions -N ""
cat ~/.ssh/spark_iot_github_actions.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/spark_iot_github_actions
```

Copy the private key output into GitHub secret `VPS_SSH_KEY`.

### First automatic deployment after ZIP-based deployments

If the VPS currently contains a non-git `~/spark-iot` folder from ZIP deployment, `scripts/deploy_vps.sh` safely backs it up and preserves its `.env` before cloning from GitHub.

After GitHub secrets are configured, push any commit to `main` or run `deploy-vps` manually from GitHub Actions.

### Production environment values

Keep production-only values in VPS `.env`, never in Git:

```env
ENVIRONMENT=production
CORS_ORIGINS=http://localhost,http://localhost:5173,http://localhost:8080,http://34.73.29.12,http://34.73.29.12:5173
VITE_API_BASE=/api/v1
JWT_SECRET=<long-random-secret>
```

For a domain deployment, point the domain or reverse proxy to the frontend container on port 80 and keep `VITE_API_BASE=/api/v1` so browser API and WebSocket calls stay same-origin through Nginx.

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
