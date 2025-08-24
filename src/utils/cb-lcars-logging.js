import * as CBLCARS from '../cb-lcars-vars.js';

let cblcarsGlobalLogLevel = 'info';

export function cblcarsSetGlobalLogLevel(level) {
  cblcarsGlobalLogLevel = level;
  cblcarsLog.info(`Setting CBLCARS global log level set to: ${level}`, {}, 'info');
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

export function baseLogger(level, ...args) {
  const levels = ['error', 'warn', 'info', 'debug'];
  const currentLevelIndex = levels.indexOf(cblcarsGlobalLogLevel);
  const messageLevelIndex = levels.indexOf(level);

  if (messageLevelIndex > currentLevelIndex) return;

  const commonStyles = 'color: white; padding: 1px 4px; border-radius: 15px;';
  const levelStyles = {
    info: 'background-color: #37a6d1',
    warn: 'background-color: #ff6753',
    error: 'background-color: #ef1d10',
    debug: 'background-color: #8e44ad',
    default: 'background-color: #6d748c',
  };

  const logMessage = `%c    CB-LCARS | ${level} `;
  const style = `${levelStyles[level] || levelStyles.default}; ${commonStyles}`;

  // Use spread to pass all args after the styled prefix
  switch (level) {
    case 'info':
      console.log(logMessage, style, ...args);
      break;
    case 'warn':
      console.warn(logMessage, style, ...args);
      break;
    case 'error':
      console.error(logMessage, style, ...args);
      break;
    case 'debug':
      console.debug(logMessage, style, ...args);
      break;
    default:
      console.log(logMessage, style, ...args);
      break;
  }
}

/**
 * Centralized CB-LCARS logging utility.
 *
 * Supports log level filtering and styled output.
 * Functions as a drop-in replacement for `console.log`, `console.warn`, etc.
 *
 * **Preferred usage:**
 *   `cblcarsLog.info('message');`
 *   `cblcarsLog.warn('message');`
 *   `cblcarsLog.error('message');`
 *   `cblcarsLog.debug('message');`
 *   `cblcarsLog.log('message');`
 *
 * *Legacy usage (not recommended):*
 *   `cblcarsLog('warn', 'message');`
 *
 * **Log level filtering:**
 *
 *   Only messages at or above the global log level are printed.
 *   For example, if the global log level is 'warn', only 'warn' and 'error' messages are shown.
 *
 * **Setting the global log level:**
 *
 *   Use the function `cblcarsSetGlobalLogLevel(level)`, or
 *   `window.cblcars.setGlobalLogLevel(level)`
 *   Valid levels: `'error'`, `'warn'`, `'info'`, `'debug'`
 *
 * @param {'error'|'warn'|'info'|'debug'} level - The log level.
 * @param {...any} args - Arguments to log.
 * @returns {void}
 *
 * @property {function(...any):void} log   - Log an info-level message.
 * @property {function(...any):void} info  - Log an info-level message.
 * @property {function(...any):void} warn  - Log a warning message.
 * @property {function(...any):void} error - Log an error message.
 * @property {function(...any):void} debug - Log a debug message.
 */
function cblcarsLog(level, ...args) {
  return baseLogger(level, ...args);
}
cblcarsLog.log   = (...args) => baseLogger('info', ...args);
cblcarsLog.info  = (...args) => baseLogger('info', ...args);
cblcarsLog.warn  = (...args) => baseLogger('warn', ...args);
cblcarsLog.error = (...args) => baseLogger('error', ...args);
cblcarsLog.debug = (...args) => baseLogger('debug', ...args);
export { cblcarsLog };


export function cblcarsLogGroup(level, title) {
    console.groupCollapsed(); // Create a collapsed group
    cblcarsLog(level, `Group: ${title}`);
    }

export function logImportStatus(importName, importedValue) {
    if (importedValue === undefined) {
        cblcarsLog.error(`Import error: ${importName} is not imported correctly.`);
    } else {
        cblcarsLog.debug(`${importName} imported successfully.`);
    }
}

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
