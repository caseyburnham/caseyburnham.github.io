# Crash & Burnham

[![Netlify Status](https://api.netlify.com/api/v1/badges/24b0e648-c6da-49c5-8d87-8efef5a893d6/deploy-status)](https://app.netlify.com/projects/crashandburnham/deploys)

[crashandburnham.com](https://crashandburnham.com) is my personal portfolio and field log. It is part professional audio résumé, part photography gallery, and part running record of mountains, concerts, and theatrical productions.

## What is here

- Professional background, skills, and production credits
- Mountain, concert, and production data
- Photography galleries with a native dialog viewer and EXIF details
- SVG summaries of summits by mountain range
- A MapLibre map built from summit-photo GPS metadata
- A Discogs-powered “Now Playing” and “For Sale” section
- Responsive navigation, light and dark color schemes, and reduced-motion support

## Built with

The site is intentionally framework-free. It uses semantic HTML, modular browser JavaScript, native browser primitives, and PostCSS.

- HTML templates for data-driven interface elements
- ES modules with lazy initialization for heavier features
- Modern CSS with cascade layers, nesting, container queries, and shared tokens
- Build-generated tables, gallery navigation, default photo grids, and SVG summaries
- LinkeDOM for build-only HTML template rendering; no DOM library ships to browsers
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) with MapTiler tiles for the map
- Netlify Functions for Discogs integration
- JSON datasets for galleries, mountains, concerts, productions, and EXIF metadata

## Project structure

```text
.
├── index.html              Main document and reusable HTML templates
├── css/
│   ├── main/_imports.css   Primary PostCSS entry point
│   ├── tokens/             Design tokens
│   ├── base/               Element-level styles
│   ├── components/         Component styles
│   ├── maps/               Lazy MapLibre CSS entry and overrides
│   └── dist/               Local primary and map CSS previews
├── dist/                   Generated Netlify deployment (ignored)
├── js/
│   ├── js-imports.js       Feature loading and initialization
│   ├── modal/              Photo dialog
│   ├── map/                MapLibre map
│   ├── ui/                 Galleries, Discogs, and UI behavior
│   └── utils/              Shared data, EXIF, and DOM utilities
├── json/                   Site content and generated metadata
├── images/                 Posters, gallery images, thumbnails, and summit photos
├── netlify/functions/      Discogs API endpoints
├── scripts/                HTML rendering, builds, and artifact checks
├── utility/                Local content-generation tools
├── _headers                Security and caching headers
└── netlify.toml            Netlify configuration
```

## Content and data

Most repeatable content lives in `json/`:

- `gallery-data.json` defines gallery groups and images.
- `mountain-data.json` supplies summit records, tables, chart data, and map relationships.
- `concert-data.json` and `production-data.json` supply their respective tables.
- `exif-data.json` supplies photo metadata, including available GPS coordinates,
  to the modal and tables. Summit-photo coordinates also supply the map.

## Build workflow

Install the exact locked dependencies and create a complete deployment:

```sh
npm ci
npm run build
npm run check
npm run smoke
```

Build and check commands do not ingest media or fix source files. Run
`npm run build:media` explicitly after adding photos, and use `npm run lint:css:fix`
when you want automatic formatting fixes. `npm run check` reads the existing
build, so run `npm run build` first.

The build starts from an empty `dist/`, compiles the primary and lazy MapLibre
PostCSS entry points, bundles the browser module graph and its lazy features,
fingerprints the generated CSS and JavaScript, rewrites their references, and
copies the site's stable images and JSON data. It also refreshes the sitemap's
`lastmod` date from public source changes or the latest public-content commit.
The map stylesheet loads with
the lazy map module rather than blocking the initial render. Netlify runs
`npm run build:deploy` and publishes only `dist/`; generated gallery media and
metadata are committed after they are built locally.

`npm run check` validates each JSON dataset against the schemas in `schemas/`,
checks cross-file relationships and referenced assets, lints the authored
JavaScript and CSS, verifies the built asset contract, and runs the media
privacy/size checks. `npm run smoke` starts a local `dist/` preview and runs a
small Chromium suite for desktop data rendering, mobile navigation, the lazy
gallery/photo dialog, and the lazy map. Install its browser once with
`npx playwright install chromium` if Playwright prompts for it. The GitHub
Actions quality workflow runs the full build, check, and smoke sequence on
every push and pull request.

`npm run build:css` remains available when only the local
`css/dist/style.css` and `css/dist/map.css` previews need to be refreshed. Run
`npm run format:css` to alphabetize declarations in the authored CSS files.

For fast local CSS work with live Netlify Functions, run `npm run dev` and open
`http://localhost:8888`. Netlify Dev serves the generated `dist/index.html`, runs the
build watcher in the background, and handles the `/api/discogs/*` routes.
Source changes regenerate the HTML and hashed assets through the deployment
build; a failed rebuild leaves the last successful preview available.

### Adding gallery and summit photos

Drop a new full-resolution gallery photo directly into its gallery folder:

```text
images/galleries/<gallery-name>/<new-photo>
```

The media builder converts it into the appropriate `avif`, `jpeg`, or `png`
subfolder, creates its thumbnail, and then moves the source into the ignored
`ORIGINALS` folder. It never reads either gallery or summit `ORIGINALS`
folders as build inputs. A summit HEIC placed in `images/summits/` becomes a
slugged AVIF in that folder and is then archived to `images/summits/ORIGINALS/`.

The media builder accepts AVIF, HEIC, JPEG, and PNG files. It creates modal
images with a longest edge of at most 2560 pixels, creates 720-pixel gallery
thumbnails (2560 pixels for full-width panoramas), preserves source EXIF
metadata including GPS in modal and summit images, and regenerates
`json/gallery-data.json` and `json/exif-data.json`. Generated modal images are
kept below 2 MB and thumbnails below 500 KB. Smaller responsive variants
(320px wide for regular thumbnails; 640px and 1280px for panoramas) are generated
only below the source width. The browser selects among these and the existing
thumbnail using native `srcset`, with automatic lazy-image sizing and a viewport
fallback. The portrait has 320px and 640px variants. To refresh only these
variants without ingesting photos, run `npm run build:responsive`. Generated
variants live in dedicated `responsive/` folders; the media builder prunes
unused variants and checks every declared width.

First run the media builder explicitly. Then use Nova’s **Gallery Build** task
to compile and validate the site, or run the complete sequence in a terminal:

```sh
npm run build:media
npm run build
npm run check
```

New gallery files are processed and archived. Existing files in the format
subfolders are the source of truth: removing one also removes its thumbnail and
both JSON entries during the next media build. The generated web images and
JSON files are committed to Git; the `ORIGINALS` folders are ignored and are not
pushed to GitHub. Keep another backup of those originals in Photos, cloud
storage, or an external drive. A new summit image also needs a matching `Image`
reference in `json/mountain-data.json`.

GPS metadata in generated images and `json/exif-data.json` is public and drives
the modal's location display. Review every photo's location before publishing
it, and remove GPS from its source when the shooting location should remain
private.

The media task requires ImageMagick and ExifTool. On macOS they can be installed
with:

```sh
brew install imagemagick exiftool
```

Layer order follows:

```text
reset → tokens → base → layout → components → integrations → utilities
```

## Caching

Only content-hashed files under `/assets/` are cached for one year with
`immutable`. HTML, JSON, and stable image URLs use Netlify's default browser
revalidation and deploy-aware edge cache. Netlify Functions set their own
response caching headers.

## Author

Built by [Casey Burnham](https://github.com/caseyburnham).

## HTML-first delivery

Edit `index.html` for structure and templates, and `json/` for content. The build
renders production, concert, and mountain tables (including tallies and SVG
summaries), the gallery navigation, and the default photo gallery into `dist/index.html`.
The browser does not fetch production/concert data or rebuild these tables.
Photo links work without JavaScript; the dialog, gallery switching, map, and
Discogs sections progressively enhance the page.

`npm run dev` watches source files and serves the generated `dist/` through Netlify,
using the same rendering path as deployment. `npm run build:deploy` followed by
`npm run preview` provides a static preview. Do not preview the source `index.html`
directly: it contains build-time templates and asset placeholders.
