
**Background:**
The current editor loads a large YAML file (due to heavy use of anchors with shared UI config) at runtime and parses the whole thing in the browser - even though only one card's form section is ever needed. This causes sluggish loading, especially as the YAML grows.

**Plan:**
- Prefer processing to happen server-side instead of client.
- Preprocess the master YAML file into individual JSON files per card type at build time.
- Resolve anchors and shared definitions during preprocessing, so each card’s JSON is self-contained.
- Distribute the resulting per-card JSON files with the package.
- Update the frontend editor code to fetch only the relevant JSON file for the specified card type, instead of loading and parsing the entire YAML in the browser.

**Implementation Steps:**

1. **Preprocessing Script**
   - Use Node.js or Python to read the full YAML, resolve all anchors, and output each top-level card definition as a separate JSON file.
   - Example Node.js snippet:
     ```js
     const fs = require('fs');
     const yaml = require('js-yaml');
     const yamlContent = fs.readFileSync('card-editors.yaml', 'utf8');
     const doc = yaml.load(yamlContent);
     for (const cardType in doc) {
       fs.writeFileSync(
         `output/${cardType}.json`,
         JSON.stringify(doc[cardType], null, 2)
       );
     }
     ```
2. **Distribute JSON Files**
   - Place these in a folder like `/editor-definitions` and ensure they're accessible to the client-side code.

3. **Update Editor Code**
   - Replace YAML file loading with a fetch for the relevant JSON file:
     ```js
     const response = await fetch(`/editor-definitions/${this._cardType}.json`);
     if (!response.ok) throw new Error('Form definition not found');
     this._formControls = await response.json();
     ```
4. **Workflow**
   - Continue editing the master YAML with anchors/aliases.
   - Regenerate JSON files at build-time with release.

**Benefits:**
- Dramatically faster editor load times.
- Lower memory usage in the browser.
- Simpler, more maintainable client code.

**Additional Notes:**
- Consider versioning the JSON files






---



Given that your build pipeline uses **GitHub Actions** and you prefer a JavaScript-based solution, the best method is to add a Node.js-based preprocessing step as part of your GitHub Actions workflow. Here’s a recommended approach:

---

## 1. Add a Preprocessing Script to Your Repo

Create a script like `scripts/generate-editor-json.js`:

```js
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const INPUT = path.resolve(__dirname, '../src/editor/card-editors.yaml');
const OUTPUT_DIR = path.resolve(__dirname, '../public/editor-definitions');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const doc = yaml.load(fs.readFileSync(INPUT, 'utf8'));

for (const cardType in doc) {
  const outPath = path.join(OUTPUT_DIR, `${cardType}.json`);
  fs.writeFileSync(outPath, JSON.stringify(doc[cardType], null, 2));
  console.log(`Wrote: ${outPath}`);
}
```
- Adjust paths as needed to match your repo structure.
- This script will take your big YAML and output one JSON file per card type to a public directory.

---

## 2. Add Required Dependencies

Add these to your `package.json` if not already present:
```json
"devDependencies": {
  "js-yaml": "^4.1.0"
}
```
and run:
```sh
npm install --save-dev js-yaml
```

---

## 3. Add a Build Step to package.json

Add a script entry:
```json
"scripts": {
  "generate-editor-json": "node scripts/generate-editor-json.js"
}
```

---

## 4. Update Your GitHub Actions Workflow

Add a step to your workflow YAML (e.g., `.github/workflows/build.yml`):

```yaml
- name: Generate per-card JSON editor definitions
  run: npm run generate-editor-json
```
Make sure this runs before your packaging/deploy step.

---

## 5. .gitignore Consideration

If you want to **commit** the generated JSON files, do not add the output directory to `.gitignore`.  
If they are build artifacts, add them to `.gitignore` and ensure your deployment process copies them to the server/site.

---

## 6. Update the Frontend Code

Make sure your editor code fetches `/editor-definitions/<cardType>.json` as previously discussed.

---

## **Summary**

- Use a Node.js (JavaScript) script with `js-yaml` to preprocess YAML to JSON.
- Integrate the script into your GitHub Actions workflow.
- Output per-card JSON files for fast editor loading.
- This approach is simple, robust, and keeps your build fully JavaScript-based.

