#!/usr/bin/env node

/**
 * Status Grid Debug Test
 *
 * Tests the initialization timing of Status Grid overlays and DataSource integration
 */

import { ficonsole.log('\n📊 Using config with DataSources:');
config.data_sources?.forEach(ds => {
  console.log(`  - ${ds.name} → ${ds.entity}`);
});

console.log('\n⚠️  This test requires a running browser environment with the MSD system loaded.');
console.log('The actual DataSource debugging should be done in the browser console.');
console.log('\nIn the browser console, try:');
console.log('  window.__msdDebug.pipelineInstance.systemsManager.dataSourceManager.getSources()');
console.log('  StatusGridRenderer.debugDataSourceManagerStatus()');

process.exit(0);rom 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import required modules
const { MsdPipeline } = await import(join(__dirname, '../../src/msd/core/MsdPipeline.js'));

console.log('🧪 Status Grid Debug Test');
console.log('=' . repeat(50));

// Test configuration with Status Grid overlays
const config = {
  id: 'status_grid_debug_test',
  size: { width: 800, height: 600 },
  data_sources: [
    {
      name: 'temperature_enhanced',
      entity: 'sensor.cpu_temperature',
      history: { hours: 1 },
      transformations: [
        {
          type: 'unit_conversion',
          key: 'celsius',
          from_unit: '°F',
          to_unit: '°C'
        }
      ]
    },
    {
      name: 'test_cpu_temp',
      entity: 'sensor.processor_use_percent',
      history: { hours: 1 }
    }
  ],
  overlays: [
    {
      id: 'debug_status_grid',
      type: 'status_grid',
      position: { x: 50, y: 50 },
      style: {
        rows: 2,
        columns: 2,
        cell_width: 100,
        cell_height: 50
      },
      cells: [
        {
          id: 'temp_cell',
          position: [0, 0],
          label: 'Temp',
          content: '{temperature_enhanced.transformations.celsius:.1f}°C'
        },
        {
          id: 'cpu_cell',
          position: [0, 1],
          label: 'CPU',
          content: '{test_cpu_temp:.1%}'
        }
      ]
    }
  ]
};

// Mock HASS object
const mockHass = {
  states: {
    'sensor.cpu_temperature': {
      state: '75.5',
      attributes: {
        unit_of_measurement: '°F'
      }
    },
    'sensor.processor_use_percent': {
      state: '45.2',
      attributes: {
        unit_of_measurement: '%'
      }
    }
  },
  connection: {
    subscribeEvents: async (callback, eventType) => {
      console.log(`[MockHass] Subscribed to ${eventType} events`);
      return () => console.log(`[MockHass] Unsubscribed from ${eventType}`);
    },
    sendMessagePromise: async (message) => {
      console.log(`[MockHass] Received message:`, message.type);
      return {};
    }
  }
};

async function runDebugTest() {
  try {
    const { fileURLToPath } = require('url');
const { dirname, join } = require('path');
const fs = require('fs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Status Grid Debug Test');
console.log('='.repeat(50));

// Read the actual config to see DataSource names
const configPath = join(__dirname, '../../test-configs/status-grid-test.json');
let testConfig = null;

try {
  if (fs.existsSync(configPath)) {
    testConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (error) {
  console.warn('Could not read test config:', error.message);
}

// Use a simplified config for debugging
const config = testConfig || {
  id: 'status_grid_debug_test',
  size: { width: 800, height: 600 },
  data_sources: [
    {
      name: 'temperature_enhanced',
      entity: 'sensor.toronto_feels_like_temperature',
      history: { hours: 6 },
      transformations: [
        {
          type: 'unit_conversion',
          key: 'celsius',
          from_unit: '°C',
          to_unit: '°C'
        }
      ]
    },
    {
      name: 'test_cpu_temp',
      entity: 'sensor.bathroom_dial_battery',
      history: { hours: 24 }
    },
    {
      name: 'test_memory',
      entity: 'sensor.bedroom_dial_battery',
      history: { hours: 24 }
    }
  ]
};

console.log('
� Using config with DataSources:');
config.data_sources?.forEach(ds => {
  console.log(`  - ${ds.name} → ${ds.entity}`);
});

console.log('
⚠️  This test requires a running browser environment with the MSD system loaded.');
console.log('The actual DataSource debugging should be done in the browser console.');
console.log('
In the browser console, try:');
console.log('  window.__msdDebug.pipelineInstance.systemsManager.dataSourceManager.getSources()');
console.log('  StatusGridRenderer.debugDataSourceManagerStatus()');

process.exit(0);

    // Create pipeline instance
    const pipeline = new MsdPipeline(config, mockHass);

    // Set up debug tracking
    let dataSourceManagerAvailableTime = null;
    let statusGridRenderTime = null;

    // Monitor when DataSourceManager becomes available
    const checkDataSourceManager = () => {
      const hasDataSourceManager = !!(
        typeof window !== 'undefined' &&
        window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager
      );

      if (hasDataSourceManager && !dataSourceManagerAvailableTime) {
        dataSourceManagerAvailableTime = Date.now();
        console.log(`⏰ DataSourceManager became available at: ${new Date(dataSourceManagerAvailableTime).toISOString()}`);
      }

      return hasDataSourceManager;
    };

    // Start periodic checking
    const monitorInterval = setInterval(() => {
      if (!checkDataSourceManager()) {
        console.log('⏳ Waiting for DataSourceManager...');
      } else {
        clearInterval(monitorInterval);

        // Check Status Grid rendering
        setTimeout(() => {
          console.log('\n📊 Status Grid Overlay Status:');
          const overlays = window.__msdDebug?.pipelineInstance?.overlayManager?.overlays || [];
          const statusGridOverlay = overlays.find(o => o.type === 'status_grid');

          if (statusGridOverlay) {
            console.log('  ✅ Status Grid overlay found:', statusGridOverlay.id);
            console.log('  📋 Cells:', statusGridOverlay.cells?.length || 0);

            if (statusGridOverlay.cells) {
              statusGridOverlay.cells.forEach(cell => {
                console.log(`    📄 Cell ${cell.id}:`, {
                  content: cell.content,
                  originalContent: cell._originalContent,
                  pendingProcessing: cell._pendingTemplateProcessing,
                  hasTemplate: cell.content?.includes('{')
                });
              });
            }
          } else {
            console.log('  ❌ No Status Grid overlay found');
          }

          // Final timing report
          console.log('\n⏱️  Timing Report:');
          console.log(`  DataSourceManager available: ${dataSourceManagerAvailableTime ? new Date(dataSourceManagerAvailableTime).toISOString() : 'Never'}`);
          console.log(`  Status Grid render: ${statusGridRenderTime ? new Date(statusGridRenderTime).toISOString() : 'Unknown'}`);

          if (dataSourceManagerAvailableTime && statusGridRenderTime) {
            const timingDiff = dataSourceManagerAvailableTime - statusGridRenderTime;
            console.log(`  Timing difference: ${timingDiff}ms ${timingDiff > 0 ? '(DataSourceManager AFTER Status Grid)' : '(DataSourceManager BEFORE Status Grid)'}`);
          }

          process.exit(0);
        }, 2000);
      }
    }, 100);

    // Initialize pipeline
    statusGridRenderTime = Date.now();
    await pipeline.initialize();

    console.log(`⏰ Status Grid render started at: ${new Date(statusGridRenderTime).toISOString()}`);

  } catch (error) {
    console.error('❌ Debug test failed:', error);
    process.exit(1);
  }
}

runDebugTest();