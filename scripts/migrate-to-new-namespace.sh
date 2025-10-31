#!/bin/bash

# Script to migrate from window.__msdDebug to window.cblcars.debug.msd
# This script updates all internal CB-LCARS code (NOT documentation yet)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔄 Starting namespace migration..."
echo "📁 Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# Files to update (excluding MsdDebugAPI.js which intentionally uses old namespace for delegation)
FILES_TO_UPDATE=(
  "src/msd/validation/ValidationService.js"
  "src/msd/charts/ApexChartsAdapter.js"
  "src/msd/hud/panels/DataSourcePanel.js"
  "src/msd/hud/panels/ChannelTrendPanel.js"
  "src/msd/hud/panels/OverlaysPanel.js"
  "src/msd/hud/panels/PacksPanel.js"
  "src/msd/hud/panels/ValidationPanel.js"
  "src/msd/hud/panels/RulesPanel.js"
  "src/msd/hud/panels/PerformancePanel.js"
  "src/msd/hud/panels/FlagsPanel.js"
  "src/msd/hud/panels/RoutingPanel.js"
  "src/msd/renderer/ActionHelpers.js"
  "src/msd/renderer/BaseRenderer.js"
  "src/msd/renderer/ApexChartsOverlayRenderer.js"
  "src/msd/renderer/DataSourceMixin.js"
  "src/msd/index.js"
)

# Count total replacements
TOTAL_REPLACEMENTS=0

for file in "${FILES_TO_UPDATE[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  File not found: $file"
    continue
  fi

  echo "📝 Processing: $file"

  # Count occurrences before replacement
  BEFORE_COUNT=$(grep -c "window\.__msdDebug" "$file" 2>/dev/null || echo "0")

  if [ "$BEFORE_COUNT" -gt 0 ]; then
    echo "   Found $BEFORE_COUNT occurrences"

    # Replace window.__msdDebug with window.cblcars.debug.msd
    # Using perl for in-place editing
    perl -pi -e 's/window\.__msdDebug/window.cblcars.debug.msd/g' "$file"

    # Count occurrences after replacement
    AFTER_COUNT=$(grep -c "window\.__msdDebug" "$file" 2>/dev/null || echo "0")
    REPLACED=$((BEFORE_COUNT - AFTER_COUNT))

    echo "   ✅ Replaced $REPLACED references"
    TOTAL_REPLACEMENTS=$((TOTAL_REPLACEMENTS + REPLACED))
  else
    echo "   ⏭️  No occurrences found"
  fi
done

echo ""
echo "✅ Migration complete!"
echo "📊 Total replacements: $TOTAL_REPLACEMENTS"
echo ""
echo "📋 Next steps:"
echo "1. Review the changes: git diff"
echo "2. Build the project: npm run build"
echo "3. Update documentation separately"
echo "4. Test in real MSD environment"
