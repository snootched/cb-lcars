# StyleResolverService API Reference

## Class: StyleResolverService

### Constructor

```javascript
new StyleResolverService(themeManager, config)
```

**Parameters:**
- `themeManager` (Object): ThemeManager instance
- `config` (Object): Configuration options
  - `config.cacheEnabled` (boolean): Enable caching (default: true)
  - `config.maxCacheSize` (number): Max cache entries (default: 1000)
  - `config.debug` (boolean): Enable debug logging (default: false)

**Example:**
```javascript
const styleResolver = new StyleResolverService(themeManager, {
  cacheEnabled: true,
  maxCacheSize: 1000,
  debug: false
});
```

---

### Methods

#### resolveProperty(options)

Resolve a single style property.

**Parameters:**
- `options` (Object): Resolution options
  - `options.property` (string): Property name
  - `options.value` (*): Explicit value from config
  - `options.tokenPath` (string): Token path to resolve
  - `options.defaultValue` (*): Final fallback value
  - `options.context` (Object): Resolution context
  - `options.componentType` (string): Component type for defaults

**Returns:** Object with `{value, source}`

**Example:**
```javascript
const result = styleResolver.resolveProperty({
  property: 'backgroundColor',
  value: undefined,
  tokenPath: 'components.chart.backgroundColor',
  defaultValue: 'transparent',
  context: { overlayId: 'my-chart' }
});
// Returns: {value: '#330033', source: 'token_system'}
```

---

#### getCacheStats()

Get cache statistics.

**Returns:** Object with cache stats

**Example:**
```javascript
const stats = styleResolver.getCacheStats();
console.log(stats);
// {
//   size: 45,
//   hits: 234,
//   misses: 56,
//   hitRate: 0.807,
//   tokenResolutions: 89
// }
```

---

#### clearCache()

Clear all caches.

**Example:**
```javascript
styleResolver.clearCache();
```

---

#### onThemeChange(callback)

Subscribe to theme changes.

**Parameters:**
- `callback` (Function): Called when theme changes

**Returns:** Function to unsubscribe

**Example:**
```javascript
const unsubscribe = styleResolver.onThemeChange((themeName) => {
  console.log('Theme changed:', themeName);
});

// Later:
unsubscribe();
```

---

## Class: TokenResolver

### Methods

#### resolve(tokenPath, defaultValue, context)

Resolve a token path to its value.

**Parameters:**
- `tokenPath` (string): Dot-notation token path
- `defaultValue` (*): Fallback if not found
- `context` (Object): Resolution context

**Returns:** Object with `{value, path, resolved}`

**Example:**
```javascript
const result = tokenResolver.resolve('colors.accent.primary', '#FF9900', {});
// Returns: {value: '#FF9900', path: 'colors.accent.primary', resolved: true}
```

---

## Debug Tools

### Check StyleResolver

```javascript
// Global access
console.log(window.cblcars.styleResolver);

// Check availability on renderer
const renderer = window.__msdDebug.overlays['my-text'];
console.log(!!renderer.styleResolver);
```

### Manual Resolution

```javascript
const result = window.cblcars.styleResolver.resolveProperty({
  property: 'color',
  value: undefined,
  tokenPath: 'colors.accent.primary',
  defaultValue: '#FF9900'
});
console.log(result);
```

### Cache Stats

```javascript
const stats = window.cblcars.styleResolver.getCacheStats();
console.log('Cache hit rate:', stats.hitRate);
```

### Provenance

```javascript
const provenance = window.__msdDebug.getProvenance('my-overlay');
console.log(provenance.style_resolution);
```

---

## See Also

- [Style Resolution User Guide](../user/style-resolution.md)
- [Theme System Architecture](../spec/theme-system.md)
- [Token Reference](../reference/tokens.md)