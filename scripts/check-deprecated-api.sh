#!/usr/bin/env bash

# CB-LCARS Deprecated API Usage Checker
#
# Searches the codebase for usage of deprecated API patterns that should be migrated
# to the new standardized API structure.

set -euo pipefail

echo "🔍 CB-LCARS Deprecated API Usage Checker"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track findings
FOUND_ISSUES=0

# Function to search for pattern
search_pattern() {
  local pattern="$1"
  local description="$2"
  local recommendation="$3"

  echo -e "${BLUE}🔍 Checking: ${description}${NC}"

  # Search in src/ directory, excluding node_modules and dist
  local results=$(grep -rn --include="*.js" --include="*.ts" -E "$pattern" src/ 2>/dev/null || true)

  if [ -n "$results" ]; then
    echo -e "${YELLOW}⚠️  Found deprecated usage:${NC}"
    echo "$results" | while IFS= read -r line; do
      echo "   $line"
    done
    echo -e "${GREEN}   💡 Recommendation: ${recommendation}${NC}"
    echo ""
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
  else
    echo -e "${GREEN}✅ No deprecated usage found${NC}"
    echo ""
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Old __msdDebug Global API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

search_pattern \
  "window\.__msdDebug" \
  "Old __msdDebug global" \
  "Replace with window.cblcars.debug.msd"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Deprecated Performance Methods"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

search_pattern \
  "\.getPerf\(" \
  "getPerf() method" \
  "Replace with window.cblcars.debug.msd.perf.summary()"

search_pattern \
  "\.getPerformanceSummary\(" \
  "getPerformanceSummary() method" \
  "Replace with window.cblcars.debug.msd.perf.summary()"

search_pattern \
  "\.getSlowestOverlays\(" \
  "getSlowestOverlays() method" \
  "Replace with window.cblcars.debug.msd.perf.slowestOverlays()"

search_pattern \
  "\.getRendererPerformance\(" \
  "getRendererPerformance() method" \
  "Replace with window.cblcars.debug.msd.perf.byRenderer()"

search_pattern \
  "\.getOverlayPerformance\(" \
  "getOverlayPerformance() method" \
  "Replace with window.cblcars.debug.msd.perf.byOverlay()"

search_pattern \
  "\.getPerformanceWarnings\(" \
  "getPerformanceWarnings() method" \
  "Replace with window.cblcars.debug.msd.perf.warnings()"

search_pattern \
  "\.getRenderTimeline\(" \
  "getRenderTimeline() method" \
  "Replace with window.cblcars.debug.msd.perf.timeline()"

search_pattern \
  "\.compareRendererPerformance\(" \
  "compareRendererPerformance() method" \
  "Replace with window.cblcars.debug.msd.perf.compare()"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Deprecated Style Methods"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

search_pattern \
  "\.getStyleResolutions\(" \
  "getStyleResolutions() method" \
  "Replace with window.cblcars.debug.msd.styles.resolutions()"

search_pattern \
  "\.findOverlaysByToken\(" \
  "findOverlaysByToken() method" \
  "Replace with window.cblcars.debug.msd.styles.findByToken()"

search_pattern \
  "\.getGlobalStyleSummary\(" \
  "getGlobalStyleSummary() method" \
  "Replace with window.cblcars.debug.msd.styles.provenance()"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Direct Internal Property Access"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

search_pattern \
  "cblcars\.debug\.msd\.debugManager[^.]" \
  "Direct debugManager access" \
  "Replace with window.cblcars.debug.msd.pipelineInstance._internal.debugManager"

search_pattern \
  "cblcars\.debug\.msd\.chartTemplateRegistry[^.]" \
  "Direct chartTemplateRegistry access" \
  "Replace with window.cblcars.debug.msd.pipelineInstance._internal.chartTemplateRegistry"

search_pattern \
  "cblcars\.debug\.msd\.ValidationService[^.]" \
  "Direct ValidationService access" \
  "Replace with window.cblcars.debug.msd.pipelineInstance._internal.ValidationService"

search_pattern \
  "cblcars\.debug\.msd\.mountElement[^.]" \
  "Direct mountElement access" \
  "Replace with window.cblcars.debug.msd.pipelineInstance._internal.mountElement"

search_pattern \
  "cblcars\.debug\.msd\.apexCharts\[" \
  "Direct apexCharts access" \
  "Replace with window.cblcars.debug.msd.pipelineInstance._internal.apexCharts"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Legacy Properties (to be removed Phase 5)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

search_pattern \
  "cblcars\.debug\.msd\.themeProvenance[^.]" \
  "themeProvenance property" \
  "Replace with window.cblcars.debug.msd.getThemeProvenance()"

search_pattern \
  "cblcars\.debug\.msd\.getDebugStatusSilent\(" \
  "getDebugStatusSilent() method" \
  "Replace with window.cblcars.debug.msd.visual.status()"

search_pattern \
  "cblcars\.debug\.msd\.dataSources[^.]" \
  "dataSources property" \
  "Replace with window.cblcars.debug.msd.data.* methods"

search_pattern \
  "cblcars\.debug\.msd\.getPackInfo\(" \
  "getPackInfo() method" \
  "Replace with window.cblcars.debug.msd.packs.get()"

search_pattern \
  "cblcars\.debug\.msd\.getStyleProvenance\(" \
  "getStyleProvenance() method" \
  "Replace with window.cblcars.debug.msd.styles.provenance()"

search_pattern \
  "cblcars\.debug\.msd\.listTrackedOverlays\(" \
  "listTrackedOverlays() method" \
  "Replace with window.cblcars.debug.msd.overlays.list()"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FOUND_ISSUES -eq 0 ]; then
  echo -e "${GREEN}✅ No deprecated API usage found in codebase!${NC}"
  echo ""
  echo "🎉 Your codebase is clean and using the modern API structure."
else
  echo -e "${YELLOW}⚠️  Found $FOUND_ISSUES pattern(s) with deprecated API usage${NC}"
  echo ""
  echo "📝 Please review the recommendations above and migrate to the new API."
  echo ""
  echo "Note: These patterns may still exist in:"
  echo "  - User-side code (Home Assistant YAML configs)"
  echo "  - External scripts or custom integrations"
  echo "  - Browser console commands"
  echo ""
  echo "Backward compatibility is maintained in Phase 4, but these will"
  echo "be removed in Phase 5. Migration is recommended."
fi

echo ""
echo "✅ Scan complete!"
echo ""

exit 0
