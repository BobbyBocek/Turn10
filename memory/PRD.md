# PRD – Turn10 (vändtian-app med konton, Elo & statistik)

## Problemformulering
Mobile-first webbapp "Turn10" på svenska för en sluten vänskapskrets som spelar en egen dubbel-lek-variant
av vändtian (3–6 spelare). Konton krävs; registrera matcher, Elo anpassad för sluten grupp + utgångsbonus,
matchhistorik + shittalk, topplista med badges & månadspriser, profiler, regler, patch notes.

## Arkitektur
- Backend: FastAPI + MongoDB (motor). Auth: JWT e-post/lösenord + Emergent Google Auth (unified resolve_user).
  Elo i central modul `backend/elo.py` (parvis Elo + exit_bonus). Full-reseed via SEED_VERSION-flagga.
- Frontend: React + react-router + framer-motion + Tailwind. Mobil-container max-w-md, sticky 6-flikars bottennav.
  Återanvändbar PlayingCard-komponent (rank+suit), RoundTable (SVG/CSS), PlayerAvatar, CardPicker, Badges.

## Branding
Turn10 genomgående. Logo: spelkort med "10" + vändpil (public/turn10-logo.jpg). Mörkt casino-tema,
guld (#F59E0B) + crimson (#E11D48) accenter.

## Elo (central funktion)
- Start 1000. K=60 (<10 matcher), 20 (etablerad), 15 (elit ≥2000).
- Vinststreak-bonus: K*(1+0.15*min(streak-1,5)). Förluststreak-dämpning: K*max(1-0.10*min(streak-1,5),0.5).
- Utgångsbonus per spelare: round((15-kortvärde)*0.4), lägst 0; kort 2 & 10 => alltid 0. Adderas till delta.
- Position/regler påverkar EJ Elo.

## Implementerat (2026-06)
- v1 (Kortkväll): auth, ny match, historik, matchdetalj, topplista, regler, patch notes, Elo + streaks.
- v2 (Turn10-rebrand): rebrand + logo; profiler (smeknamn + avatar); utgångsbonus; PlayingCard + exit-card picker;
  Home-dashboard; RoundTable; card-shaped regelväljare; topplista-badges + Månadens spelare + historik; V-ringad-omröstning; Spela igen; Min sida.
- v3 (åtkomst + regelverktyg): bordsposition tilldelas i steg 1 via tryck på bordet (position-sheet); publik läsvy
  utan inloggning (Topplista/Regler/Historik/matchdetalj), övrigt kräver login; 6-siffrig inbjudningskod (env INVITE_CODE=267710)
  vid registrering; regelkategorier (Begränsning/Fördel/Special, färgkodade) + skapare + användningsräknare + sorterbart;
  ny badge 📖 flest skapade regler; sökbar Lucide-ikonväljare med snabbrad kortsymboler; "Rensa testdata"-knapp (POST /admin/clear-testdata + recompute_all);
  inga exempelregler seedas längre.
- Testat: backend 40/40 pytest, frontend 100% (iteration_3), inga defekter.
- v4 (grundregler + bord): grundregler är nu riktiga valbara regelobjekt (kort-ikoner card:2/card:10) med egen sektion, förvalda men går att begränsa per match (visas överstrukna i historik om ej aktiva); drag-and-drop av spelare mellan bordsplatser (pointer events) auto-tilldelar position; matchdetalj visar bordsvy med placering + Elo-badge + utgångskort/bonus; Elo-förklaring i klarspråk på Regler-sidan; sistaplacerad väljer inget utgångskort; V-ringad-ikon = tydlig V-ringad t-shirt (SVG); patch note Beta 0.2.1.
- Testat: backend 44/44 pytest, frontend 100% (iteration_4), inga defekter.
- v5 (rating + interaktion): Elo-golvregel (placering i övre halvan kan aldrig ge minus på parvisa uträkningen; utgångsbonus läggs till efteråt); längre placeringsfas (hög K de första 20 matcherna istället för 10); regelbeskrivningar syns på regelkort + info-sheet vid val; slutplacering sätts med drag-and-drop (pointer events) istället för pilar; historiklistan visar övriga deltagares namn.
- Testat: backend 47/47 pytest, frontend 100% (iteration_5), inga defekter. Golvregel verifierad live.

## Backlog (ej gjort)
- P1: Elo-graf per spelare över tid (recharts).
- P2: Drag-and-drop av spelare mellan bordsplatser (nu tap-to-assign); auto-popup röstning 1:a i månaden; redigera/ta bort match.
- P2: Bildavatar-uppladdning (object storage); admin-vy för att rensa enskilda konton.

## Nästa steg
Se Next Action Items i finish-summary.
