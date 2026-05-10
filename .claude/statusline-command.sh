#!/bin/bash
# Status line script for Claude Code
# Displays: current_dir | model_name | remaining_context%

input=$(cat)
dir=$(echo "$input" | jq -r '.workspace.current_dir')
model=$(echo "$input" | jq -r '.model.display_name')
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

if [ -n "$remaining" ]; then
  printf "%s | %s | %.0f%%" "$dir" "$model" "$remaining"
else
  printf "%s | %s" "$dir" "$model"
fi
