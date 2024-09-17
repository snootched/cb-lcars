import jsyaml from 'js-yaml';

import * as CBLCARS from '../cb-lcars-vars.js'
import { cblcarsLog } from '../utils/cb-lcars-logging.js';
import { fetchYAML, readYamlFile } from '../utils/cb-lcars-fileutils.js';

import { html, css } from 'lit';

import EditorForm from 'ha-editor-formbuilder';
//import { generateForm } from 'ha-editor-formbuilder/dist/index.js';
//import { FormControlType } from 'ha-editor-formbuilder/dist/interfaces.js';
//import { getEntitiesByDomain, getEntitiesByDeviceClass, formatList, getDropdownOptionsFromEnum } from 'ha-editor-formbuilder/dist/utils/entities.js';

export class CBLCARSCardEditor extends EditorForm {

    constructor() {
        super();
        //load the editor form yaml here or die
        }

    setConfig(config) {
        //let's get our this._config setup..
        super.setConfig(config);

        cblcarsLog('debug','CBLCARSCardEditor.setConfig()  this._config:',this._config);

        // Remove "custom:" prefix if it exists
        const cardType = config.type.replace(/^custom:/, '');

        cblcarsLog('debug',`cardType key for YAML config: ${cardType}`);

        readYamlFile(CBLCARS.card_editor_uri)
            .then(formDefinitions => {
                cblcarsLog('debug','formDefinitions: ',formDefinitions);
                this._formDefinitions = formDefinitions;
                console.debug('this._formDefinitions: ',this._formDefinitions)

                //returns the content for this card type
                this._formControls = formDefinitions[cardType];

                //old shit
                //this._formContent = formDefinitions[cardType].render_form;
                //console.debug('this._formContent: ',this._formContent)
                
                this._formStyles = formDefinitions[cardType].css || {};
                console.debug('this._formStyles: ',this._formStyles)
                
                
                this.requestUpdate();
            })
            .catch(error => {
                cblcarsLog('error','Error fetching editor form definitions: ', error);
            });    
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
            //old
            //const returnForm = this.renderForm(formContent);
            
            
            const returnForm = this.generateForm(formContent);
            console.log('returnForm:', returnForm);
            return returnForm;
        } catch (error) {
            console.error('Error in renderForm:', error);
            return html`<p>Error rendering form</p>`;
        }
    }

    static get styles() {
        if (!!this._formStyles) {
            cblcarsLog('debug','No editor form styles found for this card - returning blank css.');
            return css``;
        }

        cblcarsLog('debug',"formStyles: ",this._formStyles)
        cblcarsLog('info',"Returning editor form styles for this card: ",this._formStyles);
        return css`
            ${this._formStyles}
        `;
    }

}    
