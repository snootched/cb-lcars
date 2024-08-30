class CustomButtonWrapperCard extends HTMLElement {
    setConfig(config) {
      if (!config || !config.button_card_config) {
        throw new Error("You need to define button_card_config");
      }
  
      // Create a new object to avoid modifying the original config
      const buttonCardConfig = {
        type: 'custom:button-card',
        show_icon: true,
        show_name: true,
        ...config.button_card_config,
      };
  
      this._config = { ...config, button_card_config: buttonCardConfig };
  
      if (!this._card) {
        this._card = document.createElement('button-card');
        this.appendChild(this._card);
      }
  
      this._card.setConfig(this._config.button_card_config);
    }
  
    set hass(hass) {
      if (this._card) {
        this._card.hass = hass;
      }
    }
  
    getCardSize() {
      return this._card ? this._card.getCardSize() : 1;
    }
  }
  
  customElements.define('custom-button-wrapper-card', CustomButtonWrapperCard);
  
  // Register the card for the GUI editor
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'custom-button-wrapper-card',
    name: 'Custom Button Wrapper Card',
    description: 'A custom card that wraps the button card with additional configuration.',
  });
  
  // Custom logging function
  async function cblcarsLog(level, message) {
    let styles = [
      'color: white',
      'padding: 2px 4px',
      'border-radius: 15px'
    ];
  
    switch (level) {
      case 'info':
        styles.push('background-color: #37a6d1'); // Blue
        console.log(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
        break;
      case 'warn':
        styles.push('background-color: #ff6753'); // Orange
        console.warn(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
        break;
      case 'error':
        styles.push('background-color: #ef1d10'); // Red
        console.error(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
        break;
      case 'debug':
        styles.push('background-color: #8e44ad'); // Purple
        console.debug(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
        break;
      default:
        styles.push('background-color: #6d748c'); // Gray for unknown levels
        console.log(`%c    CB-LCARS | ${level} `, styles.join(';'), message);
        break;
    }
  }
  
  // Function to read and parse the YAML file
  async function readYamlFile(filePath) {
    const response = await fetch(filePath);
    const text = await response.text();
    return jsyaml.load(text);
  }
  
  // Function to get the Lovelace configuration
  function getLovelace() {
    let root = document.querySelector('home-assistant');
    root = root && root.shadowRoot;
    root = root && root.querySelector('home-assistant-main');
    root = root && root.shadowRoot;
    root = root && root.querySelector('app-drawer-layout partial-panel-resolver, ha-drawer partial-panel-resolver');
    root = (root && root.shadowRoot) || root;
    root = root && root.querySelector('ha-panel-lovelace');
    root = root && root.shadowRoot;
    root = root && root.querySelector('hui-root');
    if (root) {
      const ll = root.lovelace;
      ll.current_view = root.___curView;
      return ll;
    }
    return null;
  }
  
  // Function to update the Lovelace configuration
  async function updateLovelaceConfig(filePath) {
    const newConfig = await readYamlFile(filePath);
    const lovelaceConfig = getLovelace();
  
    if (lovelaceConfig) {
      const cbLcarsConfig = lovelaceConfig.config['cb-lcars'] || {};
      const newCbLcarsConfig = newConfig['cb-lcars'] || {};
  
      // Check if the cb-lcars.manage_config flag is set
      if (cbLcarsConfig.manage_config) {
        // Check if the new configuration version is different
        const currentVersion = cbLcarsConfig.version || 0;
        const newVersion = newCbLcarsConfig.version || 0;
  
        if (newVersion > currentVersion) {
          // Merge the cb-lcars configurations
          const updatedCbLcarsConfig = { ...cbLcarsConfig, ...newCbLcarsConfig };
  
          // Create a new configuration object by copying the existing one and updating cb-lcars
          const updatedConfig = { ...lovelaceConfig.config, ...newConfig, 'cb-lcars': updatedCbLcarsConfig };
  
          // Apply the updated configuration
          await lovelaceConfig.saveConfig(updatedConfig);
          await cblcarsLog('info', 'Lovelace configuration updated successfully');
        } else if (newVersion === 0) {
          await cblcarsLog('warn', 'New configuration version is not defined. Please set a version in your YAML file.');
        } else {
          await cblcarsLog('info', 'Configuration is up to date');
        }
      } else {
        await cblcarsLog('warn', 'Configuration management is disabled. Set cb-lcars.manage_config to true in your Lovelace configuration to enable it.');
      }
    } else {
      await cblcarsLog('error', 'Failed to retrieve Lovelace configuration');
    }
  }
  
  // Flag to check if the configuration has been merged
  let isConfigMerged = false;
  
  // Function to initialize the configuration update
  async function initializeConfigUpdate() {
    if (!isConfigMerged) {
      await updateLovelaceConfig('/hacsfiles/cb-lcars/cb-lcars-full-new.yaml');
      isConfigMerged = true;
    }
  }
  

  
  // Use DOMContentLoaded event to initialize configuration update
  document.addEventListener('DOMContentLoaded', initializeConfigUpdate);
  
  // Use MutationObserver to watch for changes in the DOM and reinitialize if necessary
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length || mutation.removedNodes.length) {
        initializeConfigUpdate();
      }
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  