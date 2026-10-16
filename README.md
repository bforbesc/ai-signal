# AI Signal

**Read your Gmail newsletters like a book.**

AI Signal turns the Gmail label `_AI_SIGNAL` into a quiet reading feed. Open an edition, adjust the text, and move to the next. It works in a browser and can live on your iPhone Home Screen.

[Overview](https://bforbesc.github.io/ai-signal/) · [Set up your own](https://bforbesc.github.io/ai-signal/setup.html) · [Development](docs/DEVELOPMENT.md) · [Privacy](PRIVACY.md)

<p>
  <img src="docs/images/feed-preview.jpg" alt="AI Signal feed with fictional sample newsletters" width="250" />
  <img src="docs/images/reader-preview.jpg" alt="AI Signal reading view with comfortable serif text" width="250" />
</p>

*Screenshots use original, fictional sample editions. No private email is shown.*

## What it does

- Collects newsletters from one Gmail label, newest first.
- Detects publications automatically and lets you filter by newsletter.
- Offers a clean reading view, with the original email layout available.
- Remembers text size, default view and image preferences on your device.
- Keeps article links working and removes common signup menus and email footers.
- Restores your Gmail connection when you return to a configured private deployment.

You read the original writing. There are no generated summaries, email sending or notifications.

## Set up your own reader

This is an **open-source personal app template**. You deploy your own copy and connect your own Gmail account. The author's installation is private.

The current hosting setup uses **Codex with the Sites plugin**. You also need a Google account, a Google Cloud project with Gmail API enabled, and your own web OAuth client. Hosting and account requirements depend on your provider; this is not an App Store app.

1. **Create a private copy.** Fork this repository and follow the [setup guide](https://bforbesc.github.io/ai-signal/setup.html). Create a new Sites project; do not reuse the author's project ID or Google configuration.
2. **Connect your Gmail.** Configure your OAuth client and protected server settings, then tap **Connect Gmail** in your reader.
3. **Label your newsletters.** In Gmail, create `_AI_SIGNAL` and apply it to the editions you want to read. A Gmail filter can label future emails automatically.
4. **Read on your phone.** Open your reader in Chrome or Safari and use **Share → Add to Home Screen**.

The [full guide](https://bforbesc.github.io/ai-signal/setup.html) includes the Google Cloud fields, callback URL, persistent-login setup and common fixes. No Apple Developer membership is needed.

## Try the sample locally

You can explore the reading experience without connecting Gmail. Use Node.js **22.23 or newer**:

```sh
git clone https://github.com/bforbesc/ai-signal.git
cd ai-signal
npm ci
```

Create an ignored `.dev.vars` file containing:

```dotenv
APP_ORIGIN=http://127.0.0.1:5173
```

Then start the preview:

```sh
npm run dev -- --hostname 127.0.0.1 --port 5173
```

Open [the local preview](http://127.0.0.1:5173/signin-with-chatgpt?return_to=/) to enable a simulated local identity and read the sample editions. No real ChatGPT or Gmail sign-in is needed for the sample. To connect real mail, finish your own Google/server setup first. See [Development](docs/DEVELOPMENT.md) for local database setup and deployment details.

## Your data

Google's read-only Gmail permission covers the mailbox; the application restricts its reads to `_AI_SIGNAL`. A configured server stores an encrypted connection so it can renew access. Email content is not archived in the app's database or browser storage.

Remote images are off by default. **Sign out** deletes your saved connection from the app. You can also revoke access in your Google Account. Read the [privacy notice](PRIVACY.md) for details.

The code currently relies on Sites authentication. Deploying it on a different host requires implementing and reviewing a trusted identity boundary first; uploading it to a static host will not provide persistent Gmail login.

## Working on the project

```sh
npm run check:secrets
npm run typecheck
npm test
npm run build
```

Architecture, configuration, migrations and current limits are documented in [Development](docs/DEVELOPMENT.md). To report an issue, include your browser, the steps and a redacted screenshot. Keep private emails and credentials out of public issues.

## Licence

[MIT](LICENSE) — use, adapt and share your own copy. Keep the licence and copyright notice. Third-party dependencies retain their own licences.
