# Пошаговый деплой на VPS (с нуля)

Этот документ — линейный чеклист. Делайте шаги **строго по порядку**. Каждый
блок: что подготовить → команды на ноуте → команды на VPS → проверка.

Везде в примерах используются плейсхолдеры, замените их на свои:

| Плейсхолдер              | Что это                                                 |
|--------------------------|---------------------------------------------------------|
| `203.0.113.10`           | IP вашего VPS                                           |
| `example.com`            | ваш домен (без `www`, без `https://`)                   |
| `your-github-user`       | ваш GitHub username **строго в нижнем регистре**        |
| `you@example.com`        | ваш email (для Let's Encrypt уведомлений)               |

> Подсказка: открывайте этот файл рядом и **по одному** копируйте блоки.

---

## Часть 0. Что нужно подготовить ДО начала

- [ ] VPS с Ubuntu 22.04+ или Debian 12+ и **root SSH-доступом** по паролю или ключу.
- [ ] Доменное имя, A-запись `example.com` и `www.example.com` уже указывают на IP VPS.
      Проверьте с ноута:
      ```bash
      dig +short example.com
      dig +short www.example.com
      # должны вернуть 203.0.113.10
      ```
      Если запись только что добавили — подождите 5–30 минут.
- [ ] Установлен Git и доступ к двум репозиториям на GitHub:
      `researchers_back` и `researchers_front`. Оба запушены в `main`.
- [ ] На ноуте установлены: `ssh`, `openssl`, `age`.
      ```bash
      # macOS:
      brew install age
      # Linux (Debian/Ubuntu):
      sudo apt install age openssh-client
      ```

---

## Часть 1. SSH-ключ для деплой-пользователя (на ноуте)

Это ключ, которым будет ходить GitHub Actions и которым будете ходить вы под
непривилегированным пользователем `deploy`. Никогда не пушьте его в git.

```bash
# На ноуте
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/researchers_deploy -C "researchers-deploy" -N ""
```

Получите оба ключа:
```bash
cat ~/.ssh/researchers_deploy.pub   # ПУБЛИЧНЫЙ — пойдёт на VPS
cat ~/.ssh/researchers_deploy       # ПРИВАТНЫЙ — пойдёт в GitHub Secret
```

Сохраните оба значения куда-нибудь временно (текстовый редактор / стикер в
менеджере паролей). Дальше будем использовать их как:

- `<DEPLOY_SSH_PUBKEY>` — строка `ssh-ed25519 AAAA... researchers-deploy`
- `<DEPLOY_SSH_PRIVKEY>` — многострочный приватный ключ (`-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END OPENSSH PRIVATE KEY-----`)

---

## Часть 2. AGE-ключ для шифрования бэкапов БД (на ноуте)

Этот ключ нужен, чтобы расшифровать дампы PostgreSQL. **Без него восстановить
базу невозможно.** Создаём его ОДИН РАЗ на ноуте, приватный ключ хранится
офлайн.

```bash
# На ноуте
age-keygen -o ~/researchers-backup.age
cat ~/researchers-backup.age
```

Вывод выглядит так:

```
# created: 2026-05-28T17:00:00Z
# public key: age1zh9q8h8x...example...
AGE-SECRET-KEY-1Q...example...
```

Запомните:

- Строка `age1...` — **публичный** ключ. Пойдёт в `.env.production` на VPS как
  `BACKUP_AGE_RECIPIENT`. Её можно показывать кому угодно.
- Строка `AGE-SECRET-KEY-1...` — **приватный** ключ. Положите его в менеджер
  паролей (1Password, Bitwarden, KeePass) и **сотрите** файл `~/researchers-backup.age`
  с ноута после копирования:
  ```bash
  shred -u ~/researchers-backup.age 2>/dev/null || rm -P ~/researchers-backup.age
  ```

---

## Часть 3. Генерация секретов (на ноуте)

Сгенерируйте 3 значения, запишите их рядом — будут вставлены в `.env.production`:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
```

Пример вывода (у вас будут другие значения):

```
POSTGRES_PASSWORD=cMl3xQwR0bN9k2vTpY4uHsF6gJa1iE7d
JWT_ACCESS_SECRET=z3K2...очень длинная строка...==
JWT_REFRESH_SECRET=Qp9...очень длинная строка...==
```

---

## Часть 4. Подготовка `.env.production` локально (на ноуте)

Это самый важный шаг. Делаем файл **на ноуте**, потом скопируем на VPS. В git
он не попадёт (уже в `.gitignore`).

В папке backend-репо на ноуте:

```bash
cd ~/WebstormProjects/researchers_back
cp .env.production.example .env.production
chmod 600 .env.production
```

Откройте `.env.production` в редакторе и **подставьте каждое значение**. Ниже —
полный пример заполненного файла. Замените плейсхолдеры на свои.

```ini
# --- Domain & TLS -------------------------------------------------------------
DOMAIN=example.com
ACME_EMAIL=you@example.com

# --- Container images ---------------------------------------------------------
# Ваш GitHub username/org в НИЖНЕМ РЕГИСТРЕ.
IMAGE_OWNER=your-github-user
API_IMAGE_TAG=latest
WEB_IMAGE_TAG=latest

# --- API runtime --------------------------------------------------------------
NODE_ENV=production
PORT=8080
TRUST_PROXY=1
SWAGGER_ENABLED=

# --- Database -----------------------------------------------------------------
POSTGRES_USER=researchers
POSTGRES_PASSWORD=cMl3xQwR0bN9k2vTpY4uHsF6gJa1iE7d
POSTGRES_DB=researchers

# --- JWT ----------------------------------------------------------------------
JWT_ACCESS_SECRET=z3K2...вставьте_из_части_3...==
JWT_REFRESH_SECRET=Qp9...вставьте_из_части_3...==
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# --- CORS / frontend ----------------------------------------------------------
CORS_ORIGINS=https://example.com
FRONTEND_URL=https://example.com

# --- Cloudinary (если используете — иначе можно оставить пустыми) ------------
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# --- SMTP (можно оставить пустыми — письма будут падать в логи) --------------
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=Researchers.kz <noreply@example.com>

# --- Admin seed ---------------------------------------------------------------
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=ChangeMeStrongAdminPass1!

# --- Backups ------------------------------------------------------------------
BACKUP_CRON=0 3 * * *
BACKUP_RETENTION_DAYS=14
BACKUP_AGE_RECIPIENT=age1zh9q8h8x...вставьте_из_части_2...
```

Перепроверьте, что заполнены **все** поля кроме опциональных (Cloudinary/SMTP).

---

## Часть 5. Первое подключение к VPS и bootstrap (на ноуте → VPS)

### 5.1. Подключитесь как root

```bash
ssh root@203.0.113.10
```

Если у вас в провайдере был пароль — введите его. На некоторых хостингах
рут-аккаунта нет — войдите тем пользователем, которого дали, и поднимитесь до
root через `sudo -i`.

### 5.2. Запустите bootstrap-скрипт

Скрипт лежит в репозитории. Самый простой способ — скачать его прямо с GitHub.

> Замените `your-github-user` на ваш ник, `main` — на актуальную ветку.

```bash
# На VPS, как root
curl -fsSL https://raw.githubusercontent.com/your-github-user/researchers_back/main/deploy/scripts/bootstrap-vps.sh -o /root/bootstrap-vps.sh
chmod +x /root/bootstrap-vps.sh
```

Запустите со своим публичным ключом из части 1. **Кавычки обязательны**:

```bash
# На VPS, как root
DEPLOY_USER=deploy \
DEPLOY_SSH_PUBKEY="ssh-ed25519 AAAA...полная_строка_публичного_ключа... researchers-deploy" \
bash /root/bootstrap-vps.sh
```

Скрипт сделает:
1. Установит Docker + Compose.
2. Создаст пользователя `deploy` с docker-доступом.
3. Положит ваш публичный ключ в `~/.ssh/authorized_keys` для `deploy`.
4. Отключит root SSH и парольный вход.
5. Включит UFW (только порты 22/80/443).
6. Включит fail2ban и автообновления безопасности.

Когда увидите `Done.` — выйдите:

```bash
exit
```

### 5.3. Проверьте, что заходите под `deploy` своим новым ключом

С ноута:

```bash
ssh -i ~/.ssh/researchers_deploy deploy@203.0.113.10
```

Должны попасть в шелл без запроса пароля. Если не получилось — **не закрывайте**
старый root-терминал, у вас всё ещё открыта возможность поправить SSH.

Удобнее добавить алиас. На ноуте дополните `~/.ssh/config`:

```bash
cat >> ~/.ssh/config <<'EOF'

Host researchers-vps
    HostName 203.0.113.10
    User deploy
    IdentityFile ~/.ssh/researchers_deploy
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

Теперь подключение — `ssh researchers-vps`.

---

## Часть 6. Загрузка проекта на VPS

Сейчас на VPS пусто. Нужно положить туда docker-compose.prod.yml и папку
`deploy/`. Способа два — выберите один.

### 6А. Через git clone (рекомендуется, если репо публичный)

```bash
# Сначала с ноута:
ssh researchers-vps
# Дальше уже на VPS как deploy:
mkdir -p ~/researchers && cd ~/researchers
git init -q
git remote add origin https://github.com/your-github-user/researchers_back.git
git fetch --depth=1 origin main
git checkout -B main origin/main
```

> Если репозиторий **приватный**, используйте либо `git clone https://<token>@github.com/...`,
> либо `git clone git@github.com:your-github-user/researchers_back.git` через
> deploy-key. Самый просто способ — создать в репо **Deploy key** в Settings →
> Deploy keys и положить приватную часть в `~/.ssh/id_ed25519` на VPS.

### 6Б. Через rsync с ноута (если репо приватный без токена)

```bash
# На ноуте, из ~/WebstormProjects/researchers_back:
rsync -avz --delete \
  --exclude node_modules --exclude dist --exclude .git \
  --exclude .env --exclude .env.production \
  -e "ssh -i ~/.ssh/researchers_deploy" \
  ./ deploy@203.0.113.10:/home/deploy/researchers/
```

---

## Часть 7. Заливаем `.env.production` на VPS

`.env.production` мы НЕ кладём в git. Копируем его отдельно с ноута.

```bash
# На ноуте, из ~/WebstormProjects/researchers_back:
scp -i ~/.ssh/researchers_deploy .env.production deploy@203.0.113.10:/home/deploy/researchers/.env.production
ssh researchers-vps "chmod 600 /home/deploy/researchers/.env.production && ls -l /home/deploy/researchers/.env.production"
```

Должны увидеть `-rw-------`.

---

## Часть 8. PAT для GHCR (`GHCR_PAT`)

1. Создайте **classic** PAT: https://github.com/settings/tokens/new → scope **`read:packages`**
   (для org — доступ к организации и пакетам).

   > **Fine-grained PAT:** если используете fine-grained токен, в разделе **Repository access**
   > / **Packages** нужно явно добавить пакет **`rag-service`**, иначе `researchers-api` /
   > `researchers-web` будут тянуться, а `rag-service` — **403 Forbidden**.

2. Добавьте токен в **Environment → production → Secrets** как **`GHCR_PAT`**
   во всех репозиториях с deploy (`researchers_back`, `researchers_front`, `RAG_service`).

3. (Опционально) **`GHCR_USER`** — GitHub username владельца PAT (не `narxoz-diplom`).

Проверка на VPS:

```bash
echo "ghp_ваш_токен" | docker login ghcr.io -u zhubanyshzh --password-stdin
docker pull ghcr.io/narxoz-diplom/rag-service:latest
```

(`zhubanyshzh` — **ваш GitHub username**, не slug организации `narxoz-diplom`. Образы лежат в `ghcr.io/narxoz-diplom/...`, но логин всегда под личным аккаунтом, которому выдали PAT.

Если организация с SSO: на странице токена нажмите **Configure SSO** → Authorize для `narxoz-diplom`.

> Для **push** образов в CI используется встроенный `secrets.GITHUB_TOKEN`
> (не создавайте `vars.GITHUB_TOKEN` — такой переменной нет, будет `Password required`).

---

## Часть 9. Собираем и пушим образы в GHCR (с ноута)

При первом деплое образов в GHCR ещё нет, поэтому деплой-скрипт не сможет их
скачать. Самый быстрый способ — запушить main в обоих репозиториях, и
GitHub Actions сами всё соберут и зальют в GHCR.

```bash
# В обоих репо на ноуте — закоммитьте всё новое и запушьте:
cd ~/WebstormProjects/researchers_back
git add .
git commit -m "chore: production deploy infrastructure"
git push origin main

cd ~/WebstormProjects/researchers_front
git add .
git commit -m "chore: production dockerfile + ci"
git push origin main
```

После push зайдите в GitHub → ваш репозиторий → Actions. Должны побежать
workflow'ы `Deploy API` и `Deploy Web`. Шаг **deploy** в них упадёт (потому что
секреты в GitHub ещё не настроены) — это нормально. Шаг **build-and-push**
должен пройти зелёным. После этого образы появятся в
`https://github.com/your-github-user?tab=packages`.

> Если build-and-push тоже падает — посмотрите логи (скорее всего что-то с
> lint/build). Поправьте, запушьте снова.

---

## Часть 10. Делаем образы доступными для скачивания

По умолчанию пакеты в GHCR создаются приватными. Можно либо оставить так и
использовать PAT (часть 8), либо сделать их публичными.

1. Откройте https://github.com/users/your-github-user/packages/container/researchers-api/settings
2. Внизу — **Danger Zone → Change visibility → Public** (если хотите без PAT).
3. То же для `researchers-web` и **`rag-service`** (репозиторий `RAG_service`, ветка `researchers`):
   `https://github.com/orgs/narxoz-diplom/packages/container/rag-service/settings`
   — либо **Public**, либо PAT с `read:packages` и доступ org-пакетам (см. ниже).

Если `docker pull ghcr.io/.../rag-service:...` возвращает **403 Forbidden** при успешном
`docker login` — PAT не видит пакет `rag-service`. Варианты:
- Сделать пакет **Public** (проще для одного VPS).
- Либо в GitHub → **Organization settings → Packages** → разрешить PAT доступ к packages.
- Либо в настройках пакета `rag-service` → **Manage Actions access** → добавить репозиторий `rag_service`.

Если оставляете приватными — убедитесь, что `docker login` из части 8 успешен.

---

## Часть 11. Выпуск Let's Encrypt сертификата

На VPS:

```bash
ssh researchers-vps
cd ~/researchers
chmod +x deploy/scripts/*.sh

# Сначала проверьте на staging-окружении (не считает к лимиту 5 cert/неделя):
bash deploy/scripts/issue-cert.sh --staging
```

Если staging прошёл успешно — выпускайте боевой сертификат:

```bash
bash deploy/scripts/issue-cert.sh
```

В конце скрипт сам поднимет весь стек (`docker compose up -d`).

### Проверка

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Все сервисы должны быть `Up` или `healthy`. Если какой-то `restarting` —
смотрите логи:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=80 api edge web postgres
```

С ноута:

```bash
curl -fsS https://example.com/api/v1/health
# {"status":"ok","uptimeSec":42,"checks":{"database":"ok"}}

curl -fsS https://example.com/healthz
# ok
```

Откройте `https://example.com` в браузере — должна загрузиться SPA.

---

## Часть 12. Настройка GitHub Secrets и Variables (на ноуте/в браузере)

Чтобы автодеплой работал, в **обоих** репозиториях нужно настроить Environment
`production`.

В каждом репозитории (`researchers_back`, `researchers_front`):

1. Settings → Environments → **New environment** → name: `production` → Configure.
2. Add **environment secret** для каждого из этих ключей:

| Имя секрета     | Значение                                                                  |
|-----------------|---------------------------------------------------------------------------|
| `VPS_HOST`      | `203.0.113.10`                                                            |
| `VPS_USER`      | `deploy`                                                                  |
| `VPS_PORT`      | `22` (или ваш порт)                                                       |
| `VPS_SSH_KEY`   | Содержимое файла `~/.ssh/researchers_deploy` целиком (приватный ключ)     |
| `GHCR_PAT`      | GitHub PAT с правом `read:packages` (для `docker pull` на VPS)           |
| `GHCR_USER`     | (опционально) ваш GitHub username для `docker login`, если не `github.actor` |

> **Не используйте** `vars.GITHUB_TOKEN` — такой переменной нет. Для `docker/login-action`
> в CI используется встроенный `secrets.GITHUB_TOKEN` автоматически.

> Для `VPS_SSH_KEY` важно вставить **весь файл**, включая первую и последнюю
> строки `-----BEGIN OPENSSH PRIVATE KEY-----` и `-----END OPENSSH PRIVATE KEY-----`.

3. Add **environment variable** (не secret — в `environment.url` secrets недоступны):

| Имя переменной   | Значение                              |
|------------------|---------------------------------------|
| `PROD_DOMAIN`    | `example.com`                         |

В репозитории `researchers_front` дополнительно:

| Имя переменной   | Значение                              |
|------------------|---------------------------------------|
| `VITE_API_URL`   | `https://example.com/api/v1`          |

---

## Часть 13. Проверка автодеплоя

Сделайте косметический коммит в `researchers_back`:

```bash
cd ~/WebstormProjects/researchers_back
echo "" >> README.md
git add README.md
git commit -m "chore: trigger deploy"
git push origin main
```

В Actions должен пройти `Deploy API`. После `deploy on VPS` снова проверьте:

```bash
curl -fsS https://example.com/api/v1/health
```

Так же протестируйте `researchers_front`.

---

## Часть 14. Создайте тестовые данные (один раз)

```bash
ssh researchers-vps
cd ~/researchers
docker compose --env-file .env.production -f docker-compose.prod.yml \
  run --rm api npm run seed
```

Создастся админ с email/паролем из `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
вашего `.env.production`. Залогиньтесь под ним в SPA.

---

## Часть 15. Проверьте, что бэкап работает

```bash
ssh researchers-vps
cd ~/researchers
docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec backup /usr/local/bin/backup.sh
docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec backup ls -lh /backups
```

Должны увидеть свежий файл `researchers-YYYYMMDD-HHMMSS.sql.zst.age`.

В GitHub Actions запустите вручную workflow `Pull encrypted backup`
(Actions → выбрать workflow → Run workflow). После прохождения проверьте, что
артефакт `pg-backup-...` появился в Summary.

### Раз в квартал делайте тренировочный restore

Подробности — в [`deploy/README.md`](README.md) раздел *Restore from an encrypted backup*.

---

## Часть 16. Чек-лист итоговый

После всех шагов должно быть:

- [ ] `https://example.com` открывает SPA.
- [ ] Прямая ссылка типа `https://example.com/courses/whatever` не даёт 404 после refresh.
- [ ] `curl https://example.com/api/v1/health` возвращает `{"status":"ok",...}`.
- [ ] В DevTools запрос к API идёт на `https://example.com/api/v1/...`, не на `localhost`.
- [ ] `https://example.com/docs` не открывается (404 от nginx) — Swagger закрыт.
- [ ] `ssh root@203.0.113.10` НЕ работает (root SSH отключён).
- [ ] `ssh -o PreferredAuthentications=password deploy@203.0.113.10` НЕ работает (только ключ).
- [ ] Push в `main` в backend-репо триггерит `Deploy API`.
- [ ] Push в `main` в frontend-репо триггерит `Deploy Web`.
- [ ] Push в `researchers` в rag_service триггерит `Deploy RAG`.
- [ ] `docker compose ps` на VPS показывает все сервисы работающими (включая `rag`, `chromadb`).
- [ ] Workflow `Pull encrypted backup` создаёт артефакт.
- [ ] AGE-приватный ключ сохранён в менеджере паролей и стёрт с ноута.

Если хоть один пункт не сошёлся — возвращайтесь к соответствующей части.

---

## AI-генерация уроков (для авторов)

Авторы генерируют **черновик** в Studio → редактирование урока. Финальный текст и
факты — ответственность автора перед публикацией.

### Требования

1. **Google AI Studio API-ключ** — профиль → вкладка AI (BYOK; ключ не показывается после сохранения).
2. **Индекс материалов READY** — после загрузки PDF/текста дождитесь завершения индексации урока.
3. **RAG-сервис** — в `.env.production` на VPS (см. `.env.production.example`):
   ```ini
   RAG_SERVICE_URL=http://rag:8000
   RAG_SERVICE_API_KEY=...          # openssl rand -hex 32
   AI_ENCRYPTION_KEY=...            # openssl rand -base64 32
   PUBLIC_API_URL=https://example.com
   RAG_CALLBACK_SECRET=...          # openssl rand -hex 32
   RAG_IMAGE_TAG=latest
   ```
   **Gemini API-ключи не хранятся в `.env.production`:**
   - авторы — BYOK в профиле (Studio → AI);
   - подписчики — один ключ задаёт админ в **Admin → AI (чат)**.
   RAG деплоится из репозитория `narxoz-diplom/rag_service`, ветка **`researchers`**
   (workflow `Deploy RAG`). Образ: `ghcr.io/narxoz-diplom/rag-service`.

### Параметры генерации

| Поле | Рекомендация |
|------|----------------|
| **Формат** | `Лекция` — связный текст без LMS-шаблона (по умолчанию). `LMS (6 блоков)` — legacy. |
| **Аудитория** | `Эксперты / PhD` для академической подачи. |
| **Глубина** | `Развёрнуто` — больше контекста из материалов. |
| **Модель** | Для pro/deep — **Gemini Pro**. Flash Lite — быстрее, но слабее для PhD. |

### Двухшаговый режим

1. **Только план** — структура урока (bullets), можно отредактировать.
2. **Написать по плану** — полный текст по утверждённому плану.

Либо сразу **Полный текст** без предварительного плана.

---

## Частые проблемы

### `permission denied (publickey)` при `ssh deploy@...`
Не сработал шаг 1 или 5.2. Зайдите как root (если ещё можете), проверьте:
```bash
cat /home/deploy/.ssh/authorized_keys
# Должна быть ваша ssh-ed25519 строка
ls -la /home/deploy/.ssh
# .ssh = 700, authorized_keys = 600, owner = deploy:deploy
```

### `rag-service:latest: not found` (backend/front deploy)

Образ RAG ещё не залит в GHCR или тег `latest` не создан. **Сначала** успешно прогоните
workflow **Deploy RAG** в репозитории `RAG_service` (ветка `researchers`).

Проверка на VPS:
```bash
docker pull ghcr.io/narxoz-diplom/rag-service:latest
# или конкретный sha из Actions:
docker pull ghcr.io/narxoz-diplom/rag-service:sha-86643b84375f
```

Backend/front deploy **не обновляет** RAG, если не передан 3-й аргумент — используется
`.last-rag-tag` на VPS. При первом деплое RAG обязателен.

### `403 Forbidden` только на `rag-service` (api/web тянутся нормально)

Пакет **`rag-service`** создан отдельным репозиторием и по умолчанию **приватный**.
PAT видит `researchers-api` / `researchers-web` (public или уже в scope), но не `rag-service`.

**Исправление за 1 минуту (рекомендуется):**

1. https://github.com/orgs/narxoz-diplom/packages/container/rag-service/settings
2. **Package settings** → **Change package visibility** → **Public**
3. На VPS проверьте:
   ```bash
   docker pull ghcr.io/narxoz-diplom/rag-service:latest
   ```
4. Re-run deploy в GitHub Actions

**Альтернатива (оставить private):** Package settings → **Manage access** → добавить
GitHub-пользователя, которому принадлежит `GHCR_PAT`, с ролью Read. Либо пересоздайте
classic PAT с `read:packages` + SSO для org.

### `Error response from daemon: pull access denied for ghcr.io/...` или `403 Forbidden` (общее)
Не сделан шаг 8 (login в GHCR), либо пакет приватный и токен не имеет
`read:packages`, либо `IMAGE_OWNER` в `.env.production` написан не в нижнем
регистре. Имя в GHCR всегда в нижнем регистре. Для **`rag-service`** отдельно:
сделайте пакет Public (часть 10) или выдайте PAT доступ к org-пакетам.

### `nginx: [emerg] cannot load certificate "/etc/letsencrypt/live/example.com/fullchain.pem"`
Сертификат ещё не выпущен. Запустите `bash deploy/scripts/issue-cert.sh`.

### `P3009` / `P3018` — failed migration blocks deploy

**Причина:** контейнер `migrate` берёт SQL из **Docker-образа** `researchers-api`, не с диска VPS.
Если образ старый, снова выполнится `UPDATE "category"` без `ADD COLUMN IF NOT EXISTS`.

**Быстрое исправление на VPS** (из `~/researchers`, подставьте свой sha из Deploy API):

```bash
cd ~/researchers
export API_IMAGE_TAG=sha-c2625cfd495a   # последний успешный build API в Actions
bash deploy/scripts/migrate-fix-category-column.sh
```

Или вручную:

```bash
cd ~/researchers
source .env.production

# 1. SQL напрямую в Postgres
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  'ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '\''publication'\'';'

# 2. Снять failed + пометить миграцию выполненной (образ API — свежий sha!)
API_IMAGE_TAG=sha-c2625cfd495a docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate \
  npx prisma migrate resolve --rolled-back 20250623120000_course_section_categories || true
API_IMAGE_TAG=sha-c2625cfd495a docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate \
  npx prisma migrate resolve --applied 20250623120000_course_section_categories
API_IMAGE_TAG=sha-c2625cfd495a docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate \
  npx prisma migrate deploy
```

Затем **Re-run** deploy в GitHub Actions.

> Первая команда без `cd ~/researchers` даст `couldn't find env file` — файл лежит в `~/researchers/.env.production`.

### `chromadb is unhealthy` / `dependency failed to start: chromadb`

Образ `chromadb/chroma` часто **не содержит curl**, а healthcheck в compose использовал
`curl` → контейнер всегда `unhealthy`, RAG не стартует.

**После push fix** (python healthcheck + pin `1.5.3`) на VPS:

```bash
cd ~/researchers
docker compose --env-file .env.production -f docker-compose.prod.yml pull chromadb
docker compose --env-file .env.production -f docker-compose.prod.yml up -d chromadb rag api
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Проверка health:

```bash
docker inspect researchers-chromadb --format='{{.State.Health.Status}}'
# должно быть: healthy
```

### `502 Bad Gateway` от nginx
API не отвечает. Смотрите:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 api migrate
```
Часто причина — migration не прошёл (например `DATABASE_URL` плохо собран из-за
спецсимволов в пароле). Используйте пароль БЕЗ `@`, `/`, `:`, `#`, `%`. Если
уже сгенерировали с такими — перегенерируйте через
`openssl rand -base64 32 | tr -d '/+=@:#%' | head -c 32`.

### Сайт открывается, но запросы к API падают с CORS
Проверьте, что в `.env.production` `CORS_ORIGINS=https://example.com` совпадает
с тем доменом, который у вас в браузере.
