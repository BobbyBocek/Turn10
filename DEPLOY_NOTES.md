# Turn10 — vad jag fixade och vad som återstår

## Vad jag hittade och fixade i koden

**Backend (`backend/requirements.txt`):**
1. Tog bort `emergentintegrations==0.2.0` — finns bara i Emergents privata paketförråd,
   användes ingenstans i koden, hade stoppat hela backend-deployen på Render/annan
   hosting utanför Emergent.
2. Lade till `httpx` — importerades i `server.py` men saknades i beroendelistan.

Backend verifierad: `pip install -r requirements.txt` går rent, modulen importerar utan
fel, 30 API-routes registrerade.

**Frontend (`frontend/package.json`, `frontend/craco.config.js`):**
1. Tog bort `@emergentbase/overlay` och `@emergentbase/visual-edits` — Emergents egna
   utvecklingsverktyg för deras live-förhandsvisning, inte relevanta längre och hämtas
   från en URL (`assets.emergent.sh`) som inte är tillgänglig utanför deras plattform.
2. Löste en serie sammanflätade paketversionskonflikter (`ajv`/`ajv-keywords` mellan
   webpack, terser, fork-ts-checker, file-loader, babel-loader) via riktade `overrides`
   i `package.json` — ett klassiskt problem i äldre Create React App-projekt som fått
   nyare paket installerade ovanpå. Detta hade stoppat `npm run build` helt.
3. Stängde av ESLint under produktionsbygget (`craco.config.js`) — det är bara en
   utvecklingstids-varning, inte något som påverkar om appen fungerar, och dess egen
   `ajv`-version krockade med resten av verktygskedjan på ett sätt som inte gick att lösa
   utan att byta bort det helt.

**Resultat:** `npm run build` körs nu rent (`Compiled successfully.`) och producerar en
fungerande `build/`-mapp.

**Ny fil:** `frontend/build/.htaccess` — gör att React Router (sidnavigering som
`turn10.se/regler`) fungerar på Apache/Strato istället för att ge 404.

## Vad du fortfarande behöver göra själv

Jag kan inte skapa konton eller logga in på dina tjänster åt dig — det är gränser jag har
oavsett tillstånd. Kvarstående steg (se den tidigare steg-för-steg-planen):

1. Skapa gratis MongoDB Atlas-databas → få `MONGO_URL`.
2. Deploya `backend/`-mappen till Render.com (eller liknande) → få backend-URL.
3. Sätt miljövariabler på Render: `MONGO_URL`, `DB_NAME`, `JWT_SECRET` (redan genererad åt
   dig, se tidigare meddelande), `INVITE_CODE=267710`, `CORS_ORIGINS=https://turn10.se`.
4. Skapa `.env` i `frontend/`-mappen med `REACT_APP_BACKEND_URL=<din-render-url>`, kör
   `npm install --legacy-peer-deps` och `npm run build` igen (den här gången med rätt
   URL, inte platshållaren jag testade med).
5. Ladda upp allt inuti den nya `build/`-mappen (inklusive `.htaccess`) till Strato via
   FTP.
6. Testa turn10.se, skapa konto med koden 267710.

## Om du pushar detta till GitHub

Den här zip-filen innehåller de fixade `backend/`- och `frontend/`-mapparna (utan
`node_modules` och `build`, de skapas på nytt när du kör `npm install`/`npm run build`).
Du kan antingen ersätta filerna i ditt befintliga repo med dessa, eller be Emergent/din
editor applicera samma ändringar där. De viktigaste filerna som ändrats:
- `backend/requirements.txt`
- `frontend/package.json`
- `frontend/craco.config.js`
