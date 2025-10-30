# MSD System Flow & Pipeline Architecture

> **Complete data flow from configuration to rendering**
> A detailed guide to how CB-LCARS initializes, processes configuration, and renders overlays.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Complete Pipeline Flow](#complete-pipeline-flow)
3. [Initialization Sequence](#initialization-sequence)
4. [Configuration Processing](#configuration-processing)
5. [Pack System](#pack-system)
6. [Model Building](#model-building)
7. [Systems Initialization](#systems-initialization)
8. [DataSource Lifecycle](#datasource-lifecycle)
9. [Rendering Pipeline](#rendering-pipeline)
10. [Runtime Updates](#runtime-updates)
11. [Template Processing](#template-processing)
12. [Rules Engine Evaluation](#rules-engine-evaluation)
13. [Line Routing](#line-routing)
14. [Debug & Introspection](#debug--introspection)

---

## Overview

The MSD (Master Systems Display) system follows a **pipeline architecture** with clear stages from configuration loading to final SVG rendering.

### Pipeline Stages

```mermaid
graph LR
    Config[User Configuration] --> Process[Configuration<br/>Processing]
    Process --> Packs[Pack System<br/>Merge & Validate]
    Packs --> Model[Model Building]
    Model --> Systems[Systems<br/>Initialization]
    Systems --> Render[Rendering<br/>Pipeline]
    Render --> Display[SVG Display]

    Display -.->|Updates| Runtime[Runtime<br/>Updates]
    Runtime -.->|Re-render| Render

    style Config fill:#4d94ff,stroke:#0066cc,color:#fff
    style Process fill:#ff9933,stroke:#cc6600,color:#fff
    style Packs fill:#ff9933,stroke:#cc6600,color:#fff
    style Model fill:#ff9933,stroke:#cc6600,color:#fff
    style Systems fill:#00cc66,stroke:#009944,color:#fff
    style Render fill:#00cc66,stroke:#009944,color:#fff
    style Display fill:#ffcc00,stroke:#cc9900
```

**Key Characteristics:**
- 🔄 **Event-driven** - Responds to HA entity changes
- 📦 **Modular** - Clear separation of concerns
- ⚡ **Efficient** - Incremental updates, no full re-renders
- 🎯 **Declarative** - Configuration-first approach
- 🔍 **Debuggable** - Comprehensive introspection tools

---

## Complete Pipeline Flow

### End-to-End System Flow

```mermaid
sequenceDiagram
    participant User as User Config
    participant Pipeline as PipelineCore
    participant Config as Config Processor
    participant Packs as Pack System
    participant Model as Model Builder
    participant Systems as SystemsManager
    participant DS as DataSourceManager
    participant Rules as RulesEngine
    participant Template as TemplateProcessor
    participant Renderer as AdvancedRenderer
    participant SVG as SVG Output

    User->>Pipeline: initMsdPipeline(config, mountEl, hass)

    Pipeline->>Config: processAndValidateConfig()
    Config->>Config: Validate schema
    Config->>Config: Check required fields
    Config-->>Pipeline: {mergedConfig, issues, provenance}

    Pipeline->>Packs: mergePacks(config)
    Packs->>Packs: Load builtin packs
    Packs->>Packs: Load external packs
    Packs->>Packs: Merge configurations
    Packs-->>Pipeline: Merged pack config

    Pipeline->>Model: buildCardModel(config)
    Model->>Model: Process overlays
    Model->>Model: Build card structure
    Model-->>Pipeline: CardModel instance

    Pipeline->>Systems: initializeSystems()
    Systems->>DS: Initialize DataSourceManager
    DS->>DS: Create DataSource instances
    DS->>DS: Subscribe to HA entities
    DS-->>Systems: DataSources ready

    Systems->>Rules: Initialize RulesEngine
    Systems->>Template: Initialize TemplateProcessor
    Systems->>Renderer: Initialize AdvancedRenderer
    Systems-->>Pipeline: All systems initialized

    Pipeline->>Model: computeResolvedModel()
    Model->>Rules: Evaluate rules
    Rules->>Template: Process templates
    Template->>DS: Get datasource values
    DS-->>Template: Current values
    Template-->>Model: Resolved templates
    Model-->>Pipeline: Resolved model

    Pipeline->>Renderer: render(resolvedModel)
    Renderer->>Renderer: Render overlays
    Renderer->>SVG: Generate SVG elements
    SVG-->>User: Display dashboard

    loop Runtime Updates
        DS->>DS: Entity state changed
        DS->>Model: Emit update
        Model->>Rules: Re-evaluate affected rules
        Model->>Template: Re-process templates
        Model->>Renderer: Incremental update
        Renderer->>SVG: Update affected elements
    end
```

**Flow Summary:**
1. **Configuration** - Load and validate user config
2. **Packs** - Merge themes, presets, external config
3. **Model** - Build internal card representation
4. **Systems** - Initialize all subsystems (DataSources, Rules, Templates, Renderer)
5. **Resolution** - Resolve templates, evaluate rules
6. **Rendering** - Generate SVG from resolved model
7. **Runtime** - Handle updates incrementally


---

## Initialization Sequence

### Card Loading & Setup

```mermaid
graph TD
    Start[Card Load] --> Entry[index.js Entry Point]

    Entry --> Pipeline[PipelineCore.initMsdPipeline]
    Pipeline --> Config[Process Configuration]

    Config --> Valid{Valid<br/>config?}
    Valid -->|No| Error[Throw Error<br/>with details]
    Valid -->|Yes| Packs[Load & Merge Packs]

    Packs --> Theme[Initialize Theme System]
    Theme --> Model[Build Card Model]
    Model --> Systems[Initialize Systems Manager]

    Systems --> DS[DataSourceManager]
    Systems --> Rules[RulesEngine]
    Systems --> Template[TemplateProcessor]
    Systems --> Router[RouterCore]
    Systems --> Anim[AnimationRegistry]
    Systems --> Renderer[AdvancedRenderer]

    Renderer --> Initial[Initial Render]
    Initial --> Display[Display SVG]
    Display --> Ready[✅ Card Ready]

    Ready --> Runtime[Enter Runtime Mode]

    style Start fill:#4d94ff,stroke:#0066cc,color:#fff
    style Error fill:#ff3333,stroke:#cc0000,color:#fff
    style Ready fill:#00cc66,stroke:#009944,color:#fff
    style Runtime fill:#ffcc00,stroke:#cc9900
```

**Initialization Steps:**
1. **Entry Point** - `index.js` exports `initMsdPipeline`
2. **Config Processing** - Validate and normalize configuration
3. **Pack Loading** - Merge builtin and external configuration
4. **Theme Setup** - Load active theme and resolve tokens
5. **Model Building** - Create internal card model
6. **System Initialization** - Initialize all subsystems
7. **Initial Render** - Generate first SVG output
8. **Runtime Mode** - Enter event-driven update mode

---

## Configuration Processing

### Config Validation & Normalization

```mermaid
graph TD
    Raw[Raw User Config] --> Validator[Configuration Validator]

    Validator --> Schema{Schema<br/>valid?}
    Schema -->|No| Issues[Collect Issues]
    Schema -->|Yes| Normalize[Normalize Values]

    Issues --> Severity{Critical?}
    Severity -->|Yes| Throw[Throw Error]
    Severity -->|No| Warn[Log Warnings]

    Normalize --> Defaults[Apply Defaults]
    Defaults --> Expand[Expand Shorthand]
    Expand --> Resolved[Resolved Config]

    Warn --> Resolved
    Resolved --> Provenance[Track Provenance]
    Provenance --> Output[{mergedConfig, issues, provenance}]

    style Raw fill:#4d94ff,stroke:#0066cc,color:#fff
    style Throw fill:#ff3333,stroke:#cc0000,color:#fff
    style Warn fill:#ff9933,stroke:#cc6600,color:#fff
    style Output fill:#00cc66,stroke:#009944,color:#fff
```

**Configuration Stages:**
1. **Schema Validation** - Check against JSON schema
2. **Normalization** - Convert shorthand to full format
3. **Default Application** - Fill in missing values
4. **Issue Collection** - Track warnings and errors
5. **Provenance Tracking** - Record where each value came from

**Validation Features:**
- Required field checking
- Type validation
- Range validation
- Dependency validation
- Custom validators per overlay type

---

## Pack System

### Pack Loading & Merging

```mermaid
graph TD
    Start[Pack Loading] --> Builtin[Load Builtin Packs]

    Builtin --> Themes[builtin_themes]
    Builtin --> Core[core pack]
    Builtin --> Buttons[cb_lcars_buttons]

    Start --> External[Load External Packs]
    External --> User[User-defined packs]

    Themes --> Merge[Pack Merger]
    Core --> Merge
    Buttons --> Merge
    User --> Merge

    Merge --> Priority[Apply Priority Rules]
    Priority --> Themes2[Theme Selection]
    Themes2 --> Active[Set Active Theme]

    Active --> Presets[Register Style Presets]
    Presets --> Components[Register Component Defaults]
    Components --> Output[Merged Configuration]

    style Builtin fill:#4d94ff,stroke:#0066cc,color:#fff
    style External fill:#ff9933,stroke:#cc6600,color:#fff
    style Output fill:#00cc66,stroke:#009944,color:#fff
```

**Pack Types:**
- **builtin_themes** - Theme definitions (always loaded)
- **core** - Core overlays and defaults
- **cb_lcars_buttons** - LCARS button presets
- **external** - User-provided packs from URLs

**Merge Priority:**
1. Builtin packs (lowest priority)
2. External packs
3. User configuration (highest priority)

**What Packs Provide:**
- Theme tokens and component defaults
- Style presets (e.g., LCARS button styles)
- Reusable overlay templates
- Animation definitions

---

## Model Building

### Card Model Construction

```mermaid
graph TD
    Config[Merged Configuration] --> Builder[Model Builder]

    Builder --> Parse[Parse Overlays]
    Parse --> Overlays[Overlay Array]

    Overlays --> Text[Text Overlays]
    Overlays --> Button[Button Overlays]
    Overlays --> Line[Line Overlays]
    Overlays --> Grid[Status Grid Overlays]
    Overlays --> Chart[ApexChart Overlays]

    Text --> Validate[Validate Each]
    Button --> Validate
    Line --> Validate
    Grid --> Validate
    Chart --> Validate

    Validate --> Dependencies[Build Dependency Graph]
    Dependencies --> Lines[Line Attachment Resolution]
    Lines --> Model[CardModel Instance]

    Model --> Methods[Model Methods]
    Methods --> Compute[computeResolvedModel]
    Methods --> Get[getOverlayById]
    Methods --> Update[updateOverlay]

    style Config fill:#4d94ff,stroke:#0066cc,color:#fff
    style Model fill:#00cc66,stroke:#009944,color:#fff
```

**Model Building Process:**
1. **Parse Overlays** - Convert config to overlay objects
2. **Type Validation** - Ensure each overlay has valid type
3. **Dependency Analysis** - Build graph of overlay relationships
4. **Line Resolution** - Resolve line attachment points
5. **Model Creation** - Instantiate CardModel with all overlays

**CardModel Features:**
- Stores all overlay definitions
- Tracks overlay dependencies (e.g., lines attached to overlays)
- Provides query methods (getOverlayById, getOverlaysByType)
- Caches resolved model for performance
- Supports incremental updates


---

## Systems Initialization

### SystemsManager Startup

```mermaid
graph TD
    Manager[SystemsManager] --> Init[initializeSystems]

    Init --> Theme[ThemeManager]
    Theme --> Tokens[Load Theme Tokens]
    Tokens --> Defaults[Component Defaults]

    Init --> DS[DataSourceManager]
    DS --> Entities[Subscribe to HA Entities]
    DS --> History[Preload History]
    DS --> Buffer[Initialize Buffers]

    Init --> Rules[RulesEngine]
    Rules --> Conditions[Parse Rule Conditions]
    Rules --> Actions[Parse Rule Actions]

    Init --> Template[TemplateProcessor]
    Template --> Registry[Register Built-in Functions]
    Template --> Context[Setup Evaluation Context]

    Init --> Router[RouterCore]
    Router --> PathLib[Initialize Path Library]
    Router --> Algo[Load Routing Algorithms]

    Init --> Anim[AnimationRegistry]
    Anim --> AnimeJS[Load Anime.js v4]
    Anim --> Presets[Register Animation Presets]

    Init --> Renderer[AdvancedRenderer]
    Renderer --> SVG[Setup SVG Namespace]
    Renderer --> OverlayRenderers[Initialize Overlay Renderers]

    Renderer --> Ready[✅ All Systems Ready]

    style Manager fill:#4d94ff,stroke:#0066cc,color:#fff
    style Ready fill:#00cc66,stroke:#009944,color:#fff
```

**SystemsManager Role:**
- Central orchestrator for all subsystems
- Ensures initialization order
- Manages inter-system dependencies
- Provides access to all subsystems
- Handles cleanup on card removal

**Subsystems Initialized:**
1. **ThemeManager** - Theme tokens and defaults
2. **DataSourceManager** - Entity subscriptions and data processing
3. **RulesEngine** - Conditional logic evaluation
4. **TemplateProcessor** - Template string resolution
5. **RouterCore** - Line path calculation
6. **AnimationRegistry** - Animation management
7. **AdvancedRenderer** - SVG rendering

---

## DataSource Lifecycle

### DataSource Creation & Updates

```mermaid
sequenceDiagram
    participant Config as User Config
    participant DSM as DataSourceManager
    participant DS as DataSource Instance
    participant HA as Home Assistant
    participant Transform as Transformations
    participant Agg as Aggregations
    participant Overlay as Overlays

    Config->>DSM: data_sources configuration
    DSM->>DS: Create DataSource(config)
    DS->>HA: Subscribe to entity
    HA-->>DS: Current state

    opt Historical Data
        DS->>HA: Request history (6 hours default)
        HA-->>DS: Historical data array
        DS->>DS: Pre-fill buffer
    end

    DS->>Transform: Apply transformations
    Transform->>Transform: Unit conversion
    Transform->>Transform: Scaling
    Transform->>Transform: Smoothing
    Transform-->>DS: Transformed values

    DS->>Agg: Calculate aggregations
    Agg->>Agg: Moving average
    Agg->>Agg: Min/Max
    Agg->>Agg: Rate of change
    Agg-->>DS: Aggregated values

    DS->>Overlay: Emit initial values
    Overlay-->>Overlay: Initial render

    loop Runtime Updates
        HA->>DS: Entity state changed
        DS->>DS: Add to buffer (time-windowed)
        DS->>Transform: Re-apply transformations
        DS->>Agg: Recalculate aggregations
        DS->>Overlay: Emit updated values
        Overlay-->>Overlay: Incremental update
    end

    Config->>DSM: Card removed
    DSM->>DS: destroy()
    DS->>HA: Unsubscribe from entity
```

**DataSource Features:**
- **Real-time subscriptions** - Auto-connect to HA entities
- **Historical preload** - Load past data for charts/analysis
- **Time-windowed buffers** - Efficient memory management
- **Transformation pipeline** - 50+ processors (unit conversion, scaling, smoothing)
- **Aggregation engine** - Statistics, trends, moving averages
- **Performance optimization** - Coalescing, throttling, smart buffering

---

## Rendering Pipeline

### SVG Generation Process

```mermaid
graph TD
    Model[Resolved Model] --> Renderer[AdvancedRenderer]

    Renderer --> Loop[Loop Through Overlays]
    Loop --> Type{Overlay<br/>Type?}

    Type -->|text| TextR[TextRenderer]
    Type -->|button| ButtonR[ButtonRenderer]
    Type -->|line| LineR[LineRenderer]
    Type -->|status_grid| GridR[StatusGridRenderer]
    Type -->|apexchart| ChartR[ApexChartRenderer]

    TextR --> Style[Resolve Styles]
    ButtonR --> Style
    LineR --> Style
    GridR --> Style
    ChartR --> Style

    Style --> Theme[Apply Theme Defaults]
    Theme --> Preset{Preset<br/>specified?}
    Preset -->|Yes| ApplyPreset[Apply Style Preset]
    Preset -->|No| Direct[Use Direct Styles]

    ApplyPreset --> Merge[Merge Styles]
    Direct --> Merge

    Merge --> SVG[Generate SVG Elements]
    SVG --> Attach[Attach to DOM]
    Attach --> Events[Attach Event Listeners]
    Events --> Complete[✅ Overlay Rendered]

    Complete --> Next{More<br/>overlays?}
    Next -->|Yes| Loop
    Next -->|No| Done[Rendering Complete]

    style Model fill:#4d94ff,stroke:#0066cc,color:#fff
    style Done fill:#00cc66,stroke:#009944,color:#fff
```

**Rendering Steps:**
1. **Loop Overlays** - Process each overlay in order
2. **Type Detection** - Identify overlay type
3. **Style Resolution** - Resolve styles from theme, presets, and user config
4. **SVG Generation** - Create SVG elements
5. **DOM Attachment** - Add elements to SVG container
6. **Event Binding** - Attach click handlers, hover effects
7. **Return to Loop** - Process next overlay

**Renderer Features:**
- **Incremental updates** - Only re-render changed overlays
- **Efficient DOM manipulation** - Minimize reflows
- **Event delegation** - Centralized event handling
- **Style caching** - Avoid redundant calculations
- **ViewBox scaling** - Responsive sizing


---

## Runtime Updates

### Incremental Update Flow

```mermaid
sequenceDiagram
    participant Entity as HA Entity
    participant DS as DataSource
    participant Model as CardModel
    participant Rules as RulesEngine
    participant Template as TemplateProcessor
    participant Renderer as AdvancedRenderer
    participant DOM as SVG DOM

    Entity->>DS: State changed
    DS->>DS: Update buffer
    DS->>DS: Process transformations
    DS->>DS: Recalculate aggregations
    DS->>Model: Emit update event

    Model->>Rules: Check affected rules
    Rules->>Rules: Re-evaluate conditions
    Rules-->>Model: Rule results

    Model->>Template: Re-process affected templates
    Template->>DS: Get current values
    DS-->>Template: Values with transformations
    Template-->>Model: Resolved content

    Model->>Renderer: incrementalUpdate(changedOverlays)

    loop For each changed overlay
        Renderer->>Renderer: Find existing SVG element
        Renderer->>Renderer: Update element attributes
        Renderer->>DOM: Apply changes (no reflow)
    end

    Renderer-->>Model: Update complete
```

**Update Optimization:**
- ✅ **No full re-renders** - Only update changed overlays
- ✅ **Minimal DOM manipulation** - Batch updates
- ✅ **Efficient diffing** - Track what changed
- ✅ **Event coalescing** - Batch rapid updates
- ✅ **Async processing** - Non-blocking updates

**Update Triggers:**
- Entity state changes from Home Assistant
- DataSource computed value changes
- Rule re-evaluation results
- User interactions (button clicks)
- Timer-based updates

---

## Template Processing

### Template Resolution Flow

```mermaid
graph TD
    Template[Template String<br/>\{datasource.value\}] --> Processor[TemplateProcessor]

    Processor --> Parse[Parse Template]
    Parse --> Tokens[Extract Tokens]

    Tokens --> Type{Token<br/>Type?}

    Type -->|datasource| DS[DataSourceManager]
    Type -->|function| Func[Built-in Function]
    Type -->|expression| Expr[JavaScript Expression]

    DS --> Get[Get DataSource Value]
    Get --> Trans{Transformation<br/>specified?}
    Trans -->|Yes| TransValue[Get Transformation Value]
    Trans -->|No| RawValue[Get Raw Value]

    TransValue --> Format[Apply Formatting]
    RawValue --> Format

    Func --> Eval[Evaluate Function]
    Eval --> Format

    Expr --> Safe[Safe Eval Context]
    Safe --> Format

    Format --> Replace[Replace Token]
    Replace --> More{More<br/>tokens?}
    More -->|Yes| Tokens
    More -->|No| Result[Resolved String]

    style Template fill:#4d94ff,stroke:#0066cc,color:#fff
    style Result fill:#00cc66,stroke:#009944,color:#fff
```

**Template Features:**
- **DataSource references** - `{datasource.value}`, `{datasource.transformations.key}`
- **Aggregation access** - `{datasource.aggregations.avg.value}`
- **Built-in functions** - `{@round(datasource.value, 1)}`
- **Expressions** - `{datasource.value * 2 + 10}`
- **Formatting** - `{datasource.value:.2f}` (2 decimal places)
- **Safe evaluation** - Sandboxed JavaScript execution

---

## Rules Engine Evaluation

### Rule Processing

```mermaid
graph TD
    Model[Card Model] --> Rules[RulesEngine]

    Rules --> Loop[Loop Through Rules]
    Loop --> Condition[Evaluate Condition]

    Condition --> Type{Condition<br/>Type?}

    Type -->|datasource| DS[Check DataSource Value]
    Type -->|entity| Entity[Check HA Entity State]
    Type -->|expression| Expr[Evaluate Expression]
    Type -->|time| Time[Check Time/Date]

    DS --> Compare[Compare with Target]
    Entity --> Compare
    Expr --> Compare
    Time --> Compare

    Compare --> Match{Condition<br/>Met?}

    Match -->|Yes| Actions[Execute Actions]
    Match -->|No| Next{More<br/>rules?}

    Actions --> ActionType{Action<br/>Type?}

    ActionType -->|set_style| StyleAction[Update Overlay Style]
    ActionType -->|set_visibility| VisAction[Show/Hide Overlay]
    ActionType -->|set_content| ContentAction[Update Content]
    ActionType -->|trigger_animation| AnimAction[Start Animation]

    StyleAction --> Apply[Apply to Overlay]
    VisAction --> Apply
    ContentAction --> Apply
    AnimAction --> Apply

    Apply --> Next
    Next -->|Yes| Loop
    Next -->|No| Complete[✅ Rules Evaluated]

    style Model fill:#4d94ff,stroke:#0066cc,color:#fff
    style Complete fill:#00cc66,stroke:#009944,color:#fff
```

**Rule Types:**
- **Conditional styling** - Change colors based on value ranges
- **Visibility control** - Show/hide overlays based on conditions
- **Content updates** - Dynamic text based on state
- **Animation triggers** - Start animations on conditions
- **Multi-condition rules** - AND/OR logic

**Evaluation Timing:**
- Initial render
- DataSource updates
- Entity state changes
- Manual trigger (user action)

---

## Line Routing

### Path Calculation

```mermaid
graph TD
    Line[Line Overlay] --> Router[RouterCore]

    Router --> Anchor[Get Anchor Point]
    Router --> Attach[Get Attach Point]

    Anchor --> Gap1[Apply anchor_gap]
    Attach --> Gap2[Apply attach_gap]

    Gap1 --> Start[Start Point x,y]
    Gap2 --> End[End Point x,y]

    Start --> Mode{Routing<br/>Mode?}
    End --> Mode

    Mode -->|auto| Auto[Smart Pathfinding]
    Mode -->|direct| Direct[Straight Line]
    Mode -->|orthogonal| Ortho[Right Angles]
    Mode -->|curved| Curved[Bezier Curves]

    Auto --> Grid[Build Grid Graph]
    Grid --> Obstacles[Mark Obstacles]
    Obstacles --> AStar[A* Algorithm]
    AStar --> Path[Calculated Path]

    Direct --> Path
    Ortho --> Path
    Curved --> Path

    Path --> SVG[Generate SVG Path]
    SVG --> Style[Apply Line Style]
    Style --> Complete[✅ Line Rendered]

    style Line fill:#4d94ff,stroke:#0066cc,color:#fff
    style Complete fill:#00cc66,stroke:#009944,color:#fff
```

**Line Routing Features:**
- **9-point attachment** - Any side or corner of any overlay
- **Gap system** - Offset from attachment point
- **Auto routing** - Obstacle avoidance with A*
- **Multiple algorithms** - Direct, orthogonal, curved
- **Dynamic updates** - Recalculate on overlay movement
- **Style control** - Width, color, dashes, arrows

---

## Debug & Introspection

### Debug System

```mermaid
graph TD
    Debug[Debug System] --> Expose[window.cblcars.debug.msd]

    Expose --> Pipeline[Pipeline Access]
    Expose --> Systems[Systems Access]
    Expose --> Model[Model Access]
    Expose --> State[State Inspection]

    Pipeline --> ConfigAccess[View Configuration]
    Pipeline --> Provenance[Check Provenance]
    Pipeline --> Issues[View Validation Issues]

    Systems --> DSM[DataSourceManager]
    Systems --> Rules[RulesEngine]
    Systems --> Template[TemplateProcessor]
    Systems --> Renderer[Renderer State]

    DSM --> DSSources[View All DataSources]
    DSM --> DSValues[Current Values]
    DSM --> DSHistory[Buffer Contents]

    Model --> Overlays[Inspect Overlays]
    Model --> Dependencies[Dependency Graph]
    Model --> Resolved[Resolved Model]

    State --> Performance[Performance Metrics]
    State --> Events[Event Log]
    State --> Memory[Memory Usage]

    Debug --> Methods[Debug Methods]
    Methods --> Dump[dumpState]
    Methods --> Trace[traceDataFlow]
    Methods --> Test[testRules]
    Methods --> Validate[validateConfig]

    style Debug fill:#4d94ff,stroke:#0066cc,color:#fff
    style Methods fill:#00cc66,stroke:#009944,color:#fff
```

**Debug Features:**

**Console Access:**
```javascript
// Access debug interface
window.cblcars.debug.msd

// View configuration
window.cblcars.debug.msd.config

// Inspect datasources
window.cblcars.debug.msd.systems.dataSourceManager.dataSources

// View resolved model
window.cblcars.debug.msd.model.computeResolvedModel()

// Dump full state
window.cblcars.debug.msd.dumpState()
```

**Debug Methods:**
- `dumpState()` - Export complete system state
- `traceDataFlow(overlayId)` - Track data flow to overlay
- `testRules()` - Dry-run rule evaluation
- `validateConfig()` - Re-validate configuration
- `inspectDataSource(id)` - View datasource details
- `reRender()` - Force full re-render

**Debug Renderers:**
- **MsdDebugRenderer** - Overlay bounds, attachment points
- **MsdControlsRenderer** - Runtime controls, config editor

---

## Performance Characteristics

### System Performance

| Aspect | Performance | Notes |
|--------|-------------|-------|
| **Initial Load** | ~100-200ms | Depends on pack count, theme complexity |
| **First Render** | ~50-100ms | Depends on overlay count |
| **DataSource Update** | ~1-5ms | Per datasource, includes transformations |
| **Incremental Render** | ~2-10ms | Per changed overlay |
| **Rule Evaluation** | ~0.5-2ms | Per rule |
| **Template Processing** | ~1-3ms | Per template |
| **Line Routing (auto)** | ~5-20ms | Depends on path complexity |
| **Memory Usage** | 5-20 MB | Depends on history buffer size |

**Optimization Techniques:**
- Event coalescing (batch rapid updates)
- Incremental rendering (no full re-renders)
- Style caching (avoid redundant calculations)
- Buffer windowing (automatic old data cleanup)
- Lazy evaluation (compute only when needed)
- Efficient DOM manipulation (minimize reflows)

---

## Summary

### Key Pipeline Stages

1. **Configuration** → Process and validate user config
2. **Packs** → Load and merge themes, presets, external config
3. **Model** → Build internal card representation
4. **Systems** → Initialize all subsystems
5. **DataSources** → Subscribe to HA entities, preload history
6. **Resolution** → Resolve templates, evaluate rules
7. **Rendering** → Generate SVG from resolved model
8. **Runtime** → Handle updates incrementally

### System Characteristics

- ✅ **Event-driven** - React to HA state changes
- ✅ **Declarative** - Configuration-first approach
- ✅ **Modular** - Clear subsystem boundaries
- ✅ **Efficient** - Incremental updates only
- ✅ **Debuggable** - Comprehensive introspection
- ✅ **Extensible** - Pack system, custom renderers
- ✅ **Performant** - Optimized for real-time dashboards

### Architecture Benefits

**For Users:**
- Fast, responsive dashboards
- Real-time data updates
- Rich visual effects
- Easy configuration

**For Developers:**
- Clear separation of concerns
- Easy to debug and test
- Extensible architecture
- Well-documented pipeline

---

**Related Documentation:**
- [Systems Manager](subsystems/systems-manager.md) - Central orchestration
- [DataSource System](subsystems/datasource-system.md) - Data processing
- [Advanced Renderer](subsystems/advanced-renderer.md) - SVG generation
- [Pack System](subsystems/pack-system.md) - Configuration merging
- [Rules Engine](subsystems/rules-engine.md) - Conditional logic
- [Template Processor](subsystems/template-processor.md) - String resolution
