import jsyaml from 'js-yaml';

import * as CBLCARS from '../cb-lcars-vars.js'
import { cblcarsLog } from '../utils/cb-lcars-logging.js';
import { fetchYAML, readYamlFile } from '../utils/cb-lcars-fileutils.js';

import { html, css, unsafeCSS, CSSResult} from 'lit';

import EditorForm from 'ha-editor-formbuilder';

export class CBLCARSCardEditor extends EditorForm {

    _formDefinitions;
    _formControls;
    _cardType;

    /// !!!move to base class
    //_userStyles;

    constructor(cardType) {
        super();

        /// !!!move to base class
        //this._userStyles = css``;
        
        this._formDefinitions = {};
        this._formControls = {};
        this._cardType = "";

        this._cardType = cardType;
        //this._cardType = config.type.replace(/^custom:/, '');    

        cblcarsLog('debug',`cardType key for YAML config: ${cardType}`);

    }

    async setConfig(config) {

        //let's get our this._config setup..
        super.setConfig(config);

        cblcarsLog('debug','CBLCARSCardEditor.setConfig()  this._config:',this._config);
        cblcarsLog('debug',`this._cardType key for YAML config: ${this._cardType}`);
        
        try {
            const formDefinitions = await readYamlFile(CBLCARS.card_editor_uri)
            cblcarsLog('debug','formDefinitions: ',formDefinitions);
            this._formDefinitions = formDefinitions;
            console.debug('this._formDefinitions: ',this._formDefinitions)

            //returns the content for this card type
            this._formControls = formDefinitions[this._cardType];
            console.debug('this._formControls: ',this._formControls);

            this._userStyles = css`${unsafeCSS(formDefinitions[this._cardType].css.cssText || '')}`;
            console.debug('this._userStyles: ',this._userStyles);
            this._mergeUserStyles = formDefinitions[this._cardType].css.mergeStyles || true;
            console.debug('this._mergeUserStyles: ',this._mergeUserStyles);

            this.requestUpdate();
        } catch(error) {
            cblcarsLog('error','Error fetching editor form definitions: ', error);
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        //if (changedProperties.has('_userStyles')) {
            this.shadowRoot.adoptedStyleSheets = [this.constructor.styles.styleSheet, this._userStyles.styleSheet];
        //}
    }

    render() {
        if (!this._hass || !this._config || !this._formDefinitions) {
            cblcarsLog('debug','Unable to setup form rendering - returning blank');
            return html``;
        }


        const formContent = this._formControls;
        cblcarsLog('debug',`Editor formContent: `,formContent);

        try {
            const returnForm = this.generateForm(formContent);
            console.log('returnForm:', returnForm);
            return returnForm;
        } catch (error) {
            console.error('Error in renderForm:', error);
            return html`<p>Error rendering form</p>`;
        }
    }


/*  !!!move to base class 
    static get styles() {
        const baseStyles = super.styles;
        return baseStyles;
        //return [ baseStyles, this._userStyles ];
    }
*/






    /*
    static get styles() {
        //if (!this._formStyles) {
        if (!CBLCARSCardEditor._userStyles) {
                cblcarsLog('debug','No editor form custom styles found for this card - returning base class css.');
            return super.styles;
        }

        
        cblcarsLog('debug',"formStyles: ", CBLCARSCardEditor._userStyles);
        cblcarsLog('info',"Returning editor form styles for this card: ", CBLCARSCardEditor._formStyles);
        return [
            super.styles,
            CBLCARSCardEditor._userStyles
        ];
    }
    */
}    
