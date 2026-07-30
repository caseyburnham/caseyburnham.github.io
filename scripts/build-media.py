#!/usr/bin/env python3
"""Build bounded web images and gallery metadata from local originals."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from fractions import Fraction
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
GALLERIES = IMAGES / "galleries"
SUMMITS = IMAGES / "summits"
JSON_DIR = ROOT / "json"
EXIF_JSON = JSON_DIR / "exif-data.json"
GALLERY_JSON = JSON_DIR / "gallery-data.json"

ORIGINALS = "ORIGINALS"
GALLERY_FORMATS = ("avif", "jpeg", "png")
SUPPORTED_INPUTS = {".avif", ".heic", ".jpeg", ".jpg", ".png"}
WEB_OUTPUTS = {".avif", ".jpeg", ".jpg", ".png"}
MAX_MODAL_EDGE = 2560
MAX_THUMBNAIL_EDGE = 720
MAX_PANO_THUMBNAIL_EDGE = 2560
MAX_MODAL_BYTES = 2_000_000
MAX_THUMBNAIL_BYTES = 500_000
PANO_ASPECT_RATIO = 2.5
COPYRIGHT_HOLDER = "Casey Burnham"
THUMBNAIL_QUALITY = {"avif": 58, "jpeg": 72, "png": 85}

EXIF_TAGS = [
    "-DateTimeOriginal",
    "-OffsetTimeOriginal",
    "-ISO",
    "-FocalLengthIn35mmFormat",
    "-FNumber",
    "-ExposureTime",
    "-ExposureCompensation",
    "-Model",
    "-FileType",
    "-GPSLatitude",
    "-GPSLongitude",
    "-GPSAltitude",
    "-GPSAltitudeRef",
    "-Copyright",
    "-XMP:Title",
    "-IPTC:ObjectName",
    "-XMP:Description",
    "-IPTC:Caption-Abstract",
    "-EXIF:ImageDescription",
    "-File:ImageWidth",
    "-File:ImageHeight",
]

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
    stream=sys.stdout,
)


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def run(command: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(
        command,
        check=True,
        text=True,
        capture_output=capture,
    )
    return result.stdout if capture else ""


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")


def normalized_extension(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".heic", ".avif"}:
        return "avif"
    if suffix in {".jpg", ".jpeg"}:
        return "jpeg"
    if suffix == ".png":
        return "png"
    raise ValueError(f"Unsupported image type: {path}")


def image_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(
        path
        for path in directory.iterdir()
        if path.is_file()
        and not path.name.startswith(".")
        and path.suffix.lower() in SUPPORTED_INPUTS
    )


def load_legacy_thumbnails() -> dict[Path, Path]:
    try:
        gallery_data = json.loads(GALLERY_JSON.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

    thumbnails: dict[Path, Path] = {}
    for gallery_id, gallery in gallery_data.items():
        if gallery_id == "_config":
            continue
        for image in gallery.get("images", []):
            thumbnail_value = image.get("thumbnail")
            if not thumbnail_value:
                continue
            thumbnail = ROOT / thumbnail_value.lstrip("/")
            for source_value in image.get("sources", {}).values():
                source = ROOT / source_value.lstrip("/")
                thumbnails[source.resolve()] = thumbnail
    return thumbnails


LEGACY_THUMBNAILS = load_legacy_thumbnails()


def gallery_outputs(gallery: Path) -> list[Path]:
    return sorted(
        path
        for format_name in GALLERY_FORMATS
        for path in image_files(gallery / format_name)
        if normalized_extension(path) == format_name
        and path.suffix.lower() != ".heic"
    )


def summit_outputs() -> list[Path]:
    return [
        path
        for path in image_files(SUMMITS)
        if path.suffix.lower() in WEB_OUTPUTS
    ]


def output_for_source(source: Path) -> tuple[Path, Path]:
    stem = slugify(source.stem)
    if not stem:
        raise ValueError(f"Image filename has no usable characters: {source.name}")

    format_name = normalized_extension(source)
    suffix = f".{format_name}"
    gallery = source.parent
    legacy_output = gallery / format_name / source.name
    canonical_output = gallery / format_name / f"{stem}{suffix}"
    output = (
        legacy_output
        if legacy_output.exists()
        and legacy_output.suffix.lower() == suffix
        else canonical_output
    )
    thumbnail = LEGACY_THUMBNAILS.get(
        output.resolve(),
        gallery / "thumbnails" / output.name,
    )
    return output, thumbnail


def source_jobs() -> list[tuple[Path, Path, Path | None]]:
    galleries = sorted(
        gallery
        for gallery in GALLERIES.iterdir()
        if gallery.is_dir()
    )
    jobs: list[tuple[Path, Path, Path | None]] = []
    destinations: dict[Path, Path] = {}
    for gallery in galleries:
        for source in image_files(gallery):
            archive = gallery / ORIGINALS / source.name
            if archive.exists():
                raise ValueError(
                    f"Cannot archive {relative(source)} because "
                    f"{relative(archive)} already exists"
                )
            output, thumbnail = output_for_source(source)
            if output in destinations:
                previous = destinations[output]
                raise ValueError(
                    f"Filename collision: {relative(previous)} and "
                    f"{relative(source)} both produce {relative(output)}"
                )
            destinations[output] = source
            jobs.append((source, output, thumbnail))

    for source in image_files(SUMMITS):
        if source.suffix.lower() != ".heic":
            continue
        archive = SUMMITS / ORIGINALS / source.name
        if archive.exists():
            raise ValueError(
                f"Cannot archive {relative(source)} because "
                f"{relative(archive)} already exists"
            )
        output = SUMMITS / f"{slugify(source.stem)}.avif"
        if output in destinations:
            previous = destinations[output]
            raise ValueError(
                f"Filename collision: {relative(previous)} and "
                f"{relative(source)} both produce {relative(output)}"
            )
        destinations[output] = source
        jobs.append((source, output, None))
    return jobs


def read_exif(paths: list[Path]) -> dict[Path, dict[str, Any]]:
    if not paths:
        return {}
    payload = run(
        ["exiftool", "-json", "-n", *EXIF_TAGS, *(str(path) for path in paths)],
        capture=True,
    )
    records = json.loads(payload)
    return {
        Path(record["SourceFile"]).resolve(): record
        for record in records
    }


def copyright_for(source: Path) -> str | None:
    metadata = read_exif([source]).get(source.resolve(), {})
    date_value = metadata.get("DateTimeOriginal")
    match = re.match(r"(\d{4}):", str(date_value or ""))
    return f"© {match.group(1)} {COPYRIGHT_HOLDER}" if match else None


def temporary_output(destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    handle, filename = tempfile.mkstemp(
        prefix=f".{destination.stem}-",
        suffix=destination.suffix,
        dir=destination.parent,
    )
    os.close(handle)
    path = Path(filename)
    path.unlink()
    return path


def render_modal(source: Path, destination: Path) -> None:
    format_name = destination.suffix.removeprefix(".")
    temporary = temporary_output(destination)
    try:
        attempts = (
            [(MAX_MODAL_EDGE, 72), (MAX_MODAL_EDGE, 64), (MAX_MODAL_EDGE, 56)]
            if format_name == "avif"
            else [(MAX_MODAL_EDGE, 82), (MAX_MODAL_EDGE, 76), (MAX_MODAL_EDGE, 70)]
            if format_name == "jpeg"
            else [(MAX_MODAL_EDGE, 90), (1920, 90), (1600, 90)]
        )
        for edge, quality in attempts:
            temporary.unlink(missing_ok=True)
            run(
                [
                    "magick",
                    f"{source}[0]",
                    "-auto-orient",
                    "-resize",
                    f"{edge}x{edge}>",
                    "-quality",
                    str(quality),
                    str(temporary),
                ]
            )
            if temporary.stat().st_size <= MAX_MODAL_BYTES:
                break
        else:
            raise ValueError(
                f"Could not reduce {relative(source)} below "
                f"{MAX_MODAL_BYTES:,} bytes"
            )

        metadata_command = [
            "exiftool",
            "-overwrite_original",
            "-TagsFromFile",
            str(source),
            "-all:all",
            "-unsafe",
            "-Orientation#=1",
        ]
        copyright_value = copyright_for(source)
        if copyright_value:
            metadata_command.append(f"-Copyright={copyright_value}")
        metadata_command.append(str(temporary))
        run(metadata_command, capture=True)

        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def thumbnail_target_edge(width: int, height: int) -> int:
    if height and width / height > PANO_ASPECT_RATIO:
        return MAX_PANO_THUMBNAIL_EDGE
    return MAX_THUMBNAIL_EDGE


def render_thumbnail(
    source: Path,
    destination: Path,
    *,
    max_edge: int,
) -> None:
    format_name = destination.suffix.removeprefix(".")
    temporary = temporary_output(destination)
    try:
        run(
            [
                "magick",
                f"{source}[0]",
                "-auto-orient",
                "-resize",
                f"{max_edge}x{max_edge}>",
                "-strip",
                "-quality",
                str(THUMBNAIL_QUALITY[format_name]),
                str(temporary),
            ]
        )
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def archive_source(source: Path) -> None:
    destination = source.parent / ORIGINALS / source.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(source, destination)
    logging.info("Archived source: %s", relative(destination))


def path_key(path: Path) -> str:
    return path.resolve().as_posix().casefold()


def remove_orphaned_thumbnails() -> int:
    removed = 0
    for gallery in sorted(GALLERIES.iterdir()):
        if not gallery.is_dir():
            continue
        expected = {
            path_key(
                LEGACY_THUMBNAILS.get(
                    output.resolve(),
                    gallery / "thumbnails" / output.name,
                )
            )
            for output in gallery_outputs(gallery)
        }
        for thumbnail in image_files(gallery / "thumbnails"):
            if path_key(thumbnail) in expected:
                continue
            thumbnail.unlink()
            removed += 1
            logging.info("Removed orphaned thumbnail: %s", relative(thumbnail))
    return removed


def build_images() -> tuple[int, int, int]:
    modal_count = 0
    thumbnail_count = 0
    archived_count = 0
    for source, output, thumbnail in source_jobs():
        logging.info("Modal: %s", relative(output))
        render_modal(source, output)
        modal_count += 1
        if thumbnail:
            output_record = read_exif([output]).get(output.resolve(), {})

            output_width = int(output_record.get("ImageWidth", 0))
            output_height = int(output_record.get("ImageHeight", 0))
            output_edge = max(output_width, output_height)
            target_thumbnail_edge = min(
                thumbnail_target_edge(output_width, output_height),
                output_edge,
            )
            logging.info("Thumbnail: %s", relative(thumbnail))
            render_thumbnail(
                output,
                thumbnail,
                max_edge=target_thumbnail_edge,
            )
            thumbnail_count += 1

        archive_source(source)
        archived_count += 1

    return modal_count, thumbnail_count, archived_count


def format_exif_date(
    value: str | None,
    offset: str | None,
) -> dict[str, Any] | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.strptime(value[:19], "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None

    offset_minutes = 0
    zone_name = "UTC"
    if offset and re.fullmatch(r"[+-]\d{2}:\d{2}", offset):
        sign = -1 if offset.startswith("-") else 1
        hours, minutes = map(int, offset[1:].split(":"))
        offset_minutes = sign * (hours * 60 + minutes)
        zone_name = f"UTC{offset}"

    return {
        "_ctor": "ExifDateTime",
        "year": parsed.year,
        "month": parsed.month,
        "day": parsed.day,
        "hour": parsed.hour,
        "minute": parsed.minute,
        "second": parsed.second,
        "tzoffsetMinutes": offset_minutes,
        "rawValue": value[:19],
        "zoneName": zone_name,
        "inferredZone": not bool(offset),
    }


def decimal_to_dms(value: float | None, *, latitude: bool) -> str | None:
    if value is None:
        return None
    positive = value >= 0
    absolute = abs(value)
    degrees = int(absolute)
    minutes_float = (absolute - degrees) * 60
    minutes = int(minutes_float)
    seconds = (minutes_float - minutes) * 60
    direction = (
        ("N" if positive else "S")
        if latitude
        else ("E" if positive else "W")
    )
    return f'{degrees}°{minutes}\'{seconds:.2f}" {direction}'


def format_shutter_speed(value: Any) -> str:
    if value in {None, ""}:
        return ""
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return str(value)
    if numeric >= 1:
        rounded = round(numeric, 1)
        return str(int(rounded)) if rounded.is_integer() else str(rounded)
    return str(Fraction(numeric).limit_denominator(8000))


def fallback(value: Any, previous: Any) -> Any:
    return previous if value is None or value == "" else value


def build_exif_record(
    metadata: dict[str, Any],
    previous: dict[str, Any],
) -> dict[str, Any]:
    latitude = metadata.get("GPSLatitude")
    longitude = metadata.get("GPSLongitude")
    gps = None
    if latitude is not None and longitude is not None:
        gps = {
            "lat": latitude,
            "lon": longitude,
            "latDMS": decimal_to_dms(latitude, latitude=True),
            "lonDMS": decimal_to_dms(longitude, latitude=False),
            "alt": metadata.get("GPSAltitude"),
            "altRef": metadata.get("GPSAltitudeRef", 0),
        }

    aperture_value = metadata.get("FNumber")
    aperture = (
        round(float(aperture_value), 1)
        if aperture_value is not None
        else None
    )
    if isinstance(aperture, float) and aperture.is_integer():
        aperture = int(aperture)
    record = {
        "date": format_exif_date(
            metadata.get("DateTimeOriginal"),
            metadata.get("OffsetTimeOriginal"),
        ),
        "iso": metadata.get("ISO"),
        "lens": metadata.get("FocalLengthIn35mmFormat"),
        "aperture": aperture,
        "shutter": format_shutter_speed(metadata.get("ExposureTime")),
        "exposureCompensation": str(metadata.get("ExposureCompensation", "")),
        "cameraModel": metadata.get("Model"),
        "format": str(metadata.get("FileType", "")).upper(),
        "gps": gps,
        "copyright": metadata.get("Copyright"),
        "title": metadata.get("Title") or metadata.get("ObjectName"),
        "caption": (
            metadata.get("Description")
            or metadata.get("Caption-Abstract")
            or metadata.get("ImageDescription")
        ),
    }
    result = {
        key: fallback(value, previous.get(key))
        for key, value in record.items()
    }
    if result["gps"] is None:
        del result["gps"]
    return result


def write_json_data() -> None:
    outputs = sorted(
        [*summit_outputs()]
        + [
            output
            for gallery in sorted(GALLERIES.iterdir())
            if gallery.is_dir()
            for output in gallery_outputs(gallery)
        ]
    )
    output_metadata = read_exif(outputs)
    try:
        existing_exif = json.loads(EXIF_JSON.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        existing_exif = {}

    exif_data: dict[str, dict[str, Any]] = {}
    dimensions: dict[Path, tuple[int, int]] = {}
    for output in outputs:
        output_record = output_metadata.get(output.resolve(), {})
        key = output.relative_to(IMAGES).as_posix()
        exif_data[key] = build_exif_record(
            output_record,
            existing_exif.get(key, {}),
        )
        dimensions[output] = (
            int(output_record.get("ImageWidth", 0)),
            int(output_record.get("ImageHeight", 0)),
        )

    EXIF_JSON.write_text(
        f"{json.dumps(exif_data, indent=2)}\n"
    )

    try:
        existing_gallery = json.loads(GALLERY_JSON.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        existing_gallery = {}
    gallery_data: dict[str, Any] = {
        "_config": existing_gallery.get("_config", {})
    }

    for gallery in sorted(GALLERIES.iterdir()):
        if not gallery.is_dir():
            continue
        gallery_id = gallery.name
        previous_gallery = existing_gallery.get(gallery_id, {})
        entries = []
        for output in gallery_outputs(gallery):
            key = output.relative_to(IMAGES).as_posix()
            record = exif_data[key]
            width, height = dimensions[output]
            layout = (
                "portrait"
                if height > width
                else "pano"
                if height and width / height > 2.5
                else "landscape"
            )
            title = record.get("title") or output.stem.replace("-", " ").title()
            alt = record.get("caption") or title
            thumbnail = LEGACY_THUMBNAILS.get(
                output.resolve(),
                output.parent.parent / "thumbnails" / output.name,
            )
            entries.append(
                {
                    "id": output.stem,
                    "alt": alt,
                    "title": title,
                    "dateCreated": (
                        f'{record["date"]["year"]:04d}-'
                        f'{record["date"]["month"]:02d}-'
                        f'{record["date"]["day"]:02d}'
                        if record.get("date")
                        else None
                    ),
                    "copyrightNotice": record.get("copyright"),
                    "layout": layout,
                    "sources": {
                        output.suffix.removeprefix("."): f"/{relative(output)}"
                    },
                    "thumbnail": f"/{relative(thumbnail)}",
                }
            )

        if not entries:
            continue
        gallery_data[gallery_id] = {
            "name": previous_gallery.get(
                "name",
                gallery_id.replace("-", " ").title(),
            ),
            "images": entries,
        }

    GALLERY_JSON.write_text(
        f"{json.dumps(gallery_data, indent=4)}\n"
    )
    logging.info(
        "Metadata: %s EXIF entries and %s galleries",
        len(exif_data),
        len(gallery_data) - 1,
    )


def validation_errors() -> list[str]:
    outputs = sorted(
        [*summit_outputs()]
        + [
            output
            for gallery in sorted(GALLERIES.iterdir())
            if gallery.is_dir()
            for output in gallery_outputs(gallery)
        ]
    )
    thumbnails = sorted(
        thumbnail
        for gallery in sorted(GALLERIES.iterdir())
        if gallery.is_dir()
        for thumbnail in image_files(gallery / "thumbnails")
    )
    metadata = read_exif([*outputs, *thumbnails])
    errors: list[str] = []
    output_by_thumbnail: dict[str, Path] = {}

    for output in outputs:
        record = metadata.get(output.resolve(), {})
        longest_edge = max(
            int(record.get("ImageWidth", 0)),
            int(record.get("ImageHeight", 0)),
        )
        if longest_edge > MAX_MODAL_EDGE:
            errors.append(
                f"{relative(output)} is {longest_edge}px; max is {MAX_MODAL_EDGE}px"
            )
        if output.stat().st_size > MAX_MODAL_BYTES:
            errors.append(
                f"{relative(output)} is {output.stat().st_size:,} bytes; "
                f"max is {MAX_MODAL_BYTES:,}"
            )

        if GALLERIES in output.parents:
            thumbnail = LEGACY_THUMBNAILS.get(
                output.resolve(),
                output.parent.parent / "thumbnails" / output.name,
            )
            output_by_thumbnail[path_key(thumbnail)] = output
            if not thumbnail.exists():
                errors.append(f"Missing thumbnail: {relative(thumbnail)}")

    for thumbnail in thumbnails:
        record = metadata.get(thumbnail.resolve(), {})
        width = int(record.get("ImageWidth", 0))
        height = int(record.get("ImageHeight", 0))
        longest_edge = max(
            width,
            height,
        )
        output = output_by_thumbnail.get(path_key(thumbnail))
        if output is None:
            errors.append(f"Orphaned thumbnail: {relative(thumbnail)}")
        output_record = metadata.get(output.resolve(), {}) if output else {}
        output_width = int(output_record.get("ImageWidth", 0))
        output_height = int(output_record.get("ImageHeight", 0))
        expected_edge = min(
            thumbnail_target_edge(output_width, output_height),
            max(output_width, output_height),
        )
        if output and longest_edge != expected_edge:
            errors.append(
                f"{relative(thumbnail)} is {longest_edge}px; "
                f"expected {expected_edge}px"
            )
        if thumbnail.stat().st_size > MAX_THUMBNAIL_BYTES:
            errors.append(
                f"{relative(thumbnail)} is {thumbnail.stat().st_size:,} bytes; "
                f"max is {MAX_THUMBNAIL_BYTES:,}"
            )

    try:
        json.loads(EXIF_JSON.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        errors.append(f"Missing or invalid {relative(EXIF_JSON)}")

    return errors


def check_media() -> None:
    errors = validation_errors()
    if errors:
        for error in errors:
            logging.error(error)
        raise SystemExit(f"Media validation failed with {len(errors)} error(s).")
    logging.info("Media validation passed.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Process gallery inbox images and synchronize metadata."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate generated media without changing files.",
    )
    args = parser.parse_args()

    missing = [
        command
        for command in ("magick", "exiftool")
        if not command_exists(command)
    ]
    if missing:
        raise SystemExit(
            f"Missing required command(s): {', '.join(missing)}"
        )

    if args.check:
        check_media()
        return

    modal_count, thumbnail_count, archived = build_images()
    removed_thumbnail_count = remove_orphaned_thumbnails()
    write_json_data()
    check_media()
    logging.info(
        "Done: %s source(s) archived, %s modal image(s), "
        "%s thumbnail(s) generated, %s orphaned thumbnail(s) removed.",
        archived,
        modal_count,
        thumbnail_count,
        removed_thumbnail_count,
    )


if __name__ == "__main__":
    main()
