# BabyFat V8.1 Production

正式架構

Browser
  -> Cloudflare Worker API
  -> D1 database
  -> immediate booking confirmation

Cloudflare background sync
  -> Google Apps Script
  -> Google Sheets mirror

Google Sheets staff edits
  -> Apps Script installable onEdit
  -> authenticated Worker internal API
  -> D1

Important files
- src/worker.js               Worker API
- public/                     Website
- migrations/0001_init.sql   D1 schema
- wrangler.jsonc              Cloudflare deployment config
- V8_DEPLOY_GUIDE.txt         Step by step deployment

Before first deploy
1. Create D1 database `babyfat-production`.
2. Replace `PASTE_D1_DATABASE_ID_HERE` in wrangler.jsonc.
3. Apply migrations/0001_init.sql to D1.
4. Deploy Worker.
5. Configure Sheet sync according to V8_DEPLOY_GUIDE.txt.


V8.1 adds people-first lesson selection, family-safe routing, share-class matching metadata, dual-coach pricing, season phases, and 24H full-day bonus tracking.
