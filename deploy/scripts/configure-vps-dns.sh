#!/usr/bin/env bash
# Prefer public DNS on the VPS so local lookups match authoritative zones
# (avoids stale ISP resolver cache after changing A records).
#
# Usage on the VPS (as root):
#   sudo bash deploy/scripts/configure-vps-dns.sh
#
# Idempotent.

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

PRIMARY_DNS="${PRIMARY_DNS:-8.8.8.8}"
SECONDARY_DNS="${SECONDARY_DNS:-1.1.1.1}"

if systemctl is-active systemd-resolved >/dev/null 2>&1; then
  log "Configuring systemd-resolved (${PRIMARY_DNS}, ${SECONDARY_DNS})"
  install -d -m 0755 /etc/systemd/resolved.conf.d
  cat >/etc/systemd/resolved.conf.d/99-researchers-public-dns.conf <<EOF
[Resolve]
DNS=${PRIMARY_DNS} ${SECONDARY_DNS}
FallbackDNS=1.0.0.1
DNSStubListener=yes
EOF
  systemctl restart systemd-resolved
  resolvectl flush-caches 2>/dev/null || true
elif [[ -f /etc/resolv.conf ]] && ! readlink -f /etc/resolv.conf | grep -q systemd; then
  log "Configuring /etc/resolv.conf (${PRIMARY_DNS})"
  cp -a /etc/resolv.conf "/etc/resolv.conf.bak.$(date +%Y%m%d%H%M%S)"
  cat >/etc/resolv.conf <<EOF
nameserver ${PRIMARY_DNS}
nameserver ${SECONDARY_DNS}
EOF
else
  echo "ERROR: unsupported resolver setup. Configure DNS manually." >&2
  exit 1
fi

log "Verify researchers.kz"
if command -v dig >/dev/null 2>&1; then
  echo -n "  dig researchers.kz A +short → "
  dig +short researchers.kz A | head -1 || true
  echo -n "  dig @ns1.ps.kz researchers.kz A +short → "
  dig @ns1.ps.kz +short researchers.kz A | head -1 || true
else
  echo "  (install dnsutils for dig)"
fi

log "Done"
