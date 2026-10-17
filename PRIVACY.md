# AI Signal privacy notice

Updated 17 October 2026.

This notice covers Bernardo Forbes Costa's [original private reader](https://ai-signal-reader.opalash6.chatgpt.site/). The public overview and setup pages show fictional sample content and do not connect to Gmail. People deploying their own copy are responsible for their own settings, privacy notice and contact details.

## Gmail access

AI Signal displays newsletters from the exact Gmail label `_AI_SIGNAL` and uses Gmail’s `UNREAD` flag for read status. Opening an unread edition marks it read in Gmail. The requested `gmail.modify` permission is broader than this feature: Google permits reading, composing, sending and moving mail to Trash. Google does not offer a label-specific OAuth grant. AI Signal’s server checks label membership before reads and status updates, permits only changes to `UNREAD`, and exposes no send, trash or delete routes. The connected account’s email address identifies the connection.

## Saved connection

The hosted reader is private to its owner and uses Sites sign-in. The server associates the stable Sites visitor ID with an encrypted Gmail connection in its database. The encrypted record contains Google access and refresh tokens and the connected email address. The encryption key and OAuth client secret are kept in hosting secret settings, separately from the public repository and browser bundle. The browser receives connection status rather than Google tokens. A legacy browser-only fallback, when server credentials are absent, holds a short-lived access token only in memory.

## Email content and device storage

Email content passes through the hosting server; it is not archived in the server database. The newest 30 editions, including subjects, sender details, text, HTML and read flags, are cached in this browser’s IndexedDB, separately for each Gmail account. Older editions are held in memory when loaded, and newer editions replace older cached editions. A small publication catalog is also saved for the newsletter filter. Local storage saves reading preferences, public connection settings and fictional-demo progress. Real read status is fetched from Gmail and updated there. The service worker does not cache authenticated pages or tokens. Hosting providers process requests and may retain operational logs under their own policies.

## How data is used

AI Signal does not sell Google user data, use it for advertising, or send it to an AI model. Its use and transfer of information received from Google APIs follows the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. The app uses Google and the Sites hosting infrastructure to provide the reader.

## Images and links

Newsletter scripts, forms and embedded frames are removed from displayed email HTML. Remote images are off by default. Enabling images contacts their external hosts, which can receive your IP address and image-request information. Opening an article link visits that publisher's website under its own policies.

## Disconnecting and deleting data

**Sign out** deletes the active visitor's saved Gmail connection and pending authorization states from the app database, and clears that Gmail account’s device edition cache. It does not delete mail or revoke the Google-side authorization. You can separately remove AI Signal's access through [Google Account connections](https://myaccount.google.com/connections). You can clear device cache, reading preferences and demo progress using your browser's site-data controls. Infrastructure backups and operational logs are subject to the hosting provider's retention rules.

## Contact

For questions about Bernardo Forbes Costa's original personal installation, contact him through the [repository](https://github.com/bforbesc/ai-signal). Do not post email content, access tokens, client secrets or downloaded OAuth JSON in a public issue. If you use another person's deployment, contact its operator.
