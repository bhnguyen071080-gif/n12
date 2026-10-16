# Embedded print fonts

Unmodified Noto Serif Regular and Bold, downloaded from the Noto project's official Latin Greek Cyrillic distribution. SIL OFL 1.1 is included in OFL.txt. No browser requests to Google Fonts are needed when printing private documents.

The pretest/prebuild step downloads the public fonts into the ignored build-assets directory, verifies exact hashes and includes them in the server bundle. No user template or document is downloaded at build time. Builds fail closed if an upstream font changes.

Source: https://notofonts.github.io/latin-greek-cyrillic/fonts/NotoSerif/hinted/ttf/

SHA-256:
- NotoSerif-Regular.ttf: a8723b852088276eb9900f0183eeac4de61fc6693ea4465e2df9c4d8e134b153
- NotoSerif-Bold.ttf: 5c810609bfb7a58bd0a0acefccd4cca63be48c0a4735ff1370b8866fea050680

This serif substitution for Times New Roman avoids redistribution of a proprietary desktop font. Original Word templates remain private and unchanged; the PDF layout is normalized to the approved A4/A5 geometry.
