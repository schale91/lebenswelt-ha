/// <reference path="../pb_data/types.d.ts" />
// Spielstand je Home-Assistant-Person. Kein Zugriff über die allgemeine
// PocketBase-API (alle Regeln null), nur über die eigenen Routen in pb_hooks.
migrate(
  (app) => {
    const sammlung = new Collection({
      type: "base",
      name: "spielstaende",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "benutzer", type: "text", required: true, max: 100 },
        { name: "name", type: "text", max: 200 },
        { name: "zeit", type: "number", required: true },
        { name: "daten", type: "json", maxSize: 5000000 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_spielstaende_benutzer ON spielstaende (benutzer)"],
    })
    app.save(sammlung)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("spielstaende"))
  },
)
