#!/usr/bin/env node

/**
 * Check PipelineCore.js content around mergePacks
 */

import fs from 'fs';

const filePath = '/home/jweyermars/code/cb-lcars/src/msd/pipeline/PipelineCore.js';

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  console.log('🔍 Looking for mergePacks in PipelineCore.js...\n');

  lines.forEach((line, index) => {
    if (line.includes('mergePacks')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
      // Show context (3 lines before and after)
      for (let i = Math.max(0, index - 3); i <= Math.min(lines.length - 1, index + 3); i++) {
        const marker = i === index ? '>>> ' : '    ';
        console.log(`${marker}${i + 1}: ${lines[i]}`);
      }
      console.log('');
    }
  });

} catch (error) {
  console.log('❌ Error reading file:', error.message);
}