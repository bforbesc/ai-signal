# AI Signal

A quiet, Kindle-inspired reader for newsletters in the exact Gmail label `_AI_SIGNAL`. Use it in Chrome on iPhone or add it to the Home Screen. No Apple developer membership or weekly installation is needed.

**App:** https://ai-signal-reader.opalash6.chatgpt.site

**Public app information:** https://bforbesc.github.io/ai-signal/ · **Privacy:** https://bforbesc.github.io/ai-signal/privacy.html

The public demo contains fictional editions. Private emails and personalised newsletter links are not included in the repository.

## Reading

- One newest-first feed, with automatic publication detection and newsletter filters.
- Warm paper, serif body text and a compact title that scrolls with the article.
- Reading view removes standalone signup/social menus, feedback controls and administrative footers. Long contents lists fold under **In this edition**.
- Linked story headlines stay tappable after cleanup and open the publisher's destination separately.
- **Aa** saves text size, default reading/email layout and image preferences on the device. Tap outside to close it.
- Read-only Gmail access. No email sending/deleting, generated summaries or notifications.

## Staying connected

The hosted server supports Google's authorization-code flow with offline access. When configured, the app restores the connection on opening and renews short-lived access automatically. Closing the app does not discard the Google connection.

Sites owns app sign-in. Server records are bound to its trusted, stable visitor ID. Google access/refresh tokens and the connected email address are encrypted together with AES-GCM in D1. The encryption key and Google client secret exist only in hosted secret settings. Browser JavaScript receives connection status, not Google tokens. Gmail reads pass through a server route that enforces `_AI_SIGNAL`, including individual messages and attachment bodies.

Until server credentials are configured, the app retains its browser-only connection. That fallback keeps access tokens in memory and must reconnect after closing or expiry. It does **not** provide persistent sign-in. Saving a token in localStorage would not solve automatic renewal.

Google can still require reconnecting after consent is revoked, a password changes, or its refresh grant expires. An External OAuth project in **Testing** issues Gmail refresh tokens that expire after seven days. For lasting personal use, change Google Auth Platform → Audience to **In production** and reconnect once. This does not publish the private reader or its emails. Google's personal-use verification exception can apply; an unverified-app warning and user cap may remain. See [Google's expiration rules](https://developers.google.com/identity/protocols/oauth2#expiration) and [personal-use exception](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification#personal-use).

## One-time Google/server setup

1. Enable **Gmail API** in the Google Cloud project and declare `https://www.googleapis.com/auth/gmail.readonly` in Data Access.
2. Use a **Web application** OAuth client. Its public client ID is already configured for this deployment.
3. Keep the existing Authorized JavaScript origin and add this **Authorized redirect URI**:
   `https://ai-signal-reader.opalash6.chatgpt.site/api/auth/google/callback`
   For Google Cloud Branding, use the public app-information URL above as **Application home page**, the public Privacy URL as **Application privacy policy link**, and add `bforbesc.github.io` to **Authorised domains** alongside the existing reader domain. Save, then return to Audience → Publish app. These public pages contain no Gmail content and are hosted separately from the private reader. They do not replace the OAuth redirect URI.
4. In the hosting environment settings, configure these server runtime values:

   | Name | Storage |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | Public OAuth client ID |
   | `GOOGLE_CLIENT_SECRET` | Secret, from the web client |
   | `APP_ENCRYPTION_KEY` | Secret, a cryptographically random 32-byte base64/base64url key |
   | `APP_ORIGIN` | Exact deployed origin, without a path |

5. Redeploy after changing runtime values. Open the app and tap **Connect Gmail** once to grant offline read-only access.

Never put a client secret or encryption key in `VITE_` variables, the hosting manifest, source files or a committed environment file. Keep downloaded OAuth JSON outside this repository. `.env.example` documents names only. Secret settings are separate from Git and build inputs. Keep the encryption key stable; replacing it makes existing saved connections unreadable.

The Sites manifest retains the existing project identity, uses a `DB` D1 binding and declares no connected-app access. The site remains private to its owner. This server trusts Sites-injected identity headers; do not expose it behind an untrusted proxy or deploy it unchanged as an unauthenticated public Worker.

Google authorization is mailbox-wide; the application limits its reads to `_AI_SIGNAL`. The personal app does not require paid Gmail quota or an Apple account. Distribution to other users needs its own review of Google's requirements.

## Run locally

Use Node.js 22.23+ and install the locked dependencies:

```sh
npm ci
npm run build
```

For a persistent local connection, put server values in an ignored `.dev.vars` file, set `APP_ORIGIN` to the actual loopback origin and register its matching Google redirect URI. Apply the checked-in migration to the local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_pretty_hannibal_king.sql
npm run dev
```

The portable preview simulates Sites sign-in only on loopback: `/signin-with-chatgpt?return_to=/`. Hosted identity is supplied by Sites. Demo reading works without Google secrets. The local database is separate from production. Schema changes use `npm run db:generate`; preserve applied migrations.

```sh
npm run typecheck
npm test
npm run build
```

The app uses the supported Vinext/Cloudflare Sites server starter while retaining the existing React reader. Publish the built Worker and `dist/.openai` metadata through the Sites source workflow; this version is no longer a static-only `dist/` deployment. The service worker does not cache authenticated pages, Gmail content or tokens.

The `docs/` directory is the public information/privacy site, published with GitHub Pages from `main` → `/docs`. It has no application code, server credentials or Gmail access. Keep its privacy notice and `PRIVACY.md` consistent when data handling changes.

## iPhone

Open the hosted link in **Chrome → Share → Add to Home Screen → Add**. Complete Sites sign-in and Connect Gmail in the browser you will use. The Home Screen app and Chrome can have separate app sign-in sessions; each authenticated session restores the same owner-bound Gmail connection. The loopback development URL is not the iPhone deployment.

The Home Screen icon is a cream signal mark on green, matching the reader. Its 180px iPhone icon and 192/512px manifest icons are real, opaque PNGs rendered from `public/icon.svg`. Identical copies in `docs/` let the installer fetch the public icon without a Sites sign-in cookie; the reader itself remains private. If an older installation shows “A”, remove its Home Screen shortcut, reload the actual reader in your browser, and add it again. The source icon has a full square background so iOS can apply its own corner shape.

## Privacy and limits

See the [privacy notice](PRIVACY.md) for the deployed reader's data handling and connection-deletion controls. Google Cloud branding and app verification are separate from the reader's private Sites audience; do not make the reader public to change OAuth publishing status.

Emails are not archived in localStorage, IndexedDB or a server database. Google credentials are encrypted server-side in persistent mode; Sign out deletes that visitor's saved connection and pending authorization. In browser fallback, credentials remain in memory. Device storage holds only public connection settings and reading preferences.

Email HTML is rebuilt into an allowlist in an isolated, scriptless iframe. Scripts, forms and embedded frames are blocked. Remote images start off; enabling them remembers the preference and can contact image hosts. Detected one-pixel images stay excluded. Article links open separately. **Email layout** retains the original formatting and controls when needed.

Publication identity uses `List-ID` or the sender address. Discovery reads headers in small batches; full bodies paginate separately. There is no inbox fallback. Inline `cid:` attachments and non-UTF-8 email encodings are not specially handled.

Tests cover Gmail parsing/filtering, reader cleanup/isolation and server authorization: restoration, renewal, encrypted storage, user isolation, CSRF/state replay, label enforcement, revocation and sign-out. The reader was inspected with a real AlphaSignal edition from top to bottom at 375px and 402px widths. Private test content stays outside the repository and deployment. A real Google offline authorization and physical iPhone reopen still require the owner's one-time setup and verification; mocked tests do not prove that consent flow.

## REA

REA 6.5.0 was run against Meco's public web bundle during the initial investigation. Analysis did not complete because of a worker heap limit. This app is an original implementation; it contains no Meco code or claims about its internals.
