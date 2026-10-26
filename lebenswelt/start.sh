#!/bin/sh
# Weiterleitung für Lebenswelt Fit (ha_komponente/lebenswelt_fit) nach custom_components legen, mit dem Namen dieses
# Containers als Ziel. Nur bei Änderungen schreiben; Home Assistant lädt sie beim nächsten Neustart.
ZIEL=/homeassistant/custom_components/lebenswelt_fit
if [ -d /homeassistant ]; then
  mkdir -p /tmp/lebenswelt_fit
  sed "s/@ZIEL@/$(hostname)/" /ha_komponente/lebenswelt_fit/__init__.py > /tmp/lebenswelt_fit/__init__.py
  cp /ha_komponente/lebenswelt_fit/manifest.json /tmp/lebenswelt_fit/manifest.json
  if ! diff -rq /tmp/lebenswelt_fit "$ZIEL" >/dev/null 2>&1; then
    mkdir -p "$ZIEL" && cp /tmp/lebenswelt_fit/__init__.py /tmp/lebenswelt_fit/manifest.json "$ZIEL/" \
      && echo "Lebenswelt Fit: Weiterleitung in custom_components aktualisiert (wirkt nach dem nächsten Neustart von Home Assistant)"
  fi
fi
# Schiffsverkehr (AIS) im Hintergrund, startet bei einem Absturz neu; PocketBase ist der Hauptprozess.
(while true; do python3 /ais/ais.py; sleep 30; done) &
exec /usr/local/bin/pocketbase serve --http=0.0.0.0:8090 --dir=/data/pb_data --hooksDir=/pb_hooks --migrationsDir=/pb_migrations
