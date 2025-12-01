# Everyday PWA (Next.js modular scaffold)

This scaffold provides a modular Next.js PWA designed to deploy to Azure Static Web Apps.

Quick start:

1. Install dependencies

```powershell
npm ci
```

2. Run locally

```powershell
npm run dev
```

3. Open `http://localhost:3000` and visit `/admin` to toggle modules.

Notes:
- The project includes a simple service worker at `public/sw.js` and `public/manifest.json`.
- Module registry is `data/modules.json` and editable via `GET/POST /api/modules`.
- API routes are in `pages/api/*`. Data is stored in `data/*.json` as simple stubs.
- Replace placeholder icons in `public/icons` with real PNGs before publishing.
