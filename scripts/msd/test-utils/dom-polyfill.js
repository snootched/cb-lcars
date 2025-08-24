/**
 * Enhanced DOM polyfill for headless MSD testing
 * Provides working SVG element creation and manipulation
 */

const isNode = typeof window === 'undefined';

export function setupDomPolyfill() {
  if (!isNode) return;

  const createMockElement = (ns, tag) => {
    const elem = {
      setAttribute: function(name, value) {
        this._attrs = this._attrs || {};
        this._attrs[name] = value;
        if (name === 'id') this.id = value;
      },
      getAttribute: function(name) { return this._attrs?.[name] || null; },
      appendChild: function(child) {
        this._children = this._children || [];
        this._children.push(child);
        child.parentNode = this;
        child._parent = this;

        // ENSURE: Child has proper tagName for matching
        if (child && !child.tagName && child.nodeName) {
          child.tagName = child.nodeName.toLowerCase();
        }

        return child;
      },
      remove: function() {
        if (this.parentNode && this.parentNode._children) {
          const index = this.parentNode._children.indexOf(this);
          if (index > -1) this.parentNode._children.splice(index, 1);
        }
        this.parentNode = null;
      },
      querySelector: function(sel) {
        if (!this._children) return null;

        if (sel.startsWith('#')) {
          const id = sel.substring(1);
          const found = this._children.find(c => c.id === id);
          if (found) return found;

          for (const child of this._children) {
            if (child.querySelector) {
              const result = child.querySelector(sel);
              if (result) return result;
            }
          }
          return null;
        }

        const found = this._children.find(c => c.tagName?.toLowerCase() === sel.toLowerCase());
        if (found) return found;

        for (const child of this._children) {
          if (child.querySelector) {
            const result = child.querySelector(sel);
            if (result) return result;
          }
        }
        return null;
      },
      querySelectorAll: function(sel) {
        const results = [];
        if (!this._children) return results;

        const collectMatching = (element) => {
          if (!element._children) return;

          for (const child of element._children) {
            let matches = false;

            // FIXED: More robust tag matching
            const childTag = (child.tagName || '').toLowerCase();

            if (sel === 'circle' && childTag === 'circle') {
              matches = true;
            } else if (sel === 'text' && childTag === 'text') {
              matches = true;
            } else if (sel === 'rect' && childTag === 'rect') {
              matches = true;
            } else if (sel === 'path' && childTag === 'path') {
              matches = true;
            } else if (sel === '[id][data-cblcars-root="true"]' && child.id && child.getAttribute('data-cblcars-root') === 'true') {
              matches = true;
            } else if (sel === '[id]' && child.id) {
              matches = true;
            }

            if (matches) {
              results.push(child);
            }

            // Always recurse
            collectMatching(child);
          }
        };

        collectMatching(this);
        return results;
      },
      get innerHTML() { return this._innerHTML || ''; },
      set innerHTML(value) {
        this._innerHTML = value;
        this._children = [];
      },
      get children() { return this._children || []; },
      get length() { return this._children?.length || 0; },
      style: {},
      get textContent() { return this._textContent || ''; },
      set textContent(value) { this._textContent = value; },
      parentNode: null,
      id: '',
      tagName: tag?.toLowerCase() || 'div', // FIXED: Consistent lowercase

      setAttribute: function(name, value) {
        this._attrs = this._attrs || {};
        this._attrs[name] = value;
        if (name === 'id') this.id = value;
      },
      getAttribute: function(name) { return this._attrs?.[name] || null; },
      appendChild: function(child) {
        this._children = this._children || [];
        this._children.push(child);
        child.parentNode = this;
        child._parent = this;

        // ENSURE: Child has proper tagName for matching
        if (child && !child.tagName && child.nodeName) {
          child.tagName = child.nodeName.toLowerCase();
        }

        return child;
      },

      // ...existing code...

      querySelectorAll: function(sel) {
        const results = [];
        if (!this._children) return results;

        const collectMatching = (element) => {
          if (!element._children) return;

          for (const child of element._children) {
            let matches = false;

            // FIXED: More robust tag matching
            const childTag = (child.tagName || '').toLowerCase();

            if (sel === 'circle' && childTag === 'circle') {
              matches = true;
            } else if (sel === 'text' && childTag === 'text') {
              matches = true;
            } else if (sel === 'rect' && childTag === 'rect') {
              matches = true;
            } else if (sel === 'path' && childTag === 'path') {
              matches = true;
            } else if (sel === '[id][data-cblcars-root="true"]' && child.id && child.getAttribute('data-cblcars-root') === 'true') {
              matches = true;
            } else if (sel === '[id]' && child.id) {
              matches = true;
            }

            if (matches) {
              results.push(child);
            }

            // Always recurse
            collectMatching(child);
          }
        };

        collectMatching(this);
        return results;
      },

      // ...existing code...
    };

    // FIXED: Consistent SVG element creation
    if (ns && ns.includes('svg')) {
      elem.namespaceURI = ns;
      elem.tagName = tag?.toLowerCase() || 'g';

      // Set textContent property for text elements
      if (tag === 'text') {
        elem.getBBox = () => ({ x: 100, y: 50, width: 200, height: 30 });

        // FIXED: Ensure textContent is properly settable
        Object.defineProperty(elem, 'textContent', {
          get() { return this._textContent || ''; },
          set(value) {
            this._textContent = value;
            // Ensure the text element is discoverable
            if (!this.tagName) this.tagName = 'text';
          },
          enumerable: true,
          configurable: true
        });
      } else if (tag === 'rect') {
        elem.getBBox = () => ({ x: 120, y: 80, width: 300, height: 60 });
      } else {
        elem.getBBox = () => ({ x: 100, y: 100, width: 300, height: 60 });
      }
    }

    return elem;
  };

  global.document = {
    createElementNS: createMockElement,
    createElement: (tag) => createMockElement(null, tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    body: {
      appendChild: (element) => {
        // Mock body.appendChild for Node.js testing
        element._appendedToBody = true;
        return element;
      }
    },
    head: {
      appendChild: (element) => {
        // Mock head.appendChild for style elements
        element._appendedToHead = true;
        return element;
      }
    }
  };

  global.window = {
    getComputedStyle: () => ({}),
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id)
  };

  global.createMockElement = createMockElement;
}

export function createMockContainer() {
  const createElement = isNode ? global.createMockElement : document.createElementNS.bind(document);

  const container = isNode ? createElement(null, 'div') : document.createElement('div');
  const svg = createElement('http://www.w3.org/2000/svg', 'svg');

  svg.setAttribute('viewBox', '0 0 800 600');
  container.appendChild(svg);

  container.querySelector = function(sel) {
    if (sel === 'svg') return svg;
    if (sel.startsWith('#')) {
      return svg.querySelector(sel);
    }
    return null;
  };

  container.querySelectorAll = function(sel) {
    const results = [];
    if (this._children) {
      for (const child of this._children) {
        results.push(...child.querySelectorAll(sel));
      }
    }
    return results;
  };

  return container;
}

export function createMockContainerWithOverlays() {
  const createElement = isNode ? global.createMockElement : document.createElementNS.bind(document);
  const container = createMockContainer();
  const svg = container.querySelector('svg');

  const textElement = createElement('http://www.w3.org/2000/svg', 'text');
  textElement.id = 'test_text';
  textElement.setAttribute('data-cblcars-root', 'true');
  textElement.textContent = 'Test Text';
  svg.appendChild(textElement);

  const sparklineElement = createElement('http://www.w3.org/2000/svg', 'g');
  sparklineElement.id = 'test_sparkline';
  sparklineElement.setAttribute('data-cblcars-root', 'true');
  sparklineElement.setAttribute('data-cblcars-type', 'sparkline');
  svg.appendChild(sparklineElement);

  const lineElement = createElement('http://www.w3.org/2000/svg', 'path');
  lineElement.id = 'test_line';
  lineElement.setAttribute('data-cblcars-root', 'true');
  lineElement.setAttribute('data-cblcars-type', 'line');
  svg.appendChild(lineElement);

  container.getElementById = (id) => {
    return svg.querySelector(`#${id}`);
  };

  return container;
}
