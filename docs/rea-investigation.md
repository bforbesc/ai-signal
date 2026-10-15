# REA investigation — 2026-10-15

Target requested: Meco, App Store ID 1505542541. Tool actually invoked: official `rea-agents` npm package, CLI version 6.5.0. REA is used for development investigation only; it is not bundled in AI Signal.

## Evidence and scope

- Read the project's official README, Apple application inventory guide and browser-observation guide.
- Ran `rea --help`, `rea inspect-web-page --help` and `rea analyze-javascript-application --help`.
- Attempted a dedicated headless Chrome session and `rea list-browser-targets http://127.0.0.1:9341 --json`. Chrome exited and discovery returned `endpoint_unreachable`. No browser observations were obtained.
- Downloaded the public HTML of `https://web.meco.app` and the one JavaScript asset it declared, `/static/js/main.bab2db22.js`. This is a public web-client artifact, not Meco's iOS binary. No account or private email data was accessed.
- Ran `rea analyze-javascript-application ./work/meco-web-assets --max-semantic-nodes 5000 --max-semantic-nodes-per-file 5000 --analysis-timeout-ms 45000 --json`.
- Initial static analysis could not compile REA's macOS process helper because the default compiler cache location was not writable. Reran with the supported `REA_DARWIN_MODULE_CACHE_PATH` set to a workspace directory.
- The helper then compiled and REA attempted semantic analysis. Its JavaScript worker exhausted its default 1 GiB heap on the approximately 3 MiB minified bundle. REA emitted partial application Evidence with 248 graph nodes and 610 edges, and reported `cleanup_incomplete` because process-table inspection was denied in this sandbox. A separate `ps` verification was also denied. Process cleanup could not be independently confirmed.
- Partial evidence ID: `ev_f86aa5f9332fd1753182c8bc27bc011cff9304b7e6186d85718e2c734bda146a`.

## What this establishes

REA was executed against Meco's public web bundle. Analysis did **not** complete successfully. The partial graph does not establish newsletter behavior, Google integration details, feed rendering or iOS implementation. No such claims are used in the native app.

No Meco IPA or `.app` bundle was available. Native reverse engineering has not occurred. Apple's App Store listing and the user's requested behavior provided the product reference; AI Signal's implementation is original SwiftUI code against Google's documented API.

## Reproduce outside this sandbox

Use official instructions at https://github.com/morluto/rea. With a legal local app artifact, use REA's artifact inventory/Apple application workflow. For the web client, use a dedicated Chrome profile and the browser observation guide, or save the current public assets and run static analysis with an appropriate heap budget. Verify and clean up resources reported by any failed attempt before opening another target. Filenames and hashes can change with Meco releases.

Raw captured assets and REA diagnostics are kept as local work files, not committed to this repository. No Meco source or assets are shipped with AI Signal.
