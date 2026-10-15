# Native iOS validation

Source commit: `70cfc6d`.

GitHub Actions run: https://github.com/bforbesc/ai-signal/actions/runs/38818523066

Completed successfully on 2026-10-15:

- iOS Simulator build of `ios/AISignal/AISignal.xcodeproj`, scheme `AISignal`, with signing disabled.
- 11 executable Foundation checks for Unicode/base64url decoding, invalid body data, nested MIME, text-attachment exclusion, sender/subject headers, date conversion, missing values and exact `_AI_SIGNAL` label matching.
- Local Swift syntax, plist/project validation and `git diff --check` also passed.

This verifies compilation and model parsing. It does not verify real Google consent, a live mailbox, newsletter appearance or installation on an iPhone. Those require the iOS OAuth client, Apple signing and the manual device checks in `ios/AISignal/README.md`.

REA's separate attempt to analyze Meco did not complete; see `rea-investigation.md`.
