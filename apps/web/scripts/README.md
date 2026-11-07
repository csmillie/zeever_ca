# apps/web/scripts

## capture-og.mjs — OpenGraph screenshots

Generates 1200×630 PNG screenshots for OpenGraph / Twitter Card images by
loading a rendered page in headless Chromium (Playwright) and clipping a
region to disk under `apps/web/public/`.

### Prerequisites

- `playwright` is in `apps/web` devDependencies. First-time setup needs the
  Chromium binary: `npx playwright install chromium` (cached after).
- A running dev server (or pass a production URL).

### Usage

```sh
pnpm --filter zeever-web og:capture -- \
  --url <url> \
  --out <filename under public/> \
  [--clip x,y,w,h] \
  [--wait-for <css selector>]
```

- `--url` — full URL to load (dev or prod).
- `--out` — filename written under `apps/web/public/` (e.g. `og-foo.png`).
  Reference it from page metadata as `https://www.zeever.ca/<filename>`.
- `--clip` — region of the page to capture, in CSS pixels. Default
  `0,0,1200,630` (top of viewport). Use this to skip page chrome (header,
  hero, etc.) so the screenshot lands on the part you actually want.
- `--wait-for` — CSS selector to wait for before capturing. Use a stable
  attribute such as `svg[viewBox='0 0 540 320']`; class hashes from CSS
  modules change between builds.

The script:
- Sets viewport `1200×900`, `deviceScaleFactor: 2` (retina-quality PNG —
  output PNG is `2400×1260` for a `1200×630` clip).
- Waits for `load`, then the `--wait-for` selector, then 500ms for fonts
  and animations to settle.
- Hides the Next.js dev tools indicator (`nextjs-portal`,
  `[data-next-badge-root]`, `[data-next-mark]`) so the floating "N" badge
  doesn't appear in screenshots taken against `next dev`.

### Tuning the clip

Run once with the default clip, look at the result, then adjust `--clip`
to land on the section you want. The image is rendered at 2× scale, so a
`y=540` clip starts roughly 540 CSS pixels from the page top.

### Example: /canadas-ai-compute-landscape

This is the recipe used to produce
`apps/web/public/og-canadas-ai-compute-landscape.png`:

```sh
# 1) Start the dev server
pnpm --filter zeever-web dev

# 2) In another shell, capture Section 1 (province map + scorecard)
pnpm --filter zeever-web og:capture -- \
  --url http://localhost:3033/canadas-ai-compute-landscape \
  --out og-canadas-ai-compute-landscape.png \
  --wait-for "svg[viewBox='0 0 540 320']" \
  --clip 0,540,1200,630
```

Then reference the file from the page's `Metadata.openGraph.images[0].url`
and `Metadata.twitter.images[0]` as `https://www.zeever.ca/og-canadas-ai-compute-landscape.png`.

### Adding an OG image to a new page

1. Add static metadata to the page (`Metadata.openGraph`,
   `Metadata.twitter` with `card: 'summary_large_image'`).
2. Run the dev server and pick a stable `--wait-for` selector for the
   region you want captured (prefer `viewBox`, `aria-*`, `id`, or a
   non-CSS-module class — not a CSS module hash).
3. Iterate on `--clip` until the framing is right.
4. Commit the PNG under `apps/web/public/og-<slug>.png` and the metadata
   change together.

### Verifying after deploy

- View source on the live page and confirm the `og:image` and
  `twitter:image` URLs resolve.
- Use `curl -I https://www.zeever.ca/og-<slug>.png` — expect HTTP 200 and
  a sensible `Content-Type: image/png`.
- Cross-check with X/LinkedIn/Slack debuggers (their previews are cached
  separately and may need a re-scrape).
