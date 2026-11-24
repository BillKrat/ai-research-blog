#!/usr/bin/env bash
# Points the production client build at this installation's API (deploy-angular.yml calls it; run it by hand with the same variables to test).
#
#   API_URL      optional, a full https address of the API site, for example https://acct-site9.ftempurl.com
#                (an installation on temporary addresses: the API site's own temporary address, which has a free certificate).
#                No path, no port, no credentials; https only. It wins over SITE_DOMAIN.
#   SITE_DOMAIN  optional, a bare domain name; the API is then https://api.<SITE_DOMAIN>.
#   With neither set the file keeps this project's own address.
#
# Usage: set-api-url.sh <path to environment.production.ts>
set -euo pipefail

file="${1:?usage: set-api-url.sh <environment.production.ts>}"
api_url="${API_URL:-}"
site_domain="${SITE_DOMAIN:-}"
target=""

if [ -n "$api_url" ]; then
  api_url="${api_url%/}"
  if ! printf '%s' "$api_url" | grep -Eq '^https://[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$'; then
    echo "::error::API_URL must be an https address with a host name only (no path, port or credentials), for example https://acct-site9.ftempurl.com"
    exit 1
  fi
  target="$api_url"
elif [ -n "$site_domain" ]; then
  case "$site_domain" in *[!a-zA-Z0-9.-]*) echo "::error::SITE_DOMAIN must be a bare domain name"; exit 1;; esac
  target="https://api.${site_domain}"
fi

if [ -n "$target" ]; then
  sed -i "s|apiUrl: '[^']*'|apiUrl: '${target}'|" "$file"
  grep apiUrl "$file"
fi
