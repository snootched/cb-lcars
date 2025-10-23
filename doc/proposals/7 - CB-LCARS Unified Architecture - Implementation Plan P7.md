# CB-LCARS Unified Architecture - Implementation Phase 7

**Phase 7: Documentation & Testing**

**Goal:** Comprehensive documentation, testing infrastructure, and quality assurance

**Priority:** Continuous - Essential for maintainability and user adoption

---

## Phase 7 Tasks Overview

```
Phase 7: Documentation & Testing
├─ 7.1: Testing Infrastructure & Strategy
├─ 7.2: Unit Testing Suite
├─ 7.3: Integration Testing Suite
├─ 7.4: End-to-End Testing
├─ 7.5: Performance Testing & Benchmarking
├─ 7.6: User Documentation
├─ 7.7: Developer Documentation
├─ 7.8: API Reference Documentation
├─ 7.9: Migration Guides & Examples
└─ 7.10: Continuous Integration & Quality Gates
```

---

## 7.1: Testing Infrastructure & Strategy

**Purpose:** Establish comprehensive testing framework

### Testing Architecture

```
CB-LCARS Testing Stack
├─ Unit Tests (Jest + Testing Library)
│  ├─ Core systems (RulesEngine, StyleLibrary, etc.)
│  ├─ Overlays (BaseOverlay, specific overlays)
│  ├─ Controls (SliderControl, TapControl, etc.)
│  └─ Utilities (helpers, formatters, etc.)
│
├─ Integration Tests (Jest + JSDOM)
│  ├─ Card initialization flows
│  ├─ Pipeline creation and usage
│  ├─ Data source management
│  ├─ Event bus communication
│  └─ Rules engine + overlays integration
│
├─ E2E Tests (Playwright)
│  ├─ Full dashboard scenarios
│  ├─ User interaction flows
│  ├─ Multi-card coordination
│  └─ Visual regression testing
│
├─ Performance Tests (Lighthouse + Custom)
│  ├─ Rendering performance
│  ├─ Animation FPS
│  ├─ Memory profiling
│  └─ Bundle size analysis
│
└─ Visual Tests (Percy/Chromatic)
   ├─ Component snapshots
   ├─ Theme variations
   ├─ State variations
   └─ Responsive layouts
```

### Testing Strategy Document

**File:** `docs/testing/testing-strategy.md`

````markdown
# CB-LCARS Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for CB-LCARS to ensure quality, reliability, and maintainability.

## Testing Pyramid

```
         /\
        /E2E\          <- 10% (Slow, Expensive, High Value)
       /──────\
      /Integ. \       <- 20% (Medium Speed, Medium Cost)
     /──────────\
    /   Unit     \    <- 70% (Fast, Cheap, Foundational)
   /──────────────\
```

### Unit Tests (70%)
**Goal:** Test individual functions/classes in isolation

**Scope:**
- Core systems (RulesEngine, DataSourceManager, StyleLibrary)
- Overlays (rendering logic, state management)
- Controls (interaction handling, service calls)
- Utilities (pure functions, formatters, validators)

**Tools:**
- Jest (test runner)
- @testing-library/dom (DOM testing utilities)
- jest-mock (mocking dependencies)

**Coverage Target:** 85%+

### Integration Tests (20%)
**Goal:** Test component interactions and system integration

**Scope:**
- Card initialization with core
- Pipeline creation and data flow
- Overlay + Rules engine coordination
- Event bus communication
- Data source subscription/notification

**Tools:**
- Jest + JSDOM (simulated browser)
- Mock Home Assistant instance
- Mock data sources

**Coverage Target:** 75%+

### E2E Tests (10%)
**Goal:** Test complete user flows in real browser

**Scope:**
- Dashboard loading
- User interactions (tap, drag, keyboard)
- Multi-card scenarios
- Theme switching
- Navigation flows

**Tools:**
- Playwright (browser automation)
- Percy/Chromatic (visual regression)
- Custom test harness

**Coverage Target:** Critical paths covered

## Test Organization

```
tests/
├── unit/
│   ├── core/
│   │   ├── rules-engine.test.js
│   │   ├── style-library.test.js
│   │   ├── data-source-manager.test.js
│   │   └── event-bus.test.js
│   ├── components/
│   │   ├── overlays/
│   │   │   ├── base-overlay.test.js
│   │   │   ├── line-overlay.test.js
│   │   │   ├── text-overlay.test.js
│   │   │   └── gauge-overlay.test.js
│   │   └── controls/
│   │       ├── slider-control.test.js
│   │       └── tap-control.test.js
│   └── utils/
│       ├── helpers.test.js
│       └── validators.test.js
├── integration/
│   ├── card-initialization.test.js
│   ├── pipeline-flow.test.js
│   ├── data-source-integration.test.js
│   ├── event-bus-integration.test.js
│   └── multimeter-integration.test.js
├── e2e/
│   ├── dashboard-loading.spec.js
│   ├── button-interaction.spec.js
│   ├── multimeter-interaction.spec.js
│   ├── theme-switching.spec.js
│   └── multi-card-coordination.spec.js
├── performance/
│   ├── rendering-benchmark.test.js
│   ├── animation-fps.test.js
│   └── memory-profiling.test.js
└── visual/
    ├── button-snapshots.test.js
    ├── multimeter-snapshots.test.js
    └── theme-variations.test.js
```

## Testing Principles

### 1. Test Behavior, Not Implementation
❌ **Bad:**
```javascript
test('should set _initialized to true', () => {
  card._initialized = true;
  expect(card._initialized).toBe(true);
});
```

✅ **Good:**
```javascript
test('should render button after initialization', async () => {
  await card.initialize();
  const button = card.shadowRoot.querySelector('.button');
  expect(button).toBeTruthy();
});
```

### 2. Arrange-Act-Assert Pattern
```javascript
test('example test', () => {
  // Arrange: Set up test conditions
  const card = createTestCard();
  const hass = createMockHass();
  
  // Act: Perform action being tested
  card.setHass(hass);
  
  // Assert: Verify expected outcome
  expect(card.hass).toBe(hass);
});
```

### 3. Test Edge Cases
- Empty/null inputs
- Boundary values (min/max)
- Invalid data types
- Error conditions
- Race conditions

### 4. Keep Tests Fast
- Mock external dependencies
- Use fake timers for animations
- Avoid real network calls
- Minimize DOM operations

### 5. Make Tests Readable
- Descriptive test names
- One assertion per test (when possible)
- Clear error messages
- Minimal setup code

## Mocking Strategy

### Mock Home Assistant
```javascript
// tests/mocks/hass.js
export function createMockHass() {
  return {
    states: {
      'light.test': {
        state: 'on',
        attributes: { brightness: 255 }
      }
    },
    callService: jest.fn((domain, service, data) => {
      return Promise.resolve();
    }),
    connection: {
      subscribeEvents: jest.fn()
    }
  };
}
```

### Mock Core Systems
```javascript
// tests/mocks/core.js
export function createMockCore() {
  return {
    systemsManager: {
      subscribe: jest.fn(),
      getState: jest.fn()
    },
    dataSourceManager: {
      subscribe: jest.fn(),
      getData: jest.fn()
    },
    styleLibrary: {
      getPreset: jest.fn(() => ({}))
    }
  };
}
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Quality Gates

### Minimum Requirements for PR Merge
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ Code coverage ≥ 85%
- ✅ No ESLint errors
- ✅ No TypeScript errors (if applicable)
- ✅ Visual regression approved (if UI changes)
- ✅ Performance benchmarks within threshold

## Test Data Management

### Fixtures
Store common test data in fixtures:
```javascript
// tests/fixtures/entities.js
export const mockLightEntity = {
  entity_id: 'light.test',
  state: 'on',
  attributes: {
    brightness: 255,
    color_temp: 350
  }
};
```

### Factories
Use factories for complex objects:
```javascript
// tests/factories/card-factory.js
export function createButtonCard(overrides = {}) {
  const defaultConfig = {
    type: 'cb-lcars-button-card',
    entity: 'light.test',
    label: 'Test Button'
  };
  
  return new CBLCARSButtonCard({
    ...defaultConfig,
    ...overrides
  });
}
```

## Debugging Tests

### Enable Verbose Logging
```bash
DEBUG=* npm run test:unit
```

### Run Single Test
```bash
npm run test:unit -- tests/unit/core/rules-engine.test.js
```

### Debug in VSCode
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal"
}
```

## Continuous Improvement

### Weekly Reviews
- Review flaky tests
- Update snapshots
- Refactor slow tests
- Add missing coverage

### Monthly Audits
- Review test strategy effectiveness
- Update tooling
- Optimize CI/CD pipeline
- Share best practices

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
````

**Acceptance Criteria:**
- ✅ Testing strategy documented
- ✅ Test organization structure defined
- ✅ Mocking strategy established
- ✅ CI/CD integration planned
- ✅ Quality gates defined

---

## 7.2: Unit Testing Suite

**Purpose:** Comprehensive unit tests for all core components

### Test Setup Configuration

**File:** `jest.config.js`

```javascript
/**
 * Jest Configuration for CB-LCARS
 */

export default {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Transform
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Coverage
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/msd/index.js'  // Entry point
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Test match patterns
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js'
  ],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
```

**File:** `tests/setup.js`

```javascript
/**
 * Jest Setup
 * Runs before each test file
 */

import { TextEncoder, TextDecoder } from 'util';
import { setupGlobalMocks } from './mocks/global.js';

// Polyfills for JSDOM
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Setup global mocks
setupGlobalMocks();

// Mock anime.js
jest.mock('animejs', () => ({
  default: {
    animate: jest.fn(),
    createScope: jest.fn(() => ({
      destroy: jest.fn()
    })),
    utils: {}
  }
}));

// Mock window.cblcars
global.window.cblcars = {
  core: null,
  eventBus: null,
  anim: {
    animejs: {
      animate: jest.fn(),
      createScope: jest.fn(() => ({
        destroy: jest.fn()
      }))
    }
  },
  debug: {
    setLevel: jest.fn(),
    getLevel: jest.fn()
  }
};

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      };
    }
  }
});
```

### Core System Tests

**File:** `tests/unit/core/rules-engine.test.js`

```javascript
/**
 * RulesEngine Unit Tests
 */

import { RulesEngine } from '@/core/rules-engine/index.js';
import { ConditionEvaluator } from '@/core/rules-engine/condition-evaluator.js';

describe('RulesEngine', () => {
  let rulesEngine;
  let mockStyleLibrary;
  let mockAnimationPresets;

  beforeEach(() => {
    // Mock dependencies
    mockStyleLibrary = {
      getPreset: jest.fn((name) => ({
        color: 'blue',
        opacity: 1
      }))
    };

    mockAnimationPresets = {
      getPreset: jest.fn((name) => ({
        duration: 300,
        easing: 'easeOutQuad'
      }))
    };

    // Create rules
    const rules = [
      {
        condition: { state: 'on' },
        apply: { style_preset: 'active' }
      },
      {
        condition: { state: 'off' },
        apply: { style_preset: 'inactive' }
      }
    ];

    rulesEngine = new RulesEngine(rules, mockStyleLibrary, mockAnimationPresets);
  });

  describe('constructor', () => {
    it('should initialize with rules', () => {
      expect(rulesEngine.rules).toHaveLength(2);
    });

    it('should store style library reference', () => {
      expect(rulesEngine.styleLibrary).toBe(mockStyleLibrary);
    });

    it('should create condition evaluator', () => {
      expect(rulesEngine.conditionEvaluator).toBeInstanceOf(ConditionEvaluator);
    });
  });

  describe('evaluate', () => {
    it('should match first rule when state is "on"', () => {
      const entityState = { state: 'on', attributes: {} };
      const result = rulesEngine.evaluate(entityState);

      expect(result.matched).toBe(true);
      expect(result.stylePreset).toBe('active');
    });

    it('should match second rule when state is "off"', () => {
      const entityState = { state: 'off', attributes: {} };
      const result = rulesEngine.evaluate(entityState);

      expect(result.matched).toBe(true);
      expect(result.stylePreset).toBe('inactive');
    });

    it('should return no match when no rules match', () => {
      const entityState = { state: 'unknown', attributes: {} };
      const result = rulesEngine.evaluate(entityState);

      expect(result.matched).toBe(false);
      expect(result.stylePreset).toBeNull();
    });

    it('should resolve style preset from library', () => {
      const entityState = { state: 'on', attributes: {} };
      const result = rulesEngine.evaluate(entityState);

      expect(mockStyleLibrary.getPreset).toHaveBeenCalledWith('active');
      expect(result.resolvedStyles).toEqual({ color: 'blue', opacity: 1 });
    });

    it('should cache results for same state', () => {
      const entityState = { state: 'on', attributes: {} };
      
      const result1 = rulesEngine.evaluate(entityState);
      const result2 = rulesEngine.evaluate(entityState);

      // Should return cached result
      expect(result1).toBe(result2);
    });

    it('should clear cache when state changes', () => {
      const state1 = { state: 'on', attributes: {} };
      const state2 = { state: 'off', attributes: {} };
      
      const result1 = rulesEngine.evaluate(state1);
      const result2 = rulesEngine.evaluate(state2);

      // Should not return cached result
      expect(result1).not.toBe(result2);
      expect(result1.stylePreset).toBe('active');
      expect(result2.stylePreset).toBe('inactive');
    });
  });

  describe('addRule', () => {
    it('should add rule to end of list', () => {
      const newRule = {
        condition: { state: 'unavailable' },
        apply: { style_preset: 'error' }
      };

      rulesEngine.addRule(newRule);

      expect(rulesEngine.rules).toHaveLength(3);
      expect(rulesEngine.rules[2]).toBe(newRule);
    });

    it('should add rule with priority at correct position', () => {
      const highPriorityRule = {
        condition: { state: 'unavailable' },
        apply: { style_preset: 'error' }
      };

      rulesEngine.addRule(highPriorityRule, 100);

      expect(rulesEngine.rules[0]).toBe(highPriorityRule);
    });

    it('should clear cache after adding rule', () => {
      const entityState = { state: 'on', attributes: {} };
      
      // Cache result
      rulesEngine.evaluate(entityState);
      expect(rulesEngine._lastResult).not.toBeNull();

      // Add rule
      rulesEngine.addRule({ condition: {}, apply: {} });

      // Cache should be cleared
      expect(rulesEngine._lastResult).toBeNull();
    });
  });

  describe('removeRule', () => {
    it('should remove rule by index', () => {
      rulesEngine.removeRule(0);

      expect(rulesEngine.rules).toHaveLength(1);
      expect(rulesEngine.rules[0].condition.state).toBe('off');
    });

    it('should clear cache after removing rule', () => {
      const entityState = { state: 'on', attributes: {} };
      
      // Cache result
      rulesEngine.evaluate(entityState);
      expect(rulesEngine._lastResult).not.toBeNull();

      // Remove rule
      rulesEngine.removeRule(0);

      // Cache should be cleared
      expect(rulesEngine._lastResult).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear evaluation cache', () => {
      const entityState = { state: 'on', attributes: {} };
      
      // Cache result
      rulesEngine.evaluate(entityState);
      expect(rulesEngine._lastResult).not.toBeNull();

      // Clear cache
      rulesEngine.clearCache();

      expect(rulesEngine._lastResult).toBeNull();
      expect(rulesEngine._lastStateSignature).toBeNull();
    });
  });
});
```

**File:** `tests/unit/core/condition-evaluator.test.js`

```javascript
/**
 * ConditionEvaluator Unit Tests
 */

import { ConditionEvaluator } from '@/core/rules-engine/condition-evaluator.js';

describe('ConditionEvaluator', () => {
  let evaluator;
  let mockEntity;

  beforeEach(() => {
    evaluator = new ConditionEvaluator();
    
    mockEntity = {
      entity_id: 'light.test',
      state: 'on',
      attributes: {
        brightness: 200,
        color_temp: 350
      }
    };
  });

  describe('simple state matching', () => {
    it('should match exact state', () => {
      const condition = { state: 'on' };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should match state in array', () => {
      const condition = { state: ['on', 'off'] };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should not match different state', () => {
      const condition = { state: 'off' };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });
  });

  describe('attribute evaluation', () => {
    it('should evaluate attribute value', () => {
      const condition = {
        attribute: 'brightness',
        equals: 200
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate attribute range', () => {
      const condition = {
        attribute: 'brightness',
        from: 150,
        to: 250
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should handle brightness conversion (0-255 to 0-100)', () => {
      const condition = {
        attribute: 'brightness',
        from: 75,
        to: 85
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      // 200/256 * 100 = 78.125%
      expect(result).toBe(true);
    });
  });

  describe('regex matching', () => {
    it('should match state with regex', () => {
      const condition = {
        state_regex: '^(on|open)$'
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should not match state with non-matching regex', () => {
      const condition = {
        state_regex: '^off$'
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });
  });

  describe('logical operators', () => {
    it('should evaluate AND (all must match)', () => {
      const condition = {
        and: [
          { state: 'on' },
          { attribute: 'brightness', from: 150, to: 250 }
        ]
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should fail AND if one does not match', () => {
      const condition = {
        and: [
          { state: 'on' },
          { attribute: 'brightness', from: 250, to: 300 }
        ]
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should evaluate OR (any must match)', () => {
      const condition = {
        or: [
          { state: 'off' },
          { attribute: 'brightness', from: 150, to: 250 }
        ]
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate NOT (inverse)', () => {
      const condition = {
        not: { state: 'off' }
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should handle nested logical operators', () => {
      const condition = {
        and: [
          { state: 'on' },
          {
            or: [
              { attribute: 'brightness', from: 0, to: 100 },
              { attribute: 'brightness', from: 150, to: 250 }
            ]
          }
        ]
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });
  });

  describe('comparison operators', () => {
    it('should evaluate greater_than', () => {
      const condition = {
        attribute: 'brightness',
        greater_than: 150
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate less_than', () => {
      const condition = {
        attribute: 'brightness',
        less_than: 250
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });

    it('should evaluate not_equals', () => {
      const condition = {
        state: { not_equals: 'off' }
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle null entity', () => {
      const condition = { state: 'on' };
      const context = { entity: null };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should handle missing attribute', () => {
      const condition = {
        attribute: 'nonexistent',
        equals: 100
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });

    it('should handle invalid regex', () => {
      const condition = {
        state_regex: '[invalid'  // Unclosed bracket
      };
      const context = { entity: mockEntity };

      const result = evaluator.evaluate(condition, context);

      expect(result).toBe(false);
    });
  });
});
```

### Overlay Tests

**File:** `tests/unit/components/overlays/base-overlay.test.js`

```javascript
/**
 * BaseOverlay Unit Tests
 */

import { BaseOverlay } from '@/components/overlays/base-overlay.js';

// Create concrete test class
class TestOverlay extends BaseOverlay {
  render() {
    this.element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.element.setAttribute('id', this.config.id);
  }
  
  onUpdate(data) {
    this._lastUpdate = data;
  }
}

describe('BaseOverlay', () => {
  let overlay;
  let mockPipeline;

  beforeEach(() => {
    mockPipeline = {
      systemsManager: {
        hass: {
          states: {
            'light.test': {
              state: 'on',
              attributes: { brightness: 255 }
            }
          }
        }
      },
      getEntityState: jest.fn((entityId) => ({
        state: 'on',
        attributes: { brightness: 255 }
      })),
      getDataSource: jest.fn(() => ({ temp: 72 }))
    };

    const config = {
      id: 'test_overlay',
      x: 10,
      y: 20,
      entity: 'light.test'
    };

    overlay = new TestOverlay(config, mockPipeline);
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(overlay.config.id).toBe('test_overlay');
      expect(overlay.config.x).toBe(10);
      expect(overlay.config.y).toBe(20);
    });

    it('should initialize state as "initializing"', () => {
      expect(overlay._state).toBe('initializing');
    });

    it('should throw error if id missing', () => {
      expect(() => {
        new TestOverlay({}, mockPipeline);
      }).toThrow('Overlay config must include id');
    });
  });

  describe('initialize', () => {
    it('should transition from initializing to ready', async () => {
      await overlay.initialize();

      expect(overlay._state).toBe('ready');
    });

    it('should call onInitialize hook', async () => {
      overlay.onInitialize = jest.fn().mockResolvedValue();

      await overlay.initialize();

      expect(overlay.onInitialize).toHaveBeenCalled();
    });

    it('should call render after initialization', async () => {
      overlay.render = jest.fn();

      await overlay.initialize();

      expect(overlay.render).toHaveBeenCalled();
    });

    it('should handle initialization error', async () => {
      overlay.onInitialize = jest.fn().mockRejectedValue(new Error('Init failed'));

      await overlay.initialize();

      expect(overlay._state).toBe('error');
      expect(overlay._errorMessage).toBe('Init failed');
    });
  });

  describe('_waitForEntity', () => {
    it('should resolve if entity exists', async () => {
      await expect(overlay._waitForEntity('light.test')).resolves.not.toThrow();
    });

    it('should reject if entity not found', async () => {
      await expect(overlay._waitForEntity('light.nonexistent')).rejects.toThrow("Entity 'light.nonexistent' not found");
    });

    it('should add entity to pending resources', async () => {
      const promise = overlay._waitForEntity('light.test');
      
      expect(overlay._pendingResources.has('entity:light.test')).toBe(true);
      
      await promise;
      
      expect(overlay._pendingResources.has('entity:light.test')).toBe(false);
    });
  });

  describe('_waitForDataSource', () => {
    beforeEach(() => {
      window.cblcars.core = {
        _initializedDataSources: new Set()
      };
    });

    it('should resolve immediately if data source initialized', async () => {
      window.cblcars.core._initializedDataSources.add('weather');

      await expect(overlay._waitForDataSource('weather')).resolves.not.toThrow();
    });

    it('should wait for data source initialization', async () => {
      jest.useFakeTimers();

      const promise = overlay._waitForDataSource('weather');

      // Simulate data source being initialized after 500ms
      setTimeout(() => {
        window.cblcars.core._initializedDataSources.add('weather');
      }, 500);

      jest.advanceTimersByTime(500);

      await expect(promise).resolves.not.toThrow();

      jest.useRealTimers();
    });

    it('should timeout after 10 seconds', async () => {
      jest.useFakeTimers();

      const promise = overlay._waitForDataSource('weather');

      jest.advanceTimersByTime(10000);

      await expect(promise).rejects.toThrow("Data source 'weather' not available after 10s");

      jest.useRealTimers();
    });
  });

  describe('_renderPending', () => {
    it('should create pending element', () => {
      overlay._renderPending();

      expect(overlay.element).toBeTruthy();
      expect(overlay.element.getAttribute('class')).toBe('overlay-pending');
      expect(overlay.element.getAttribute('data-state')).toBe('pending');
    });

    it('should show loading text', () => {
      overlay._renderPending();

      const text = overlay.element.querySelector('text');
      expect(text.textContent).toBe('LOADING...');
    });

    it('should start animation', () => {
      jest.useFakeTimers();
      
      overlay._renderPending();

      expect(overlay._pendingAnimation).toBeTruthy();

      jest.advanceTimersByTime(400);
      
      const text = overlay.element.querySelector('text');
      expect(text.textContent).toBe('LOADING.');

      jest.useRealTimers();
    });
  });

  describe('_renderError', () => {
    it('should create error element', () => {
      overlay._errorMessage = 'Test error';
      overlay._renderError();

      expect(overlay.element).toBeTruthy();
      expect(overlay.element.getAttribute('data-state')).toBe('error');
    });

    it('should show error message', () => {
      overlay._errorMessage = 'Test error';
      overlay._renderError();

      const text = overlay.element.querySelector('text');
      expect(text.textContent).toContain('Test error');
      expect(text.getAttribute('fill')).toBe('var(--lcars-red)');
    });

    it('should clear pending animation', () => {
      overlay._pendingAnimation = setInterval(() => {}, 100);
      
      overlay._renderError();

      expect(overlay._pendingAnimation).toBeNull();
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await overlay.initialize();
    });

    it('should call onUpdate when ready', () => {
      const data = { test: 'data' };
      
      overlay.update(data);

      expect(overlay._lastUpdate).toBe(data);
    });

    it('should not update when not ready', () => {
      overlay._state = 'pending';
      
      overlay.update({ test: 'data' });

      expect(overlay._lastUpdate).toBeUndefined();
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      expect(overlay.getState()).toBe('initializing');

      overlay._state = 'ready';
      expect(overlay.getState()).toBe('ready');
    });
  });

  describe('isReady', () => {
    it('should return true when ready', () => {
      overlay._state = 'ready';
      expect(overlay.isReady()).toBe(true);
    });

    it('should return false when not ready', () => {
      overlay._state = 'pending';
      expect(overlay.isReady()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should clear pending animation', () => {
      overlay._pendingAnimation = setInterval(() => {}, 100);
      
      overlay.destroy();

      expect(overlay._pendingAnimation).toBeNull();
    });

    it('should remove element from DOM', async () => {
      await overlay.initialize();
      
      const parent = document.createElement('div');
      parent.appendChild(overlay.element);

      overlay.destroy();

      expect(overlay.element.parentElement).toBeNull();
    });

    it('should set state to destroyed', () => {
      overlay.destroy();

      expect(overlay._state).toBe('destroyed');
    });
  });
});
```

### Control Tests

**File:** `tests/unit/components/controls/slider-control.test.js`

```javascript
/**
 * SliderControl Unit Tests
 */

import { SliderControl } from '@/components/controls/slider-control.js';

describe('SliderControl', () => {
  let slider;
  let mockPipeline;
  let mockHass;

  beforeEach(() => {
    // Create slider element
    slider = new SliderControl();

    mockHass = {
      states: {
        'light.test': {
          entity_id: 'light.test',
          state: 'on',
          attributes: {
            brightness: 200,
            min_mireds: 153,
            max_mireds: 500
          }
        }
      },
      callService: jest.fn().mockResolvedValue()
    };

    mockPipeline = {
      getEntityState: jest.fn(() => mockHass.states['light.test'])
    };

    const config = {
      id: 'test_slider',
      entity: 'light.test',
      mode: 'brightness',
      orientation: 'horizontal',
      step: 1
    };

    slider.initialize(config, mockPipeline);
    slider.setHass(mockHass);
  });

  afterEach(() => {
    slider.remove();
  });

  describe('initialization', () => {
    it('should set default values', () => {
      expect(slider._min).toBe(0);
      expect(slider._max).toBe(100);
      expect(slider._step).toBe(1);
    });

    it('should extract initial value from entity', () => {
      // brightness 200/256 * 100 = 78.125
      expect(slider._value).toBeCloseTo(78.13, 1);
    });

    it('should render horizontal layout', () => {
      const container = slider.shadowRoot.querySelector('.slider-container');
      expect(container).toBeTruthy();
    });

    it('should render vertical layout', () => {
      const config = {
        id: 'vertical_slider',
        entity: 'light.test',
        mode: 'brightness',
        orientation: 'vertical'
      };

      const verticalSlider = new SliderControl();
      verticalSlider.initialize(config, mockPipeline);

      // Check if vertical styles applied (implementation specific)
      expect(verticalSlider._orientation).toBe('vertical');

      verticalSlider.remove();
    });
  });

  describe('drag interaction', () => {
    it('should update value on drag', () => {
      const thumb = slider.shadowRoot.querySelector('.slider-thumb');
      const track = slider.shadowRoot.querySelector('.slider-track');
      
      // Simulate pointer down
      const pointerDown = new PointerEvent('pointerdown', {
        clientX: 0,
        clientY: 0,
        pointerId: 1
      });
      thumb.dispatchEvent(pointerDown);

      // Simulate pointer move
      const rect = track.getBoundingClientRect();
      const pointerMove = new PointerEvent('pointermove', {
        clientX: rect.left + rect.width / 2,  // 50% position
        clientY: rect.top
      });
      document.dispatchEvent(pointerMove);

      // Value should be around 50
      expect(slider._value).toBeCloseTo(50, 0);
    });

    it('should clamp value to min/max', () => {
      const thumb = slider.shadowRoot.querySelector('.slider-thumb');
      const track = slider.shadowRoot.querySelector('.slider-track');
      
      thumb.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));

      // Move beyond max
      const rect = track.getBoundingClientRect();
      const pointerMove = new PointerEvent('pointermove', {
        clientX: rect.right + 1000,
        clientY: rect.top
      });
      document.dispatchEvent(pointerMove);

      expect(slider._value).toBe(100);
    });

    it('should snap to step values', () => {
      slider._step = 10;
      
      const thumb = slider.shadowRoot.querySelector('.slider-thumb');
      const track = slider.shadowRoot.querySelector('.slider-track');
      
      thumb.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));

      // Move to approximately 47%
      const rect = track.getBoundingClientRect();
      const pointerMove = new PointerEvent('pointermove', {
        clientX: rect.left + rect.width * 0.47,
        clientY: rect.top
      });
      document.dispatchEvent(pointerMove);

      // Should snap to nearest multiple of 10
      expect(slider._value % 10).toBe(0);
    });
  });

  describe('track click', () => {
    it('should jump to clicked position', () => {
      const track = slider.shadowRoot.querySelector('.slider-track');
      const rect = track.getBoundingClientRect();

      // Click at 75% position
      const clickEvent = new MouseEvent('click', {
        clientX: rect.left + rect.width * 0.75,
        clientY: rect.top
      });
      track.dispatchEvent(clickEvent);

      expect(slider._value).toBeCloseTo(75, 0);
    });
  });

  describe('keyboard support', () => {
    it('should increase value on ArrowRight', () => {
      const container = slider.shadowRoot.querySelector('.slider-container');
      const initialValue = slider._value;

      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

      expect(slider._value).toBe(initialValue + slider._step);
    });

    it('should decrease value on ArrowLeft', () => {
      const container = slider.shadowRoot.querySelector('.slider-container');
      const initialValue = slider._value;

      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));

      expect(slider._value).toBe(initialValue - slider._step);
    });

    it('should set to min on Home', () => {
      const container = slider.shadowRoot.querySelector('.slider-container');

      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));

      expect(slider._value).toBe(slider._min);
    });

    it('should set to max on End', () => {
      const container = slider.shadowRoot.querySelector('.slider-container');

      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));

      expect(slider._value).toBe(slider._max);
    });
  });

  describe('Home Assistant integration', () => {
    it('should call brightness service for light', async () => {
      slider.setValue(50);
      await slider._callService();

      expect(mockHass.callService).toHaveBeenCalledWith(
        'light',
        'turn_on',
        expect.objectContaining({
          entity_id: 'light.test',
          brightness: 128  // 50% of 256
        })
      );
    });

    it('should handle temperature mode', async () => {
      const tempConfig = {
        id: 'temp_slider',
        entity: 'light.test',
        mode: 'temperature',
        min: 153,
        max: 500
      };

      const tempSlider = new SliderControl();
      tempSlider.initialize(tempConfig, mockPipeline);
      tempSlider.setHass(mockHass);

      tempSlider.setValue(350);
      await tempSlider._callService();

      expect(mockHass.callService).toHaveBeenCalledWith(
        'light',
        'turn_on',
        expect.objectContaining({
          entity_id: 'light.test',
          color_temp: 350
        })
      );

      tempSlider.remove();
    });

    it('should update from entity state changes', () => {
      // Update entity state
      mockHass.states['light.test'].attributes.brightness = 128;

      slider.setHass(mockHass);

      // Value should update to ~50%
      expect(slider._value).toBeCloseTo(50, 0);
    });
  });

  describe('visual updates', () => {
    it('should update fill width on value change', () => {
      slider.setValue(75);

      const fill = slider.shadowRoot.querySelector('.slider-fill');
      expect(fill.style.width).toBe('75%');
    });

    it('should update thumb position on value change', () => {
      slider.setValue(75);

      const thumb = slider.shadowRoot.querySelector('.slider-thumb');
      expect(thumb.style.left).toBe('75%');
    });

    it('should update ARIA attributes', () => {
      slider.setValue(75);

      const container = slider.shadowRoot.querySelector('.slider-container');
      expect(container.getAttribute('aria-valuenow')).toBe('75');
    });
  });

  describe('disabled state', () => {
    it('should not respond to interaction when disabled', () => {
      slider.setAttribute('disabled', '');
      
      const initialValue = slider._value;
      
      const thumb = slider.shadowRoot.querySelector('.slider-thumb');
      thumb.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));

      expect(slider._value).toBe(initialValue);
    });

    it('should show disabled styling', () => {
      slider.setAttribute('disabled', '');

      const container = slider.shadowRoot.querySelector('.slider-container');
      expect(container.classList.contains('disabled')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup animation scope on destroy', () => {
      slider._animScope = { destroy: jest.fn() };
      
      slider._cleanup();

      expect(slider._animScope).toBeNull();
    });
  });
});
```

**Acceptance Criteria for 7.2:**
- ✅ Jest configuration complete
- ✅ Test setup utilities created
- ✅ Core system tests written (85%+ coverage)
- ✅ Overlay tests written
- ✅ Control tests written
- ✅ Mock utilities created
- ✅ All tests passing
- ✅ Coverage thresholds met

---

Due to space constraints, I'll provide a summary structure for remaining sections:

## 7.3: Integration Testing Suite
- Card initialization flows
- Pipeline + core integration
- Data source subscription/notification
- Event bus coordination
- Multi-overlay scenarios
- Rules + overlays integration

## 7.4: End-to-End Testing
- Playwright setup
- Dashboard loading tests
- User interaction flows
- Theme switching scenarios
- Multi-card coordination
- Visual regression tests

## 7.5: Performance Testing & Benchmarking
- Rendering performance
- Animation FPS monitoring
- Memory profiling
- Bundle size analysis
- Load time metrics
- Interaction latency

## 7.6: User Documentation
- Getting started guide
- Card configuration guides
- Core card usage
- Migration guides
- Troubleshooting
- FAQ

## 7.7: Developer Documentation
- Architecture overview
- Contributing guide
- Development setup
- Code style guide
- Testing guide
- Release process

## 7.8: API Reference Documentation
- Core systems API
- Overlay API
- Control API
- Rules engine API
- Event bus API
- Utilities API

## 7.9: Migration Guides & Examples
- Legacy to modern migration
- Button card migration
- Multimeter migration
- MSD integration
- Best practices
- Common patterns

## 7.10: Continuous Integration & Quality Gates
- GitHub Actions workflows
- Automated testing
- Code coverage reporting
- Performance monitoring
- Release automation
- Documentation deployment

---

## Phase 7 Completion Criteria

### Testing Requirements
- ✅ Unit test coverage ≥ 85%
- ✅ Integration test coverage ≥ 75%
- ✅ E2E tests for critical paths
- ✅ Performance benchmarks established
- ✅ Visual regression tests configured
- ✅ CI/CD pipeline operational

### Documentation Requirements
- ✅ User guides complete
- ✅ Developer guides complete
- ✅ API documentation complete
- ✅ Migration guides complete
- ✅ Examples repository created
- ✅ Video tutorials (optional)

### Quality Requirements
- ✅ All tests passing
- ✅ No critical bugs
- ✅ Code review process established
- ✅ Performance targets met
- ✅ Accessibility standards met
- ✅ Browser compatibility verified

### Process Requirements
- ✅ CI/CD automated
- ✅ Release process documented
- ✅ Version strategy defined
- ✅ Changelog automated
- ✅ Issue templates created
- ✅ PR templates created

---

**End of Phase 7 - Implementation Plan Complete**

This completes the comprehensive 7-phase implementation plan for CB-LCARS Unified Architecture. All phases are designed to be executed sequentially with clear acceptance criteria and deliverables.