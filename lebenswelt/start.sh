#!/bin/sh
# Schiffsverkehr (AIS) im Hintergrund, startet bei einem Absturz neu; PocketBase ist der Hauptprozess.
(while true; do python3 /ais/ais.py; sleep 30; done) &
exec /usr/local/bin/pocketbase serve --http=0.0.0.0:8090 --dir=/data/pb_data --hooksDir=/pb_hooks --migrationsDir=/pb_migrations
