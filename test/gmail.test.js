// Gmail im Posteingang: Eingaben prüfen, Zusammenführen ohne Dubletten, Entscheidung, Rückfrage, XP einmal je Mail
const test = require("node:test")
const assert = require("node:assert/strict")
const G = require("../lebenswelt/pb_hooks/gmail.js")
const R = require("../lebenswelt/pb_hooks/einsatz/regelwerk.js")

const T = Date.parse("2026-11-03T07:30:00Z")
const optionen = [
  { id: "todo", text: "Als To-Do markieren", aktion: "to_do" },
  { id: "rechnung", text: "Label Rechnungen, archivieren", aktion: "labeln", daten: { labels: ["Label_12"], label_namen: ["Finanzen/Rechnungen"], archivieren: true } },
  { id: "weg", text: "Archivieren", aktion: "archivieren" },
]
const mail = (x = {}) => Object.assign({ thread_id: "18f2a9c0b1", titel: "Ihre Rechnung", absender: "Stadtwerke", datum: "2026-11-02", auszug: "x".repeat(500), optionen }, x)

test("Mail wird geprüft und gekürzt, Link zeigt auf Gmail", () => {
  const d = G.mailDaten(mail(), T)
  assert.equal(d.quelle, "gmail")
  assert.equal(d.status, "offen")
  assert.equal(d.auszug.length, 300)
  assert.match(d.link, /^https:\/\/mail\.google\.com\/.*18f2a9c0b1$/)
  assert.equal(d.optionen.length, 3)
  assert.deepEqual(d.optionen[1].daten.labels, ["Label_12"])
  assert.throws(() => G.mailDaten(mail({ thread_id: "../x" }), T), /thread_id/)
  assert.throws(() => G.mailDaten(mail({ link: "https://example.com/" }), T), /mail\.google\.com/)
  assert.throws(() => G.mailDaten(mail({ optionen: optionen.slice(0, 1) }), T), /2 bis 4/)
  assert.throws(() => G.mailDaten(mail({ optionen: [optionen[0], optionen[0]] }), T), /doppelt/)
  assert.throws(() => G.mailDaten(mail({ optionen: [optionen[0], { id: "x", text: "Löschen", aktion: "loeschen" }] }), T), /aktion/)
  assert.throws(() => G.mailDaten(mail({ optionen: [optionen[0], { id: "l", text: "Labeln", aktion: "labeln" }] }), T), /Label-IDs/)
})

test("Erneut gelieferte Mail: offen wird aktualisiert, entschieden bleibt", () => {
  const alt = G.mailDaten(mail(), T)
  assert.equal(G.zusammenfuehren(alt, G.mailDaten(mail(), T + 1000)).geaendert, false)
  // PocketBase liefert Objekte mit anderer Reihenfolge der Schlüssel zurück
  const umsortiert = Object.assign({}, alt, { optionen: alt.optionen.map((o) => ({ daten: o.daten, aktion: o.aktion, text: o.text, id: o.id })) })
  assert.equal(G.zusammenfuehren(umsortiert, G.mailDaten(mail(), T)).geaendert, false)
  const z = G.zusammenfuehren(alt, G.mailDaten(mail({ titel: "Re: Ihre Rechnung" }), T))
  assert.equal(z.geaendert, true)
  assert.equal(z.daten.titel, "Re: Ihre Rechnung")
  const entschieden = G.entscheide(alt, { auswahl: "todo" }, T, 0, R.POSTEINGANG_XP)
  const z2 = G.zusammenfuehren(entschieden, G.mailDaten(mail({ titel: "Neu" }), T))
  assert.equal(z2.geaendert, false)
  assert.equal(z2.daten.status, "entschieden")
})

test("Entscheidung: Vorschlag oder eigene Eingabe, XP einmal je Mail und höchstens tag_max am Tag", () => {
  const alt = G.mailDaten(mail(), T)
  const X = R.POSTEINGANG_XP
  assert.throws(() => G.entscheide(alt, {}, T, 0, X), /fehlt/)
  assert.throws(() => G.entscheide(alt, { auswahl: "gibtsnicht" }, T, 0, X), /keiner der Vorschläge/)
  assert.throws(() => G.entscheide(alt, { eigene_eingabe: "x".repeat(2001) }, T, 0, X), /zu lang/)
  const a = G.entscheide(alt, { auswahl: "rechnung" }, T, 0, X)
  assert.equal(a.status, "entschieden")
  assert.equal(a.verarbeitet, true)
  assert.equal(a.xp, X.gmail_entscheidung)
  assert.equal(a.xp_gebucht, true)
  // Umentscheiden vor dem nächsten Lauf: keine zweiten XP
  const b = G.entscheide(Object.assign({}, a, { xp_abgeholt: true }), { eigene_eingabe: "Bitte an Julia weiterleiten" }, T, 0, X)
  assert.equal(b.auswahl, null)
  assert.equal(b.xp_abgeholt, true)
  assert.equal(b.xp, X.gmail_entscheidung)
  // Obergrenze je Tag
  assert.equal(G.xpFuer(X.tag_max - 1, X), 1)
  assert.equal(G.xpFuer(X.tag_max, X), 0)
  assert.equal(G.entscheide(alt, { auswahl: "weg" }, T, X.tag_max, X).xp, 0)
})

test("Routine: verarbeitet mit Ergebnis, Rückfrage setzt zurück, ohne neue XP", () => {
  const alt = G.mailDaten(mail(), T)
  assert.throws(() => G.routineAendern(alt, { status: "verarbeitet" }, T), /entschiedene/)
  const e = G.entscheide(alt, { eigene_eingabe: "Kümmer dich" }, T, 0, R.POSTEINGANG_XP)
  const f = G.routineAendern(e, { status: "offen", rueckfrage: "Soll ich antworten oder archivieren?" }, T)
  assert.equal(f.status, "offen")
  assert.equal(f.verarbeitet, false)
  assert.equal(f.vorherige_eingabe, "Kümmer dich")
  assert.equal(f.xp_gebucht, true)
  assert.throws(() => G.routineAendern(e, { status: "offen" }, T), /rueckfrage/)
  const g = G.entscheide(f, { auswahl: "weg" }, T, 0, R.POSTEINGANG_XP)
  assert.equal(g.xp, e.xp)
  const v = G.routineAendern(g, { status: "verarbeitet", ergebnis: "Archiviert." }, T)
  assert.equal(v.status, "verarbeitet")
  assert.equal(v.ergebnis, "Archiviert.")
  assert.ok(v.verarbeitet_am)
  assert.throws(() => G.entscheide(v, { auswahl: "todo" }, T, 0, R.POSTEINGANG_XP), /schon verarbeitet/)
  assert.throws(() => G.routineAendern(v, { status: "erledigt" }, T), /status/)
})

test("Push nennt nur die Anzahl, XP-Höhe steht im Regelwerk", () => {
  assert.equal(G.pushText(1), "Eine neue Mail wartet im Posteingang auf deine Entscheidung.")
  assert.equal(G.pushText(3), "3 neue Mails warten im Posteingang auf deine Entscheidung.")
  assert.ok(R.POSTEINGANG_XP.gmail_entscheidung > 0 && R.POSTEINGANG_XP.tag_max >= R.POSTEINGANG_XP.gmail_entscheidung)
  assert.equal(G.statusFilter(""), null)
  assert.throws(() => G.statusFilter("weg"), /status/)
})
