#!/usr/bin/env node

/**
 * Find overlay merging logic in mergePacks.js
 */

import fs from 'fs';

const filePath = '/home/jweyermars/code/cb-lcars/src/msd/packs/mergePacks.js';

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  console.log('🔍 Looking for overlay merging in mergePacks.js...\n');

  lines.forEach((line, index) => {
    if (line.includes('overlay') && (line.includes('merge') || line.includes('forEach') || line.includes('allOverlays'))) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
      // Show context (5 lines before and after)
      for (let i = Math.max(0, index - 5); i <= Math.min(lines.length - 1, index + 5); i++) {
        const marker = i === index ? '>>> ' : '    ';
        console.log(`${marker}${i + 1}: ${lines[i]}`);
      }
      console.log('');
    }
  });

} catch (error) {
  console.log('❌ Error reading file:', error.message);
}