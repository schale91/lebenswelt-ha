/// <reference path="../pb_data/types.d.ts" />
// Allgemeiner Dokumentenspeicher: jede Sache der Lebenswelt (Aufgabe, Vorgang, Trainingstag, Aktivität ...)
// ist ein Dokument mit Typ und frei strukturierten Daten. Zugriff nur über die eigenen Routen in pb_hooks.
migrate(
  (app) => {
    const sammlung = new Collection({
      type: "base",
      name: "dokumente",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "besitzer", type: "text", required: true, max: 100 },
        { name: "typ", type: "text", required: true, max: 40 },
        { name: "schluessel", type: "text", max: 200 },
        { name: "daten", type: "json", maxSize: 2000000 },
        { name: "geloescht", type: "bool" },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_dokumente_schluessel ON dokumente (besitzer, typ, schluessel) WHERE schluessel != ''",
        "CREATE INDEX idx_dokumente_geaendert ON dokumente (besitzer, updated)",
      ],
    })
    app.save(sammlung)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("dokumente"))
  },
)
