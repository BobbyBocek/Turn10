# PRD – Kortkväll (kortspels-app med Elo & statistik)

## Problemformulering
Mobile-first webbapp på svenska för en sluten vänskapskrets (3–6 spelare/match). Konton krävs;
registrera matchresultat, räkna Elo anpassad för sluten grupp, matchhistorik + kommentarer (shittalk),
topplista, regelbibliotek och patch notes.

## Arkitektur
- Backend: FastAPI + MongoDB (motor). Auth: JWT e-post/lösenord (cookie `access_token`) + Emergent
  Google Auth (cookie `session_token`), unified via `resolve_user`. Elo i central modul `backend/elo.py`.
- Frontend: React + react-router + framer-motion + Tailwind. Mobil-container max-w-md, sticky bottennav (5 flikar).

## Användarpersonas
- Spelare i vänkretsen: loggar in, registrerar match direkt efter spelkväll, snackar skit i kommentarer.
- Alla inloggade har samma rättigheter (ingen admin-hierarki i v1).

## Kärnkrav (statiska)
- Endast registrerade konton kan väljas som deltagare. 3–6 spelare, unika placeringar.
- Elo: start 1000; K=60 (<10 matcher), 20 (etablerad), 15 (elit ≥2000). Vinststreak-bonus (+15%/steg, max +75%).
  Förluststreak-"mercy": man förlorar mindre för varje sista-plats i rad (−10%/steg, max −50%).
- Position/regler/sista kort påverkar EJ Elo (endast statistik).
- Topplista: endast spelare med ≥1 match; kolumner rating/V/F/sist/vinst%, sorterbar.

## Implementerat (2026-06-19)
- Auth (JWT + Google), seed: admin tom.jenssen@live.se + 5 testspelare, 10 regler (3 grund), 4 exempelmatcher, 2 patch notes.
- Ny match (3-stegsflöde: deltagare → position + Worms-regelrutnät + skapa egen regel → placering m. pilar + sista kort).
- Matchdetalj med Elo-badges (grön/röd) + shittalk (text/emoji, snabbval).
- Historik, Topplista (sorterbar), Regler (grund + bibliotek, radera egna), Patch notes (lägg till).
- Testad: backend 19/19 pytest, frontend alla kärnflöden (testing agent iteration_1).

## Backlog (ej gjort)
- P1: Elo-graf/historik per spelare över tid (recharts).
- P1: Redigera egna regler (endpoint finns, ej UI).
- P2: Redigera/radera match, delad plats-hantering, spelarprofil-sida.
- P2: Riktig realtidsuppdatering (nu refetch vid navigering).

## Nästa steg
Se Next Action Items i finish-summary.
