const fs = require('fs');
const yaml = require('js-yaml');
const yamlContent = fs.readFileSync('src/editor/cb-lcars-card-editor-forms.yaml', 'utf8');
const doc = yaml.load(yamlContent);
for (const cardType in doc) {
fs.writeFileSync(
    `src/editor/${cardType}.json`,
    JSON.stringify(doc[cardType], null, 2)
);
}
console.log('JSON files generated successfully in the output directory.');