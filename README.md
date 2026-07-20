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
│   └── dist/style.css      Compiled stylesheet
├── js/
│   ├── js-imports.js       Feature loading and initialization
│   ├── modal/              Photo dialog
│   ├── map/                MapLibre map
│   ├── ui/                 Galleries, tables, chart, Discogs, and UI behavior
│   └── utils/              Shared data, EXIF, and DOM utilities
├── json/                   Site content and generated metadata
├── images/                 Posters, gallery images, thumbnails, and summit photos
├── netlify/functions/      Discogs API endpoints
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

## CSS workflow

Source files are imported by `css/main/_imports.css` and concatenated with PostCSS via `npm run build:css`. The generated `css/dist/style.css` is the stylesheet served by the site.

Layer order follows:

```text
reset → tokens → base → layout → components → integrations → utilities
```

## Author

Built by [Casey Burnham](https://github.com/caseyburnham).
