# MSD Template Engine Auto-DataSource Implementation Plan

## Executive Summary

Implement automatic DataSource creation for template-referenced entities in MSD overlays to enable real-time template updates without requiring users to manually define DataSources. This approach leverages the existing DataSource subscription infrastructure for architectural consistency and performance.

## Architecture Decision

**Selected Approach**: Auto-DataSource Creation via DataSource Subscription System
- **Rationale**: Leverages proven DataSource infrastructure, maintains clean separation of concerns, requires zero user configuration
- **Rejected Alternative**: Rules Engine extension (would pollute Rules Engine's focused purpose)

## Implementation Requirements

### 1. Create Template Entity Extractor Utility

**File**: `src/msd/templates/TemplateEntityExtractor.js`

**Requirements**:
- Extract entity references from both MSD `{entity_id}` and HA `{{states('entity_id')}}` template formats
- Support template content in overlay properties: `content`, `text`, `value_format`, `label`
- Support status grid cell-level template extraction
- Filter out DataSource references (contain `.transformations.` or `.aggregations.`)
- Validate entity ID format (domain.entity_name pattern)
- Skip JavaScript keywords and invalid references

**Key Methods**:
```javascript
static extractEntityReferences(content: string): Set<string>
static extractFromOverlay(overlay: Object): Set<string>
static _extractEntitiesFromExpression(expression: string): Set<string>
static _extractEntitiesFromHATemplate(template: string): Set<string>
static _isDataSourceReference(expression: string): boolean
static _looksLikeEntityId(str: string): boolean
```

**Template Format Support**:
- MSD templates: `{sensor.temperature}`, `{binary_sensor.door.state}`
- HA templates: `{{states('sensor.temperature')}}`, `{{state_attr('sensor.temp', 'unit')}}`
- Conditional templates: `{{is_state('binary_sensor.door', 'open')}}`

### 2. Enhance SystemsManager for Auto-DataSource Creation

**File**: `src/msd/pipeline/SystemsManager.js`

**Modifications Required**:

#### 2.1 Update `_initializeDataSources` method:
- Import `TemplateEntityExtractor`
- Call `_createTemplateDataSources(mergedConfig)` before DataSourceManager initialization
- Merge auto-created DataSources with configured ones
- Log auto-creation activity

#### 2.2 Add new method `_createTemplateDataSources`:
```javascript
async _createTemplateDataSources(mergedConfig) {
  // Extract all template entity references from overlays
  // Skip entities that already have configured DataSources
  // Create lightweight DataSource configs for template entities
  // Return merged DataSource configuration object
}
```

**Auto-Created DataSource Configuration**:
```javascript
{
  entity: 'sensor.temperature',
  windowSeconds: 60,        // Small buffer for template updates
  minEmitMs: 100,          // Responsive updates
  coalesceMs: 50,          // Quick coalescing
  history: { enabled: false }, // No history needed for templates
  _autoCreated: true,      // Mark as auto-created
  _templateEntity: true    // Mark as template entity
}
```

**Naming Convention**: `template_${entityId.replace(/\./g, '_')}`

### 3. Enhanced BaseOverlayUpdater Integration

**File**: `src/msd/renderer/BaseOverlayUpdater.js`

**Modifications Required**:

#### 3.1 Update `updateOverlaysForDataSourceChanges` method:
- Add support for template entity changes
- Enhanced logging for template vs DataSource changes
- Use TemplateEntityExtractor for entity reference detection

#### 3.2 Update `_overlayReferencesChangedEntities` method:
- Use TemplateEntityExtractor instead of manual regex parsing
- Support both direct entity references and DataSource references
- Return Promise-based detection for async import

#### 3.3 Enhanced overlay updater registration:
- Ensure all overlay types (text, status_grid) have template detection
- Add `hasTemplates` method for each overlay type
- Optimize template detection performance

### 4. Integration Points

#### 4.1 SystemsManager Initialization Sequence:
1. Process merged config
2. Extract template entities using TemplateEntityExtractor
3. Create auto-DataSource configurations
4. Merge with user-configured DataSources
5. Initialize DataSourceManager with combined configuration
6. Continue with existing initialization flow

#### 4.2 BaseOverlayUpdater Flow:
1. Entity state changes trigger DataSource notifications
2. DataSource change events include auto-created template entities
3. BaseOverlayUpdater detects affected overlays using TemplateEntityExtractor
4. Overlay-specific updaters process template changes
5. Renderer updates overlay content with new entity states

### 5. Testing Requirements

#### 5.1 Unit Tests for TemplateEntityExtractor:
- Test MSD template format extraction: `{sensor.temp}`
- Test HA template format extraction: `{{states('sensor.temp')}}`
- Test DataSource reference filtering
- Test status grid cell template extraction
- Test invalid/malformed template handling

#### 5.2 Integration Tests:
- Test auto-DataSource creation during SystemsManager initialization
- Test template overlay updates when entities change
- Test performance with multiple template entities
- Test mixed configured + auto-created DataSources

#### 5.3 End-to-End Tests:
- Test text overlay with template updates in real-time
- Test status grid with cell-level templates
- Test complex templates with multiple entity references
- Test template updates don't interfere with Rules Engine

### 6. Performance Considerations

#### 6.1 Template Entity Detection:
- Cache extracted entity references per overlay
- Use Set operations for efficient entity matching
- Minimize regex complexity for template parsing

#### 6.2 Auto-DataSource Optimization:
- Lightweight configuration for template-only entities
- Minimal history buffering (60 seconds max)
- Aggressive coalescing (50ms) for UI responsiveness
- No unnecessary transformations/aggregations

#### 6.3 Update Pipeline Efficiency:
- Batch entity changes when possible
- Avoid duplicate overlay updates
- Use existing BaseOverlayUpdater infrastructure

### 7. User Experience Requirements

#### 7.1 Zero Configuration:
- Templates automatically work without DataSource definitions
- Support both MSD and HA template syntax
- No breaking changes to existing configurations

#### 7.2 Error Handling:
- Graceful handling of invalid entity references
- Clear logging for debugging template issues
- Fallback to static content if entity unavailable

#### 7.3 Documentation:
- Update user documentation with template examples
- Document supported template formats
- Provide troubleshooting guide for template issues

### 8. Implementation Order

1. **Phase 1**: Create `TemplateEntityExtractor.js` with comprehensive template parsing
2. **Phase 2**: Modify `SystemsManager._initializeDataSources()` for auto-DataSource creation
3. **Phase 3**: Add `SystemsManager._createTemplateDataSources()` method
4. **Phase 4**: Update `BaseOverlayUpdater` for enhanced template change detection
5. **Phase 5**: Integration testing and performance optimization
6. **Phase 6**: Documentation updates and user testing

### 9. Success Criteria

- [ ] Templates in text overlays update automatically when entities change
- [ ] Status grid cell templates update in real-time
- [ ] No manual DataSource configuration required for template entities
- [ ] Performance impact < 10% on overlay rendering
- [ ] Zero breaking changes to existing MSD configurations
- [ ] Comprehensive test coverage for all template formats
- [ ] Clear error messages for invalid templates
- [ ] Documentation includes working examples

### 10. Code Quality Requirements

- [ ] JSDoc documentation for all new methods
- [ ] Consistent error handling and logging
- [ ] Performance monitoring and metrics
- [ ] TypeScript-compatible JSDoc annotations
- [ ] Follow existing MSD architectural patterns
- [ ] Comprehensive inline comments for complex logic

### 11. File Modification Summary

| File | Modification Type | Key Changes |
|------|------------------|-------------|
| `src/msd/templates/TemplateEntityExtractor.js` | **NEW FILE** | Template parsing and entity extraction |
| `src/msd/pipeline/SystemsManager.js` | **MODIFY** | Auto-DataSource creation in `_initializeDataSources` |
| `src/msd/renderer/BaseOverlayUpdater.js` | **MODIFY** | Enhanced template change detection |

### 12. Integration Verification

After implementation, verify:
- [ ] Auto-created DataSources appear in DataSourceManager
- [ ] Template entities trigger overlay updates
- [ ] BaseOverlayUpdater processes template changes correctly
- [ ] No conflicts with existing Rules Engine functionality
- [ ] Memory usage remains acceptable with auto-created DataSources
