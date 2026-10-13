# Lebenswelt Datenbank

Speichert die Daten der Lebenswelt-App in Home Assistant. Technisch ist das [PocketBase](https://pocketbase.io) mit eigenen Routen.

- Erreichbar nur über den Ingress von Home Assistant. Anfragen von anderswo lehnt die App ab.
- Wer eine Anfrage stellt, weiß die App aus dem Ingress (die angemeldete Home-Assistant-Person). Eine eigene Anmeldung gibt es nicht.
- Die Daten liegen in `/data/pb_data` und sind Teil jedes Home-Assistant-Backups. Gesichert wird im gestoppten Zustand.

## Schnittstelle

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/lebenswelt/ich` | angemeldete Person |
| GET | `/api/lebenswelt/spielstand` | Spielstand der Person |
| PUT | `/api/lebenswelt/spielstand` | Spielstand speichern (`{zeit, daten}`), 409 wenn der gespeicherte neuer ist |
