# Development

Start with the [personal setup guide](https://bforbesc.github.io/ai-signal/setup.html) if you want your own reader. This document covers the code and local environment.

## Requirements

- Node.js 22.23 or newer, npm and Git.
- Codex with the Sites plugin for the currently supported hosted deployment.
- Your own Google OAuth web client for real Gmail access. Sample editions need no Google credentials.

The app uses React, Vinext and a Cloudflare Worker with D1. Sites provides hosted app identity; Google authorization provides read-only Gmail access. These are separate connections.

## Local preview

Install the locked dependencies with `npm ci`. On a fresh clone, create an ignored `.dev.vars` file with the exact preview origin:

```dotenv
APP_ORIGIN=http://127.0.0.1:5173
```

Start with `npm run dev -- --hostname 127.0.0.1 --port 5173`. If you choose another port, update `APP_ORIGIN` and use that same origin in the browser. A different hostname, such as `localhost`, is a different origin.

The portable development server can simulate Sites sign-in on loopback. Visit `http://127.0.0.1:5173/signin-with-chatgpt?return_to=/` to create a local test identity. This is for development and is not included in the hosted authentication flow. `npm start` previews the production Worker and does not simulate sign-in.

### Connect Gmail locally

1. Configure your own Google web OAuth client as described in the setup guide. Add the local origin and `http://127.0.0.1:5173/api/auth/google/callback` to that client.
2. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_ENCRYPTION_KEY` to the ignored `.dev.vars` file. Keep `APP_ORIGIN` set to the local origin. Never commit these values.
3. Build once to generate the local Worker configuration:

   ```sh
   npm run build
   ```

4. On a **fresh local database**, apply the checked-in schema once:

   ```sh
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_pretty_hannibal_king.sql
   ```

5. Start the development server, use the loopback test sign-in, and connect Gmail yourself.

Do not replay an already applied migration. Local data lives under ignored `.wrangler/state` and is separate from the hosted database. After schema changes, run `npm run db:generate`, inspect the generated SQL and commit the migration and Drizzle metadata. Applied migrations are immutable.

## Runtime settings

| Setting | Purpose | Where to store it |
| --- | --- | --- |
| `APP_ORIGIN` | Exact reader origin, without a path or trailing slash | Server environment |
| `GOOGLE_CLIENT_ID` | Your web OAuth client's public identifier | Server environment |
| `GOOGLE_CLIENT_SECRET` | Your web OAuth client's secret | Protected server secret |
| `APP_ENCRYPTION_KEY` | A random 32-byte base64/base64url encryption key | Protected server secret |

Keep the encryption key stable: changing it prevents existing connections from being decrypted. Redeploy after changing hosted runtime values.

The optional browser fallback uses `VITE_GOOGLE_CLIENT_ID` at build time or a client ID entered in Connection settings. It keeps access tokens in memory and requires reconnecting after closing or expiry. It does not provide persistent Gmail login. Only a **public client ID** belongs in a `VITE_` variable.

The original deployment's public OAuth ID and origin remain compatibility defaults in `src/lib/auth.ts` and `server/google-session.ts`. They are not secrets, but **must not be used for a new installation**. Supply your own runtime settings, configure any browser fallback with your own client ID, and replace deployment-specific defaults when preparing your copy.

## Deploy your own copy

GitHub Actions validates the source, GitHub Pages publishes the documentation, and Sites publishes the private reader. When retiring an older Git-linked Cloudflare Worker, disable its automatic production and preview builds in the Worker's **Settings → Builds** to stop obsolete deployment checks.

Use the Sites plugin's supported source/build/publish workflow. For a new installation:

- Create a **new private Site** in your own account. Replace `.openai/hosting.json`'s original `project_id` with the new ID returned by Sites. A fork does not create a new hosting identity by itself.
- Retain the `DB` D1 binding and the Sites Vite/Worker integration. Sites applies the checked-in hosted migrations during publication.
- Configure your own server variables and secrets through hosting settings. Do not put credentials in source or the hosting manifest.
- Publish your fork's `docs/` directory with GitHub Pages, or host equivalent public information/privacy pages on a domain you control. Update the copy, operator contact and repository links for your installation.
- Replace the original public page/icon URLs in `app/layout.tsx`, `public/manifest.webmanifest`, `index.html` and the public docs. The PNG icon files are supplied in `public/icons/` and `docs/icons/`.

This build is a Worker deployment, not a static-only app. Keep the manifest's project identity and D1 binding consistent with the new Site. A standalone Worker or another host also needs a trusted app authentication layer; do not accept visitor-supplied identity headers on a public endpoint.

The `docs/` site is separate from the private reader. GitHub Pages hosts documentation, icons and fictional screenshots only. It does not run the Gmail server or receive mailbox access.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/App.tsx`, `src/components/` | Feed, reader and settings |
| `src/lib/gmail.ts`, `src/hooks/useFeed.ts` | Gmail parsing, pagination and publication filters |
| `src/lib/reader.ts` | Email cleanup and isolated reading document |
| `src/lib/session.ts`, `src/store/useAuth.ts` | Connection restoration and browser fallback |
| `server/google-session.ts`, `app/api/` | OAuth exchange/renewal, encrypted storage and label-restricted proxy |
| `db/`, `drizzle/` | Connection/state schema and migrations |
| `docs/` | Public overview, setup guide and privacy notice |

## Validation

Run `npm run check:secrets`, `npm run typecheck`, `npm test` and `npm run build`. Tests cover MIME parsing, exact label matching, publication filters, reader cleanup and link preservation, isolated rendering, OAuth state checks, encrypted credentials, session renewal, user isolation and sign-out.

For a deployment, also test your own Google consent flow, load an edition, open an article link, and close/reopen the reader on your phone. Unit tests do not prove a real account's OAuth configuration or a physical iPhone's behaviour.

Use fictional content for public screenshots. Keep real-email fixtures under ignored `.local-qa/` or outside the checkout, and remove them after testing. The secret scanner reports finding categories and locations without printing credentials; `--history` adds reachable Git history and `--bundle` adds `dist/client`.

Use your GitHub no-reply address for public commits if you want to keep your personal email address out of author/committer metadata. A clean source-file scan does not check Git author identities.

## Current limits

The reader supports multiple newsletter publications on any topic from one connected Gmail account. Publication grouping uses `List-ID` or the sender address; there is no publisher allowlist. The label name is exactly `_AI_SIGNAL`. There is no inbox fallback or label picker. Inline `cid:` images and non-UTF-8 encodings are not specially handled, and cleanup can vary with email formatting. Images are optional and off by default. There is no offline email archive, generated summary, mail editing or native App Store package.
