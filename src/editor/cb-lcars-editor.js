import * as CBLCARS from '../cb-lcars-vars.js'
import { cblcarsLog } from '../utils/cb-lcars-logging.js';

import { html, css, unsafeCSS } from 'lit';

import EditorForm from 'ha-editor-formbuilder-yaml';

export class CBLCARSCardEditor extends EditorForm {

    _formControls;
    _cardType;

    constructor(cardType) {
        super();

        this._formControls = {};
        this._cardType = "";
        this._cardType = cardType;

        //cblcarsLog.debug(`Setting up editor for ${cardType}`);

        this._initializationPromise = this._initialize();
    }

    async _initialize() {
        try {
            // Fetch only the relevant JSON file for this card type
            const response = await fetch(`${CBLCARS.card_editor_uri}/${this._cardType}.json`);
            if (!response.ok) throw new Error(`Form definition not found for card type: ${this._cardType}`);
            const formControls = await response.json();
            cblcarsLog.debug('Loaded formControls:', formControls);
            this._formControls = formControls;

            // Handle user styles if present
            this._userStyles = css`${unsafeCSS((formControls.css && formControls.css.cssText) || '')}`;
            this._mergeUserStyles = formControls?.css?.mergeUserStyles ?? true;

            this.requestUpdate();
        } catch(error) {
            cblcarsLog.error('Error fetching editor form definition: ', error);
        }
    }

    async setConfig(config) {

        await this._initializationPromise;

        super.setConfig(config);
        this.requestUpdate();

    }

    render() {
        if (!this._hass) {
            return html`<ha-alert alert-type="error" title="Error">Home Assistant instance is missing.</ha-alert>`;
        }

        if (!this._config) {
            return html`<ha-alert alert-type="error" title="Error">Card configuration is missing.</ha-alert>`;
        }

        if (!this._formControls) {
            return html`<ha-alert alert-type="error" title="Error">Form controls are missing.</ha-alert>`;
        }

        try {
            const formContent = this._formControls;
            const returnForm = this.generateForm(formContent);
            return returnForm;
        } catch (error) {
            cblcarsLog.error('Error rendering configuration form:', error);
            return html`<ha-alert alert-type="error" title="Error">Error rendering form: ${error.message}</ha-alert>`;
        }
    }

}
