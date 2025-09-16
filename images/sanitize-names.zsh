#!/bin/zsh

# Script to sanitize filenames in a directory. (Final Version)
# - Correctly handles file extensions.

# --- SCRIPT ---

# 1. Validate Input
if [[ $# -ne 1 ]]; then
  echo "🚫 Error: Please provide a target directory."
  echo "Usage: $(basename "$0") <directory>"
  exit 1
fi

TARGET_DIR="$1"

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "🚫 Error: '$TARGET_DIR' is not a valid directory."
  exit 1
fi

echo "🔎 Processing files in '$TARGET_DIR'..."

# 2. Process Files
# Enable extended globbing for advanced pattern matching.
setopt extendedglob

for file in "$TARGET_DIR"/*; do
  # Skip subdirectories to only process files.
  [[ -d "$file" ]] && continue

  original_name="${file##*/}" # e.g., "My_File_Name__.JPG"

  # --- Apply Corrected Renaming Rules ---

  # a. Separate the filename's root from its extension.
  #    :r gets the "root" name -> "My_File_Name__"
  #    :e gets the "extension" -> "JPG"
  local root_name="${original_name:r}"
  local extension="${original_name:e}"

  # b. Remove trailing underscores from the ROOT NAME ONLY.
  local new_root=${root_name%%(#m)_#} # "My_File_Name__" -> "My_File_Name"

  # c. Reassemble the name. If an extension exists, add the dot back.
  local reassembled_name="$new_root"
  if [[ -n "$extension" ]]; then
    reassembled_name="${reassembled_name}.${extension}" # -> "My_File_Name.JPG"
  fi

  # d. Now, perform the global conversions on the whole reassembled name.
  local new_name="${(L)reassembled_name}" # -> "my_file_name.jpg"
  new_name="${new_name//_/-}"             # -> "my-file-name.jpg"

  # 3. Rename File
  if [[ "$original_name" != "$new_name" ]]; then
    echo "🔸 Renaming: '$original_name'  ->  '$new_name'"
    mv -v -- "$file" "$TARGET_DIR/$new_name"
  fi
done

echo "\n✅ Done."