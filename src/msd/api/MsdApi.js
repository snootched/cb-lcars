/**
 * Phase 4: Unified MSD API structure
 * Provides window.cblcars.msd.api namespace
 * MSD v1 is now the stable system - no feature flag needed
 */

export class MsdApi {
  static attach() {
    if (typeof window === 'undefined') return;

    window.cblcars = window.cblcars || {};
    window.cblcars.msd = window.cblcars.msd || {};

    // Complete API structure
    window.cblcars.msd.api = {
      overlays: {
        list: (root) => this.listOverlays(root),
        highlight: (ids, opts) => this.highlightOverlays(ids, opts),
        getBBox: (id, root) => this.getOverlayBBox(id, root),
        update: (id, data) => this.updateOverlay(id, data)
      },

      anchors: {
        list: () => this.listAnchors(),
        get: (id) => this.getAnchor(id),
        set: (id, x, y) => this.setAnchor(id, x, y),
        dump: () => this.dumpAnchors()
      },

      debug: {
        showAnchors: () => this.setDebugFlag('overlay', true),
        showOverlays: () => this.setDebugFlag('overlay', true),
        showConnectors: () => this.setDebugFlag('connectors', true),
        showGeometry: () => this.setDebugFlag('geometry', true),
        clear: () => this.clearDebugFlags()
      },

      performance: {
        dump: () => this.getPerformanceData(),
        counters: () => this.getPerformanceData().counters || {},
        timers: () => this.getPerformanceData().timers || {}
      },

      pipeline: {
        getResolvedModel: () => this.getResolvedModel(),
        reRender: () => this.reRender(),
        validate: () => this.getValidationIssues()
      }
    };

    // Backward compatibility aliases (temporary - remove after migration)
    window.cblcars.msd.listOverlays = (root) => this.listOverlays(root);
    window.cblcars.msd.listAnchors = () => this.listAnchors();
    window.cblcars.msd.getOverlayBBox = (id, root) => this.getOverlayBBox(id, root);
    window.cblcars.msd.highlight = (ids, opts) => this.highlightOverlays(ids, opts);
  }

  static getWindow() {
    if (typeof window !== 'undefined') return window;
    if (typeof global !== 'undefined' && global.window) return global.window;
    return null;
  }

  static listOverlays(root) {
    try {
      // Try to use MsdIntrospection if available
      const window = this.getWindow();
      const MsdIntrospection = window?.MsdIntrospection;

      if (MsdIntrospection && MsdIntrospection.listOverlays) {
        return MsdIntrospection.listOverlays(root);
      }

      // Fallback implementation
      const overlays = [];
      const resolvedModel = this.getResolvedModel();

      if (resolvedModel && resolvedModel.overlays) {
        resolvedModel.overlays.forEach(overlay => {
          overlays.push({
            id: overlay.id,
            type: overlay.type,
            bbox: this.getOverlayBBox(overlay.id, root),
            hasErrors: false,
            hasWarnings: false
          });
        });
      }

      return overlays;
    } catch (_) {
      return [];
    }
  }

  static listAnchors() {
    try {
      const resolvedModel = this.getResolvedModel();
      return Object.keys(resolvedModel?.anchors || {});
    } catch (_) {
      return [];
    }
  }

  static getAnchor(id) {
    try {
      const resolvedModel = this.getResolvedModel();
      return resolvedModel?.anchors?.[id] || null;
    } catch (_) {
      return null;
    }
  }

  static dumpAnchors() {
    try {
      const resolvedModel = this.getResolvedModel();
      return { ...resolvedModel?.anchors } || {};
    } catch (_) {
      return {};
    }
  }

  static getOverlayBBox(id, root) {
    try {
      // Try to use MsdIntrospection if available
      const window = this.getWindow();
      const MsdIntrospection = window?.MsdIntrospection;

      if (MsdIntrospection && MsdIntrospection.getOverlayBBox) {
        return MsdIntrospection.getOverlayBBox(id, root);
      }

      // Fallback: basic bbox from config
      const resolvedModel = this.getResolvedModel();
      const overlay = resolvedModel?.overlays?.find(o => o.id === id);

      if (overlay && overlay.position && overlay.size) {
        const pos = Array.isArray(overlay.position) ? overlay.position : [0, 0];
        const size = Array.isArray(overlay.size) ? overlay.size : [100, 50];

        return {
          x: Number(pos[0]) || 0,
          y: Number(pos[1]) || 0,
          w: Number(size[0]) || 100,
          h: Number(size[1]) || 50
        };
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  static highlightOverlays(ids, opts) {
    try {
      // Try to use MsdIntrospection if available
      const window = this.getWindow();
      const MsdIntrospection = window?.MsdIntrospection;

      if (MsdIntrospection && MsdIntrospection.highlight) {
        return MsdIntrospection.highlight(ids, opts);
      }

      // Fallback: log highlight request
      console.log('[MSD API] Highlight request:', ids, opts);
    } catch (_) {}
  }

  static getResolvedModel() {
    try {
      const window = this.getWindow();
      return window?.__msdDebug?.pipelineInstance?.getResolvedModel?.() || null;
    } catch (_) {
      return null;
    }
  }

  static getPerformanceData() {
    try {
      const window = this.getWindow();
      return window?.__msdDebug?.getPerf?.() || { timers: {}, counters: {} };
    } catch (_) {
      return { timers: {}, counters: {} };
    }
  }

  static getValidationIssues() {
    try {
      const window = this.getWindow();
      return window?.__msdDebug?.validation?.issues?.() || [];
    } catch (_) {
      return [];
    }
  }

  static setDebugFlag(flag, value) {
    try {
      const window = this.getWindow();
      window.cblcars = window.cblcars || {};
      window.cblcars._debugFlags = window.cblcars._debugFlags || {};
      window.cblcars._debugFlags[flag] = value;
    } catch (_) {}
  }

  static clearDebugFlags() {
    try {
      const window = this.getWindow();
      window.cblcars = window.cblcars || {};
      window.cblcars._debugFlags = {
        overlay: false,
        connectors: false,
        geometry: false
      };
    } catch (_) {}
  }

  static updateOverlay(id, data) {
    // Future: Dynamic overlay updates
    console.warn('[MSD API] Dynamic overlay updates not yet implemented');
    return false;
  }

  static setAnchor(id, x, y) {
    try {
      const window = this.getWindow();
      const result = window?.__msdDebug?.pipelineInstance?.setAnchor?.(id, [x, y]);
      return result || { id, position: [x, y] };
    } catch (_) {
      return null;
    }
  }

  static reRender() {
    try {
      const window = this.getWindow();
      return window?.__msdDebug?.pipelineInstance?.reRender?.() || { success: false };
    } catch (_) {
      return { success: false };
    }
  }
}

