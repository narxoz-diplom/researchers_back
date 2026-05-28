# researchers — production deployment guide

This directory hosts everything needed to run the **researchers** platform on a
single Ubuntu/Debian VPS with autodeploy from GitHub Actions, HTTPS via
Let's Encrypt, encrypted PostgreSQL backups, and basic operational hardening.

> **Делаете деплой в первый раз?** Идите в [`QUICKSTART.md`](QUICKSTART.md) —
> там линейный пошаговый чеклист с копи-пастом команд. Этот README — справочник
> для day-2 операций.

## Architecture

```
                 +-------------------+
                 |  GitHub Actions   |   build & push images to GHCR
                 |  (CI/CD + backup) |   SSH deploy + pull encrypted backups
                 +---------+---------+
                           | ssh
                           v
        +------------------+------------------+
        |                 VPS                 |
        |  +-----------+   +---------------+  |
HTTPS ->|  | edge (nginx) |->| api (NestJS) |  |
        |  | TLS, routing|   |  port 8080   |  |
        |  +-----+-------+   +-------+------+  |
        |        |                   |         |
        |        v                   v         |
        |  +-----------+      +-------------+  |
        |  | web (nginx|      | postgres 15 |  |
        |  | + static) |      | named vol   |  |
        |  +-----------+      +------+------+  |
        |                            |         |
        |                            v         |
        |                     +-------------+  |
        |                     | backup cron |  |
        |                     | pg_dump|age |  |
        |                     +-------------+  |
        +--------------------------------------+
```

| Service    | Image                                          | Role                                                |
|------------|------------------------------------------------|-----------------------------------------------------|
| `postgres` | `postgres:15-alpine`                           | DB on named volume `pg_data`. Internal only.        |
| `migrate`  | `ghcr.io/<owner>/researchers-api:<tag>`        | One-shot `prisma migrate deploy`.                   |
| `api`      | `ghcr.io/<owner>/researchers-api:<tag>`        | NestJS app, port 8080, internal.                    |
| `web`      | `ghcr.io/<owner>/researchers-web:<tag>`        | nginx serving Vite static, port 8081, internal.     |
| `edge`     | `nginx:1.27-alpine`                            | Public ports 80/443, TLS termination, SPA + API.    |
| `certbot`  | `certbot/certbot:latest`                       | Auto-renews Let's Encrypt cert every 12h.           |
| `backup`   | local (`deploy/backup`)                        | Cron-driven `pg_dump | zstd | age` to `/backups`.    |

Only `edge` exposes ports to the host; everything else is reachable over the
internal docker network.

## One-time setup

### 1. Buy & point a domain

Point your domain's A/AAAA records (`example.com` and `www.example.com`) to the
VPS IPv4/IPv6.

### 2. Provision the VPS

SSH in as root once and run the bootstrap script. It installs Docker, creates a
hardened deploy user, sets up UFW + fail2ban + unattended-upgrades, and locks
down SSH.

```bash
# As root on the fresh VPS:
curl -fsSL https://raw.githubusercontent.com/<owner>/researchers_back/main/deploy/scripts/bootstrap-vps.sh -o bootstrap-vps.sh
DEPLOY_USER=deploy \
DEPLOY_SSH_PUBKEY="ssh-ed25519 AAAA... deploy@laptop" \
bash bootstrap-vps.sh
```

After it finishes, log out and reconnect as the `deploy` user.

### 3. Lay down the project

```bash
mkdir -p ~/researchers && cd ~/researchers
git init -q
git remote add origin https://github.com/<owner>/researchers_back.git
git fetch --depth=1 origin main
git checkout -B main origin/main

cp .env.production.example .env.production
chmod 600 .env.production
$EDITOR .env.production       # fill every value, especially secrets
```

Generate secrets:

```bash
openssl rand -base64 32  # POSTGRES_PASSWORD
openssl rand -base64 64  # JWT_ACCESS_SECRET
openssl rand -base64 64  # JWT_REFRESH_SECRET
```

### 4. Generate the AGE backup key

On a **trusted laptop** (NOT on the VPS):

```bash
# install age first: brew install age   OR   apt install age
age-keygen -o ~/researchers-backup.age
cat ~/researchers-backup.age
# # created: 2026-...
# # public key: age1xyz...
# AGE-SECRET-KEY-1...
```

- Copy the `age1...` public key into `.env.production` as `BACKUP_AGE_RECIPIENT`.
- Store `AGE-SECRET-KEY-1...` offline (password manager, hardware token, etc.).
  **Without this key, encrypted backups cannot be restored.**

### 5. Log in to GHCR on the VPS

The images are private by default. The deploy workflow re-logs in on every run,
but the first manual bring-up needs a local login:

```bash
# Create a PAT with `read:packages` and run:
echo "$GHCR_PAT" | docker login ghcr.io -u <github-user> --password-stdin
```

### 6. Issue the initial TLS certificate

```bash
cd ~/researchers
bash deploy/scripts/issue-cert.sh --staging   # sanity-check
bash deploy/scripts/issue-cert.sh             # real cert
```

### 7. First deploy

```bash
bash deploy/scripts/deploy.sh
```

Then verify:

```bash
curl -fsS https://${DOMAIN}/api/v1/health
curl -fsS https://${DOMAIN}/healthz
curl -fsS https://${DOMAIN}/
```

## GitHub configuration

In **both** repos (`researchers_back`, `researchers_front`), under
`Settings → Environments → production`, add:

| Secret           | Value                                      |
|------------------|--------------------------------------------|
| `VPS_HOST`       | VPS IPv4                                   |
| `VPS_USER`       | `deploy`                                   |
| `VPS_SSH_KEY`    | OpenSSH **private** key matching the deploy user's `authorized_keys` |
| `VPS_PORT`       | SSH port (default `22`)                    |
| `PROD_DOMAIN` (variable) | `example.com`                      |

In **`researchers_front`** only, also add a variable:

| Variable        | Value                                      |
|-----------------|--------------------------------------------|
| `VITE_API_URL`  | `https://example.com/api/v1`               |

The default `GITHUB_TOKEN` is used to push images to GHCR; no extra secret
needed. Make sure the package visibility is set appropriately under
`https://github.com/<owner>?tab=packages`.

## Day-2 operations

### Manual seed (one-off — does NOT run on every start)

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  run --rm api npm run seed
```

### Roll back

```bash
bash deploy/scripts/rollback.sh
# or:
bash deploy/scripts/rollback.sh sha-abcdef0123 sha-fedcba9876
```

### Restore from an encrypted backup

```bash
# 1. Put the encrypted dump on the VPS, e.g. ~/restore.sql.zst.age
# 2. Put your age IDENTITY (private key) in a temp file:
echo "AGE-SECRET-KEY-1..." > /tmp/age-identity.txt
chmod 600 /tmp/age-identity.txt

# 3. Decrypt + restore through the backup container:
docker compose --env-file .env.production -f docker-compose.prod.yml \
  run --rm \
  -v /tmp/age-identity.txt:/run/secrets/age-identity.txt:ro \
  -v ~/restore.sql.zst.age:/backups/restore.sql.zst.age:ro \
  backup /usr/local/bin/restore.sh /backups/restore.sql.zst.age

# 4. Wipe the identity file:
shred -u /tmp/age-identity.txt
```

To rehearse against a throw-away database (highly recommended, every quarter):

```bash
docker run --rm -d --name pgtest -e POSTGRES_PASSWORD=t -p 55432:5432 postgres:15-alpine
POSTGRES_HOST=host.docker.internal POSTGRES_PORT=55432 \
POSTGRES_USER=postgres POSTGRES_PASSWORD=t POSTGRES_DB=postgres \
  bash deploy/backup/restore.sh ./pg-backup-XXXX.sql.zst.age
```

### Tail logs

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  logs -f --tail=200 api edge web postgres backup
```

Logs are rotated automatically (`json-file`, 10 MB × 5 per container).

### Disk usage

```bash
docker system df
docker volume ls
du -sh /var/lib/docker/volumes/*
```

### Recovery from scratch (disaster)

1. Provision a fresh VPS with `bootstrap-vps.sh`.
2. `git clone` the repo into `~/researchers`.
3. Recreate `.env.production` from your password manager.
4. Re-issue TLS: `bash deploy/scripts/issue-cert.sh`.
5. Bring stack up: `bash deploy/scripts/deploy.sh`.
6. Pull the latest encrypted backup (`pg-backup-*.sql.zst.age`) from GitHub
   Actions artifacts.
7. Run the restore procedure above.

## Monitoring & alerting

### Built-in checks

- `GET https://${DOMAIN}/api/v1/health` — DB-aware health (HTTP 503 if Postgres is unreachable).
- `GET https://${DOMAIN}/api/v1/health/live` — process liveness only.
- `GET https://${DOMAIN}/healthz` — edge nginx liveness.
- Docker `HEALTHCHECK` directives keep restarts honest for `api`, `web`,
  `edge`, `postgres`.

### Recommended external monitors

Pick at least one external uptime probe (free tiers are fine):

| Tool         | What to monitor                              |
|--------------|----------------------------------------------|
| Uptime Kuma  | Self-host elsewhere; HTTP probes + alerts.   |
| BetterStack / UptimeRobot / Hetzner | External 1-min HTTP checks on the URLs above. |
| Cron-monitor (cronitor.io etc.) | Pings from the `backup` cron — alert if a backup is skipped. |

Configure them to alert on:
- `/healthz` and `/api/v1/health` going non-2xx.
- TLS certificate expiry within 14 days.
- Missing daily backup (no GitHub `pull` workflow success for 2+ days).

### Logs / metrics expansion (later)

The current stack writes JSON logs locally with rotation. When you outgrow this:
- Add Loki + Promtail + Grafana for centralized logs.
- Add cAdvisor + node_exporter + Prometheus for metrics.
- Move PostgreSQL to a managed service (DO/Hetzner/Neon/Supabase).

## Limits of a single-VPS deployment

| Risk                         | Mitigation here                              | Future fix                          |
|------------------------------|----------------------------------------------|-------------------------------------|
| VPS host failure             | None — single host                           | Multi-VPS + load balancer           |
| DC-wide outage               | None                                          | Multi-region failover               |
| PostgreSQL corruption        | Encrypted daily backups + GitHub retention   | Managed Postgres with PITR          |
| Image registry outage (GHCR) | Old image stays running                       | Mirror GHCR -> private registry     |
| Single SSH key compromise    | UFW + fail2ban + key-only SSH                | Bastion + hardware token            |

If you need real high availability later, the modules in this repo already
support it: stateless API behind a load balancer, Cloudinary for media, and the
DB is the only stateful piece to lift out.
