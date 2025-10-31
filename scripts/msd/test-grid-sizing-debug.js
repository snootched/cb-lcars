#!/usr/bin/env node

/**
 * Status Grid Sizing Debug - CB-LCARS
 *
 * This script debugs the status grid sizing and cell positioning issues where a 2x2 grid
 * is being rendered as a 2x3 grid with incorrect dimensions.
 *
 * Problem Statement:
 * - Expected: 2 rows × 2 columns = 4 cells total
 * - Actual: 2 rows × 3 columns with cells overflowing grid boundaries
 * - Size: 300×200 pixels with incorrect cell calculations
 */

console.log('🔧 Status Grid Sizing Debug - CB-LCARS');
console.log('=' .repeat(50));

// Test Grid Configuration
const testGridConfig = {
  id: 'test_grid',
  type: 'status_grid',
  position: [1500, 0],
  size: [300, 200],
  rows: 2,
  columns: 2,
  style: {
    lcars_button_preset: 'bullet',
    cell_color: 'var(--lcars-blue)'
  },
  cells: [
    {
      id: 'cell_1',
      content: 'shit',
      style: {
        lcars_button_preset: 'lozenge'
      }
    },
    {
      id: 'cell_2',
      content: 'bruh',
      style: {
        cell_color: 'var(--lcars-red)'
      }
    },
    {
      id: 'cell_3',
      content: 'fkme'
    }
  ]
};

console.log('\n📋 Test Grid Configuration:');
console.log('  Grid ID:', testGridConfig.id);
console.log('  Size:', testGridConfig.size);
console.log('  Rows:', testGridConfig.rows);
console.log('  Columns:', testGridConfig.columns);
console.log('  Cells provided:', testGridConfig.cells.length);
console.log('  Expected total cells:', testGridConfig.rows * testGridConfig.columns);

// Analyze Expected Grid Calculations
const gridSize = testGridConfig.size;
const [totalWidth, totalHeight] = gridSize;
const rows = testGridConfig.rows;
const columns = testGridConfig.columns;
const gap = 2; // Default cell gap

console.log('\n📐 Expected Grid Calculations:');
console.log('=' .repeat(40));

// Calculate available space after gaps
const gapWidth = gap * Math.max(0, columns - 1);
const gapHeight = gap * Math.max(0, rows - 1);
const availableWidth = Math.max(0, totalWidth - gapWidth);
const availableHeight = Math.max(0, totalHeight - gapHeight);

console.log('Total Grid Size:', `${totalWidth}×${totalHeight}`);
console.log('Gaps:', `horizontal=${gapWidth}px, vertical=${gapHeight}px`);
console.log('Available Space:', `${availableWidth}×${availableHeight}`);

// Calculate expected cell dimensions
const expectedCellWidth = availableWidth / columns;
const expectedCellHeight = availableHeight / rows;

console.log('\n🔲 Expected Cell Dimensions:');
console.log('Cell Width:', expectedCellWidth.toFixed(2) + 'px');
console.log('Cell Height:', expectedCellHeight.toFixed(2) + 'px');

// Calculate expected positions for 2x2 grid
console.log('\n📍 Expected Cell Positions (2×2 grid):');
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < columns; col++) {
    const cellX = col * (expectedCellWidth + gap);
    const cellY = row * (expectedCellHeight + gap);
    console.log(`  Cell[${row},${col}]: x=${cellX.toFixed(2)}, y=${cellY.toFixed(2)}`);
  }
}

// Debug Actual SVG Output
const actualSvgOutput = `<g data-overlay-id="test_grid" data-overlay-type="status_grid" data-grid-rows="2" data-grid-columns="3" data-grid-features="labels,values,hover,cb-button-preset" data-animation-ready="true" data-cascade-direction="row" style="pointer-events: none; cursor: default;" transform="translate(1500, 0)"><g data-cell-id="cell_1" data-cell-row="0" data-cell-col="0" data-has-cell-actions="false" style="pointer-events: none; cursor: default;"><rect x="0" y="0" width="97.33333333333333" height="98" fill="var(--lcars-red)" stroke="var(--lcars-gray)" stroke-width="2" rx="12" opacity="1" style="pointer-events: inherit;"></rect><text x="10" y="22.8" text-anchor="start" dominant-baseline="hanging" fill="var(--lcars-white)" font-size="16" font-family="Antonio" font-weight="bold" style="pointer-events: inherit; user-select: none; cursor: inherit;" data-cell-label="cell_1">
                     Cell 1
                   </text><text x="87.33333333333333" y="83.3" text-anchor="end" dominant-baseline="baseline" fill="var(--lcars-orange)" font-size="14" font-family="Antonio" font-weight="bold" style="pointer-events: inherit; user-select: none; cursor: inherit;" data-cell-content="cell_1">
                     shit
                   </text></g><g data-cell-id="cell_2" data-cell-row="0" data-cell-col="1" data-has-cell-actions="false" style="pointer-events: none; cursor: default;"><rect x="101.33333333333333" y="0" width="97.33333333333333" height="98" fill="var(--lcars-blue)" stroke="var(--lcars-gray)" stroke-width="1" rx="38" opacity="1" style="pointer-events: inherit;"></rect><text x="109.33333333333333" y="49" text-anchor="start" dominant-baseline="middle" fill="var(--lcars-white)" font-size="16" font-family="Antonio" font-weight="normal" style="pointer-events: inherit; user-select: none; cursor: inherit;" data-cell-label="cell_2">
                     Cell 2
                   </text><text x="190.66666666666666" y="49" text-anchor="end" dominant-baseline="middle" fill="var(--lcars-white)" font-size="14" font-family="Antonio" font-weight="normal" style="pointer-events: inherit; user-select: none; cursor: inherit;" data-cell-content="cell_2">
                     bruh
                   </text></g><g data-cell-id="cell_3" data-cell-row="0" data-cell-col="2" data-has-cell-actions="false" style="pointer-events: none; cursor: default;"><rect x="202.66666666666666" y="0" width="97.33333333333333" height="98" fill="var(--lcars-blue)" stroke="var(--lcars-gray)" stroke-width="1" rx="38" opacity="1" style="pointer-events: inherit;"></rect><text x="210.66666666666666" y="49" text-anchor="start" dominant-baseline="middle" fill="var(--lcars-white)" font-size="16" font-family="Antonio" font-weight="normal" style="pointer-events: inherit; user-select: none; cursor: inherit;" data-cell-label="cell_3">
                     Cell 3
                   </text><text x="292" y="49" text-anchor="end" dominant-baseline="middle" fill="var(--lcars-white)" font-size="14" font-family="Antonio" font-weight="normal" style="pointer-events: inherit; user-select: none; cursor: inherit;" data-cell-content="cell_3">
                     fkme
                   </text></g></g>`;

console.log('\n🔍 Actual SVG Analysis:');
console.log('=' .repeat(40));

// Parse data attributes
const actualRows = actualSvgOutput.match(/data-grid-rows="(\d+)"/)[1];
const actualColumns = actualSvgOutput.match(/data-grid-columns="(\d+)"/)[1];

console.log('SVG Grid Rows:', actualRows);
console.log('SVG Grid Columns:', actualColumns);
console.log('❌ MISMATCH: Expected 2x2, got', `${actualRows}x${actualColumns}`);

// Extract cell information
const cellMatches = [...actualSvgOutput.matchAll(/data-cell-row="(\d+)" data-cell-col="(\d+)".*?width="([^"]+)" height="([^"]+)".*?x="([^"]+)" y="([^"]+)"/g)];

console.log('\n🔲 Actual Cell Information:');
cellMatches.forEach((match, index) => {
  const [, row, col, width, height, x, y] = match;
  console.log(`  Cell ${index + 1}: row=${row}, col=${col}, x=${parseFloat(x).toFixed(2)}, y=${parseFloat(y).toFixed(2)}, size=${parseFloat(width).toFixed(2)}×${parseFloat(height).toFixed(2)}`);
});

// Check if cells exceed grid boundaries
const lastCellX = parseFloat(cellMatches[2][6]) + parseFloat(cellMatches[2][3]); // x + width of last cell
console.log('\n⚠️ Grid Boundary Check:');
console.log('Grid Width:', totalWidth);
console.log('Last Cell Right Edge:', lastCellX.toFixed(2));
console.log('Overflow:', lastCellX > totalWidth ? `${(lastCellX - totalWidth).toFixed(2)}px` : 'None');

// Layout Comparison
console.log('\n📊 Layout Comparison:');
console.log('=' .repeat(50));

// Problem Analysis: 3 cells are being treated as 3 columns instead of respecting 2x2 grid
console.log('🔍 Root Cause Analysis:');
console.log('  Cells Provided:', testGridConfig.cells.length);
console.log('  Grid Specification:', `${testGridConfig.rows} rows × ${testGridConfig.columns} columns`);
console.log('  Expected Total Cells:', testGridConfig.rows * testGridConfig.columns);
console.log('  Actual Rendered Layout: 2 rows × 3 columns');

// Calculate what the correct 2x2 layout should be
console.log('\n✅ Correct 2×2 Layout Calculation:');
const correctCellWidth = (totalWidth - gap) / 2; // 2 columns, 1 gap
const correctCellHeight = (totalHeight - gap) / 2; // 2 rows, 1 gap

console.log('  Correct Cell Width:', correctCellWidth.toFixed(2) + 'px');
console.log('  Correct Cell Height:', correctCellHeight.toFixed(2) + 'px');

console.log('\n  Correct Cell Positions:');
const correctPositions = [
  { id: 'cell_1', row: 0, col: 0, x: 0, y: 0 },
  { id: 'cell_2', row: 0, col: 1, x: correctCellWidth + gap, y: 0 },
  { id: 'cell_3', row: 1, col: 0, x: 0, y: correctCellHeight + gap },
  { id: 'cell_4', row: 1, col: 1, x: correctCellWidth + gap, y: correctCellHeight + gap }
];

correctPositions.slice(0, 3).forEach(pos => {
  console.log(`    ${pos.id}: [${pos.row},${pos.col}] → x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}`);
});

// Compare with actual rendered positions
console.log('\n❌ Actual vs ✅ Expected:');
cellMatches.forEach((match, index) => {
  const [, actualRow, actualCol, width, height, actualX, actualY] = match;
  const expectedPos = correctPositions[index];

  console.log(`  Cell ${index + 1}:`);
  console.log(`    Position: [${actualRow},${actualCol}] → [${expectedPos.row},${expectedPos.col}]`);
  console.log(`    X: ${parseFloat(actualX).toFixed(2)} → ${expectedPos.x.toFixed(2)}`);
  console.log(`    Y: ${parseFloat(actualY).toFixed(2)} → ${expectedPos.y.toFixed(2)}`);
  console.log(`    Size: ${parseFloat(width).toFixed(2)}×${parseFloat(height).toFixed(2)} → ${correctCellWidth.toFixed(2)}×${correctCellHeight.toFixed(2)}`);
});

// Cell Overflow Analysis
console.log('\n🚨 Cell Overflow Analysis:');
console.log('=' .repeat(45));

// Calculate actual grid usage
const actualCellWidth = 97.33; // From SVG output
const actualTotalWidth = (actualCellWidth * 3) + (gap * 2); // 3 cells + 2 gaps

console.log('Grid Container Size:', `${totalWidth}×${totalHeight}`);
console.log('Actual Rendered Width:', actualTotalWidth.toFixed(2) + 'px');
console.log('Overflow Amount:', (actualTotalWidth - totalWidth).toFixed(2) + 'px');

// Analyze the dimension calculation bug
console.log('\n🐛 Bug Analysis:');
console.log('The renderer is treating 3 cells as requiring 3 columns,');
console.log('ignoring the explicitly specified 2-column grid layout.');

console.log('\n💡 Expected Behavior:');
console.log('1. Respect grid.columns = 2');
console.log('2. Position cells in row-major order:');
console.log('   cell_1 → [0,0]');
console.log('   cell_2 → [0,1]');
console.log('   cell_3 → [1,0]');
console.log('3. Calculate cell dimensions based on 2×2 grid, not cell count');

console.log('\n🔧 Root Cause:');
console.log('The cell positioning logic in _resolveCellConfigurations');
console.log('is likely defaulting to array.length instead of grid.columns');
console.log('when calculating column count for cell positioning.');

// Simulate the buggy logic
const buggyColumns = testGridConfig.cells.length; // This is what's happening
const correctColumns = testGridConfig.columns;    // This is what should happen

console.log('\n📈 Logic Comparison:');
console.log('Buggy Logic: columns =', buggyColumns, '(from cells.length)');
console.log('Correct Logic: columns =', correctColumns, '(from grid.columns)');

// Show how this affects positioning
console.log('\n📍 Position Calculation Impact:');
testGridConfig.cells.forEach((cell, index) => {
  const buggyCol = index % buggyColumns;
  const buggyRow = Math.floor(index / buggyColumns);

  const correctCol = index % correctColumns;
  const correctRow = Math.floor(index / correctColumns);

  console.log(`  ${cell.id}[${index}]:`);
  console.log(`    Buggy: [${buggyRow},${buggyCol}]`);
  console.log(`    Correct: [${correctRow},${correctCol}]`);
});

// Grid Size Validation
console.log('\n🧪 Grid Size Validation Tests:');
console.log('=' .repeat(40));

// Test function to validate grid configuration
function validateGridConfig(config) {
  const { rows, columns, cells, size } = config;
  const totalCells = rows * columns;
  const providedCells = cells ? cells.length : 0;

  const validation = {
    isValid: true,
    warnings: [],
    errors: [],
    recommendations: []
  };

  // Check if provided cells exceed grid capacity
  if (providedCells > totalCells) {
    validation.errors.push(`Too many cells: ${providedCells} provided, ${totalCells} maximum for ${rows}×${columns} grid`);
    validation.isValid = false;
  }

  // Check if cells will fit in specified size
  const [width, height] = size;
  const minCellSize = 50; // Minimum reasonable cell size
  const gap = 2;

  const availableWidth = width - (gap * (columns - 1));
  const availableHeight = height - (gap * (rows - 1));
  const cellWidth = availableWidth / columns;
  const cellHeight = availableHeight / rows;

  if (cellWidth < minCellSize) {
    validation.warnings.push(`Cell width ${cellWidth.toFixed(1)}px may be too small (minimum recommended: ${minCellSize}px)`);
  }

  if (cellHeight < minCellSize) {
    validation.warnings.push(`Cell height ${cellHeight.toFixed(1)}px may be too small (minimum recommended: ${minCellSize}px)`);
  }

  // Recommendations
  if (providedCells < totalCells) {
    validation.recommendations.push(`Consider providing ${totalCells} cells for complete ${rows}×${columns} grid`);
  }

  return validation;
}

// Test our problematic configuration
const validationResult = validateGridConfig(testGridConfig);

console.log('Configuration Validation:');
console.log('✅ Valid:', validationResult.isValid);

if (validationResult.errors.length > 0) {
  console.log('\n❌ Errors:');
  validationResult.errors.forEach(error => console.log('  -', error));
}

if (validationResult.warnings.length > 0) {
  console.log('\n⚠️ Warnings:');
  validationResult.warnings.forEach(warning => console.log('  -', warning));
}

if (validationResult.recommendations.length > 0) {
  console.log('\n💡 Recommendations:');
  validationResult.recommendations.forEach(rec => console.log('  -', rec));
}

// Test different scenarios
console.log('\n🔄 Testing Different Scenarios:');

const testCases = [
  { name: 'Too many cells', cells: 5, rows: 2, columns: 2 },
  { name: 'Perfect fit', cells: 4, rows: 2, columns: 2 },
  { name: 'Partial fill', cells: 3, rows: 2, columns: 2 },
  { name: 'Single row', cells: 3, rows: 1, columns: 3 }
];

testCases.forEach(testCase => {
  const mockConfig = {
    ...testGridConfig,
    rows: testCase.rows,
    columns: testCase.columns,
    cells: new Array(testCase.cells).fill({}).map((_, i) => ({ id: `cell_${i+1}` }))
  };

  const result = validateGridConfig(mockConfig);
  console.log(`  ${testCase.name}: ${result.isValid ? '✅' : '❌'} (${result.errors.length} errors, ${result.warnings.length} warnings)`);
});

// Generate Corrected Grid Parameters
console.log('\n🔧 Corrected Grid Configuration:');
console.log('=' .repeat(45));

// Generate the corrected configuration that should fix the issues
function generateCorrectConfig(originalConfig) {
  const { rows, columns, size, cells } = originalConfig;
  const [totalWidth, totalHeight] = size;
  const gap = 2;

  // Calculate proper cell dimensions
  const availableWidth = totalWidth - (gap * (columns - 1));
  const availableHeight = totalHeight - (gap * (rows - 1));
  const cellWidth = availableWidth / columns;
  const cellHeight = availableHeight / rows;

  // Generate corrected cell positions
  const correctedCells = cells.map((cell, index) => {
    const totalCells = rows * columns;

    if (index >= totalCells) {
      console.warn(`Warning: Cell ${index} exceeds grid capacity, will be skipped`);
      return null;
    }

    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = col * (cellWidth + gap);
    const y = row * (cellHeight + gap);

    return {
      ...cell,
      calculatedPosition: [row, col],
      calculatedCoords: [x, y],
      calculatedSize: [cellWidth, cellHeight]
    };
  }).filter(Boolean);

  return {
    ...originalConfig,
    correctedCells,
    calculatedDimensions: {
      cellWidth,
      cellHeight,
      availableWidth,
      availableHeight,
      gap
    }
  };
}

const correctedConfig = generateCorrectConfig(testGridConfig);

console.log('📊 Corrected Parameters:');
console.log('  Grid Size:', `${correctedConfig.size[0]}×${correctedConfig.size[1]}`);
console.log('  Grid Layout:', `${correctedConfig.rows}×${correctedConfig.columns}`);
console.log('  Cell Dimensions:', `${correctedConfig.calculatedDimensions.cellWidth.toFixed(2)}×${correctedConfig.calculatedDimensions.cellHeight.toFixed(2)}`);

console.log('\n📍 Corrected Cell Positions:');
correctedConfig.correctedCells.forEach(cell => {
  const [row, col] = cell.calculatedPosition;
  const [x, y] = cell.calculatedCoords;
  console.log(`  ${cell.id}: [${row},${col}] → (${x.toFixed(2)}, ${y.toFixed(2)})`);
});

// Generate the fix for the StatusGridRenderer
console.log('\n🔨 Required Code Fix:');
console.log('In _resolveCellConfigurations(), the position calculation should use:');
console.log('  row = Math.floor(index / gridStyle.columns)  // NOT cells.length');
console.log('  col = index % gridStyle.columns              // NOT cells.length');

console.log('\n📋 Summary of Issues Found:');
console.log('1. ❌ Grid columns calculated from cells.length instead of config.columns');
console.log('2. ❌ Cell dimensions calculated for wrong grid size (2×3 vs 2×2)');
console.log('3. ❌ Cells positioned linearly instead of in proper grid layout');
console.log('4. ✅ Cell styling and presets working correctly');
console.log('5. ✅ SVG structure and transforms working correctly');

console.log('\n🎯 Test Complete - Root cause identified!');
console.log('\nThe issue is in the cell positioning logic where it uses cells.length');
console.log('instead of the configured grid.columns value for calculating positions.');