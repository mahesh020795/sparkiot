from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROD_COMPOSE = ROOT / "docker-compose.prod.yml"
DEPLOY_SCRIPT = ROOT / "scripts" / "deploy_vps.sh"
README = ROOT / "README.md"
DEPLOYMENT_DOCS = ROOT / "docs" / "deployment.md"
GIT_ATTRIBUTES = ROOT / ".gitattributes"


def test_production_compose_removes_public_database_and_cache_ports():
    compose = PROD_COMPOSE.read_text(encoding="utf-8")

    for expected in [
        "postgres:",
        "ports: !reset []",
        "valkey:",
        "api:",
        '"127.0.0.1:8000:8000"',
        "frontend:",
        '"80:80"',
        '"5173:80"',
        "mosquitto:",
        '"1883:1883"',
    ]:
        assert expected in compose

    assert '"5432:5432"' not in compose
    assert '"6379:6379"' not in compose
    assert '"0.0.0.0:8000:8000"' not in compose


def test_vps_deploy_uses_production_compose_by_default():
    script = DEPLOY_SCRIPT.read_text(encoding="utf-8")

    assert "docker-compose.prod.yml" in script
    assert 'COMPOSE_FILES="${COMPOSE_FILES:-"-f docker-compose.yml -f docker-compose.prod.yml"}"' in script
    assert "docker compose $COMPOSE_FILES up -d --build" in script
    assert "docker compose $COMPOSE_FILES ps" in script


def test_docs_explain_safe_vps_port_exposure():
    docs = README.read_text(encoding="utf-8") + "\n" + DEPLOYMENT_DOCS.read_text(encoding="utf-8")

    for expected in [
        "docker-compose.prod.yml",
        "PostgreSQL and Valkey are not exposed publicly",
        "HTTP fallback should use `http://YOUR_VPS_IP/api/v1`",
        "direct API port 8000 is bound to localhost only",
    ]:
        assert expected in docs


def test_deploy_scripts_keep_linux_line_endings():
    attributes = GIT_ATTRIBUTES.read_text(encoding="utf-8")

    assert "*.sh text eol=lf" in attributes
    assert "docker-compose*.yml text eol=lf" in attributes
