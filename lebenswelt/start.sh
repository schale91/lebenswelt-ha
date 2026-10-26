#!/bin/sh
# Weiterleitung für Lebenswelt Fit (ha_komponente/lebenswelt_fit) nach custom_components legen, mit dem Namen dieses
# Containers als Ziel. Nur bei Änderungen schreiben; Home Assistant lädt sie beim nächsten Neustart.
ZIEL=/homeassistant/custom_components/lebenswelt_fit
if [ -d /homeassistant ]; then
  rm -rf /tmp/lebenswelt_fit && cp -r /ha_komponente/lebenswelt_fit /tmp/lebenswelt_fit
  sed -i "s/@ZIEL@/$(hostname)/" /tmp/lebenswelt_fit/__init__.py
  # Vergleich nur über die eigenen Dateien (Home Assistant legt dort __pycache__ an)
  (cd /tmp/lebenswelt_fit && find . -type f | sort | xargs md5sum) > /tmp/lebenswelt_fit.md5
  if ! (cd "$ZIEL" 2>/dev/null && md5sum -c -s /tmp/lebenswelt_fit.md5); then
    rm -rf "$ZIEL" && mkdir -p /homeassistant/custom_components && cp -r /tmp/lebenswelt_fit "$ZIEL" \
      && echo "Lebenswelt Fit: Weiterleitung in custom_components aktualisiert (wirkt nach dem nächsten Neustart von Home Assistant)"
  fi
fi
# Schiffsverkehr (AIS) im Hintergrund, startet bei einem Absturz neu; PocketBase ist der Hauptprozess.
(while true; do python3 /ais/ais.py; sleep 30; done) &
exec /usr/local/bin/pocketbase serve --http=0.0.0.0:8090 --dir=/data/pb_data --hooksDir=/pb_hooks --migrationsDir=/pb_migrations
