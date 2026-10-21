# Embedded print fonts

Unmodified Noto Serif Regular and Bold from the official Noto Fonts repository, pinned to commit `ffebf8c1ee449e544955a7e813c54f9b73848eac`. The matching SIL OFL 1.1 license is included in OFL.txt. No browser requests to Google Fonts are needed when printing private documents.

The pretest/prebuild step downloads the public fonts into the ignored build-assets directory, verifies exact hashes and includes them in the server bundle. No user template or document is downloaded at build time. Builds fail closed if an upstream font changes.

Source: https://github.com/notofonts/noto-fonts/tree/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/NotoSerif

Downloads use the full commit URL on raw.githubusercontent.com, not a moving branch or distribution website. A cached asset is reused only when its hash matches. Missing or mismatched assets are fetched from the pinned commit; the build still fails if the downloaded bytes do not match. This removes the mutable font-distribution dependency that blocked clean builds on 21/10/2026.

SHA-256:
- NotoSerif-Regular.ttf: c8f669ceb2c9c60ccf55198b305e08a997ffca79a38cc7eeb551e643cbe66505
- NotoSerif-Bold.ttf: 3b2086a869bcded2aeb4416fc281ceec9d6ce3c06756cda19f8f763636204e7d

This serif substitution for Times New Roman avoids redistribution of a proprietary desktop font. Original Word templates remain private and unchanged; the PDF layout is normalized to the approved A4/A5 geometry.
