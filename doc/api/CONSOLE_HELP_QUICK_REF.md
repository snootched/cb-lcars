# CB-LCARS Console Help - Quick Reference

## 🎯 Getting Started (30 seconds)

```javascript
// 1. Create shorthand
const msd = window.cblcars.debug.msd;

// 2. See what's available
msd.help();

// 3. Get examples
msd.usage();
```

---

## 📖 Two Main Commands

### `help([topic])`
**What it does:** Shows available methods
**When to use:** "What methods exist in the perf namespace?"

```javascript
msd.help();           // All namespaces
msd.help('perf');     // Performance methods
msd.help('overlays'); // Overlay methods
```

### `usage([namespace])`
**What it does:** Shows code examples
**When to use:** "How do I use the routing API?"

```javascript
msd.usage();           // Quick start
msd.usage('routing');  // Routing examples
msd.usage('data');     // Data examples
```

---

## 📚 11 Namespaces Available

| Namespace | What It Does | Example |
|-----------|--------------|---------|
| `perf` | Performance profiling | `msd.help('perf')` |
| `routing` | Route debugging | `msd.help('routing')` |
| `data` | Data inspection | `msd.help('data')` |
| `styles` | Style computation | `msd.help('styles')` |
| `charts` | Chart debugging | `msd.help('charts')` |
| `rules` | Rule evaluation | `msd.help('rules')` |
| `animations` | Animation control | `msd.help('animations')` |
| `packs` | Pack management | `msd.help('packs')` |
| `visual` | Visual debugging | `msd.help('visual')` |
| `overlays` | Overlay operations | `msd.help('overlays')` |
| `pipeline` | Pipeline control | `msd.help('pipeline')` |

---

## 💡 Common Workflows

### "I need to debug performance"
```javascript
msd.help('perf');           // What's available?
msd.usage('perf');          // Show me examples
msd.perf.summary();         // Get performance data
```

### "How do I update overlays?"
```javascript
msd.help('overlays');       // List overlay methods
msd.usage('overlays');      // See bulk update examples
msd.overlays.list();        // Try it out
```

### "I want to inspect routing"
```javascript
msd.help('routing');        // Routing methods
msd.usage('routing');       // Routing examples
msd.routing.inspect('guid'); // Debug specific element
```

---

## 🎨 Output Features

- **Color-coded** - Orange headers, cyan method names
- **Self-documenting** - Each output suggests next steps
- **Copy-pasteable** - Examples work as-is
- **No autocomplete needed** - Just type `msd.help()`

---

## 🔧 For Developers

### Update when adding methods:

**File:** `src/api/MsdDebugAPI.js` (top of file)

1. Add to `help()` → `namespaces` object
2. Add to `usage()` → `examples` object

### Test changes:
```bash
npm run build
open test-help-usage.html
```

---

**That's it!** Just type `msd.help()` in console to get started.
