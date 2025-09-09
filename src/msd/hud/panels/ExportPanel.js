/**
 * Export Panel for MSD HUD
 * Interactive configuration export/import/diff tools
 * Based on legacy HudController export functionality
 */

export class ExportPanel {
  constructor() {
    // FIXED: Only log construction once, not on every refresh
    console.log('[ExportPanel] Constructor called');
    this.initialized = false;
    this.setupGlobalHandlers();
    this.initialized = true;
  }

  setupGlobalHandlers() {
    if (window.__msdExportPanel) return;

    const self = this;
    window.__msdExportPanel = {
      exportCollapsed: function() {
        try {
          const pipeline = window.__msdDebug?.pipelineInstance;
          if (pipeline?.exportCollapsedJson) {
            const json = pipeline.exportCollapsedJson(true);
            self.downloadJson(json, 'msd-config-collapsed');
            self.updateTextarea('collapsed', json);
          }
        } catch (e) {
          console.error('[ExportPanel] Collapsed export failed:', e);
        }
      },

      exportFull: function(includeMeta = false) {
        try {
          const pipeline = window.__msdDebug?.pipelineInstance;
          if (pipeline?.exportFullSnapshotJson) {
            const options = includeMeta ? { include_meta: true } : {};
            const json = pipeline.exportFullSnapshotJson(options, true);
            const filename = includeMeta ? 'msd-snapshot-with-meta' : 'msd-snapshot';
            self.downloadJson(json, filename);
            self.updateTextarea('full', json);
          }
        } catch (e) {
          console.error('[ExportPanel] Full export failed:', e);
        }
      },

      diffItem: function() {
        try {
          const collection = document.getElementById('export-diff-collection')?.value;
          const itemId = document.getElementById('export-diff-id')?.value?.trim();

          if (!collection || !itemId) {
            alert('Please select collection and enter item ID');
            return;
          }

          const pipeline = window.__msdDebug?.pipelineInstance;
          if (pipeline?.diffItem) {
            const result = pipeline.diffItem(collection, itemId);
            const jsonStr = JSON.stringify(result, null, 2);
            self.updateTextarea('diff', jsonStr);
          }
        } catch (e) {
          console.error('[ExportPanel] Item diff failed:', e);
        }
      },

      clearTextarea: function(type) {
        self.updateTextarea(type, '');
      },

      copyToClipboard: function(type) {
        const textarea = document.getElementById(`export-${type}-textarea`);
        if (textarea && textarea.value) {
          navigator.clipboard.writeText(textarea.value).then(() => {
            self.showFeedback('Copied to clipboard!');
          }).catch(e => {
            console.warn('Clipboard copy failed:', e);
            textarea.select();
            textarea.setSelectionRange(0, 99999);
          });
        }
      }
    };

    // FIXED: Only log setup once
    console.log('[ExportPanel] Global handlers setup complete');
  }

  downloadJson(jsonString, filename) {
    try {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showFeedback(`Downloaded: ${a.download}`);
    } catch (e) {
      console.error('[ExportPanel] Download failed:', e);
    }
  }

  updateTextarea(type, content) {
    const textarea = document.getElementById(`export-${type}-textarea`);
    if (textarea) {
      textarea.value = content;
    }
  }

  showFeedback(message, type = 'info') {
    const colors = {
      info: '#00ffff',
      success: '#00ff00',
      warning: '#ffaa00',
      error: '#ff6666'
    };

    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: ${colors[type]};
      padding: 8px 16px;
      border: 1px solid ${colors[type]};
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000001;
      pointer-events: none;
    `;
    feedback.textContent = message;
    document.body.appendChild(feedback);

    setTimeout(() => feedback.remove(), 3000);
  }

  captureData() {
    const pipeline = window.__msdDebug?.pipelineInstance;

    // FIXED: Add more detailed debugging for export panel visibility
    const data = {
      available: !!pipeline,
      hasExportMethods: !!(pipeline?.exportCollapsedJson && pipeline?.exportFullSnapshotJson),
      hasDiffMethod: !!pipeline?.diffItem,
      collections: ['animations', 'timelines', 'rules', 'profiles', 'overlays'],
      initialized: this.initialized,
      globalHandlers: !!window.__msdExportPanel
    };

    // FIXED: Only log data capture issues, not every successful capture
    if (!data.available) {
      console.warn('[ExportPanel] Pipeline not available for export functionality');
    }

    return data;
  }

  renderHtml(exportData) {
    // FIXED: Add debug info to help troubleshoot rendering
    if (!exportData.available) {
      return `<h3>Export & Config</h3>
        <div class="msd-hud-section msd-hud-error">
          Pipeline instance not available
          <div style="font-size: 10px; color: #888; margin-top: 4px;">
            Initialized: ${exportData.initialized} | Handlers: ${exportData.globalHandlers}
          </div>
        </div>`;
    }

    let html = '<h3>Export & Config</h3>';

    // Export Controls Section
    html += '<div class="msd-hud-section"><h4>Export Configuration</h4>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">';

    html += `<button onclick="window.__msdExportPanel?.exportCollapsed()"
      style="font-size:10px;padding:2px 6px;background:#333;color:#fff;border:1px solid #555;border-radius:3px;cursor:pointer;">
      Collapsed JSON
    </button>`;

    html += `<button onclick="window.__msdExportPanel?.exportFull(false)"
      style="font-size:10px;padding:2px 6px;background:#333;color:#fff;border:1px solid #555;border-radius:3px;cursor:pointer;">
      Full Snapshot
    </button>`;

    html += `<button onclick="window.__msdExportPanel?.exportFull(true)"
      style="font-size:10px;padding:2px 6px;background:#666;color:#fff;border:1px solid #888;border-radius:3px;cursor:pointer;">
      +Metadata
    </button>`;

    html += '</div>';

    // Collapsed JSON textarea
    html += '<div style="margin-bottom:6px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">';
    html += '<span style="font-size:11px;color:#ffaa00;">Collapsed JSON:</span>';
    html += '<div style="display:flex;gap:2px;">';
    html += `<button onclick="window.__msdExportPanel?.copyToClipboard('collapsed')"
      style="font-size:9px;padding:1px 4px;background:#444;color:#fff;border:1px solid #666;border-radius:2px;cursor:pointer;">Copy</button>`;
    html += `<button onclick="window.__msdExportPanel?.clearTextarea('collapsed')"
      style="font-size:9px;padding:1px 4px;background:#666;color:#fff;border:1px solid #888;border-radius:2px;cursor:pointer;">Clear</button>`;
    html += '</div></div>';
    html += `<textarea id="export-collapsed-textarea" readonly
      style="width:100%;height:80px;font-size:9px;font-family:monospace;background:#111;color:#ccc;border:1px solid #444;border-radius:3px;padding:4px;resize:vertical;"></textarea>`;
    html += '</div>';

    // Full JSON textarea
    html += '<div style="margin-bottom:6px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">';
    html += '<span style="font-size:11px;color:#ffaa00;">Full Snapshot:</span>';
    html += '<div style="display:flex;gap:2px;">';
    html += `<button onclick="window.__msdExportPanel?.copyToClipboard('full')"
      style="font-size:9px;padding:1px 4px;background:#444;color:#fff;border:1px solid #666;border-radius:2px;cursor:pointer;">Copy</button>`;
    html += `<button onclick="window.__msdExportPanel?.clearTextarea('full')"
      style="font-size:9px;padding:1px 4px;background:#666;color:#fff;border:1px solid #888;border-radius:2px;cursor:pointer;">Clear</button>`;
    html += '</div></div>';
    html += `<textarea id="export-full-textarea" readonly
      style="width:100%;height:100px;font-size:9px;font-family:monospace;background:#111;color:#ccc;border:1px solid #444;border-radius:3px;padding:4px;resize:vertical;"></textarea>`;
    html += '</div>';

    html += '</div>';

    // Status
    html += `<div class="msd-hud-section msd-hud-summary">
      Export: ${exportData.hasExportMethods ? '✅' : '❌'} •
      Diff: ${exportData.hasDiffMethod ? '✅' : '❌'} •
      Handlers: ${exportData.globalHandlers ? '✅' : '❌'} •
      Ready for config management
    </div>`;

    return html;
  }
}
