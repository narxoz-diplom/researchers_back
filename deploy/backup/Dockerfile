FROM alpine:3.20

RUN apk add --no-cache \
    bash \
    tzdata \
    coreutils \
    findutils \
    postgresql15-client \
    age \
    zstd \
    dcron \
    su-exec

COPY backup.sh /usr/local/bin/backup.sh
COPY restore.sh /usr/local/bin/restore.sh
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
