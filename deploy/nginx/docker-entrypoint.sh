#!/bin/sh
set -eu

: "${DOMAIN:?DOMAIN is required}"

# Only substitute ${DOMAIN}; nginx $variables stay as $$ in the template.
envsubst '${DOMAIN}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
