# Crash & Burnham

[![Netlify Status](https://api.netlify.com/api/v1/badges/24b0e648-c6da-49c5-8d87-8efef5a893d6/deploy-status)](https://app.netlify.com/projects/crashandburnham/deploys)

[crashandburnham.com](https://crashandburnham.com) is my personal portfolio and field log. It is part professional audio résumé, part photography gallery, and part running record of mountains, concerts, and theatrical productions.

## What is here

- Professional background, skills, and production credits
- Mountain, concert, and production data
- Photography galleries with a native dialog viewer and EXIF details
- An elevation-history chart
- A MapLibre map built from photo GPS metadata
- A Discogs-powered “Now Playing” and “For Sale” section
- Responsive navigation, light and dark color schemes, and reduced-motion support

## Built with

The site is intentionally framework-free. It uses semantic HTML, modular browser JavaScript, native browser primitives, and PostCSS.

- HTML templates for data-driven interface elements
- ES modules with lazy initialization for heavier features
- Modern CSS with cascade layers, nesting, container queries, and shared tokens
- [Chart.js](https://www.chartjs.org/) for elevation history
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) with MapTiler tiles for the map
- Netlify Functions for Discogs integration
- JSON datasets for galleries, mountains, concerts, productions, and EXIF metadata

## Project structure

```text
.
├── index.html              Main document and reusable HTML templates
├── css/
│   ├── main/_imports.css   PostCSS entry point
│   ├── tokens/             Design tokens
│   ├── base/               Element-level styles
│   ├── components/         Component styles
│   ├── maps/               MapLibre overrides
│   └── dist/style.css      Local compiled preview
├── dist/                   Generated Netlify deployment (ignored)
├── js/
│   ├── js-imports.js       Feature loading and initialization
│   ├── modal/              Photo dialog
│   ├── map/                MapLibre map
│   ├── ui/                 Galleries, tables, chart, Discogs, and UI behavior
│   └── utils/              Shared data, EXIF, and DOM utilities
├── json/                   Site content and generated metadata
├── images/                 Posters, gallery images, thumbnails, and summit photos
├── netlify/functions/      Discogs API endpoints
├── scripts/                Repeatable build and artifact checks
├── utility/                Local content-generation tools
├── _headers                Security and caching headers
└── netlify.toml            Netlify configuration
```

## Content and data

Most repeatable content lives in `json/`:

- `gallery-data.json` defines gallery groups and images.
- `mountain-data.json` supplies summit records, tables, chart data, and map relationships.
- `concert-data.json` and `production-data.json` supply their respective tables.
- `exif-data.json` supplies photo metadata and GPS coordinates used by the modal, tables, and map.

## Build workflow

Install the exact locked dependencies and create a complete deployment:

```sh
npm ci
npm run build
npm run check
```

The build starts from an empty `dist/`, compiles the PostCSS entry point, bundles
the browser module graph and its lazy features, fingerprints the generated CSS
and JavaScript, rewrites their references in `dist/index.html`, and copies the
site's stable images and JSON data. Netlify runs the same `npm run build`
command and publishes only `dist/`.

`npm run build:css` remains available when only the local
`css/dist/style.css` preview needs to be refreshed. Run `npm run format:css`
to alphabetize declarations in the authored CSS files.

### Adding gallery and summit photos

Keep full-resolution source photos locally in these ignored folders:

```text
images/galleries/<gallery-name>/ORIGINALS/
images/summits/ORIGINALS/
```

The media builder accepts AVIF, HEIC, JPEG, and PNG files. It creates modal
images with a longest edge of at most 2560 pixels, creates 720-pixel gallery
thumbnails (2560 pixels for full-width panoramas), preserves useful EXIF
metadata, and regenerates
`json/gallery-data.json` and `json/exif-data.json`. Generated modal images are
kept below 2 MB and thumbnails below 500 KB.

In Nova, select the **Gallery Build** task and use **Project → Build** or
<kbd>Command</kbd>+<kbd>B</kbd>. That one task runs the media builder, builds
the complete site, and validates both outputs. From a terminal, the equivalent
is:

```sh
npm run build:media
npm run build
npm run check
```

Only new, changed, missing, or oversized images are rebuilt. The generated web
images and JSON files are committed to Git; the `ORIGINALS` folders are ignored
and are not pushed to GitHub. Keep another backup of those originals in Photos,
cloud storage, or an external drive. A new summit image also needs a matching
`Image` reference in `json/mountain-data.json`.

The media task requires ImageMagick and ExifTool. On macOS they can be installed
with:

```sh
brew install imagemagick exiftool
```

Layer order follows:

```text
reset → tokens → base → layout → components → integrations → utilities
```

### Existing Git media history

Optimizing the current files does not remove their older full-resolution
versions from Git's database. Cleaning that database is a separate,
history-rewriting operation: it changes commit IDs and requires a coordinated
force-push. Before doing it, commit the optimized media, make a repository
backup, and ensure any other clones can be replaced.

The safest cleanup for this repository is to remove
`images/galleries/` and `images/summits/` from all old commits with
`git-filter-repo`, restore only the current optimized versions, commit them, and
force-push the rewritten branches and tags. Do not run that operation as part
of the normal Nova task.

## Caching

Only content-hashed files under `/assets/` are cached for one year with
`immutable`. HTML, JSON, and stable image URLs use Netlify's default browser
revalidation and deploy-aware edge cache. Netlify Functions set their own
response caching headers.

## Author

Built by [Casey Burnham](https://github.com/caseyburnham).
