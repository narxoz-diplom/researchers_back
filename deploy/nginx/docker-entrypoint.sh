#!/bin/sh
set -eu

: "${DOMAIN:?DOMAIN is required}"

# Only substitute ${DOMAIN}; nginx $variables stay as $$ in the template.
envsubst '${DOMAIN}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Landing subdomain: enabled only once its certificate exists, otherwise nginx
# would refuse to start. Until then its ACME challenge is answered by the
# default port-80 server above.
LANDING_DOMAIN="${LANDING_DOMAIN:-data-analysis.${DOMAIN}}"
export LANDING_DOMAIN
if [ -f "/etc/letsencrypt/live/${LANDING_DOMAIN}/fullchain.pem" ] \
  && [ -f /etc/nginx/templates/landing.conf.template ]; then
  envsubst '${LANDING_DOMAIN}' \
    < /etc/nginx/templates/landing.conf.template \
    > /etc/nginx/conf.d/landing.conf
  echo "edge: landing enabled for ${LANDING_DOMAIN}"
else
  rm -f /etc/nginx/conf.d/landing.conf
  echo "edge: landing disabled (no certificate for ${LANDING_DOMAIN} yet)"
fi

exec nginx -g 'daemon off;'
