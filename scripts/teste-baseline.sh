#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

qa_db_url="${MEDFLOW_DB_URL:-${SPRING_DATASOURCE_URL:-}}"
qa_db_username="${MEDFLOW_DB_USERNAME:-${SPRING_DATASOURCE_USERNAME:-}}"
qa_db_password="${MEDFLOW_DB_PASSWORD:-${SPRING_DATASOURCE_PASSWORD:-}}"

: "${qa_db_url:?Defina MEDFLOW_DB_URL ou SPRING_DATASOURCE_URL para um PostgreSQL de teste}"
: "${qa_db_username:?Defina MEDFLOW_DB_USERNAME ou SPRING_DATASOURCE_USERNAME}"
: "${qa_db_password:?Defina MEDFLOW_DB_PASSWORD ou SPRING_DATASOURCE_PASSWORD}"

export MEDFLOW_DB_URL="$qa_db_url"
export MEDFLOW_DB_USERNAME="$qa_db_username"
export MEDFLOW_DB_PASSWORD="$qa_db_password"
export SPRING_DATASOURCE_URL="$qa_db_url"
export SPRING_DATASOURCE_USERNAME="$qa_db_username"
export SPRING_DATASOURCE_PASSWORD="$qa_db_password"
export SPRING_DOCKER_COMPOSE_ENABLED=false

./gradlew build --no-daemon
npm ci
npm test -- --watch=false
npm run build
