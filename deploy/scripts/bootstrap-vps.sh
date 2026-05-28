#!/usr/bin/env bash
# One-time VPS provisioning. Run as root (e.g. via `sudo bash bootstrap-vps.sh`)
# on a fresh Ubuntu/Debian VPS.
#
# What it does:
#   1. Apt-update + install base packages (curl, ufw, fail2ban, unattended-upgrades).
#   2. Install Docker Engine + compose plugin from official Docker apt repo.
#   3. Create a deploy user with docker access and authorized SSH key.
#   4. Harden SSH (key-only, no root login, no password auth).
#   5. Configure UFW (allow 22, 80, 443; default deny inbound).
#   6. Enable fail2ban with SSH and nginx jails.
#   7. Enable unattended security upgrades.
#
# Required env (export or pass via `VAR=val bash bootstrap-vps.sh`):
#   DEPLOY_USER        username to create (default: deploy)
#   DEPLOY_SSH_PUBKEY  full ssh public key string for the deploy user
#
# Idempotent: safe to re-run.

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_SSH_PUBKEY="${DEPLOY_SSH_PUBKEY:-}"

if [[ -z "${DEPLOY_SSH_PUBKEY}" ]]; then
  echo "ERROR: DEPLOY_SSH_PUBKEY env is required." >&2
  echo "Example: DEPLOY_SSH_PUBKEY='ssh-ed25519 AAAA...' bash $0" >&2
  exit 1
fi

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

log "Apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg ufw fail2ban unattended-upgrades \
  apt-transport-https software-properties-common

log "Install Docker Engine"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | \
    gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

log "Create deploy user ${DEPLOY_USER}"
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
fi
usermod -aG docker "${DEPLOY_USER}"

DEPLOY_HOME="$(getent passwd "${DEPLOY_USER}" | cut -d: -f6)"
install -d -m 700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${DEPLOY_HOME}/.ssh"
AUTHORIZED="${DEPLOY_HOME}/.ssh/authorized_keys"
touch "${AUTHORIZED}"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${AUTHORIZED}"
chmod 600 "${AUTHORIZED}"
if ! grep -qxF "${DEPLOY_SSH_PUBKEY}" "${AUTHORIZED}"; then
  echo "${DEPLOY_SSH_PUBKEY}" >> "${AUTHORIZED}"
fi

log "Harden SSH"
SSHD_CONF=/etc/ssh/sshd_config
cp -n "${SSHD_CONF}" "${SSHD_CONF}.bak.$(date +%Y%m%d%H%M%S)"
set_sshd() {
  local key="$1" val="$2"
  if grep -qE "^[#[:space:]]*${key}\b" "${SSHD_CONF}"; then
    sed -ri "s|^[#[:space:]]*${key}\b.*|${key} ${val}|" "${SSHD_CONF}"
  else
    echo "${key} ${val}" >> "${SSHD_CONF}"
  fi
}
set_sshd PermitRootLogin no
set_sshd PasswordAuthentication no
set_sshd ChallengeResponseAuthentication no
set_sshd KbdInteractiveAuthentication no
set_sshd UsePAM yes
set_sshd X11Forwarding no
set_sshd PermitEmptyPasswords no
sshd -t
systemctl reload ssh || systemctl reload sshd

log "Configure UFW"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

log "Configure fail2ban"
cat > /etc/fail2ban/jail.d/researchers.local <<'JAIL'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime  = 1h

[nginx-http-auth]
enabled = true
maxretry = 5
findtime = 10m
bantime  = 1h
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban

log "Enable unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades || true
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'AUTO'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUTO
systemctl enable --now unattended-upgrades

log "Done."
echo
echo "Next steps:"
echo "  1. Log in as ${DEPLOY_USER}: ssh ${DEPLOY_USER}@<vps-ip>"
echo "  2. Place the repo + .env.production under ~/researchers/."
echo "  3. Run deploy/scripts/issue-cert.sh to get the initial Let's Encrypt cert."
echo "  4. Run deploy/scripts/deploy.sh to bring the stack up."
