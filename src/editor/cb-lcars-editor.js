import jsyaml from 'js-yaml';

import * as CBLCARS from '../cb-lcars-vars.js'
import { cblcarsLog } from '../utils/cb-lcars-logging.js';
import { fetchYAML, readYamlFile } from '../utils/cb-lcars-fileutils.js';

import { html, css, unsafeCSS, CSSResult} from 'lit';

import EditorForm from 'ha-editor-formbuilder';
//import { generateForm } from 'ha-editor-formbuilder/dist/index.js';
//import { FormControlType } from 'ha-editor-formbuilder/dist/interfaces.js';
//import { getEntitiesByDomain, getEntitiesByDeviceClass, formatList, getDropdownOptionsFromEnum } from 'ha-editor-formbuilder/dist/utils/entities.js';

export class CBLCARSCardEditor extends EditorForm {

    _formDefinitions;
    _formControls;
    _userStyles;
    _initializationPromise;

    constructor(cardType) {
        super();

        this._formDefinitions = {};
        this._formControls = {};
        this._userStyles = css``;
       

        //this._cardType = cardType;
        //this._cardType = config.type.replace(/^custom:/, '');    

        cblcarsLog('debug',`cardType key for YAML config: ${cardType}`);

        this._initializationPromise = readYamlFile(CBLCARS.card_editor_uri)
            .then(formDefinitions => {
                cblcarsLog('debug','formDefinitions: ',formDefinitions);
                this._formDefinitions = formDefinitions;
                console.debug('this._formDefinitions: ',this._formDefinitions)

                //returns the content for this card type
                this._formControls = formDefinitions[cardType];
       
                this._userStyles = css`${unsafeCSS(formDefinitions[cardType].css || '')}`;
                
                //this.requestUpdate();
            })
            .catch(error => {
                cblcarsLog('error','Error fetching editor form definitions: ', error);
            });


    }

    async setConfig(config) {

        await this._initializationPromise;
        
        //let's get our this._config setup..
        super.setConfig(config);

        cblcarsLog('debug','CBLCARSCardEditor.setConfig()  this._config:',this._config);

        this.requestUpdate();

/*
        // Remove "custom:" prefix if it exists
        //const cardType = config.type.replace(/^custom:/, '');
        this._cardType = config.type.replace(/^custom:/, '');    

        cblcarsLog('debug',`_cardType key for YAML config: ${this._cardType}`);

        readYamlFile(CBLCARS.card_editor_uri)
            .then(formDefinitions => {
                cblcarsLog('debug','formDefinitions: ',formDefinitions);
                this._formDefinitions = formDefinitions;
                console.debug('this._formDefinitions: ',this._formDefinitions)

                //returns the content for this card type
                this._formControls = formDefinitions[this._cardType];
       
                //this._userStyles = css`${formDefinitions[this._cardType].css || ''}`;
                this._userStyles = css`${unsafeCSS(formDefinitions[this._cardType].css || '')}`;
                
                //this._formStyles = formDefinitions[cardType].css || {};
                //console.debug('this._formStyles: ',this._formStyles)
                
                ////console.debug("BEFORE setUserStyles - userStyles: ", EditorForm._userStyles);
                ////const userStyles = formDefinitions[cardType].css || '';
                ////EditorForm.setUserStyles(userStyles);
                ////console.debug('setting userStyles: ', userStyles);
                ////console.debug("AFTER setUserStyles - userStyles: ", EditorForm._userStyles);

                this.requestUpdate();
            })
            .catch(error => {
                cblcarsLog('error','Error fetching editor form definitions: ', error);
            });   
*/ 
    }
    render() {
        //console.log("in CBLCARSCardEditor.render()");
        //console.log('this._hass:', this._hass);
        //console.log('this._config:', this._config);
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

    static get styles() {
        const baseStyles = super.styles;
        return [ baseStyles, this._userStyles ];
    }
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
