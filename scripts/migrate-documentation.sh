#!/bin/bash

# Script to update documentation from window.__msdDebug to window.cblcars.debug.msd
# This preserves migration guides and deprecation warnings that intentionally show old syntax

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📚 Starting documentation migration..."
echo "📁 Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# Files to EXCLUDE from automatic replacement (they need manual review)
EXCLUDE_FILES=(
  "doc/api/MIGRATION_GUIDE.md"           # Shows old→new syntax
  "doc/api/PHASE_3_MIGRATION_PLAN.md"    # Shows migration process
  "doc/api/PHASE_3_COMPLETION_SUMMARY.md" # Shows migration results
  "doc/api/API_STANDARDIZATION_COMPLETE.md" # Contains backward compat info
)

# Convert exclude list to grep pattern
EXCLUDE_PATTERN=$(printf "|%s" "${EXCLUDE_FILES[@]}")
EXCLUDE_PATTERN=${EXCLUDE_PATTERN:1} # Remove leading |

echo "⚠️  Will preserve these files (manual review needed):"
for file in "${EXCLUDE_FILES[@]}"; do
  echo "   - $file"
done
echo ""

# Find all markdown files in doc/ directory
DOC_FILES=$(find doc -name "*.md" -type f | grep -vE "$EXCLUDE_PATTERN")

TOTAL_FILES=0
TOTAL_REPLACEMENTS=0

for file in $DOC_FILES; do
  if [ ! -f "$file" ]; then
    continue
  fi

  # Count occurrences before replacement
  BEFORE_COUNT=$(grep -c "window\.__msdDebug" "$file" 2>/dev/null || echo "0")

  if [ "$BEFORE_COUNT" -gt 0 ]; then
    echo "📝 Processing: $file"
    echo "   Found $BEFORE_COUNT occurrences"

    # Replace window.__msdDebug with window.cblcars.debug.msd
    # But preserve examples showing the OLD API in migration context
    perl -pi -e 's/window\.__msdDebug(?!.*\(old\)|.*deprecated|.*DEPRECATED|.*was:|.*before:|.*❌)/window.cblcars.debug.msd/g' "$file"

    # Count occurrences after replacement
    AFTER_COUNT=$(grep -c "window\.__msdDebug" "$file" 2>/dev/null || echo "0")
    REPLACED=$((BEFORE_COUNT - AFTER_COUNT))

    if [ "$REPLACED" -gt 0 ]; then
      echo "   ✅ Replaced $REPLACED references (kept $AFTER_COUNT as examples)"
      TOTAL_REPLACEMENTS=$((TOTAL_REPLACEMENTS + REPLACED))
      TOTAL_FILES=$((TOTAL_FILES + 1))
    else
      echo "   ⏭️  All references preserved as examples"
    fi
  fi
done

echo ""
echo "✅ Documentation migration complete!"
echo "📊 Files updated: $TOTAL_FILES"
echo "📊 Total replacements: $TOTAL_REPLACEMENTS"
echo ""
echo "⚠️  Manual review needed for:"
for file in "${EXCLUDE_FILES[@]}"; do
  echo "   - $file"
done
echo ""
echo "📋 Next steps:"
echo "1. Review the changes: git diff doc/"
echo "2. Manually update excluded migration guide files"
echo "3. Build and test documentation"
