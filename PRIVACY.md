# GPS and location privacy policy

This site publishes available photo location metadata so the photo modal can
display shooting coordinates and the mountain map can place summit markers.
Those coordinates are public and may identify a precise shooting location.

## Public location data

- `json/exif-data.json` may include exact coordinates for gallery and summit
  photos so the modal can display them. Summit coordinates also drive the map
  when the image is referenced by `json/mountain-data.json`.
- Generated modal and summit images preserve source EXIF metadata, including
  embedded GPS when present. That metadata can be downloaded independently of
  the site's visible location display.
- Site identity markup may describe the Denver, Colorado locality, but must not
  include an exact personal or home coordinate.

## Private source data

Full-resolution source photos live only in ignored `ORIGINALS/` directories.
Those directories must not be copied into `dist/`, committed to Git, or
deployed, even though selected metadata is preserved in generated web images.

## Publishing and enforcement

Adding an image with GPS metadata to an `ORIGINALS/` directory is an explicit
decision to publish its coordinates in both the generated web image and
`json/exif-data.json`. Before doing so, confirm that the coordinates do not
identify a home, campsite, private access point, sensitive habitat, or another
location that should remain private. Remove GPS from the source if in doubt.

`npm run build:media` preserves source EXIF metadata in generated modal and
summit images and retains available coordinates in the public JSON.
`npm run check:media` validates generated media dimensions, sizes, thumbnails,
and JSON syntax; it does not reject GPS metadata.

Removing coordinates from the current build does not erase them from earlier
Git commits, third-party caches, or existing clones. If previously published
coordinates are sensitive, remove the deployed file immediately, rotate its
URL where practical, and handle Git-history cleanup as a separate coordinated
operation.
