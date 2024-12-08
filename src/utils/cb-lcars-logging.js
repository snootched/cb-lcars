import * as CBLCARS from '../cb-lcars-vars.js';

let cblcarsGlobalLogLevel = 'info';

export function cblcarsSetGlobalLogLevel(level) {
  cblcarsGlobalLogLevel = level;
  cblcarsLog('info',`Setting CBLCARS global log level set to: ${level}`, {}, 'info');
}
export function cblcarsGetGlobalLogLevel() {
  return cblcarsGlobalLogLevel;
}

// Ensure the cblcars object exists on the window object
window.cblcars = window.cblcars || {};
// Attach the functions to the cblcars object
window.cblcars.setGlobalLogLevel = cblcarsSetGlobalLogLevel;
window.cblcars.getGlobalLogLevel = cblcarsGetGlobalLogLevel;



export function cblcarsLog(level, message, obj = {}, currentLogLevel = cblcarsGlobalLogLevel) {

    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(currentLogLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex > currentLevelIndex) {
        return; // Do not log the message if its level is lower than the current log level
    }

    const commonStyles = 'color: white; padding: 1px 4px; border-radius: 15px;';
    const levelStyles = {
      info: 'background-color: #37a6d1', // Blue
      warn: 'background-color: #ff6753', // Orange
      error: 'background-color: #ef1d10', // Red
      debug: 'background-color: #8e44ad', // Purple
      default: 'background-color: #6d748c', // Gray for unknown levels
    };

    // Capture the stack trace for caller information
    //const stack = new Error().stack;
    //const caller = stack.split('\n')[2].trim(); // Get the caller from the stack trace
    // Create a formatted log message with the specified level, caller, and message
    //remove caller cuz of webpack..

    //const logMessage = `%c    CB-LCARS | ${level} | ${caller} `;
    const logMessage = `%c    CB-LCARS | ${level} `;

    // Choose the appropriate style based on the level
    const style = `${levelStyles[level] || levelStyles.default}; ${commonStyles}`;

    // Log the message using the chosen style and console method
    switch (level) {
      case 'info':
        console.log(logMessage, style, message, obj);
        break;
      case 'warn':
        console.warn(logMessage, style, message, obj);
        break;
      case 'error':
        console.error(logMessage, style, message, obj);
        break;
      case 'debug':
        console.debug(logMessage, style, message, obj);
        break;
      default:
        console.log(logMessage, style, message, obj);
        break;
    }
  }

export function cblcarsLogGroup(level, title) {
    console.groupCollapsed(); // Create a collapsed group
    cblcarsLog(level, `Group: ${title}`);
    }

export function logImportStatus(importName, importedValue) {
    if (importedValue === undefined) {
        cblcarsLog('error', `Import error: ${importName} is not imported correctly.`);
    } else {
        console.debug(`${importName} imported successfully.`);
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

  // Create strings with the required number of spaces
  const spaces = ' '.repeat(spacesNeeded);
  const paddedUrl = ' '.repeat(padding) + url;

  console.info(`%c${spaces}${baseString}  %c\n%c${paddedUrl}  `, styles1.join(';'), invisibleStyle.join(';'), styles2.join(';'));
}
