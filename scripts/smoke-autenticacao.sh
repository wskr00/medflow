#!/usr/bin/env bash

set -euo pipefail

auth_base_url="${MEDFLOW_AUTH_BASE_URL:-http://localhost:8085}"
api_base_url="${MEDFLOW_API_BASE_URL:-http://localhost:8080}"

for local_url in "$auth_base_url" "$api_base_url"; do
  case "$local_url" in
    http://localhost:*|http://127.0.0.1:*) ;;
    *) echo "O smoke aceita somente serviços locais sintéticos." >&2; exit 2 ;;
  esac
done

for command in curl jq; do
  command -v "$command" >/dev/null || {
    echo "Comando obrigatório ausente: $command" >&2
    exit 2
  }
done

smoke_dir="$(mktemp -d)"
admin_token=""
restore_realm=false
restore_frontend_url=false

cleanup() {
  if [[ "$restore_realm" == true && -n "$admin_token" ]]; then
    curl --silent --fail --output /dev/null --request PUT \
      "$auth_base_url/admin/realms/medflow" \
      --header "Authorization: Bearer $admin_token" \
      --header 'Content-Type: application/json' \
      --data '{"accessTokenLifespan":300}' || true
  fi
  if [[ "$restore_frontend_url" == true && -n "$admin_token" ]]; then
    curl --silent --fail --output /dev/null --request PUT \
      "$auth_base_url/admin/realms/medflow" \
      --header "Authorization: Bearer $admin_token" \
      --header 'Content-Type: application/json' \
      --data '{"attributes":{}}' || true
  fi
  rm -r -- "$smoke_dir"
}
trap cleanup EXIT

token_for() {
  local realm="$1" client_id="$2" username="$3" password="$4" client_secret="${5:-}"
  local args=(
    --silent --fail --request POST
    "$auth_base_url/realms/$realm/protocol/openid-connect/token"
    --data-urlencode grant_type=password
    --data-urlencode "client_id=$client_id"
    --data-urlencode "username=$username"
    --data-urlencode "password=$password"
  )
  if [[ -n "$client_secret" ]]; then
    args+=(--data-urlencode "client_secret=$client_secret")
  fi
  curl "${args[@]}" | jq -er '.access_token'
}

assert_status() {
  local expected="$1" actual="$2" label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "$label: esperado HTTP $expected, recebido $actual" >&2
    exit 1
  fi
}

health_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "$api_base_url/actuator/health")"
assert_status 200 "$health_status" "Actuator health"

anonymous_status="$(curl --silent --dump-header "$smoke_dir/anonymous.headers" \
  --output "$smoke_dir/anonymous.json" --write-out '%{http_code}' "$api_base_url/api/me")"
assert_status 401 "$anonymous_status" "Requisição sem token"
jq -e '.code == "NAO_AUTENTICADO" and (.requestId | length > 0)' \
  "$smoke_dir/anonymous.json" >/dev/null
grep -qi '^WWW-Authenticate: Bearer' "$smoke_dir/anonymous.headers"
grep -qi '^X-Request-Id:' "$smoke_dir/anonymous.headers"

patient_token="$(token_for medflow medflow-test paciente paciente medflow-test-secret)"
jq -Rn --arg token "$patient_token" '
  $token | split(".")[1] | @base64d | fromjson |
  select(.iss | endswith("/realms/medflow")) |
  select(.aud == "medflow-api") |
  select(.exp > now) |
  select(.resource_access["medflow-api"].roles | index("PATIENT"))
' >/dev/null

valid_status="$(curl --silent --output "$smoke_dir/me.json" --write-out '%{http_code}' \
  --header "Authorization: Bearer $patient_token" "$api_base_url/api/me")"
assert_status 200 "$valid_status" "Token válido"
jq -e '.roles == ["PATIENT"] and .pacienteId == null and .medicoId == null and .clinicaId == null' \
  "$smoke_dir/me.json" >/dev/null

wrong_audience_token="$(token_for medflow medflow-test-no-audience paciente paciente \
  medflow-test-no-audience-secret)"
jq -eRn --arg token "$wrong_audience_token" '
  $token | split(".")[1] | @base64d | fromjson |
  select(.iss | endswith("/realms/medflow")) |
  select(.aud != "medflow-api")
' >/dev/null
wrong_audience_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --header "Authorization: Bearer $wrong_audience_token" "$api_base_url/api/me")"
assert_status 401 "$wrong_audience_status" "Token sem audiência medflow-api"

admin_token="$(token_for master admin-cli admin admin)"
curl --silent --fail --output /dev/null --request PUT \
  "$auth_base_url/admin/realms/medflow" \
  --header "Authorization: Bearer $admin_token" \
  --header 'Content-Type: application/json' \
  --data '{"attributes":{"frontendUrl":"http://wrong-issuer.invalid"}}'
restore_frontend_url=true

wrong_issuer_token="$(token_for medflow medflow-test paciente paciente medflow-test-secret)"
jq -eRn --arg token "$wrong_issuer_token" '
  $token | split(".")[1] | @base64d | fromjson |
  select(.iss == "http://wrong-issuer.invalid/realms/medflow") |
  select(.aud == "medflow-api")
' >/dev/null
wrong_issuer_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --header "Authorization: Bearer $wrong_issuer_token" "$api_base_url/api/me")"
assert_status 401 "$wrong_issuer_status" "Token com emissor incorreto"

curl --silent --fail --output /dev/null --request PUT \
  "$auth_base_url/admin/realms/medflow" \
  --header "Authorization: Bearer $admin_token" \
  --header 'Content-Type: application/json' \
  --data '{"attributes":{}}'
restore_frontend_url=false

curl --silent --fail --output /dev/null --request PUT \
  "$auth_base_url/admin/realms/medflow" \
  --header "Authorization: Bearer $admin_token" \
  --header 'Content-Type: application/json' \
  --data '{"accessTokenLifespan":-120}'
restore_realm=true

expired_token="$(token_for medflow medflow-test paciente paciente medflow-test-secret)"
expired_at="$(jq -Rn --arg token "$expired_token" '$token | split(".")[1] | @base64d | fromjson | .exp')"
[[ "$expired_at" -lt "$(date +%s)" ]] || {
  echo "O Keycloak não emitiu o token expirado esperado para o smoke." >&2
  exit 1
}
expired_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --header "Authorization: Bearer $expired_token" "$api_base_url/api/me")"
assert_status 401 "$expired_status" "Token expirado"

echo "Smoke de autenticação passou: health, 401, JWT válido, emissor, audiência e expiração."
