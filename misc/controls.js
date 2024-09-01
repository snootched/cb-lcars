"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderCheckboxes = exports.renderRadio = exports.renderDropdown = exports.renderSwitch = exports.renderTextbox = exports.renderEntityDropdown = exports.renderFiller = void 0;
const lit_1 = require("lit");
const entities_1 = require("./entities");

const getNestedProperty = (obj, path) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const renderFiller = () => {
    return (0, lit_1.html) `<div class="form-control"></div>`;
};
exports.renderFiller = renderFiller;

const renderEntityDropdown = (card, control) => {
    return (0, lit_1.html) `
    <div class="form-control">
    <ha-entity-picker
    label="${control.label}"
    .value="${getNestedProperty(card._config, control.configValue) || ''}"
    .configValue="${control.configValue}"
    .hass="${card._hass}"
    domain-filter="${control.domain}"
    @change="${card._valueChanged}">
    </ha-entity-picker>
    </div>
    `;
};
exports.renderEntityDropdown = renderEntityDropdown;

const renderTextbox = (card, control) => {
    return (0, lit_1.html) `
    <div class="form-control">
    <ha-textfield
    label="${control.label}"
    .value="${getNestedProperty(card._config, control.configValue) || ''}"
    .configValue="${control.configValue}"
    @input="${card._valueChanged}"
    @change="${card._valueChanged}">
    </ha-textfield>
    </div>
    `;
};
exports.renderTextbox = renderTextbox;

const renderSwitch = (card, control) => {
    return (0, lit_1.html) `
    <div class="form-control">
    <ha-switch
    id="${control.configValue}"
    name="${control.configValue}"
    .checked="${getNestedProperty(card._config, control.configValue)}"
    .configValue="${control.configValue}"
    @change="${card._valueChanged}"
    >
    </ha-switch>
    <label for="${control.configValue}">${control.label}</label>
    </div>
    `;
};
exports.renderSwitch = renderSwitch;

const renderDropdown = (card, control) => {
    const items = control.items || (0, entities_1.getEntitiesByDomain)(card._hass, control.domain);
    return (0, lit_1.html) `
    <div class="form-control">
    <ha-combo-box
    label="${control.label}"
    .value="${getNestedProperty(card._config, control.configValue)}"
    .configValue="${control.configValue}"
    .items="${items}"
    @value-changed="${card._valueChanged}"
    @change=${card._valueChanged}
    ></ha-combo-box>
    </div>
    `;
};
exports.renderDropdown = renderDropdown;

const renderRadio = (card, control) => {
    return (0, lit_1.html) `
    <div class="form-control">
    <label>${control.label}</label>
    ${control.items.map(item => {
        return (0, lit_1.html) `
        <ha-radio
        id="${control.configValue}_${item.value}"
        name="${control.configValue}"
        .checked="${getNestedProperty(card._config, control.configValue) === item.value}"
        .configValue="${control.configValue}"
        .value="${item.value}"
        @change="${card._valueChanged}"
        >
        </ha-radio>
        <label for="${control.configValue}_${item.value}">${item.label}</label>
        `;
    })}
    </div>
    `;
};
exports.renderRadio = renderRadio;

const renderCheckboxes = (card, control) => {
    return (0, lit_1.html) `
    <label>${control.label}</label>
    ${control.items.map(item => {
        return (0, lit_1.html) `
        <div class="form-control">
        <ha-checkbox
        id="${control.configValue}_${item.value}"
        name="${control.configValue}[]"
        .checked="${(getNestedProperty(card._config, control.configValue) || []).indexOf(item.value) > -1}"
        .configValue="${control.configValue}"
        .value="${item.value}"
        @change="${card._valueChanged}"
        >
        </ha-checkbox>
        <label for="${control.configValue}_${item.value}">${item.label}</label>
        </div>
        `;
    })}
    `;
};
exports.renderCheckboxes = renderCheckboxes;
