# AI Signal

A simple web app for reading newsletters from the exact Gmail label `_AI_SIGNAL`. Open it in Chrome on iPhone or desktop, or add it to your Home Screen. There is no seven-day app-signing limit.

**Demo:** https://ai-signal-reader.opalash6.chatgpt.site

The demo contains fictional AlphaSignal-style editions. Real email content is fetched only after you connect your own Google account; no private emails or personalised links are bundled in this repository.

## Current version

- One newest-first feed with automatic newsletter detection.
- **All newsletters** or a filter for a specific publication. AlphaSignal is the only source in the demo; additional newsletters are detected when added to `_AI_SIGNAL`.
- A Kindle-inspired reader: warm paper, serif text, comfortable margins, minimal controls.
- **Aa** opens text-size controls, original email layout and optional remote images.
- Read-only Gmail access, refresh, pagination, reconnect and clear empty/error states.

The current product is the web/PWA version. Xcode, TestFlight and Apple Developer Program enrollment are not required.

## Run locally

Use Node.js 22.23+ (or a compatible newer release).

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. The demo works without Google configuration. `npm test` runs the email and reader tests; `npm run build` typechecks and builds `dist/` with its manifest and service worker.

## Connect Gmail — one-time setup

Google needs a **Web application** OAuth client, not the iOS client used by a native app. Standard personal Gmail API usage is available at no additional cost. Do not buy a plan or request paid quota increases for this reader.

1. In [Google Cloud](https://console.cloud.google.com/), create or select a project, then enable **Gmail API**.
2. Configure **Google Auth Platform → Branding** with the app name AI Signal and your support/contact email.
3. In **Audience**, choose External for a personal Gmail account, keep the project in Testing and add your own Gmail address as a test user.
4. In **Data Access**, add `https://www.googleapis.com/auth/gmail.readonly`.
5. In **Clients**, create a **Web application** client. Add the exact app origin under **Authorized JavaScript origins**:
   - `https://ai-signal-reader.opalash6.chatgpt.site`
   - For local development, add the actual local origin printed by Vite, such as `http://127.0.0.1:5173`.
6. Open the app’s settings button, paste the public client ID, and save. Then tap **Connect Gmail**. Alternatively, set `VITE_GOOGLE_CLIENT_ID` before building.
7. Make sure the exact `_AI_SIGNAL` Gmail label contains the editions you want to read.

No client secret, API key or payment information belongs in this app. Access tokens stay in memory; the public client ID and chosen text size are stored in the browser. Configuring a client ID in settings applies to that browser/device. Setting the public ID at build time avoids repeating this setup on other devices.

Google authorization is mailbox-wide; the application enforces `_AI_SIGNAL` in its queries and verifies membership. Google sessions expire: reconnecting through the app is separate from reinstalling it. The app itself has no weekly expiry. There is no backend token store or automatic background sync.

## Add to your iPhone Home Screen

Open the deployed link in **Chrome** → **Share** → **Add to Home Screen** → **Add**. Safari also works. Open the new icon to launch the app. Google sign-in may need to be completed separately in the Home Screen app because its browser session can differ.

## How newsletter detection works

Publication identity uses the email’s `List-ID` header when available and otherwise its sender address. That keeps different newsletters separate even when they share a delivery service. Header-only discovery walks the labelled messages in small batches, while full email bodies load a page at a time. Filtering uses a Gmail search plus a source-membership check. It never falls back to reading an unfiltered inbox.

## Reading and privacy

The reading view rebuilds the email into a small HTML allowlist inside an isolated iframe. Scripts, forms and embedded frames are blocked. Remote images start off; loading them can contact the newsletter’s image hosts. Detected one-pixel images remain excluded. Article links open separately. The original-layout option retains the newsletter’s visual formatting when needed.

Emails and Google access tokens are not saved to localStorage, IndexedDB or a server. Signing out clears the local session. The service worker caches the application shell, not Gmail responses; previously loaded messages do not survive a page reload.

## Deployment

The repository builds to `dist/` and can also be hosted on Cloudflare Pages or another static HTTPS host. Use `npm run build` and deploy `dist/`. Set the OAuth authorized origin to the actual deployment address. Sites deployment metadata lives in `.openai/hosting.json`; keep its project identity unchanged when updating that existing Site.

## Validation and limits

Automated tests cover nested MIME/Unicode decoding, attachment-backed bodies, exact-label matching, source discovery/filtering, pagination failures and reader isolation. Mobile/desktop demo checks cover feed navigation and reading controls. Live Google consent and a real iPhone sign-in still need the Web OAuth client configuration above.

No AI summaries, email writing/deleting, Gmail read-state changes, notifications, backend or offline email archive. Inline `cid:` attachments are not downloaded. Email encodings beyond UTF-8 are not specially decoded. Reading view can simplify unusual email layouts; email layout remains available.

## REA

REA 6.5.0 was actually run against Meco’s public web bundle during the initial investigation. Analysis did not complete because of a worker heap limit. The web app does not use claims about Meco internals or include Meco code. It is an original implementation of the requested reading workflow.
