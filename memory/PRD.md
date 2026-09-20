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
- v2 (Turn10-rebrand): rebrand + logo; profiler (smeknamn + avatar bg/symbol); utgångsbonus;
  PlayingCard-komponent + exit-card picker; Home-dashboard; RoundTable på Ny match; card-shaped regelväljare;
  topplista-badges (🔥💬🥄👕🏆) + Månadens spelare + historik; V-ringad månadsomröstning; Spela igen; Min sida.
- Seed: admin Tommy + 5 spelare med smeknamn/ikoner, Turn10-regler (7 grund + 4 tillval), 4 exempelmatcher.
- Testat: backend 25/25 pytest, frontend 16/16 flöden (iteration_2, inga buggar).

## Backlog (ej gjort)
- P1: Elo-graf per spelare över tid (recharts).
- P2: Redigera/ta bort match + rulla tillbaka Elo; auto-popup av röstning 1:a i månaden; egna bordspositioner-UI.
- P2: Bildavatar-uppladdning (object storage).

## Nästa steg
Se Next Action Items i finish-summary.
