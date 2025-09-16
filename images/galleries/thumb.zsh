#!/bin/zsh

#
# Creates AVIF thumbnails from a directory of source AVIF files,
# preserving orientation using ImageMagick.
#

# --- 1. Prerequisite Check ---
if ! command -v magick &> /dev/null; then
  echo "❌ Error: 'magick' command not found."
  echo "   Please install it using Homebrew: brew install imagemagick"
  exit 1
fi

# --- 2. Input Validation ---
if [ -z "$1" ]; then
  echo "❌ Error: No directory supplied."
  echo "   Usage: ./create_thumbnails.zsh <path_to_directory>"
  exit 1
fi

ROOT_DIR="$1"
# Change this line if your AVIF files are in a different subdirectory
SOURCE_DIR="$ROOT_DIR/avif" 
THUMBNAIL_DIR="$ROOT_DIR/thumbnails"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Error: Source directory '$SOURCE_DIR' not found."
  exit 1
fi

# --- 3. Create Output Directory ---
mkdir -p "$THUMBNAIL_DIR"
echo "✅ Thumbnails will be saved in: $THUMBNAIL_DIR"

# --- 4. Process Images ---
echo "🚀 Starting AVIF thumbnail generation using ImageMagick..."

# Loop through all .avif files in the source directory.
for file in "$SOURCE_DIR"/*.avif; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    echo "   Processing: $filename"

    # Use ImageMagick to auto-orient, resize, and set quality.
    magick "$file" \
           -auto-orient \
           -resize 25% \
           -quality 80 \
           "$THUMBNAIL_DIR/$filename" > /dev/null 2>&1
  fi
done

echo "🎉 Done! Thumbnail generation complete."