# MSD Refactor Implementation Roadmap
**Aggressive Timeline: 6-8 Weeks to Production Ready**

---

## Executive Summary

Based on the current state analysis, we'll complete the refactor in **4 phases over 6-8 weeks** with aggressive timelines and breaking changes allowed for optimal foundation. Each milestone has clear deliverables, automated tests, and rollback safety.

**Project Start Date**: August 23, 2025
**Target Completion**: October 4-18, 2025
**Project Owner**: snootched

---

## Phase 1: Wave 1 Stabilization & Foundation (Days 1-14)
**Goal: Establish rock-solid deterministic baseline**

### Milestone 1.1: Critical Infrastructure (Days 1-4)
**Target Dates: Aug 23-26, 2025**
**Deliverable: Unified, deterministic merge engine**

#### Tasks:
1. **Remove dual merge logic completely**
   ```javascript
   // DELETE these legacy functions from mergePacks.js:
   // - layerKeyed()
   // - markProvenance() (first version)
   // - Any prototype merge helpers

   // CONSOLIDATE to single algorithm:
   async function mergePacks(userConfig) {
     const layers = await loadAllLayers(userConfig);
     return processSinglePass(layers);
   }
   ```

2. **Implement canonical checksum pipeline**
   ```javascript
   // src/msd/utils/checksum.js
   export function computeCanonicalChecksum(obj) {
     const cleaned = stripMetaFields(obj);
     const stable = stableStringify(cleaned);
     return sha256(stable).substring(0, 10);
   }

   function stripMetaFields(obj) {
     // Remove: __provenance, __raw_msd, checksum, origin_pack, etc.
     // Keep only semantic configuration
   }

   function stableStringify(obj) {
     // Deterministic JSON with sorted keys
     // Handle arrays, nested objects consistently
   }
   ```

3. **Fix validation pipeline integration**
   ```javascript
   // src/msd/index.js - Fix wrapper destructuring
   const { merged: mergedConfig, provenance } = await mergePacks(userMsdConfig);
   mergedConfig.__provenance = provenance;
   const issues = validateMerged(mergedConfig); // Pass clean merged config
   ```

#### Automated Tests:
- **`scripts/test-determinism.js`** - Core merge determinism
  ```javascript
  // Merge same config 5 times, assert identical checksums
  const results = await Promise.all([...Array(5)].map(() => mergePacks(testConfig)));
  assert(results.every(r => r.checksum === results[0].checksum));
  ```

- **`scripts/test-legacy-removal.js`** - Ensure no legacy function calls remain
- **`scripts/test-validation-integration.js`** - Known bad configs produce expected errors

#### Success Criteria:
- [ ] Zero legacy merge functions in codebase
- [ ] Determinism test passes 100 consecutive runs
- [ ] Validation catches duplicate IDs and missing anchors
- [ ] No runtime TypeErrors on mergePacks()

---

### Milestone 1.2: Deep Merge & Provenance (Days 5-8)
**Target Dates: Aug 27-30, 2025**
**Deliverable: Token-level palette merge + comprehensive provenance**

#### Tasks:
1. **Implement deep palette merge**
   ```javascript
   function deepMergePalettes(basePalettes, newPalettes, originInfo) {
     for (const [paletteName, tokens] of Object.entries(newPalettes)) {
       if (!basePalettes[paletteName]) {
         basePalettes[paletteName] = {};
       }

       for (const [tokenName, value] of Object.entries(tokens)) {
         // Token-level override with provenance
         if (basePalettes[paletteName][tokenName] !== undefined) {
           // Mark as overridden
           provenance.palettes[paletteName] = provenance.palettes[paletteName] || {};
           provenance.palettes[paletteName][tokenName] = {
             origin_pack: originInfo.pack,
             overridden: true,
             override_layer: originInfo.layer,
             original_value: basePalettes[paletteName][tokenName]
           };
         }
         basePalettes[paletteName][tokenName] = value;
       }
     }
   }
   ```

2. **Enhanced anchor provenance**
   ```javascript
   function processAnchors(anchors, originInfo) {
     Object.keys(anchors).forEach(anchorId => {
       provenance.anchors[anchorId] = {
         origin_pack: originInfo.pack,
         origin_type: detectAnchorSource(anchors[anchorId]), // 'svg'|'user'|'pack'
         coordinates: anchors[anchorId],
         overridden: false
       };
     });
   }
   ```

3. **External pack integration with timeout**
   ```javascript
   async function loadExternalPacks(urls, timeout = 5000) {
     const promises = urls.map(url =>
       Promise.race([
         fetch(url).then(r => r.json()),
         new Promise((_, reject) =>
           setTimeout(() => reject(new Error(`Timeout: ${url}`)), timeout)
         )
       ]).catch(err => ({ error: err.message, url }))
     );

     const results = await Promise.allSettled(promises);
     return results.map((result, i) => ({
       url: urls[i],
       data: result.status === 'fulfilled' ? result.value : null,
       error: result.status === 'rejected' ? result.reason : result.value?.error
     }));
   }
   ```

#### Automated Tests:
- **`scripts/test-palette-merge.js`** - Palette deep merge testing
  ```javascript
  // Test that individual tokens are preserved/overridden correctly
  const base = { theme: { primary: '#blue', secondary: '#green' } };
  const override = { theme: { primary: '#red' } };
  const result = deepMergePalettes(base, override);
  assert(result.theme.primary === '#red');
  assert(result.theme.secondary === '#green'); // Preserved
  ```

- **`scripts/test-external-packs.js`** - Mock external pack loading with success/failure scenarios
- **`scripts/test-anchor-provenance.js`** - Verify anchor origins tracked correctly

#### Success Criteria:
- [ ] Palette tokens preserved across merges (no overwrite of entire palette)
- [ ] Anchor provenance shows origin (svg/user/pack) correctly
- [ ] External packs load with timeout handling
- [ ] Provenance data structure complete and accurate

---

### Milestone 1.3: Performance & Export Foundation (Days 9-14)
**Target Dates: Aug 31-Sep 5, 2025**
**Deliverable: Performance instrumentation + export baseline**

#### Tasks:
1. **Enhanced performance counters**
   ```javascript
   // src/msd/utils/performance.js
   class PerformanceTracker {
     constructor() {
       this.counters = new Map();
     }

     addTiming(key, ms) {
       if (!this.counters.has(key)) {
         this.counters.set(key, { last: 0, totalMs: 0, samples: 0, avg: 0 });
       }
       const counter = this.counters.get(key);
       counter.last = ms;
       counter.totalMs += ms;
       counter.samples++;
       counter.avg = counter.totalMs / counter.samples;
     }

     addCount(key, increment = 1) {
       // For discrete counters like rules.match.count
     }
   }
   ```

2. **Export collapsed with parity testing**
   ```javascript
   export function exportCollapsed(mergedConfig) {
     // Extract only user layer (no provenance, no pack items)
     const userOnly = extractUserLayer(mergedConfig);
     const canonical = canonicalizeYaml(userOnly);
     return canonical;
   }

   function canonicalizeYaml(obj) {
     // Stable key ordering for deterministic output
     // Strip meta fields completely
     // Handle arrays consistently
   }
   ```

3. **Validation expansion**
   ```javascript
   function validateMerged(config) {
     const issues = { errors: [], warnings: [] };

     // Anchor reference validation
     const anchors = new Set(Object.keys(config.anchors || {}));
     config.overlays?.forEach(overlay => {
       ['anchor', 'attach_to', 'attachTo'].forEach(field => {
         if (overlay[field] && !anchors.has(overlay[field])) {
           issues.errors.push({
             code: 'anchor.missing',
             overlay: overlay.id,
             anchor: overlay[field],
             message: `Overlay ${overlay.id} references missing anchor '${overlay[field]}'`
           });
         }
       });
     });

     // Duplicate ID detection
     ['overlays', 'rules', 'animations'].forEach(collection => {
       const ids = new Set();
       config[collection]?.forEach(item => {
         if (ids.has(item.id)) {
           issues.errors.push({
             code: 'duplicate.id',
             collection,
             id: item.id,
             message: `Duplicate ${collection} ID: ${item.id}`
           });
         }
         ids.add(item.id);
       });
     });

     return issues;
   }
   ```

#### Automated Tests:
- **`scripts/test-performance.js`** - Verify counters increment and averages calculate correctly
- **`scripts/test-export-parity.js`** - Export parity testing
  ```javascript
  // Export collapsed → re-import → should produce same final result
  const original = await mergePacks(testConfig);
  const collapsed = exportCollapsed(original);
  const reimported = await mergePacks(yamlParse(collapsed));

  // Core checksums should match (excluding meta)
  assert(stripMeta(original).checksum === stripMeta(reimported).checksum);
  ```

- **`scripts/test-validation-comprehensive.js`** - All error codes trigger correctly

#### Success Criteria:
- [ ] Performance counters show realistic merge times (<50ms for medium configs)
- [ ] Export → re-import produces identical semantic results
- [ ] All validation error codes tested and working
- [ ] Memory usage stable (no leaks in repeated merges)

---

## Phase 2: Rules Engine & Dependencies (Days 15-28)
**Target Dates: Sep 6-19, 2025**
**Goal: Intelligent rule evaluation with performance optimization**

### Milestone 2.1: Dependency Index & Dirty Evaluation (Days 15-21)
**Target Dates: Sep 6-12, 2025**
**Deliverable: Rules engine only processes changed entities**

#### Tasks:
1. **Dependency index construction**
   ```javascript
   class RulesEngine {
     buildDependencyIndex(rules) {
       const entityToRules = new Map();
       const ruleToEntities = new Map();

       rules.forEach(rule => {
         const entities = this.extractEntityReferences(rule);
         ruleToEntities.set(rule.id, entities);

         entities.forEach(entity => {
           if (!entityToRules.has(entity)) {
             entityToRules.set(entity, new Set());
           }
           entityToRules.get(entity).add(rule.id);
         });
       });

       return { entityToRules, ruleToEntities };
     }

     extractEntityReferences(rule) {
       const entities = new Set();

       // Parse rule.when conditions
       const conditions = [
         ...(rule.when?.all || []),
         ...(rule.when?.any || [])
       ];

       conditions.forEach(condition => {
         if (condition.entity) entities.add(condition.entity);
         if (condition.entity_attr) entities.add(condition.entity_attr.split('.')[0]);
       });

       return Array.from(entities);
     }
   }
   ```

2. **Dirty evaluation cycle**
   ```javascript
   evaluateDirty(changedEntities, getEntityFn) {
     const affectedRules = new Set();

     changedEntities.forEach(entityId => {
       const rules = this.dependencyIndex.entityToRules.get(entityId) || new Set();
       rules.forEach(ruleId => affectedRules.add(ruleId));
     });

     // Performance tracking
     this.perfTracker.addCount('rules.eval.count', affectedRules.size);

     const results = [];
     affectedRules.forEach(ruleId => {
       const rule = this.rulesById.get(ruleId);
       const result = this.evaluateRule(rule, getEntityFn);
       if (result.matched) {
         results.push(result);
         this.perfTracker.addCount('rules.match.count', 1);
       }
     });

     return this.aggregateResults(results);
   }
   ```

#### Automated Tests:
- **`scripts/test-rule-dependencies.js`** - Dependency index testing
  ```javascript
  const rules = [
    { id: 'r1', when: { all: [{ entity: 'sensor.temp' }] } },
    { id: 'r2', when: { any: [{ entity: 'light.living' }, { entity: 'sensor.temp' }] } }
  ];

  const engine = new RulesEngine(rules);
  const deps = engine.dependencyIndex;

  assert(deps.entityToRules.get('sensor.temp').has('r1'));
  assert(deps.entityToRules.get('sensor.temp').has('r2'));
  assert(deps.entityToRules.get('light.living').has('r2'));
  ```

- **`scripts/test-dirty-evaluation.js`** - Only affected rules process when entities change

#### Success Criteria:
- [ ] Dependency index correctly maps all entity references
- [ ] Only rules with changed dependencies evaluate
- [ ] Performance counters increment accurately
- [ ] No performance regression vs full evaluation on small rule sets

---

### Milestone 2.2: Rule Tracing & Advanced Features (Days 22-28)
**Target Dates: Sep 13-19, 2025**
**Deliverable: Rule debugging and stop semantics**

#### Tasks:
1. **Rule trace ring buffer**
   ```javascript
   class RuleTraceBuffer {
     constructor(maxSize = 1000) {
       this.buffer = [];
       this.maxSize = maxSize;
       this.index = 0;
     }

     addTrace(ruleId, matched, conditions, timestamp = Date.now()) {
       const trace = { ruleId, matched, conditions, timestamp };

       if (this.buffer.length < this.maxSize) {
         this.buffer.push(trace);
       } else {
         this.buffer[this.index] = trace;
         this.index = (this.index + 1) % this.maxSize;
       }
     }

     getRecentTraces(limit = 50) {
       // Return most recent traces
       const recent = [];
       let idx = this.index - 1;

       for (let i = 0; i < Math.min(limit, this.buffer.length); i++) {
         if (idx < 0) idx = this.buffer.length - 1;
         recent.unshift(this.buffer[idx]);
         idx--;
       }

       return recent;
     }
   }
   ```

2. **Stop semantics for overlay-scoped rules**
   ```javascript
   processOverlayRules(overlays, ruleResults) {
     overlays.forEach(overlay => {
       let shouldStop = false;

       ruleResults
         .filter(r => r.targetOverlay === overlay.id)
         .sort((a, b) => (a.priority || 0) - (b.priority || 0))
         .forEach(result => {
           if (shouldStop) return;

           this.applyRuleResult(overlay, result);

           if (result.stopAfter) {
             shouldStop = true;
           }
         });
     });
   }
   ```

#### Automated Tests:
- **`scripts/test-rule-trace.js`** - Verify traces captured and retrievable
- **`scripts/test-stop-semantics.js`** - Rules after stop don't execute
- **`scripts/test-hud-integration.js`** - Rule data accessible via debug interface

#### Success Criteria:
- [ ] Rule traces available in HUD with timing and match info
- [ ] Stop semantics prevent further rule processing per overlay
- [ ] Debug interface shows rule dependency graph
- [ ] Performance impact minimal (<10% overhead for tracing)

---

## Phase 3: Animation & Profile Systems (Days 29-42)
**Target Dates: Sep 20-Oct 3, 2025**
**Goal: Efficient animation reuse and consolidated styling**

### Milestone 3.1: Animation Registry & Reuse (Days 29-35)
**Target Dates: Sep 20-26, 2025**
**Deliverable: Animation instance caching and reuse optimization**

#### Tasks:
1. **Animation instance hashing**
   ```javascript
   class AnimationRegistry {
     computeInstanceHash(definition) {
       // Hash semantic properties only (exclude DOM references)
       const semantic = {
         preset: definition.preset,
         params: this.normalizeParams(definition.params),
         duration: definition.duration,
         easing: definition.easing,
         // Exclude: targets (DOM nodes), runtime callbacks
       };

       return this.hashObject(semantic);
     }

     normalizeParams(params) {
       // Normalize numeric precision to avoid hash churn
       const normalized = {};
       Object.entries(params || {}).forEach(([key, value]) => {
         if (typeof value === 'number') {
           normalized[key] = Math.round(value * 1000) / 1000; // 3 decimal precision
         } else {
           normalized[key] = value;
         }
       });
       return normalized;
     }
   }
   ```

2. **Instance reuse with performance tracking**
   ```javascript
   getOrCreateInstance(definition, targets) {
     const hash = this.computeInstanceHash(definition);

     if (this.cache.has(hash)) {
       const instance = this.cache.get(hash);

       // Verify targets compatibility
       if (this.targetsCompatible(instance.targets, targets)) {
         this.perfTracker.addCount('animation.instance.reuse', 1);
         return instance;
       }
     }

     // Create new instance
     const instance = window.cblcars.anim.create(definition, targets);
     this.cache.set(hash, instance);
     this.perfTracker.addCount('animation.instance.new', 1);

     return instance;
   }
   ```

3. **Timeline diffing for structural changes**
   ```javascript
   diffTimelines(current, desired) {
     const changes = {
       added: [],
       removed: [],
       modified: [],
       unchanged: []
     };

     const currentIds = new Set(current.map(t => t.id));
     const desiredIds = new Set(desired.map(t => t.id));

     // Detect structural changes
     desired.forEach(timeline => {
       if (!currentIds.has(timeline.id)) {
         changes.added.push(timeline);
       } else {
         const existing = current.find(t => t.id === timeline.id);
         if (this.timelineChanged(existing, timeline)) {
           changes.modified.push({ existing, desired: timeline });
         } else {
           changes.unchanged.push(timeline);
         }
       }
     });

     return changes;
   }
   ```

#### Automated Tests:
- **`scripts/test-animation-hash.js`** - Same definition produces same hash
- **`scripts/test-animation-reuse.js`** - Compatible animations reuse instances
- **`scripts/test-animation-performance.js`** - Reuse rate >60% in typical scenarios

#### Success Criteria:
- [ ] Animation reuse rate >60% in complex scenarios
- [ ] No visual jitter from inappropriate reuse
- [ ] Timeline diff detects structural vs parameter changes
- [ ] Memory usage stable with animation caching

---

### Milestone 3.2: Profile System Consolidation (Days 36-42)
**Target Dates: Sep 27-Oct 3, 2025**
**Deliverable: Centralized profile and value_map resolution**

#### Tasks:
1. **Centralized value_map resolver**
   ```javascript
   class ValueMapResolver {
     resolveValueMaps(overlays, entityResolver) {
       overlays.forEach(overlay => {
         this.processOverlayValueMaps(overlay, entityResolver);
       });
     }

     processOverlayValueMaps(overlay, entityResolver) {
       Object.entries(overlay.style || {}).forEach(([prop, value]) => {
         if (this.hasValueMap(value)) {
           const resolved = this.resolveValueMap(value, entityResolver);
           overlay.style[prop] = resolved;
         }
       });
     }

     resolveValueMap(valueMapDef, entityResolver) {
       const entity = entityResolver(valueMapDef.entity);
       if (!entity) return valueMapDef.default;

       const inputValue = this.extractValue(entity, valueMapDef.attribute);
       return this.mapValue(inputValue, valueMapDef.map_range);
     }
   }
   ```

2. **Profile layering with active_profiles precedence**
   ```javascript
   function assembleOverlayStyle(overlay, activeProfiles, profileIndex) {
     const styles = [];

     // Base style from overlay definition
     if (overlay.style) {
       styles.push({ style: overlay.style, source: 'base' });
     }

     // Active profiles in order
     activeProfiles.forEach(profileId => {
       const profile = profileIndex.get(profileId);
       if (profile?.overlays?.[overlay.id]) {
         styles.push({
           style: profile.overlays[overlay.id],
           source: `profile:${profileId}`
         });
       }
     });

     // Merge with precedence tracking
     return this.mergeStyles(styles);
   }
   ```

#### Automated Tests:
- **`scripts/test-value-map-resolution.js`** - Entity values correctly mapped to CSS properties
- **`scripts/test-profile-precedence.js`** - Later profiles override earlier ones
- **`scripts/test-style-performance.js`** - Style resolution <5ms for 50 overlays

#### Success Criteria:
- [ ] Value maps resolve consistently with entity state
- [ ] Profile changes reflect immediately in UI
- [ ] No style calculation regressions
- [ ] Memory efficient style caching

---

## Phase 4: Renderer & Export Completion (Days 43-56)
**Target Dates: Oct 4-17, 2025**
**Goal: Complete pipeline with advanced features**

### Milestone 4.1: Advanced Rendering & Routing (Days 43-49)
**Target Dates: Oct 4-10, 2025**
**Deliverable: Optimized rendering with intelligent caching**

#### Tasks:
1. **Renderer consuming ResolvedModel**
   ```javascript
   class RendererV1 {
     render(resolvedModel) {
       // Diff against previous model for minimal updates
       const diff = this.diffResolvedModels(this.lastModel, resolvedModel);

       this.updateViewBox(diff.viewBox);
       this.updateOverlays(diff.overlays);
       this.updateAnimations(diff.animations);
       this.updateRouting(diff.routing);

       this.lastModel = resolvedModel;
     }

     updateOverlays(overlayDiff) {
       overlayDiff.modified.forEach(overlay => {
         const element = this.overlayElements.get(overlay.id);
         this.applyStyleChanges(element, overlay.styleChanges);
       });

       overlayDiff.added.forEach(overlay => {
         this.createOverlayElement(overlay);
       });

       overlayDiff.removed.forEach(overlayId => {
         this.removeOverlayElement(overlayId);
       });
     }
   }
   ```

2. **Routing cache with intelligent invalidation**
   ```javascript
   class RouterCore {
     constructor() {
       this.cache = new Map();
       this.cacheVersion = 0;
     }

     invalidate(reason) {
       if (reason === 'anchors' || reason === '*') {
         this.cache.clear();
         this.cacheVersion++;
         this.perfTracker.addCount('routing.invalidate.events', 1);
       }
     }

     computePath(request) {
       const cacheKey = this.buildCacheKey(request);

       if (this.cache.has(cacheKey)) {
         this.perfTracker.addCount('routing.cache.hit', 1);
         return this.cache.get(cacheKey);
       }

       const path = this.computePathInternal(request);
       this.cache.set(cacheKey, path);
       this.perfTracker.addCount('routing.cache.miss', 1);

       return path;
     }
   }
   ```

#### Automated Tests:
- **`scripts/test-renderer-diff.js`** - Only modified overlays update
- **`scripts/test-routing-cache.js`** - Cache hits when anchors unchanged
- **`scripts/test-render-performance.js`** - Render time <16ms for 100 overlays (60fps)

#### Success Criteria:
- [ ] Only modified elements update during renders
- [ ] Routing cache improves performance measurably
- [ ] 60fps maintained with 100+ overlays
- [ ] Memory usage stable during continuous rendering

---

### Milestone 4.2: Export & HUD Completion (Days 50-56)
**Target Dates: Oct 11-17, 2025**
**Deliverable: Full export capabilities and comprehensive HUD**

#### Tasks:
1. **Export full snapshot with metadata**
   ```javascript
   export function exportFullSnapshot(resolvedModel, options = {}) {
     const snapshot = {
       timestamp: new Date().toISOString(),
       version: '1.0',
       config: options.includeMeta ? resolvedModel : stripMetadata(resolvedModel),
       provenance: options.includeProvenance ? resolvedModel.__provenance : undefined,
       performance: options.includePerf ? getPerformanceSnapshot() : undefined
     };

     return canonicalizeSnapshot(snapshot);
   }
   ```

2. **Comprehensive HUD panels**
   ```javascript
   class HudController {
     createOverlaysPanel() {
       const overlays = this.pipeline.getResolvedModel()?.overlays || [];

       return overlays.map(overlay => ({
         id: overlay.id,
         type: overlay.type,
         style: this.summarizeStyle(overlay.style),
         animation: overlay.animation_hash,
         provenance: this.getProvenanceBadges(overlay)
       }));
     }

     getProvenanceBadges(item) {
       const badges = [];
       const prov = item.__provenance;

       if (prov?.origin_pack) badges.push(prov.origin_pack);
       if (prov?.overridden) badges.push('overridden');
       if (prov?.removed) badges.push('removed');

       return badges;
     }
   }
   ```

#### Automated Tests:
- **`scripts/test-export-full.js`** - All metadata correctly included/excluded
- **`scripts/test-hud-panels.js`** - All panels render with live data
- **`scripts/test-diff-tool.js`** - Changes correctly identified and displayed

#### Success Criteria:
- [ ] Full export includes all requested metadata
- [ ] HUD shows real-time pipeline state
- [ ] Diff tool helps identify configuration issues
- [ ] Export/import maintains complete fidelity

---

## Breaking Changes & YAML Schema Improvements

### Recommended Breaking Changes for Better Foundation:

1. **Standardize field naming**
   ```yaml
   # OLD (inconsistent)
   overlay:
     attach_to: anchor1
     attachTo: anchor2  # Remove this variant

   # NEW (consistent)
   overlay:
     attach_to: anchor1
   ```

2. **Simplify animation definitions**
   ```yaml
   # OLD
   animations:
     - id: fade
       preset: fade
       params:
         duration: 1000
         easing: ease

   # NEW (more concise)
   animations:
     - id: fade
       preset: fade
       duration: 1000
       easing: ease
   ```

3. **Unified rule conditions**
   ```yaml
   # OLD
   rules:
     - when:
         all: [...]
         any: [...]

   # NEW (clearer precedence)
   rules:
     - when:
         operator: and  # or 'or'
         conditions: [...]
   ```

### Automated Migration Tool
Create `scripts/migrate-config.js` to automatically update existing YAML files to new schema.

---

## Automated Testing Strategy

### Continuous Integration Tests (`scripts/` directory):

1. **`test-determinism.js`** - Core merge determinism
2. **`test-performance.js`** - Performance regression detection
3. **`test-validation.js`** - Configuration error detection
4. **`test-export-parity.js`** - Export/import consistency
5. **`test-animation-reuse.js`** - Animation efficiency
6. **`test-rules-engine.js`** - Rule evaluation correctness
7. **`test-memory-leaks.js`** - Memory stability
8. **`test-scenarios.js`** - Complex integration scenarios

### Test Execution Framework:
```javascript
// scripts/test-runner.js
async function runAllTests() {
  const tests = [
    'determinism',
    'performance',
    'validation',
    'export-parity',
    'animation-reuse',
    'rules-engine',
    'memory-leaks',
    'scenarios'
  ];

  for (const test of tests) {
    console.log(`Running ${test}...`);
    const result = await require(`./test-${test}.js`).run();
    if (!result.passed) {
      console.error(`❌ ${test} failed:`, result.error);
      process.exit(1);
    }
    console.log(`✅ ${test} passed`);
  }
}
```

---

## Success Metrics & KPIs

### Performance Targets:
- **Merge Time**: <50ms for typical config, <100ms for large config
- **Render Time**: <16ms for 100 overlays (60fps target)
- **Animation Reuse**: >60% in typical scenarios
- **Memory Usage**: Stable over 1000 merge cycles
- **Cache Hit Rate**: >70% for routing after warmup

### Quality Gates:
- **Zero Runtime Errors**: In production scenarios
- **100% Determinism**: Same input = same output always
- **Backwards Compatibility**: Existing configs work (with migration)
- **Test Coverage**: >90% for core merge/rules/animation logic
- **Documentation**: Complete API docs and migration guide

---

## Risk Mitigation

### Technical Risks:
1. **Performance Regression**: Continuous benchmarking in CI
2. **Memory Leaks**: Automated leak detection tests
3. **Animation Jitter**: Visual regression testing
4. **Configuration Breaking**: Migration tool + compatibility tests

### Timeline Risks:
1. **Complexity Underestimation**: Buffer time in each milestone
2. **Integration Issues**: Daily smoke tests across milestones
3. **Testing Overhead**: Parallel test development with features

### Rollback Strategy:
Each milestone has feature flags for immediate rollback if issues discovered in production.

---

## Daily Progress Tracking

### Week 1 (Aug 23-29, 2025)
- [ ] **Day 1-2**: Remove legacy merge logic, implement canonical checksum
- [ ] **Day 3-4**: Fix validation pipeline, create determinism tests
- [ ] **Day 5-6**: Deep palette merge implementation
- [ ] **Day 7**: External pack integration with timeout handling

### Week 2 (Aug 30-Sep 5, 2025)
- [ ] **Day 8**: Enhanced anchor provenance
- [ ] **Day 9-10**: Performance counters and tracking
- [ ] **Day 11-12**: Export collapsed with parity testing
- [ ] **Day 13-14**: Validation expansion and comprehensive testing

### Week 3 (Sep 6-12, 2025)
- [ ] **Day 15-16**: Rules engine dependency index construction
- [ ] **Day 17-18**: Dirty evaluation cycle implementation
- [ ] **Day 19-20**: Performance tracking for rules engine
- [ ] **Day 21**: Integration testing and optimization

### Week 4 (Sep 13-19, 2025)
- [ ] **Day 22-23**: Rule trace ring buffer
- [ ] **Day 24-25**: Stop semantics implementation
- [ ] **Day 26-27**: HUD integration for rules debugging
- [ ] **Day 28**: Rules engine comprehensive testing

### Week 5 (Sep 20-26, 2025)
- [ ] **Day 29-30**: Animation instance hashing
- [ ] **Day 31-32**: Animation reuse and caching
- [ ] **Day 33-34**: Timeline diffing implementation
- [ ] **Day 35**: Animation system testing and optimization

### Week 6 (Sep 27-Oct 3, 2025)
- [ ] **Day 36-37**: Centralized value_map resolver
- [ ] **Day 38-39**: Profile layering system
- [ ] **Day 40-41**: Style resolution optimization
- [ ] **Day 42**: Profile system testing

### Week 7 (Oct 4-10, 2025)
- [ ] **Day 43-44**: Advanced renderer implementation
- [ ] **Day 45-46**: Routing cache optimization
- [ ] **Day 47-48**: Performance optimization and testing
- [ ] **Day 49**: Rendering system integration

### Week 8 (Oct 11-17, 2025)
- [ ] **Day 50-51**: Export full snapshot implementation
- [ ] **Day 52-53**: HUD panel completion
- [ ] **Day 54-55**: Final integration testing
- [ ] **Day 56**: Documentation and release preparation

---

This comprehensive roadmap provides clear milestones, deliverables, automated testing, and success criteria for completing the MSD refactor within an aggressive 6-8 week timeline while maintaining system stability and enabling future growth.