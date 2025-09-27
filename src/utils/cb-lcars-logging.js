import * as CBLCARS from '../cb-lcars-vars.js';

let cblcarsGlobalLogLevel = 'info';

export function cblcarsSetGlobalLogLevel(level) {
  const validLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLevels.includes(level)) {
    console.warn('🟡 CB-LCARS|WARN: Invalid log level:', level, 'Using "info" instead');
    level = 'info';
  }
  cblcarsGlobalLogLevel = level;
  console.log('🔵 CB-LCARS|INFO: Setting CBLCARS global log level to:', level);
}
export function cblcarsGetGlobalLogLevel() {
  return cblcarsGlobalLogLevel;
}

// Ensure the cblcars object exists on the window object
window.cblcars = window.cblcars || {};
// Attach the functions to the cblcars object
window.cblcars.setGlobalLogLevel = cblcarsSetGlobalLogLevel;
window.cblcars.getGlobalLogLevel = cblcarsGetGlobalLogLevel;
// Add shortcut properties for each log level
['error', 'warn', 'info', 'debug'].forEach(level => {
  window.cblcars.setGlobalLogLevel[level] = () => cblcarsSetGlobalLogLevel(level);
});


export function cblcarsLogBanner() {
  let styles1 = [
      'color: white',
      'font-weight: bold',
      'padding: 2px 4px',
      'border-radius: 5em 5em 0 0', // Top left and right rounded, bottom left and right square
      'background-color: #37a6d1' // Blue
  ];

  let styles2 = [
      'color: white',
      'padding: 2px 4px',
      'border-radius: 0 0 5em 5em', // Top left and right square, bottom left and right rounded
      'background-color: #37a6d1' // Blue
  ];

  let invisibleStyle = [
      'color: transparent',
      'padding: 0',
      'border: none'
  ];

  const version = CBLCARS.CBLCARS_VERSION;
  const url = CBLCARS.project_url;
  const baseString = "CB-LCARS v" + version;
  const padding = 4;

  // Calculate the total length including padding
  const totalLength = url.length + padding;
  const spacesNeeded = totalLength - baseString.length;

  // FIXED: Protect against negative repeat count
  const spaces = spacesNeeded > 0 ? ' '.repeat(spacesNeeded) : '';
  const paddedUrl = ' '.repeat(padding) + url;

  console.info(`%c${spaces}${baseString}  %c\n%c${paddedUrl}  `, styles1.join(';'), invisibleStyle.join(';'), styles2.join(';'));
}

/**
 * CB-LCARS Logging System
 *
 * RECOMMENDED USAGE:
 *   import { cblcarsLog } from './utils/cb-lcars-logging.js';
 *
 *   cblcarsLog.error('[MyClass] Something failed:', error);    // ✅ Styled, ✅ Level filtered, ✅ Stack trace
 *   cblcarsLog.warn('[MyClass] Deprecated usage detected');    // ✅ Styled, ✅ Level filtered, ✅ Stack trace
 *   cblcarsLog.info('[MyClass] Processing started');           // ✅ Styled, ✅ Level filtered, use [Class] prefix
 *   cblcarsLog.debug('[MyClass] Debug data:', data);           // ✅ Styled, ✅ Level filtered, use [Class] prefix
 *
 *
 * EMOTICON REFERENCE GUIDE:
 * Use these emoticons consistently across all panels for similar operations:
 *
 *   ⚠️  - Warnings (data capture failures, missing resources, deprecated usage)
 *   ❌  - Error conditions (not found, failed operations, critical failures)
 *   ✅  - Successful operations (completed tasks, enabled features)
 *   🔍  - Searching/inspection operations (looking for elements, analyzing)
 *   �  - Targeting/highlighting (selecting specific items, focus operations)
 *   🏷️  - Metadata/labeling (type information, tags, classifications)
 *   📊  - Data/statistics (counts, summaries, metrics, analysis results)
 *   📋  - Detailed information (lists, sources, comprehensive data)
 *   �  - Debug/development operations (troubleshooting, developer tools)
 *   �️  - Configuration/setup (enabling features, initialization)
 *   🔄  - Processing/modifications (transforms, patches, updates)
 *   🔗  - Connections/relationships (linking, mapping, associations)
 *   ♻️  - Refresh/reload operations (data refresh, interface updates)
 *   �  - Export/output operations (data export, file generation)
 *   �  - Import/download operations (file downloads, data ingestion)
 *   �  - Flags/features (feature toggles, debug flags)
 *   🚨  - Issues/alerts (problem detection, critical notifications)
 *   �  - Packages/collections (pack management, bundled resources)
 *   📈  - Trends/analytics (usage patterns, performance tracking)
 *   🎮  - Controls/interactions (UI controls, user input handling)
 *   �  - Styling/appearance (CSS operations, visual modifications)
 *   🔀  - Routing/navigation (path management, flow control)
 *   ⏱️  - Performance/timing (speed issues, duration tracking)
 *   �  - Scaling/sizing (dimension adjustments, zoom operations)
 *   🧹  - Cleanup/maintenance (clearing data, housekeeping)
 *   🚫  - Blocking/skipping (prevented operations, filtered out)
 *   🔢  - Counting/enumeration (numeric operations, indexing)
*/

const styleConfig = {
  commonStyles: 'color: white; padding: 2px 6px; border-radius: 15px; font-weight: bold;',
  levels: {
    info: 'background: linear-gradient(45deg, #37a6d1, #4db8e8);',
    warn: 'background: linear-gradient(45deg, #ff6753, #ff8570);',
    error: 'background: linear-gradient(45deg, #ef1d10, #ff453a);',
    debug: 'background: linear-gradient(45deg, #8e44ad, #a569bd);'
  }
};

function shouldLog(level) {
  // Correct logging hierarchy: error (most critical) -> warn -> info -> debug (least critical)
  const levels = ['error', 'warn', 'info', 'debug'];
  const levelPriority = {
    'error': 0,  // Always shown (highest priority)
    'warn': 1,   // Shown at warn level and above
    'info': 2,   // Shown at info level and above
    'debug': 3   // Only shown at debug level (lowest priority)
  };

  const currentPriority = levelPriority[cblcarsGlobalLogLevel] ?? 2; // Default to info
  const messagePriority = levelPriority[level] ?? 2;

  return messagePriority <= currentPriority;
}

function createStyleArgs(level, message, ...args) {
  return [
    `%c CB-LCARS|${level} `,
    `${styleConfig.levels[level]} ${styleConfig.commonStyles}`,
    message,
    ...args
  ];
}

export function logError(message, ...args) {
  if (shouldLog('error')) {
    console.error(...createStyleArgs('error', message, ...args));
  }
}

export function logWarn(message, ...args) {
  if (shouldLog('warn')) {
    console.warn(...createStyleArgs('warn', message, ...args));
  }
}

export function logInfo(message, ...args) {
  if (shouldLog('info')) {
    console.log(...createStyleArgs('info', message, ...args));
  }
}

export function logDebug(message, ...args) {
  if (shouldLog('debug')) {
    console.debug(...createStyleArgs('debug', message, ...args));
  }
}

// Alias
export const logLog = logInfo;




/*
 * PRIMARY API - Dot notation logging (recommended approach)
 * Familiar console.* style API with level filtering and styling
 */
export const cblcarsLog = {
  log: (...args) => logInfo(...args),
  info: (...args) => logInfo(...args),
  warn: (...args) => logWarn(...args),
  error: (...args) => logError(...args),
  debug: (...args) => logDebug(...args)
};

