import jsyaml from 'js-yaml';

import * as CBLCARS from '../cb-lcars-vars.js'
import { cblcarsLog } from '../utils/cb-lcars-logging.js';
import { fetchYAML } from '../utils/cb-lcars-fileutils.js';

import { html, css } from 'lit';

import EditorForm from 'ha-editor-formbuilder';
import { FormControlType } from 'ha-editor-formbuilder/dist/interfaces.js';
import { getEntitiesByDomain, getEntitiesByDeviceClass, formatList, getDropdownOptionsFromEnum } from 'ha-editor-formbuilder/dist/utils/entities.js';


//custom yaml schema for the FormControlType
export async function readFormEditorYamlFile(url) {
    try {
       // Define the FormControlType enum as per the renderer's code
        const FormControlType = {
            Dropdown: 'dropdown',
            Checkbox: 'checkbox',
            Checkboxes: 'checkboxes',
            Radio: 'radio',
            Switch: 'switch',
            Textbox: 'textbox',
            Filler: 'filler',
            EntityDropdown: 'entity-dropdown',
            Slider: 'slider'
        };
        
        // Custom YAML type for FormControlType
        const FormControlTypeYamlType = new jsyaml.Type('!FormControlType', {
            kind: 'scalar',
            resolve: function (data) {
              return FormControlType.hasOwnProperty(data);
            },
            construct: function (data) {
              return FormControlType[data];
            },
            instanceOf: String,
            represent: function (data) {
              return data;
            }
          });
        
        // Create a schema that includes the custom type
        const SCHEMA = jsyaml.DEFAULT_SCHEMA.extend([FormControlTypeYamlType]);
  

        //await loadJsYaml; // Wait for the js-yaml script to load
        const response = await fetchYAML(url);
        const jsObject = jsyaml.load(response, { schema: SCHEMA });
        cblcarsLog('debug',`Processed YAML file: ${url}`);
        cblcarsLog('debug','FormEditor object from custom schema:' ,jsObject);
        return jsObject;
    } catch (error) {
        cblcarsLog('error', 'Failed to parse YAML file',error.message);
        throw error; // Re-throw the error after logging it
    }
}

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

        readFormEditorYamlFile(CBLCARS.card_editor_uri)
            .then(formDefinitions => {
                cblcarsLog('debug','formDefinitions: ',formDefinitions);
                this._formDefinitions = formDefinitions;
                console.debug('this._formDefinitions: ',this._formDefinitions)
                this._formContent = formDefinitions[cardType].render_form;
                console.debug('this._formContent: ',this._formContent)
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


        const formContent = this._formContent;
        cblcarsLog('debug',`Editor formContent: `,formContent);

        try {
            const returnForm = this.renderForm(formContent);
            console.log('returnForm:', returnForm);
            return returnForm;
        } catch (error) {
            console.error('Error in renderForm:', error);
            return html`<p>Error rendering form</p>`;
        }
    }

    styles() {
        if (!!this._formStyles) {
            //cblcarsLog('debug','No editor form styles found for this card - returning blank css.');
            return css``;
        }

        //cblcarsLog('debug',"formStyles: ",this._formStyles)
        return css`
            ${this._formStyles}
        `;
    }

}    
