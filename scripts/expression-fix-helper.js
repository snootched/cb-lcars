// Quick fix for expression cross-contamination
// This patches the template processing to be more selective

console.log('🔧 Applying quick fix for expression cross-contamination...');

const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
const pipelineInstance = window.__msdDebug?.pipelineInstance;

// Function to extract entity names from template strings
function extractEntityNames(templateString) {
  const entityNames = new Set();
  const regex = /\{([^}]+)\}/g;
  let match;

  while ((match = regex.exec(templateString)) !== null) {
    const expression = match[1].trim();

    // Extract entity names from the expression
    // Look for patterns like: entityName, entityName.prop, entityName > 70, etc.
    const entityRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b/g;
    let entityMatch;

    while ((entityMatch = entityRegex.exec(expression)) !== null) {
      const entityName = entityMatch[1];

      // Skip JavaScript keywords and operators
      if (!['true', 'false', 'null', 'undefined', 'if', 'else', 'return', 'var', 'let', 'const'].includes(entityName)) {
        entityNames.add(entityName);
      }
    }
  }

  return Array.from(entityNames);
}

// Test the extraction function
const testTemplate = "{test_cpu_temp > 70 ? 'HOT' : 'OK'}";
const extractedEntities = extractEntityNames(testTemplate);
console.log('🧮 Extracted entities from template:', extractedEntities);

// Check if there's a template processor we can patch
let templateProcessor = null;

// Look for template processor in various locations
if (pipelineInstance?.systemsManager?.templateProcessor) {
  templateProcessor = pipelineInstance.systemsManager.templateProcessor;
} else if (pipelineInstance?.templateProcessor) {
  templateProcessor = pipelineInstance.templateProcessor;
} else if (window.processTemplate) {
  console.log('📋 Found global processTemplate function');
}

if (templateProcessor) {
  console.log('✅ Template processor found, checking for patch opportunities...');

  // Check if it has a subscribe method that we can make more selective
  if (typeof templateProcessor.setupSubscriptions === 'function') {
    console.log('🔧 Found setupSubscriptions method - potential patch point');
  }

  if (typeof templateProcessor.subscribeToEntities === 'function') {
    console.log('🔧 Found subscribeToEntities method - potential patch point');
  }
}

// Create a selective subscription manager
window.__msdExpressionFix = {
  extractEntityNames,
  subscribeToTemplate: function(templateString, callback) {
    const entityNames = extractEntityNames(templateString);
    console.log('📡 Setting up selective subscription for entities:', entityNames);

    const subscriptions = [];

    entityNames.forEach(entityName => {
      const entity = dsm.getEntity(entityName);
      if (entity && typeof entity.subscribe === 'function') {
        console.log(`📡 Subscribing to ${entityName}`);
        const unsubscribe = entity.subscribe(() => {
          console.log(`🔄 ${entityName} updated, re-evaluating template`);
          callback();
        });
        subscriptions.push(unsubscribe);
      } else {
        console.log(`⚠️ Entity ${entityName} not found or no subscribe method`);
      }
    });

    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }
};

console.log('✅ Expression fix helper installed at window.__msdExpressionFix');
console.log('🔧 Use __msdExpressionFix.subscribeToTemplate(templateString, callback) for selective subscriptions');