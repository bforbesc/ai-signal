# AI Signal for iPhone

A small SwiftUI app for newsletters carrying the exact Gmail label `_AI_SIGNAL`. Swipe vertically between newsletter previews, then tap **Read newsletter** for the complete email. The reader scrolls normally; tap Done to return to the same feed position.

## What works in this implementation

- Google sign-in using Google's native iOS SDK and Keychain session restoration.
- Read-only Gmail API requests, filtered by the `_AI_SIGNAL` label ID. Message membership is checked again before display.
- Newest-first feed, 15-message pagination, deduplication, refresh, empty/error states and retry.
- Automatic refresh on returning to the app after five minutes.
- Nested multipart email decoding, HTML/plain-text reader, Unicode/base64url decoding.
- JavaScript disabled in the email reader, forms/frames/network blocked by CSP, external links opened in Safari. Remote images start blocked and can be enabled per reading session.
- Sample feed available before Google configuration. Sample stories are explicitly marked.

No backend, analytics, email writing, deleting or Gmail read-status changes. Message bodies stay in memory and are cleared when signing out. Google credentials are managed by the Google SDK; the app does not write tokens to its own files.

## Open and install

1. Install the current Xcode from the Mac App Store. Open `AISignal.xcodeproj`. Let Swift Package Manager resolve GoogleSignIn 9.x.
2. In **Signing & Capabilities**, select your Apple team and choose a unique bundle identifier. Put the same value in `APP_BUNDLE_ID` in `Config.xcconfig`.
3. In [Google Cloud](https://console.cloud.google.com/), enable **Gmail API**, configure the OAuth consent screen with `https://www.googleapis.com/auth/gmail.readonly`, and add your Gmail address as a test user when using Testing mode.
4. Create an OAuth client of type **iOS** for that exact bundle identifier. The existing PWA's Web OAuth client cannot replace this iOS client. No client secret is needed.
5. In `Config.xcconfig`, replace `GOOGLE_CLIENT_ID` with the iOS client ID and `GOOGLE_REVERSED_CLIENT_ID` with the iOS URL scheme shown in Google's client settings. Do not add quotes. These IDs are public identifiers, not passwords.
6. Connect your iPhone, enable Developer Mode if asked, choose it as the run destination, and press Run. Tap **Sign in with Google**, allow read-only Gmail access, and open the feed.
7. Ensure the exact `_AI_SIGNAL` label exists and has messages. An unlabelled inbox is never used as a fallback.

For **TestFlight**, use an Apple Developer Program membership, create the app in App Store Connect with the same bundle identifier, increment the build number for subsequent uploads, and use **Product → Archive → Distribute App → App Store Connect**. Add yourself as an internal tester, process the build, then install from TestFlight. External testing may require Apple's beta review. Direct Xcode installation is another option; free personal signing has renewal limits.

## Google access

Google's `gmail.readonly` scope covers the mailbox, not a single label. This implementation enforces `_AI_SIGNAL` in its queries and checks. Testing-mode authorizations may need reconnection; do not assume they are permanent. Public distribution and moving beyond personal testing can require Google's verification requirements.

## Validation

Local checks performed during creation: Swift syntax parsing, project/plist validation and 11 executable Foundation checks for MIME parsing and message mapping. A full iOS build requires Xcode; this workspace initially had only Command Line Tools. The repository's **iOS build** workflow compiles the app for the simulator and runs the decoder checks on a macOS runner.

Manual device acceptance:

1. Preview samples without Google configuration.
2. Sign in with the intended Google account and verify only `_AI_SIGNAL` messages appear, newest first.
3. Swipe through more than 15 messages, open both HTML and plain-text newsletters, follow an article link, and return.
4. Add a newly labelled message in Gmail and refresh.
5. Sign out and confirm the feed disappears; relaunch and check session restoration after reconnecting.
6. Test denied Gmail permission, an empty/missing label, network loss, expired access and retry.

## Current limits

No offline email cache, push notifications, summaries, account switching UI or background synchronization. Attachment-backed MIME bodies and inline `cid:` images are not downloaded; text/snippet fallbacks are shown. Header encodings beyond Google's returned header strings are not specially decoded. Full Gmail sign-in and rendering still need an actual device check.

## REA

REA is a development-time investigation tool, not an app dependency. See `../../docs/rea-investigation.md` for exactly what was analyzed and the limitations. No Meco code is included in this app.
