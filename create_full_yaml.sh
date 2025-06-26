#!/bin/bash

# Default values
output_filename=""
declare -a paths

# Function to display usage information
display_usage() {
    echo "Usage: $0 --output output_filename --path dir1 [--path dir2 ...]"
    echo
    echo "Creates full yaml for 'button_card_templates:' section for lovelace dashboards."
    echo "Ouput yaml can be added directly into the dashboard in UI mode using the edit yaml feature."
    echo
    echo "Options:"
    echo "  --output    Specifies the output filename."
    echo "  --path      Specifies a directory to include. Can be used multiple times to specify multiple directories."
    echo "  --help      Displays this help message."
}

# Parse command line arguments
while (( "$#" )); do
  case "$1" in
    --output)
      output_filename=$2
      shift 2
      ;;
    --path)
      paths+=("$2")
      shift 2
      ;;
    --help)
      display_usage
      exit 0
      ;;
    *)
      echo "Error: Invalid argument"
      display_usage
      exit 1
  esac
done

# Check if output filename is provided
if [ -z "$output_filename" ]; then
    echo "Error: No output filename provided. Use --output to specify the output filename."
    display_usage
    exit 1
fi

# Check if at least one directory is provided
if [ ${#paths[@]} -eq 0 ]; then
    echo "Error: No directories provided. Use --path to specify the directories."
    display_usage
    exit 1
fi

# Concatenate yaml files
echo 'cblcars_card_templates:' > $output_filename
for dir in "${paths[@]}"
do
    find ./$dir -type f \( -name '*.yaml' -o -name '*.yml' \) -exec cat {} \; | grep -v '^ *$' | sed 's/^/  /' >> $output_filename
done

echo "Concatenation complete. Output written to $output_filename"
