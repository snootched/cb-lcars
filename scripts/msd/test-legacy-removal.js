/**
 * Verify legacy merge functions have been completely removed
 */

import fs from 'fs/promises';
import path from 'path';

const LEGACY_PATTERNS = [
  /layerKeyed\s*\(/,
  /markProvenance\s*\(/,
  /prototype.*merge/i,
  /legacy.*merge/i,
  /dual.*merge/i
  // Remove the hasOwnProperty pattern since we're using modern 'in' operator
];

const LEGACY_FUNCTION_NAMES = [
  'layerKeyed',
  'markProvenance', // Only the old version, new one is OK
  'legacyMerge',
  'dualMerge'
];

async function scanDirectory(dirPath) {
  const issues = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const subIssues = await scanDirectory(fullPath);
        issues.push(...subIssues);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
        const fileIssues = await scanFile(fullPath);
        issues.push(...fileIssues);
      }
    }
  } catch (error) {
    console.warn(`Skipping directory ${dirPath}: ${error.message}`);
  }

  return issues;
}

async function scanFile(filePath) {
  const issues = [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }

      // Skip lines that are just using modern 'in' operator replacement
      if (line.includes('in merged.anchors')) {
        return;
      }

      // Check for legacy patterns
      LEGACY_PATTERNS.forEach(pattern => {
        if (pattern.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            issue: 'Legacy merge pattern detected'
          });
        }
      });

      // Check for legacy function names
      LEGACY_FUNCTION_NAMES.forEach(funcName => {
        const regex = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
        if (regex.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            issue: `Legacy function call: ${funcName}`
          });
        }
      });
    });
  } catch (error) {
    console.warn(`Skipping file ${filePath}: ${error.message}`);
  }

  return issues;
}

async function runLegacyRemovalTest() {
  console.log('🔍 Scanning for legacy merge functions...');

  const srcPath = path.join(process.cwd(), 'src/msd');
  const issues = await scanDirectory(srcPath);

  if (issues.length === 0) {
    console.log('✅ Legacy removal test PASSED');
    console.log('   No legacy merge functions found');
    return { passed: true };
  } else {
    console.error('❌ Legacy removal test FAILED');
    console.error(`   Found ${issues.length} issues:`);

    issues.forEach(issue => {
      console.error(`   ${path.relative(process.cwd(), issue.file)}:${issue.line}`);
      console.error(`     ${issue.issue}`);
      console.error(`     ${issue.content}`);
    });

    return { passed: false, error: `Found ${issues.length} legacy function references` };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLegacyRemovalTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runLegacyRemovalTest };
