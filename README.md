# Schroeven – herstelling

Webapp (PWA) voor de schroefherstelling: ontvangst met foto's, spoedmeting,
herstelling en herstelrapport in PDF (NL/FR) dat je per e-mail verstuurt.

- Werkt op tablet, gsm en pc; installeerbaar en offline bruikbaar.
- Alle gegevens blijven op het toestel (IndexedDB). Back-up via Instellingen.
- Spoedberekening = zelfde formules als `SCHROEFBLADEN.xlsx` (zie `js/calc.js`).

## Lokaal starten

    python3 -m http.server 8000

en open http://localhost:8000.

Zie `docs/notas-processo.md` voor de procesnotities.
