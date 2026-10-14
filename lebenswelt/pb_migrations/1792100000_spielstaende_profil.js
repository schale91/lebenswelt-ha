/// <reference path="../pb_data/types.d.ts" />
// Profil je Spielstand ("voll" oder "fitness"). Damit wissen Hintergrundaufgaben, wer die Fitness-Welt hat
// (Erinnerung am Abend), und Claude findet ohne Option `person` weiterhin die eine Person mit voller Lebenswelt.
migrate(
  (app) => {
    const sammlung = app.findCollectionByNameOrId("spielstaende")
    sammlung.fields.add(new TextField({ name: "profil", max: 20 }))
    app.save(sammlung)
  },
  (app) => {
    const sammlung = app.findCollectionByNameOrId("spielstaende")
    sammlung.fields.removeByName("profil")
    app.save(sammlung)
  },
)
