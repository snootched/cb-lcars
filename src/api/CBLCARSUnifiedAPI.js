/**
 * CB-LCARS Unified API - Main Entry Point
 *
 * Orchestrates all API tiers and provides single attachment point.
 * This is the foundation of the standardized API structure:
 *
 * - Runtime API (window.cblcars.msd) - User-facing stable API
 * - Debug API (window.cblcars.debug.msd) - Developer introspection
 * - Dev API (window.cblcars.dev) - Internal development tools
 * - Animation API (window.cblcars.anim) - Already set up in cb-lcars.js
 *
 * Phase 0: Foundation & Runtime API
 * Phase 1-3: Debug API, CLI features, cleanup
 *
 * @module CBLCARSUnifiedAPI
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';
import { MsdRuntimeAPI } from './MsdRuntimeAPI.js';
import { MsdDebugAPI } from './MsdDebugAPI.js';

export class CBLCARSUnifiedAPI {
  /**
   * Attach all API tiers to window.cblcars
   *
   * This method is called once during initialization to set up the
   * entire API structure. It ensures clean namespace organization
   * and prevents conflicts.
   */
  static attach() {
    if (typeof window === 'undefined') {
      cblcarsLog.warn('[UnifiedAPI] Window not available, skipping API attach');
      return;
    }

    try {
      // Ensure namespace exists
      window.cblcars = window.cblcars || {};

      cblcarsLog.debug('[UnifiedAPI] 🚀 Attaching unified API structure...');

      // ==========================================
      // PHASE 0: Runtime API
      // ==========================================
      window.cblcars.msd = MsdRuntimeAPI.create();
      cblcarsLog.debug('[UnifiedAPI] Runtime API attached');

      // ==========================================
      // PHASE 1: Debug API
      // ==========================================
      window.cblcars.debug = window.cblcars.debug || {};
      // CRITICAL: Preserve existing debug.msd properties (e.g., MsdInstanceManager from index.js)
      // by merging DebugAPI instead of replacing
      window.cblcars.debug.msd = window.cblcars.debug.msd || {};

      // Debug logging to trace API attachment
      const debugAPIMethods = MsdDebugAPI.create();
      cblcarsLog.debug('[UnifiedAPI] Debug API methods to merge:', Object.keys(debugAPIMethods));
      cblcarsLog.debug('[UnifiedAPI] Existing debug.msd keys before merge:', Object.keys(window.cblcars.debug.msd));

      // CRITICAL: Delete deprecated properties that would block Object.assign()

      // Delete 'pipeline' getter (read-only property can't be overwritten)
      if ('pipeline' in window.cblcars.debug.msd) {
        const descriptor = Object.getOwnPropertyDescriptor(window.cblcars.debug.msd, 'pipeline');
        if (descriptor && descriptor.get && !descriptor.set) {
          delete window.cblcars.debug.msd.pipeline;
          cblcarsLog.debug('[UnifiedAPI] Deleted read-only pipeline getter to allow merge');
        }
      }

      // Delete legacy 'perf' function (needs to become an object namespace)
      if ('perf' in window.cblcars.debug.msd && typeof window.cblcars.debug.msd.perf === 'function') {
        delete window.cblcars.debug.msd.perf;
        cblcarsLog.debug('[UnifiedAPI] Deleted legacy perf function to allow namespace merge');
      }

      Object.assign(window.cblcars.debug.msd, debugAPIMethods);

      cblcarsLog.debug('[UnifiedAPI] Existing debug.msd keys after merge:', Object.keys(window.cblcars.debug.msd));
      cblcarsLog.debug('[UnifiedAPI] Debug API attached');



      // ==========================================
      // PHASE 0: Dev API (placeholder stub)
      // ==========================================
      window.cblcars.dev = {
        _placeholder: true,
        _version: 'phase0-stub',
        _status: 'Dev API will be implemented in Phase 3'
      };

      // ==========================================
      // Animation API (window.cblcars.anim)
      // ==========================================
      // Already set up in cb-lcars.js - we'll refactor in Phase 3
      // Just log that it exists
      if (window.cblcars.anim) {
        cblcarsLog.debug('[UnifiedAPI] Animation API already initialized');
      }

      cblcarsLog.debug('[UnifiedAPI] ✅ Unified API structure attached successfully');
      cblcarsLog.debug('[UnifiedAPI] Available namespaces:', {
        runtime: !!window.cblcars.msd,
        debug: !!window.cblcars.debug?.msd,
        dev: !!window.cblcars.dev,
        animation: !!window.cblcars.anim
      });

    } catch (error) {
      cblcarsLog.error('[UnifiedAPI] ❌ Failed to attach API:', error);
    }
  }

  /**
   * Detach APIs (for testing/cleanup)
   *
   * Removes all API namespaces. Useful for testing or if you need
   * to reinitialize the API structure.
   */
  static detach() {
    if (typeof window === 'undefined') return;

    try {
      delete window.cblcars?.msd;
      delete window.cblcars?.debug?.msd;
      delete window.cblcars?.dev;

      cblcarsLog.info('[UnifiedAPI] API detached');
    } catch (error) {
      cblcarsLog.error('[UnifiedAPI] Error during detach:', error);
    }
  }

  /**
   * Get API version and status information
   *
   * Useful for debugging to see which API tiers are loaded
   * and what version/phase they're at.
   *
   * @returns {Object} Version info for all API tiers
   */
  static getVersion() {
    if (typeof window === 'undefined') {
      return { error: 'Window not available' };
    }

    return {
      phase: 0,
      runtime: {
        version: window.cblcars?.msd?._version || 'not-loaded',
        placeholder: window.cblcars?.msd?._placeholder || false
      },
      debug: {
        version: window.cblcars?.debug?.msd?._version || 'not-loaded',
        placeholder: window.cblcars?.debug?.msd?._placeholder || false
      },
      dev: {
        version: window.cblcars?.dev?._version || 'not-loaded',
        placeholder: window.cblcars?.dev?._placeholder || false
      },
      animation: {
        loaded: !!window.cblcars?.anim,
        hasAnimejs: !!window.cblcars?.anim?.animejs
      }
    };
  }

  /**
   * Get current API status for debugging
   *
   * @returns {Object} Status information
   */
  static getStatus() {
    if (typeof window === 'undefined') {
      return { available: false };
    }

    return {
      available: true,
      namespaces: {
        runtime: !!window.cblcars?.msd,
        debug: !!window.cblcars?.debug?.msd,
        dev: !!window.cblcars?.dev,
        animation: !!window.cblcars?.anim
      },
      versions: CBLCARSUnifiedAPI.getVersion()
    };
  }
}

// ALWAYS attach when module loads - no conditionals
if (typeof window !== 'undefined') {
  // Expose class first so DebugInterface can call attach() again if needed
  window.CBLCARSUnifiedAPI = CBLCARSUnifiedAPI;

  // Force attach immediately
  CBLCARSUnifiedAPI.attach();
  cblcarsLog.debug('[UnifiedAPI] ✅ Auto-attached at module load');
}
