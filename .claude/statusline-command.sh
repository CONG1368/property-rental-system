#!/bin/bash
# Status line script for Claude Code
# Displays: windows_directory | model_name | remaining_context%

input=$(cat)
raw_dir=$(echo "$input" | jq -r '.workspace.current_dir')
model=$(echo "$input" | jq -r '.model.display_name')
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# Convert Unix-style path to Windows-style path (backslashes)
if command -v cygpath >/dev/null 2>&1; then
  dir=$(cygpath -w "$raw_dir" 2>/dev/null)
else
  # Manual conversion for common cases
  dir=$(echo "$raw_dir" | sed -E 's|^/([a-zA-Z])/|\1:/|; s|/|\\|g')
fi

# Fallback: if conversion didn't work (e.g. already Windows-style), clean it up
if echo "$dir" | grep -q '^[A-Za-z]:'; then
  : # already has drive letter, good
elif echo "$dir" | grep -q '\\'; then
  : # already has backslashes, good
else
  # Fallback: just use the raw directory
  dir="$raw_dir"
fi

if [ -n "$remaining" ]; then
  printf "%s | %s | %.0f%%" "$dir" "$model" "$remaining"
else
  printf "%s | %s" "$dir" "$model"
fi
