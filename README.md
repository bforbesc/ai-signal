# AI Signal

A scrollable, social-feed-style PWA for reading AI newsletters (Alpha Signal + The Batch) from a Gmail label. Installs to the iPhone home screen — no App Store.

**Status:** v1 scaffold. Steps 1–3 of the build plan are done (Vite + React + TS + Tailwind + PWA shell + Google sign-in smoke test). Feed and reader come next.

**Stack:** Vite · React · TypeScript · Tailwind · vite-plugin-pwa · Zustand · Dexie · Google Identity Services. Hosted on Cloudflare Pages. $0 / month.

---

## Deploy from iPhone (no laptop needed)

Every step works in mobile Safari. Do them in this order so you only need to redeploy once.

### 1. Deploy to Cloudflare Pages — get your URL first

1. Sign up: https://dash.cloudflare.com/sign-up
2. Dashboard → **Workers & Pages** → **Create application** → **Pages** tab → **Connect to Git**
3. Authorize Cloudflare on GitHub → pick **bforbesc/ai-signal**
4. **Production branch** → change to `claude/ai-signal-pwa-WivN3` (or whichever branch holds the latest code)
5. **Framework preset** → pick **Vite** (auto-fills build command `npm run build`, output dir `dist`)
6. **Save and Deploy** → wait ~2 min → copy the URL (`https://ai-signal-xxx.pages.dev`)

Sign-in will error with "Missing VITE_GOOGLE_CLIENT_ID" — expected, wired up below.

### 2. Set up Google OAuth — uses the URL from step 1

1. https://console.cloud.google.com → project dropdown (top) → **New Project** → name `AI Signal` → **Create**
2. Enable Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com → tap **Enable**
3. OAuth consent screen: https://console.cloud.google.com/apis/credentials/consent
   - **External** → **Create**
   - App name: `AI Signal`, support email + developer contact: your Gmail → **Save and Continue**
   - Scopes step → **Add or Remove Scopes** → search `gmail.readonly` → check → **Update** → **Save and Continue**
   - Test users → **Add Users** → your Gmail → **Save and Continue**
   - **Leave in "Testing" mode — do NOT publish.** No verification needed for personal use.
4. Credentials: https://console.cloud.google.com/apis/credentials
   - **Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `AI Signal`
   - **Authorized JavaScript origins** → add the Cloudflare URL from step 1 (no trailing slash)
   - **Create** → copy the **Client ID** (`....apps.googleusercontent.com`)

### 3. Wire up env var and redeploy

1. Cloudflare dashboard → your Pages project → **Settings → Environment variables → Production**
2. Add: name `VITE_GOOGLE_CLIENT_ID`, value = the client ID you just copied → **Save**
3. **Deployments** tab → **⋯** on the latest deployment → **Retry deployment**

The env var is baked in at build time, not runtime, so a redeploy is required whenever you change it.

### 4. Install on iPhone home screen

1. Open the Cloudflare URL in **Safari** (PWA install only works in Safari — not Chrome/Brave)
2. Tap **Share** → scroll → **Add to Home Screen** → **Add**
3. Tap the new icon → launches standalone → **Sign in with Google** → your email appears

---

## What's free

| Component | Cost | Notes |
|---|---|---|
| Cloudflare Pages | $0 | Unlimited bandwidth, 500 builds/mo, free `*.pages.dev` subdomain |
| Google Cloud / Gmail API | $0 | Keep consent screen in **Testing** mode (no verification needed) |
| GitHub public repo | $0 | |
| No backend, no DB | $0 | Direct browser → Gmail; IndexedDB on-device |

Do **not** publish the OAuth consent screen (triggers Google's verification flow). Do **not** put any secret (Anthropic API key, `client_secret`) in a `VITE_*` env var — those get bundled into public JS. The Google OAuth **client ID** is public by design; security comes from the authorized-origins allowlist.

---

## Local development (optional)

```bash
cp .env.example .env   # paste your VITE_GOOGLE_CLIENT_ID
npm install
npm run dev            # http://localhost:5173
```

Add `http://localhost:5173` as an authorized JavaScript origin in the same OAuth client.

---

## Roadmap

See the build plan for the full v1 / v2 split. Next up after the auth smoke test:

- Gmail API client + HTML body decoder (`src/lib/gmail.ts`)
- Dexie schema + sync loop
- Feed UI (cards, source tabs, relative dates)
- Reader (sandboxed iframe)
- Pull-to-refresh + infinite scroll
- Offline behavior
