// Script to generate per-card JSON editor definitions from the master YAML file

const fs = require('fs');
const yaml = require('js-yaml');

// Read the master YAML file containing all card editor definitions
const yamlContent = fs.readFileSync('src/editor/cb-lcars-card-editor-forms.yaml', 'utf8');

// Parse the YAML content into a JavaScript object
const doc = yaml.load(yamlContent);

// For each card type, write a separate JSON file with its editor definition
for (const cardType in doc) {
    fs.writeFileSync(
        `src/editor/${cardType}.json`,
        JSON.stringify(doc[cardType], null, 2)
    );
}

console.log('JSON files generated successfully in the output directory.');