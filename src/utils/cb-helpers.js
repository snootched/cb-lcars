export function getLovelace() {
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

  export function checkLovelaceTemplates(config) {
    const ll = getLovelace();
    const lovelaceTemplates = ll && ll.config && ll.config.cblcars_card_templates ? ll.config.cblcars_card_templates : {};
    let isUsingLovelaceTemplate = false;
    let overriddenTemplates = [];

    templates = config.templates || [];

    for (const template of templates) {
        if (lovelaceTemplates.hasOwnProperty(template)) {
            isUsingLovelaceTemplate = true;
            overriddenTemplates.push(template);
        }
    }

    // Remove duplicates and sort the array
    overriddenTemplates = [...new Set(overriddenTemplates)].sort();

    return { isUsingLovelaceTemplate, overriddenTemplates };
}