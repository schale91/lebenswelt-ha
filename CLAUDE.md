## Pull Requests
Claude legt für seine Änderungen selbst einen Pull Request an und führt ihn
ohne Rückfrage zusammen, wenn die Tests bestanden sind und es keine Konflikte gibt
(Merge-Commit). Danach kurz sagen, was ich noch tun muss
(App-Update in Home Assistant, „Update verfügbar“ installieren).

## Tests
Vor dem Zusammenführen müssen die Action „Tests“ dieses Repos grün sein und, wenn
`pb_hooks` oder `pb_migrations` geändert sind, auch die „Ende-zu-Ende-Tests“ im App-Repo,
von Hand gestartet mit `addon_ref` = Zweig dieses Pull Requests (docs/ARBEITSABLAUF.md).
