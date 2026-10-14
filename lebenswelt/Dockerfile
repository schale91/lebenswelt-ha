FROM alpine:3.21

ARG BUILD_ARCH
ARG PB_VERSION=0.40.4

# PocketBase aus dem offiziellen Release, geprüft gegen die veröffentlichte Prüfsumme.
# openssl signiert die Anmeldung bei Firebase (Push-Nachrichten an die Android-App)
RUN apk add --no-cache ca-certificates openssl \
    && apk add --no-cache --virtual .laden unzip wget \
    && case "${BUILD_ARCH}" in \
        amd64) PB_ARCH=amd64; PB_SHA=9042ec818570e79c3628dadcd0a756c1496d9e1173918ec409d133c02f82e5fa ;; \
        aarch64) PB_ARCH=arm64; PB_SHA=86095bf8ed9345954f0d2bf0a5fb9b57584ae60b77ebf3b6cd23a8003a3fd418 ;; \
        *) echo "Architektur ${BUILD_ARCH} wird nicht unterstützt" && exit 1 ;; \
    esac \
    && wget -q -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" \
    && echo "${PB_SHA}  /tmp/pb.zip" | sha256sum -c - \
    && unzip -q /tmp/pb.zip pocketbase -d /usr/local/bin \
    && rm /tmp/pb.zip \
    && apk del .laden

COPY pb_hooks /pb_hooks
COPY pb_migrations /pb_migrations

# /data ist der dauerhafte Speicher der App und steckt in jedem Home-Assistant-Backup.
CMD ["/usr/local/bin/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/data/pb_data", "--hooksDir=/pb_hooks", "--migrationsDir=/pb_migrations"]
