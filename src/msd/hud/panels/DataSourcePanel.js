/**
 * Enhanced Data source monitoring panel for MSD HUD
 * DataSourceManager integration health checks and subscription diagnostics
 */

export class DataSourcePanel {
  constructor() {
    this.entityChangeHistory = new Map(); // entityId -> recent state changes
    this.maxHistoryLength = 10;

    // ADDED: Set up global helper functions
    this._setupGlobalHelpers();
  }

  // ADDED: Setup simple global helper functions with direct access
  _setupGlobalHelpers() {
    // Global entity inspection function with direct DataSourceManager access
    window.__msdInspectDataEntity = (entityId) => {
      console.log('[DataSourcePanel] Inspecting entity:', entityId);

      const dsManager = window.__msdDebug?.dataSourceManager ||
                       window.__msdDebug?.pipelineInstance?.dataSourceManager ||
                       window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (!dsManager?.getEntity) {
        console.warn('[DataSourcePanel] DataSourceManager not available');
        return;
      }

      const entity = dsManager.getEntity(entityId);
      if (!entity) {
        console.warn('[DataSourcePanel] Entity not found:', entityId);
        return;
      }

      // Show available methods for debugging
      console.log('[DataSourcePanel] Available dsManager methods:', Object.getOwnPropertyNames(dsManager).filter(name => typeof dsManager[name] === 'function'));

      // Console logging
      console.group(`🔍 Entity Inspection: ${entityId}`);
      console.log('Entity Data:', entity);
      console.table([entity]);
      console.groupEnd();

      // Show popup with the entity data we just retrieved
      this._showEntityPopup(entityId, entity);
    };

    // Global subscription inspection function with direct DataSourceManager access
    window.__msdInspectDataSubscription = (sourceName) => {
      console.log('[DataSourcePanel] Inspecting subscription:', sourceName);

      const dsManager = window.__msdDebug?.dataSourceManager ||
                       window.__msdDebug?.pipelineInstance?.dataSourceManager ||
                       window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (!dsManager?.getStats) {
        console.warn('[DataSourcePanel] DataSourceManager not available');
        return;
      }

      const stats = dsManager.getStats() || {};
      const sourceData = stats.sources?.[sourceName] || {};

      // ADDED: Get subscriber details using new API
      let subscribers = [];
      try {
        subscribers = dsManager.getSourceSubscribers?.(sourceName) || [];
        console.log('[DataSourcePanel] Found subscribers via API:', subscribers);
      } catch (e) {
        console.warn('[DataSourcePanel] Error getting subscribers:', e);
      }

      // Console logging
      console.group(`🔍 Subscription Inspection: ${sourceName}`);
      console.log('Source Stats:', sourceData);
      console.log('Subscribers:', subscribers);
      console.log('All Stats:', stats);
      console.groupEnd();

      // Show popup with the subscription data and subscriber details
      this._showSubscriptionPopup(sourceName, sourceData, subscribers);
    };    // Simple refresh function
    window.__msdRefreshDataSources = () => {
      const dsManager = window.__msdDebug?.dataSourceManager ||
                       window.__msdDebug?.pipelineInstance?.dataSourceManager ||
                       window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (dsManager?.refreshSubscriptions) {
        dsManager.refreshSubscriptions();
        console.log('[DataSourcePanel] Subscriptions refreshed');
      } else {
        console.warn('[DataSourcePanel] Refresh not available');
      }

      // Trigger HUD refresh
      if (window.__msdDebug?.hud?.refresh) {
        window.__msdDebug.hud.refresh();
      }
    };
  }

  // SIMPLE: Show entity popup using fresh DataSourceManager data
  _showEntityPopup(entityId, entity) {
    // Remove any existing popup
    const existing = document.getElementById('msd-entity-inspection-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'msd-entity-inspection-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: #66ff99;
      padding: 20px;
      border: 2px solid #66ff99;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000002;
      max-width: 700px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(102, 255, 153, 0.3);
    `;

    let content = `<h3 style="margin:0 0 16px;color:#ffaa00;">🔍 Entity Inspection: ${entityId}</h3>`;

    // Basic entity information
    content += `
      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px;color:#88ffcc;">📊 Entity State</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">
          <div><strong>Current State:</strong> <span style="color:#ffcc88;">${entity.state || 'N/A'}</span></div>
          <div><strong>Domain:</strong> ${entityId.split('.')[0]}</div>
          <div><strong>Last Changed:</strong> ${entity.last_changed ? new Date(entity.last_changed).toLocaleString() : 'N/A'}</div>
          <div><strong>Last Updated:</strong> ${entity.last_updated ? new Date(entity.last_updated).toLocaleString() : 'N/A'}</div>
        </div>
      </div>
    `;

    // Entity attributes
    if (entity.attributes && Object.keys(entity.attributes).length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ffcc;">🏷️ Attributes (${Object.keys(entity.attributes).length})</h4>
          <div style="font-size:10px;background:#111;padding:8px;border:1px solid #333;border-radius:4px;max-height:200px;overflow-y:auto;">
      `;

      Object.entries(entity.attributes).forEach(([key, value]) => {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        const truncatedValue = displayValue.length > 60 ? displayValue.substring(0, 57) + '...' : displayValue;
        content += `<div style="margin:2px 0;"><strong style="color:#99ddff;">${key}:</strong> <span style="color:#ccc;">${truncatedValue}</span></div>`;
      });

      content += `</div></div>`;
    }

    // Raw entity data
    content += `
      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px;color:#88ffcc;">🔧 Raw Entity Data</h4>
        <div style="font-size:9px;background:#111;padding:8px;border:1px solid #333;border-radius:4px;max-height:200px;overflow-y:auto;word-break:break-all;color:#aaa;">
          ${JSON.stringify(entity, null, 2)}
        </div>
      </div>
    `;

    // Action buttons
    content += `
      <div style="text-align:center;margin-top:20px;border-top:1px solid #333;padding-top:16px;">
        <button onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(entity)}, null, 2)); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy Entity', 2000);"
          style="background:#225522;color:#fff;border:1px solid #55aa55;border-radius:4px;padding:6px 12px;cursor:pointer;margin-right:8px;font-size:11px;">
          Copy Entity
        </button>
        <button onclick="this.parentElement.parentElement.remove()"
          style="background:#333;color:#fff;border:1px solid #555;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;">
          Close
        </button>
      </div>
    `;

    popup.innerHTML = content;
    document.body.appendChild(popup);
  }

  // UPDATED: Show subscription popup with basic subscriber details
  _showSubscriptionPopup(sourceName, sourceData, subscribers = []) {
    // Remove any existing popup
    const existing = document.getElementById('msd-subscription-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'msd-subscription-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: #ffaa66;
      padding: 20px;
      border: 2px solid #ffaa66;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000002;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(255, 170, 102, 0.3);
    `;

    let content = `<h3 style="margin:0 0 16px;color:#ff9900;">🔗 Subscription: ${sourceName}</h3>`;

    // Subscription statistics
    if (sourceData && Object.keys(sourceData).length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#ffcc88;">📊 Statistics</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">
            <div><strong>Subscribers:</strong> <span style="color:#88ccff;">${sourceData.subscribers || 0}</span></div>
            <div><strong>Updates Received:</strong> <span style="color:#88ff88;">${sourceData.received || 0}</span></div>
            <div><strong>Cache Hits:</strong> <span style="color:#ffcc88;">${sourceData.cacheHits || 0}</span></div>
            <div><strong>Errors:</strong> <span style="color:${sourceData.errors > 0 ? '#ff6666' : '#888'};">${sourceData.errors || 0}</span></div>
            <div><strong>Last Update:</strong> ${sourceData.lastUpdate ? new Date(sourceData.lastUpdate).toLocaleString() : 'Never'}</div>
          </div>
        </div>
      `;

      // Cache hit rate
      if (sourceData.received > 0) {
        const hitRate = ((sourceData.cacheHits || 0) / sourceData.received * 100).toFixed(1);
        content += `
          <div style="margin-bottom:16px;">
            <h4 style="margin:0 0 8px;color:#ffcc88;">📈 Performance</h4>
            <div style="font-size:11px;">
              <div><strong>Cache Hit Rate:</strong> <span style="color:#88ff88;">${hitRate}%</span></div>
            </div>
          </div>
        `;
      }
    }

    // ADDED: Basic subscriber details section
    if (subscribers && subscribers.length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#ffcc88;">👥 Subscribers (${subscribers.length})</h4>
          <div style="font-size:10px;background:#111;padding:8px;border:1px solid #333;border-radius:4px;max-height:120px;overflow-y:auto;">
      `;

      subscribers.forEach((subscriber, i) => {
        const name = subscriber.name || subscriber.id || `Subscriber ${i + 1}`;
        const type = subscriber.type || 'unknown';
        content += `<div style="margin:2px 0;color:#ccc;">• ${name} <span style="color:#888;">(${type})</span></div>`;
      });

      content += `</div></div>`;
    } else if (sourceData.subscribers > 0) {
      // Show that we know there are subscribers but couldn't get details
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#ffcc88;">👥 Subscribers</h4>
          <div style="font-size:11px;color:#888;">
            ${sourceData.subscribers} active subscriber${sourceData.subscribers === 1 ? '' : 's'} (basic details available)
          </div>
        </div>
      `;
    }

    // Raw data section
    const combinedData = { stats: sourceData, subscribers };
    content += `
      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px;color:#ffcc88;">🔧 Raw Data</h4>
        <div style="font-size:9px;background:#111;padding:8px;border:1px solid #333;border-radius:4px;max-height:200px;overflow-y:auto;word-break:break-all;color:#aaa;">
          ${JSON.stringify(combinedData, null, 2)}
        </div>
      </div>
    `;

    // Action buttons
    content += `
      <div style="text-align:center;margin-top:20px;border-top:1px solid #333;padding-top:16px;">
        <button onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(combinedData)}, null, 2)); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy Data', 2000);"
          style="background:#552200;color:#fff;border:1px solid #aa5500;border-radius:4px;padding:6px 12px;cursor:pointer;margin-right:8px;font-size:11px;">
          Copy Data
        </button>
        <button onclick="this.parentElement.parentElement.remove()"
          style="background:#333;color:#fff;border:1px solid #555;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;">
          Close
        </button>
      </div>
    `;

    popup.innerHTML = content;
    document.body.appendChild(popup);
  }

  // NEW: Create detailed entity inspection popup
  _createEntityPopup(entityId, entity, extras = {}) {
    // Remove any existing popup
    const existing = document.getElementById('msd-entity-inspection-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'msd-entity-inspection-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: #66ff99;
      padding: 20px;
      border: 2px solid #66ff99;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000002;
      max-width: 700px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(102, 255, 153, 0.3);
    `;

    let content = `<h3 style="margin:0 0 16px;color:#ffaa00;">🔍 Entity Inspection: ${entityId}</h3>`;

    // Basic entity information
    content += `
      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px;color:#88ffcc;">📊 Entity State</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">
          <div><strong>Current State:</strong> <span style="color:#ffcc88;">${entity.state || 'N/A'}</span></div>
          <div><strong>Domain:</strong> ${entityId.split('.')[0]}</div>
          <div><strong>Last Changed:</strong> ${entity.last_changed ? new Date(entity.last_changed).toLocaleString() : 'N/A'}</div>
          <div><strong>Last Updated:</strong> ${entity.last_updated ? new Date(entity.last_updated).toLocaleString() : 'N/A'}</div>
        </div>
      </div>
    `;

    // Entity attributes
    if (entity.attributes && Object.keys(entity.attributes).length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ffcc;">🏷️ Attributes</h4>
          <div style="font-size:10px;background:#111;padding:8px;border:1px solid #333;border-radius:4px;max-height:150px;overflow-y:auto;">
      `;

      Object.entries(entity.attributes).forEach(([key, value]) => {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        const truncatedValue = displayValue.length > 50 ? displayValue.substring(0, 47) + '...' : displayValue;
        content += `<div style="margin:2px 0;"><strong style="color:#99ddff;">${key}:</strong> <span style="color:#ccc;">${truncatedValue}</span></div>`;
      });

      content += `</div></div>`;
    }

    // Change history
    if (extras.history) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ffcc;">📈 Recent Activity</h4>
          <div style="font-size:11px;color:#ccc;">
            <div><strong>Previous State:</strong> ${extras.history.state || 'N/A'}</div>
            <div><strong>Changed:</strong> ${new Date(extras.history.timestamp).toLocaleString()}</div>
          </div>
        </div>
      `;
    }

    // Subscribers
    if (extras.subscribers && extras.subscribers.length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ffcc;">👥 Subscribers (${extras.subscribers.length})</h4>
          <div style="font-size:10px;color:#ccc;">
      `;

      extras.subscribers.forEach((subscriber, i) => {
        const subscriberName = typeof subscriber === 'string' ? subscriber : (subscriber.name || subscriber.id || `Subscriber ${i + 1}`);
        content += `<div style="margin:2px 0;">• ${subscriberName}</div>`;
      });

      content += `</div></div>`;
    }

    // Transforms
    if (extras.transforms && extras.transforms.length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ffcc;">🔄 Transforms (${extras.transforms.length})</h4>
          <div style="font-size:10px;color:#ccc;">
      `;

      extras.transforms.forEach((transform, i) => {
        const transformName = typeof transform === 'string' ? transform : (transform.type || transform.name || `Transform ${i + 1}`);
        content += `<div style="margin:2px 0;">• ${transformName}</div>`;
      });

      content += `</div></div>`;
    }

    // Calculations
    if (extras.calculations && extras.calculations.length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ffcc;">🧮 Calculations (${extras.calculations.length})</h4>
          <div style="font-size:10px;color:#ccc;">
      `;

      extras.calculations.forEach((calc, i) => {
        const calcName = typeof calc === 'string' ? calc : (calc.type || calc.name || `Calculation ${i + 1}`);
        content += `<div style="margin:2px 0;">• ${calcName}</div>`;
      });

      content += `</div></div>`;
    }

    // Raw entity data
    content += `
      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px;color:#88ffcc;">🔧 Raw Entity Data</h4>
        <div style="font-size:9px;background:#111;padding:8px;border:1px solid #333;border-radius:4px;max-height:200px;overflow-y:auto;word-break:break-all;color:#aaa;">
          ${JSON.stringify(entity, null, 2)}
        </div>
      </div>
    `;

    // Action buttons
    content += `
      <div style="text-align:center;margin-top:20px;border-top:1px solid #333;padding-top:16px;">
        <button onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(entity)}, null, 2)); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy Entity', 2000);"
          style="background:#225522;color:#fff;border:1px solid #55aa55;border-radius:4px;padding:6px 12px;cursor:pointer;margin-right:8px;font-size:11px;">
          Copy Entity
        </button>
        <button onclick="console.log('Entity ${entityId}:', ${JSON.stringify(entity)}); this.textContent='Logged!'; setTimeout(() => this.textContent='Log to Console', 2000);"
          style="background:#552255;color:#fff;border:1px solid #aa55aa;border-radius:4px;padding:6px 12px;cursor:pointer;margin-right:8px;font-size:11px;">
          Log to Console
        </button>
        <button onclick="this.parentElement.parentElement.remove()"
          style="background:#333;color:#fff;border:1px solid #555;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;">
          Close
        </button>
      </div>
    `;

    popup.innerHTML = content;
    document.body.appendChild(popup);
  }

  // NEW: Show subscription inspection popup using stored data
  _showSubscriptionInspectionPopup(sourceName) {
    try {
      if (!this._currentData?.subscriptions) {
        console.warn('[DataSourcePanel] No subscription data available');
        return;
      }

      const sourceData = this._currentData.subscriptions[sourceName];
      if (!sourceData) {
        console.warn('[DataSourcePanel] Subscription not found:', sourceName);
        return;
      }

      // Log to console
      console.group(`🔍 Subscription Inspection: ${sourceName}`);
      console.log('Source Stats:', sourceData);
      console.groupEnd();

      // Show detailed popup
      this._createSubscriptionPopup(sourceName, sourceData, {});

    } catch (e) {
      console.warn('[DataSourcePanel] Subscription inspection failed:', e);
    }
  }

  // NEW: Create subscription inspection popup
  _createSubscriptionPopup(sourceName, sourceData, details) {
    // Remove any existing popup
    const existing = document.getElementById('msd-subscription-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'msd-subscription-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: #ffaa66;
      padding: 20px;
      border: 2px solid #ffaa66;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000002;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(255, 170, 102, 0.3);
    `;

    let content = `<h3 style="margin:0 0 16px;color:#ff9900;">🔗 Subscription: ${sourceName}</h3>`;

    // Subscription statistics
    if (sourceData && Object.keys(sourceData).length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#ffcc88;">📊 Statistics</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">
            <div><strong>Subscribers:</strong> <span style="color:#88ccff;">${sourceData.subscribers || 0}</span></div>
            <div><strong>Updates Received:</strong> <span style="color:#88ff88;">${sourceData.received || 0}</span></div>
            <div><strong>Cache Hits:</strong> <span style="color:#ffcc88;">${sourceData.cacheHits || 0}</span></div>
            <div><strong>Errors:</strong> <span style="color:${sourceData.errors > 0 ? '#ff6666' : '#888'};">${sourceData.errors || 0}</span></div>
            <div><strong>Last Update:</strong> ${sourceData.lastUpdate ? new Date(sourceData.lastUpdate).toLocaleString() : 'Never'}</div>
          </div>
        </div>
      `;

      // Cache hit rate
      if (sourceData.received > 0) {
        const hitRate = ((sourceData.cacheHits || 0) / sourceData.received * 100).toFixed(1);
        content += `
          <div style="margin-bottom:16px;">
            <h4 style="margin:0 0 8px;color:#ffcc88;">📈 Performance</h4>
            <div style="font-size:11px;">
              <div><strong>Cache Hit Rate:</strong> <span style="color:#88ff88;">${hitRate}%</span></div>
            </div>
          </div>
        `;
      }
    }

    // Detailed subscription info
    if (details && Object.keys(details).length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#ffcc88;">🔧 Details</h4>
          <div style="font-size:10px;background:#111;padding:8px;border:1px solid #333;border-radius:4px;max-height:200px;overflow-y:auto;">
      `;

      Object.entries(details).forEach(([key, value]) => {
        const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        content += `<div style="margin:3px 0;"><strong style="color:#ffaa88;">${key}:</strong><br><span style="color:#ccc;margin-left:10px;">${displayValue}</span></div>`;
      });

      content += `</div></div>`;
    }

    // Raw data section
    const combinedData = { stats: sourceData, details };
    content += `
      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px;color:#ffcc88;">🔧 Raw Data</h4>
        <div style="font-size:9px;background:#111;padding:8px;border:1px solid #333;border-radius:4px;max-height:200px;overflow-y:auto;word-break:break-all;color:#aaa;">
          ${JSON.stringify(combinedData, null, 2)}
        </div>
      </div>
    `;

    // Action buttons
    content += `
      <div style="text-align:center;margin-top:20px;border-top:1px solid #333;padding-top:16px;">
        <button onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(combinedData)}, null, 2)); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy Data', 2000);"
          style="background:#552200;color:#fff;border:1px solid #aa5500;border-radius:4px;padding:6px 12px;cursor:pointer;margin-right:8px;font-size:11px;">
          Copy Data
        </button>
        <button onclick="console.log('Subscription ${sourceName}:', ${JSON.stringify(combinedData)}); this.textContent='Logged!'; setTimeout(() => this.textContent='Log to Console', 2000);"
          style="background:#552255;color:#fff;border:1px solid #aa55aa;border-radius:4px;padding:6px 12px;cursor:pointer;margin-right:8px;font-size:11px;">
          Log to Console
        </button>
        <button onclick="this.parentElement.parentElement.remove()"
          style="background:#333;color:#fff;border:1px solid #555;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;">
          Close
        </button>
      </div>
    `;

    popup.innerHTML = content;
    document.body.appendChild(popup);
  }

  refreshSubscriptions() {
    try {
      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      const dsManager = pipelineInstance?.dataSourceManager ||
                       pipelineInstance?.systemsManager?.dataSourceManager ||
                       window.__msdDebug?.dataSourceManager;

      if (dsManager?.refreshSubscriptions) {
        dsManager.refreshSubscriptions();
        console.log('[DataSourcePanel] Subscriptions refreshed');
      } else {
        console.warn('[DataSourcePanel] Refresh not available');
      }

      // Trigger HUD refresh
      if (window.__msdDebug?.hud?.refresh) {
        window.__msdDebug.hud.refresh();
      }
    } catch (e) {
      console.warn('[DataSourcePanel] Subscription refresh failed:', e);
    }
  }

  clearHistory() {
    this.entityChangeHistory.clear();
    console.log('[DataSourcePanel] Change history cleared');

    // Trigger refresh
    if (window.__msdDebug?.hud?.refresh) {
      window.__msdDebug.hud.refresh();
    }
  }

  captureData() {
    const entities = {};
    const stats = {};
    const health = {};
    const subscriptions = {};
    const recentChanges = [];

    try {
      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      const dsManager = pipelineInstance?.dataSourceManager ||
                       pipelineInstance?.systemsManager?.dataSourceManager ||
                       window.__msdDebug?.dataSourceManager;

      if (dsManager) {
        // Get comprehensive stats
        const entityIds = dsManager.listIds?.() || [];
        const dsStats = dsManager.getStats?.() || {};
        const healthCheck = dsManager.getHealth?.() || {};

        // Transform stats
        stats.count = entityIds.length;
        stats.subscribed = Object.keys(dsStats.sources || {}).length;
        stats.updated = Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.received || 0), 0);
        stats.cacheHits = Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.cacheHits || 0), 0);
        stats.errors = Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.errors || 0), 0);

        // Health metrics
        if (healthCheck.status) {
          health.status = healthCheck.status;
          health.uptime = healthCheck.uptime || 0;
          health.lastError = healthCheck.lastError;
          health.connectionCount = healthCheck.connectionCount || 0;
        }

        // Subscription details
        if (dsStats.sources) {
          Object.entries(dsStats.sources).forEach(([sourceName, sourceData]) => {
            subscriptions[sourceName] = {
              subscribers: sourceData.subscribers || 0,
              received: sourceData.received || 0,
              errors: sourceData.errors || 0,
              lastUpdate: sourceData.lastUpdate,
              cacheHits: sourceData.cacheHits || 0
            };
          });
        }

        // Sample recent entities and track changes
        entityIds.slice(0, 15).forEach(id => {
          const entity = dsManager.getEntity?.(id);
          if (entity) {
            // Track state changes
            const previousState = this.entityChangeHistory.get(id);
            if (previousState && previousState.state !== entity.state) {
              recentChanges.push({
                id: id,
                from: previousState.state,
                to: entity.state,
                timestamp: Date.now()
              });
            }

            // Store current state
            this.entityChangeHistory.set(id, {
              state: entity.state,
              timestamp: Date.now()
            });

            // Trim history
            if (this.entityChangeHistory.size > this.maxHistoryLength) {
              const oldestKey = this.entityChangeHistory.keys().next().value;
              this.entityChangeHistory.delete(oldestKey);
            }

            entities[id] = {
              state: entity.state,
              lastChanged: entity.last_changed,
              lastUpdated: entity.last_updated,
              attributes: entity.attributes || {},
              domain: id.split('.')[0] // Extract domain for grouping
            };
          }
        });

      } else {
        console.warn('[DataSourcePanel] DataSourceManager not available via consolidated interface');
        stats.error = 'DataSourceManager not available';
      }
    } catch (e) {
      console.warn('[DataSourcePanel] Data capture failed:', e);
      stats.error = e.message;
    }

    return { entities, stats, health, subscriptions, recentChanges };
  }

  renderHtml(entityData) {
    let html = '<div class="msd-hud-panel"><h3>Data Sources</h3>';

    const { entities, stats, health, subscriptions, recentChanges } = entityData;

    // ADDED: Store data for popup access
    this._currentData = entityData;

    // Error handling
    if (stats.error) {
      html += `<div class="msd-hud-section msd-hud-error">
        <h4>Error</h4>
        <div class="msd-hud-metric-value">${stats.error}</div>
      </div>`;
      html += '</div>';
      return html;
    }

    // Controls section
    html += '<div class="msd-hud-section"><h4>Controls</h4>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';

    html += `<button onclick="window.__msdRefreshDataSources();"
      style="font-size:10px;padding:2px 6px;background:#225522;color:#fff;border:1px solid #55aa55;border-radius:3px;cursor:pointer;">
      Refresh Subs
    </button>`;

    html += `<button onclick="(function(){const panel=window.__msdDebug?.hud?.manager?.dataSourcePanel;if(panel?.clearHistory){panel.clearHistory();}else{console.warn('Clear history not available');}})();"
      style="font-size:10px;padding:2px 6px;background:#552255;color:#fff;border:1px solid #aa55aa;border-radius:3px;cursor:pointer;">
      Clear History
    </button>`;

    html += '</div></div>';

    // Health section
    if (health && health.status) {
      const statusColor = health.status === 'healthy' ? '#66ff99' :
                         health.status === 'warning' ? '#ffaa00' : '#ff6666';

      html += '<div class="msd-hud-section"><h4>Health Status</h4>';
      html += `<div class="msd-hud-metric">
        <span class="msd-hud-metric-name">Status</span>
        <span class="msd-hud-metric-value" style="color:${statusColor};">${health.status}</span>
      </div>`;

      if (health.uptime > 0) {
        const uptimeHours = (health.uptime / (1000 * 60 * 60)).toFixed(1);
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">Uptime</span>
          <span class="msd-hud-metric-value">${uptimeHours}h</span>
        </div>`;
      }

      if (health.connectionCount !== undefined) {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">Connections</span>
          <span class="msd-hud-metric-value">${health.connectionCount}</span>
        </div>`;
      }

      if (health.lastError) {
        html += `<div class="msd-hud-metric msd-hud-warning">
          <span class="msd-hud-metric-name">Last Error</span>
          <span class="msd-hud-metric-value">${health.lastError}</span>
        </div>`;
      }

      html += '</div>';
    }

    // Enhanced statistics section
    html += '<div class="msd-hud-section"><h4>Statistics</h4>';
    html += `<div class="msd-hud-metric">
      <span class="msd-hud-metric-name">Total Entities</span>
      <span class="msd-hud-metric-value">${stats.count || 0}</span>
    </div>`;
    html += `<div class="msd-hud-metric">
      <span class="msd-hud-metric-name">Data Sources</span>
      <span class="msd-hud-metric-value">${stats.subscribed || 0}</span>
    </div>`;
    html += `<div class="msd-hud-metric">
      <span class="msd-hud-metric-name">Total Updates</span>
      <span class="msd-hud-metric-value">${stats.updated || 0}</span>
    </div>`;
    if (stats.cacheHits !== undefined) {
      const hitRate = stats.updated > 0 ? ((stats.cacheHits / stats.updated) * 100).toFixed(1) : '0';
      html += `<div class="msd-hud-metric">
        <span class="msd-hud-metric-name">Cache Hit Rate</span>
        <span class="msd-hud-metric-value">${hitRate}%</span>
      </div>`;
    }
    if (stats.errors !== undefined && stats.errors > 0) {
      html += `<div class="msd-hud-metric msd-hud-warning">
        <span class="msd-hud-metric-name">Errors</span>
        <span class="msd-hud-metric-value">${stats.errors}</span>
      </div>`;
    }
    html += '</div>';

    // Subscription diagnostics
    if (subscriptions && Object.keys(subscriptions).length > 0) {
      html += '<div class="msd-hud-section"><h4>Active Subscriptions</h4>';
      Object.entries(subscriptions).slice(0, 6).forEach(([sourceName, sourceData]) => {
        const shortName = sourceName.length > 18 ? sourceName.substring(0, 15) + '...' : sourceName;
        const hasErrors = sourceData.errors > 0;
        const errorClass = hasErrors ? 'msd-hud-warning' : '';

        html += `<div class="msd-hud-metric ${errorClass}" style="cursor:pointer;"
          onclick="window.__msdInspectDataSubscription('${sourceName}')">
          <div style="display:flex;justify-content:space-between;">
            <span class="msd-hud-metric-name">${shortName}</span>
            <span class="msd-hud-metric-value">${sourceData.subscribers} subs</span>
          </div>
          <div style="font-size:10px;color:#888;margin-top:2px;">
            ${sourceData.received} updates • ${sourceData.cacheHits} cached
            ${hasErrors ? ` • ${sourceData.errors} errors` : ''}
          </div>
        </div>`;
      });
      html += '</div>';
    }

    // Recent state changes
    if (recentChanges && recentChanges.length > 0) {
      html += '<div class="msd-hud-section"><h4>Recent Changes</h4>';
      recentChanges.slice(-5).forEach(change => {
        const shortId = change.id.length > 20 ? change.id.substring(0, 17) + '...' : change.id;
        const timeAgo = Math.round((Date.now() - change.timestamp) / 1000);

        html += `<div class="msd-hud-metric" style="cursor:pointer;"
          onclick="window.__msdInspectDataEntity('${change.id}')">
          <div style="display:flex;justify-content:space-between;">
            <span class="msd-hud-metric-name">${shortId}</span>
            <span style="font-size:10px;color:#888;">${timeAgo}s ago</span>
          </div>
          <div class="msd-hud-metric-value" style="font-size:10px;color:#ccc;margin-top:1px;">
            ${change.from} → ${change.to}
          </div>
        </div>`;
      });
      html += '</div>';
    }

    // Entity samples by domain
    const entities_entries = Object.entries(entities || {});
    if (entities_entries.length > 0) {
      // Group by domain
      const byDomain = {};
      entities_entries.forEach(([id, entity]) => {
        const domain = entity.domain || 'unknown';
        if (!byDomain[domain]) byDomain[domain] = [];
        byDomain[domain].push([id, entity]);
      });

      html += '<div class="msd-hud-section"><h4>Entity Samples</h4>';
      Object.entries(byDomain).slice(0, 4).forEach(([domain, domainEntities]) => {
        html += `<div style="margin-bottom:6px;">
          <div style="font-weight:bold;font-size:11px;color:#ffaa00;">${domain} (${domainEntities.length})</div>`;

        domainEntities.slice(0, 3).forEach(([id, entity]) => {
          const shortId = id.length > 20 ? id.substring(0, 17) + '...' : id;
          const stateValue = entity.state || 'N/A';
          const shortState = stateValue.length > 12 ? stateValue.substring(0, 9) + '...' : stateValue;

          html += `<div class="msd-hud-metric" style="cursor:pointer;margin-left:10px;"
            onclick="window.__msdInspectDataEntity('${id}')">
            <span class="msd-hud-metric-name">${shortId}</span>
            <span class="msd-hud-metric-value">${shortState}</span>
          </div>`;
        });

        html += '</div>';
      });
      html += '</div>';
    } else if (stats.count > 0) {
      html += '<div class="msd-hud-section">Entities available but no recent data</div>';
    } else {
      html += '<div class="msd-hud-section">No entity data available</div>';
    }

    html += '</div>';
    return html;
  }
}

