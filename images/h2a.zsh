#!/bin/zsh

# Converts all .heic/.HEIC files in a target directory to .avif format.
#
# - Uses highest quality settings and preserves resolution.
# - Preserves all original EXIF metadata.
# - Replaces spaces in filenames with hyphens.
# - Moves original HEIC files to a new 'originals' subdirectory.

# --- Validate Input ---
TARGET_DIR="$1"

if [[ -z "$TARGET_DIR" ]]; then
  echo "🔴 Error: No directory provided."
  echo "Usage: ./heic-to-avif.zsh <path_to_your_folder>"
  exit 1
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "🔴 Error: Directory not found at '$TARGET_DIR'"
  exit 1
fi

# --- Process Files ---
cd "$TARGET_DIR" || exit

# Create a directory for the original files, if it doesn't exist
mkdir -p originals
echo "📁 Moving original files to './originals/'"

# Loop through all .heic and .HEIC files (case-insensitive)
# The (N) glob qualifier prevents errors if no files are found.
for file in *.(HEIC|heic)(N); do
  echo "\nProcessing '$file'..."

  # Get the filename without the extension using Zsh's :r modifier
  base_name="${file:r}"

  # Replace spaces with hyphens
  sanitized_name="${base_name// /-}"

  # Define the final output filename
  output_file="${sanitized_name}.avif"

  # Convert using ImageMagick's `magick` command
  # -quality 0 is the highest (lossless) setting for AVIF.
  # EXIF data is preserved by default.
  if magick "$file" -quality 0 "$output_file"; then
    echo "✅ Successfully converted to '$output_file'"
    # Move the original file to the 'originals' folder
    mv "$file" originals/
  else
    echo "❌ Failed to convert '$file'. Leaving original in place."
  fi
done

echo "\n✨ Conversion complete!"