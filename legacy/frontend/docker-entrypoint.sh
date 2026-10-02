#!/bin/sh
set -eu

: "${API_URL:=http://localhost:8000}"
: "${ENTRA_CLIENT_ID:=}"
: "${ENTRA_AUTHORITY:=}"
: "${API_SCOPE:=}"
export API_URL ENTRA_CLIENT_ID ENTRA_AUTHORITY API_SCOPE
envsubst '${API_URL} ${ENTRA_CLIENT_ID} ${ENTRA_AUTHORITY} ${API_SCOPE}' \
  < /opt/config.js.template > /usr/share/nginx/html/config.js
