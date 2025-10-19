# MathLive offline assets

The MathLive library expects its fonts, sounds and virtual keyboard layouts to be
served from this directory when running in offline mode. The font and sound files
are not included in this repository snapshot because the Codex environment does
not support adding binary assets directly. Please upload the following files to
GitHub (or copy them from `node_modules/mathlive`) before deploying:

## Fonts (`vendor/cdn/mathlive/fonts/`)
- KaTeX_AMS-Regular.woff2
- KaTeX_Caligraphic-Bold.woff2
- KaTeX_Caligraphic-Regular.woff2
- KaTeX_Fraktur-Bold.woff2
- KaTeX_Fraktur-Regular.woff2
- KaTeX_Main-Bold.woff2
- KaTeX_Main-BoldItalic.woff2
- KaTeX_Main-Italic.woff2
- KaTeX_Main-Regular.woff2
- KaTeX_Math-BoldItalic.woff2
- KaTeX_Math-Italic.woff2
- KaTeX_SansSerif-Bold.woff2
- KaTeX_SansSerif-Italic.woff2
- KaTeX_SansSerif-Regular.woff2
- KaTeX_Script-Regular.woff2
- KaTeX_Size1-Regular.woff2
- KaTeX_Size2-Regular.woff2
- KaTeX_Size3-Regular.woff2
- KaTeX_Size4-Regular.woff2
- KaTeX_Typewriter-Regular.woff2

## Sounds (`vendor/cdn/mathlive/sounds/`)
- keypress-delete.wav
- keypress-return.wav
- keypress-spacebar.wav
- keypress-standard.wav
- plonk.wav

These files can be copied from the MathLive npm package after running `npm install`:

```
cp node_modules/mathlive/fonts/*.woff2 vendor/cdn/mathlive/fonts/
cp node_modules/mathlive/sounds/*.wav vendor/cdn/mathlive/sounds/
```

Remember to commit the files in GitHub so they are available when the application
is deployed without external CDN access.
