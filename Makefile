SHELL := /bin/sh

.PHONY: help test test-backend test-frontend build package up down logs seed deploy-check

help:
	@echo "Spark IoT development commands"
	@echo "  make up             Start local/VPS Docker Compose stack"
	@echo "  make down           Stop Docker Compose stack"
	@echo "  make logs           Follow API/frontend logs"
	@echo "  make test           Run backend and frontend tests"
	@echo "  make build          Run frontend production build"
	@echo "  make package        Build Linux-safe release ZIP in outputs/"
	@echo "  make deploy-check   Validate key deploy files exist"

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f api frontend worker

seed:
	docker compose run --rm seed

test: test-backend test-frontend

test-backend:
	cd backend && python -m pytest tests -q

test-frontend:
	cd frontend && pnpm test

build:
	cd frontend && pnpm build

package:
	python scripts/package_release.py

deploy-check:
	test -f docker-compose.yml
	test -f .env.example
	test -f scripts/deploy_vps.sh
	test -f .github/workflows/ci.yml
	test -f .github/workflows/deploy-vps.yml
