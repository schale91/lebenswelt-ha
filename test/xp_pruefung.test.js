// Tests der Sonntagsprüfung: node --test test/
const test = require("node:test")
const assert = require("node:assert/strict")
const P = require("../lebenswelt/pb_hooks/xp_pruefung.js")

const SONNTAG = "2026-10-18"
const tage = (von, anzahl) => Array.from({ length: anzahl }, (_, i) => P._intern.plusTage(von, i))

/** Vier ruhige Wochen: jeden Tag 60 XP bei 4 Nachweisen. */
function ruhig() {
  const xpTage = {}
  const nachweise = {}
  for (const t of tage("2026-09-14", 28)) {
    xpTage[t] = { xp: 60, n: 4 }
    nachweise[t] = 4
  }
  return { xpTage, nachweise }
}

test("Level wie in der App", () => {
  assert.equal(P.levelAusXp(0), 0)
  assert.equal(P.levelAusXp(99), 0)
  assert.equal(P.levelAusXp(100), 1)
  assert.equal(P.levelAusXp(100 + 264), 2)
})

test("normale Woche ist unauffällig", () => {
  const { xpTage, nachweise } = ruhig()
  for (const t of tage("2026-10-12", 7)) {
    xpTage[t] = { xp: 70, n: 5 }
    nachweise[t] = 5
  }
  const e = P.bewerte({ name: "Alex", xpTage, nachweise, gesamtXp: 5000 }, SONNTAG)
  assert.equal(e.auffaellig, false)
  assert.equal(e.fleissig, false)
  assert.equal(e.xpWoche, 490)
  assert.equal(e.schnittXp, 420)
  assert.equal(e.vergleichswochen, 4)
})

test("viel mehr XP bei entsprechend mehr Erledigtem ist Fleiß", () => {
  const { xpTage, nachweise } = ruhig()
  for (const t of tage("2026-10-12", 7)) {
    xpTage[t] = { xp: 150, n: 10 }
    nachweise[t] = 10
  }
  const e = P.bewerte({ name: "Alex", xpTage, nachweise, gesamtXp: 20000 }, SONNTAG)
  assert.equal(e.fleissig, true)
  assert.equal(e.auffaellig, false)
})

test("viel mehr XP ohne mehr Erledigtes fällt auf", () => {
  const { xpTage, nachweise } = ruhig()
  for (const t of tage("2026-10-12", 7)) {
    xpTage[t] = { xp: 150, n: 4 }
    nachweise[t] = 4
  }
  const e = P.bewerte({ name: "Papa", profil: "fitness", xpTage, nachweise, gesamtXp: 20000 }, SONNTAG)
  assert.equal(e.fleissig, false)
  assert.equal(e.auffaellig, true)
  assert.match(e.hinweise[0], /1050 XP statt sonst etwa 420/)
})

test("ein Ausreißertag mit wenig Nachweisen fällt auf", () => {
  const { xpTage, nachweise } = ruhig()
  for (const t of tage("2026-10-12", 7)) {
    xpTage[t] = { xp: 60, n: 4 }
    nachweise[t] = 4
  }
  xpTage["2026-10-14"] = { xp: 400, n: 3 }
  nachweise["2026-10-14"] = 2
  const e = P.bewerte({ name: "Alex", xpTage, nachweise, gesamtXp: 20000 }, SONNTAG)
  assert.equal(e.auffaellig, true)
  assert.ok(e.hinweise.some((h) => h.startsWith("Am 14.10.: 400 XP")))
})

test("XP ohne jeden Nachweis fallen auf, auch ohne Vergleichswochen", () => {
  const xpTage = {}
  for (const t of tage("2026-10-12", 7)) xpTage[t] = { xp: 80, n: 6 }
  const e = P.bewerte({ name: "Alex", xpTage, nachweise: {}, gesamtXp: 3000 }, SONNTAG)
  assert.equal(e.vergleichswochen, 0)
  assert.equal(e.auffaellig, true)
  assert.match(e.hinweise[0], /nichts Erledigtes/)
})

test("ohne Tagebuch bleibt es ruhig", () => {
  const e = P.bewerte({ name: "Neu", gesamtXp: 0 }, SONNTAG)
  assert.equal(e.auffaellig, false)
  assert.equal(e.xpWoche, 0)
})
