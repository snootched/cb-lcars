import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';
/**
 * [PacksPanel] Packs panel for MSD HUD
 * 📦 Shows pack collections and provenance information
 */

export class PacksPanel {
  captureData() {
    const collections = {};
    const provenance = {};
    const summary = {};

    try {
      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      if (pipelineInstance) {
        cblcarsLog.debug('[PacksPanel] 📋 Capturing pack collections and provenance data');
        const resolvedModel = pipelineInstance.getResolvedModel?.();
        if (resolvedModel) {
          // Capture collections
          const collectionTypes = ['animations', 'timelines', 'rules', 'profiles', 'overlays'];
          collectionTypes.forEach(type => {
            collections[type] = resolvedModel[type] || [];
            summary[type] = collections[type].length;
          });

          // Capture provenance if available
          if (resolvedModel.__provenance) {
            Object.assign(provenance, resolvedModel.__provenance);
          }
        }

        // Try to get merged config for additional info
        const merged = pipelineInstance.merged;
        if (merged) {
          Object.keys(collections).forEach(type => {
            if (merged[type]) {
              collections[type] = merged[type];
              summary[type] = merged[type].length;
            }
          });

          if (merged.__provenance) {
            Object.assign(provenance, merged.__provenance);
          }
        }
      } else {
        cblcarsLog.warn('[PacksPanel] ⚠️ Pipeline instance not available for pack data capture');
      }
    } catch (e) {
      cblcarsLog.warn('[PacksPanel] ⚠️ Data capture failed:', e);
    }

    return { collections, provenance, summary };
  }

  renderHtml(packsData) {
    let html = '<div class="msd-hud-panel"><h3>Packs & Collections</h3>';

    const { collections, provenance, summary } = packsData;

    // Summary section
    if (summary && Object.keys(summary).length > 0) {
      html += '<div class="msd-hud-section"><h4>Collection Summary</h4>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px;font-size:10px;">';

      Object.entries(summary).forEach(([type, count]) => {
        const color = count > 0 ? '#66ff99' : '#666';
        html += `<span style="background:#222;color:${color};padding:2px 4px;border:1px solid #444;border-radius:3px;">
          ${type}:${count}
        </span>`;
      });
      html += '</div></div>';
    }

    // Provenance section (if available)
    if (provenance && Object.keys(provenance).some(k => Object.keys(provenance[k] || {}).length > 0)) {
      html += '<div class="msd-hud-section"><h4>Provenance Sample</h4>';

      const allEntries = [];
      Object.entries(provenance).forEach(([collection, items]) => {
        Object.entries(items || {}).forEach(([id, chain]) => {
          allEntries.push({ collection, id, chain });
        });
      });

      // Show first 8 entries
      allEntries.slice(0, 8).forEach(entry => {
        const shortId = entry.id.length > 15 ? entry.id.substring(0, 12) + '...' : entry.id;
        const chainStr = (entry.chain || [])
          .map(c => `${c.layer_id}${c.overridden ? '*' : ''}`)
          .join(' → ');

        html += `<div class="msd-hud-metric" style="margin:2px 0;">
          <div style="display:flex;justify-content:space-between;">
            <span class="msd-hud-metric-name">${entry.collection}:${shortId}</span>
          </div>
          <div style="font-size:9px;color:#888;margin-top:1px;font-family:monospace;">
            ${chainStr || 'No chain data'}
          </div>
        </div>`;
      });

      if (allEntries.length > 8) {
        html += `<div style="font-size:9px;opacity:0.6;text-align:center;">
          ... ${allEntries.length - 8} more items
        </div>`;
      }

      html += '</div>';
    }

    // Collections detail section
    if (collections && Object.keys(collections).length > 0) {
      html += '<div class="msd-hud-section"><h4>Collections Detail</h4>';

      Object.entries(collections).forEach(([type, items]) => {
        if (!Array.isArray(items) || items.length === 0) return;

        html += `<div style="margin-bottom:6px;">
          <div style="font-weight:bold;font-size:11px;color:#ffaa00;">${type} (${items.length})</div>`;

        // Show first few items with badges
        items.slice(0, 6).forEach(item => {
          if (!item || !item.id) return;

          const badges = [];
          if (item.__meta?.origin_pack) {
            const pack = item.__meta.origin_pack;
            if (pack === 'builtin:core') badges.push({ text: 'core', color: '#555' });
            else if (pack.startsWith('builtin:')) badges.push({ text: 'builtin', color: '#663399' });
            else if (pack.startsWith('external:')) badges.push({ text: 'ext', color: '#cc6600' });
            else badges.push({ text: 'user', color: '#996515' });
          }

          if (item.__meta?.overridden) badges.push({ text: 'mod', color: '#8a6d00' });
          if (item.__meta?.removed) badges.push({ text: 'rm', color: '#702020' });

          const badgeHtml = badges.map(b =>
            `<span style="background:${b.color};color:#fff;padding:0 3px;margin-left:4px;border-radius:2px;font-size:8px;">
              ${b.text}
            </span>`
          ).join('');

          const shortId = item.id.length > 20 ? item.id.substring(0, 17) + '...' : item.id;
          html += `<div style="margin-left:10px;font-size:10px;margin:1px 0;">
            ${shortId}${badgeHtml}
          </div>`;
        });

        if (items.length > 6) {
          html += `<div style="margin-left:10px;font-size:9px;color:#666;">
            ... ${items.length - 6} more
          </div>`;
        }

        html += '</div>';
      });

      html += '</div>';
    } else {
      html += '<div class="msd-hud-section">No pack data available</div>';
    }

    html += '</div>';
    return html;
  }
}
