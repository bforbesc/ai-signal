# AI Signal privacy notice

Updated 16 October 2026. This notice describes the personal AI Signal deployment linked in the README. Other deployments of this public source code have their own operators and settings.

AI Signal displays newsletters from the exact Gmail label `_AI_SIGNAL`. Google grants the app read-only mailbox access; Google does not offer an OAuth permission restricted to one label. The application enforces that label when listing and opening messages. It also reads the connected account's email address to identify the connection. It cannot send, modify or delete mail with this permission.

The hosted reader is private to its owner and uses Sites sign-in. The server associates the stable Sites visitor ID with an encrypted Gmail connection in its database. The encrypted record contains Google access and refresh tokens and the connected email address. The encryption key and OAuth client secret are kept in hosting secret settings, separately from the public repository and browser bundle. The browser receives connection status rather than Google tokens. A legacy browser-only fallback, when server credentials are absent, holds a short-lived access token only in memory.

Email content passes through the hosting server to display the feed. AI Signal does not archive emails in its database or browser storage. Content remains in memory while being read. Device storage saves reading preferences and public connection settings. The service worker does not cache authenticated pages, Gmail content or tokens. Hosting providers process requests and may retain operational logs under their own policies.

AI Signal does not sell Google user data, use it for advertising, or send it to an AI model. Its use and transfer of information received from Google APIs follows the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. The app uses Google and the Sites hosting infrastructure to provide the reader.

Newsletter scripts, forms and embedded frames are removed from displayed email HTML. Remote images are off by default. Enabling images contacts their external hosts, which can receive your IP address and image-request information. Opening an article link visits that publisher's website under its own policies.

**Sign out** deletes the active visitor's saved Gmail connection and pending authorization states from the app database. It does not delete mail or revoke the Google-side authorization. You can separately remove AI Signal's access through [Google Account connections](https://myaccount.google.com/connections). You can clear device reading preferences using your browser's site-data controls. Infrastructure backups and operational logs are subject to the hosting provider's retention rules.

For questions about this personal deployment, contact its owner through the [repository](https://github.com/bforbesc/ai-signal). Do not post email content, access tokens, client secrets or downloaded OAuth JSON in a public issue.
