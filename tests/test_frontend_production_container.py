from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DOCKERFILE = ROOT / "frontend" / "Dockerfile"
FRONTEND_NGINX = ROOT / "frontend" / "nginx.conf"
COMPOSE = ROOT / "docker-compose.yml"
README = ROOT / "README.md"
DEPLOYMENT_DOCS = ROOT / "docs" / "deployment.md"
DEPLOY_SCRIPT = ROOT / "scripts" / "deploy_vps.sh"


def test_frontend_container_serves_static_production_build():
    dockerfile = FRONTEND_DOCKERFILE.read_text(encoding="utf-8")

    assert "FROM node:22-alpine AS build" in dockerfile
    assert "pnpm build" in dockerfile
    assert "FROM nginx:1.27-alpine" in dockerfile
    assert "COPY --from=build /app/dist /usr/share/nginx/html" in dockerfile
    assert 'CMD ["pnpm", "dev", "--host", "0.0.0.0"]' not in dockerfile


def test_frontend_nginx_supports_spa_routing_and_api_proxy():
    nginx = FRONTEND_NGINX.read_text(encoding="utf-8")

    for expected in [
        "listen 80;",
        "try_files $uri $uri/ /index.html;",
        "location /api/",
        "proxy_pass http://api:8000/api/",
        "location /health/frontend",
        "location = /health/live",
        "location = /health/ready",
        "proxy_pass http://api:8000/health/live;",
        "proxy_pass http://api:8000/health/ready;",
    ]:
        assert expected in nginx


def test_compose_exposes_production_frontend_on_port_80_with_5173_compatibility():
    compose = COMPOSE.read_text(encoding="utf-8")

    assert "frontend:" in compose
    assert '"80:80"' in compose
    assert '"5173:80"' in compose
    assert "VITE_API_BASE: ${VITE_API_BASE:-/api/v1}" in compose
    assert "VITE_MQTT_HOST: ${VITE_MQTT_HOST:-iot.rectronx.com}" in compose
    assert "VITE_MQTT_PORT: ${VITE_MQTT_PORT:-1883}" in compose


def test_docs_explain_production_frontend_not_vite_dev_server():
    docs = README.read_text(encoding="utf-8") + "\n" + DEPLOYMENT_DOCS.read_text(encoding="utf-8")

    for expected in [
        "The Docker frontend image serves the built React app with Nginx",
        "http://iot.rectronx.com",
        "http://iot.rectronx.com:5173",
        "Vite dev server is not used in the production Compose stack",
    ]:
        assert expected in docs


def test_deploy_script_checks_api_and_frontend_health():
    script = DEPLOY_SCRIPT.read_text(encoding="utf-8")

    assert "curl -fsS http://localhost:8000/health/ready" in script
    assert "curl -fsS http://localhost/health/frontend" in script
    assert "Deploy complete: API and frontend ready" in script
