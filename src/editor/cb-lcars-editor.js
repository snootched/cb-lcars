import * as CBLCARS from '../cb-lcars-vars.js'
import { cblcarsLog } from '../utils/cb-lcars-logging.js';
import { readYamlFile } from '../utils/cb-lcars-fileutils.js';

import { html, css, unsafeCSS } from 'lit';

import EditorForm from 'ha-card-formbuilder';

export class CBLCARSCardEditor extends EditorForm {

    _formDefinitions;
    _formControls;
    _cardType;

    constructor(cardType) {
        super();

        this._formDefinitions = {};
        this._formControls = {};
        this._cardType = "";

        this._cardType = cardType;

        cblcarsLog('debug',`Setting up editor for ${cardType}`);

        this._initializationPromise = this._initialize();
    }

    async _initialize() {
        try {
            const formDefinitions = await readYamlFile(CBLCARS.card_editor_uri)
            cblcarsLog('debug','formDefinitions: ',formDefinitions);
            this._formDefinitions = formDefinitions;
            //console.debug('this._formDefinitions: ',this._formDefinitions)

            //returns the content for this card type
            this._formControls = formDefinitions[this._cardType];
            //console.debug('this._formControls: ',this._formControls);

            this._userStyles = css`${unsafeCSS((formDefinitions[this._cardType].css && formDefinitions[this._cardType].css.cssText) || '')}`;
            //console.debug('this._userStyles: ',this._userStyles);
            this._mergeUserStyles = formDefinitions[this._cardType]?.css?.mergeUserStyles ?? true;
            //console.debug('this._mergeUserStyles: ',this._mergeUserStyles);

            this.requestUpdate();
        } catch(error) {
            cblcarsLog('error','Error fetching editor form definitions: ', error);
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
            cblcarsLog('error','Error rendering configuration form:', error);
            return html`<ha-alert alert-type="error" title="Error">Error rendering form: ${error.message}</ha-alert>`;
        }
    }

}
