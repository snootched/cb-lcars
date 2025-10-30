# Control Overlay System Architecture

> **Embedding Home Assistant Cards as MSD Overlays**
> Technical architecture documentation for the Control overlay type

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Rendering Pipeline](#rendering-pipeline)
4. [SVG foreignObject Integration](#svg-foreignobject-integration)
5. [HASS Context Management](#hass-context-management)
6. [Attachment Point System](#attachment-point-system)
7. [Card Type Support](#card-type-support)
8. [Lifecycle Management](#lifecycle-management)
9. [Performance & Optimization](#performance--optimization)
10. [Integration with MSD Systems](#integration-with-msd-systems)

---

## Overview

The **Control overlay type** enables embedding any Home Assistant card (custom or built-in) directly into an MSD canvas as a positioned overlay. These embedded cards maintain full interactivity, receive HASS context updates, and integrate seamlessly with MSD features like line attachment points, theming, and the debug system.

### Key Features

- 🎮 **Universal Card Support** - Embed any HA card (custom or built-in)
- 📍 **Precise Positioning** - SVG coordinate-based placement
- 🔗 **Line Attachments** - Full 9-point attachment system
- 🔄 **Reactive Updates** - Automatic HASS context propagation
- 🎨 **Theme Integration** - Inherits MSD theme and scaling
- 🐛 **Debug Support** - Full introspection and highlighting

---

## Architecture

### System Overview

```mermaid
graph TB
    Config[Control Overlay Config] --> Parser[Config Parser]
    Parser --> Model[CardModel]

    Model --> Renderer[MsdControlsRenderer]

    Renderer --> CardFactory[Card Factory]
    CardFactory --> Type{Card<br/>Type?}

    Type -->|custom:*| CustomCard[Custom Card Element]
    Type -->|built-in| HUICard[HUI Card Element]

    CustomCard --> Foreign[SVG foreignObject]
    HUICard --> Foreign

    Foreign --> SVG[SVG Container]

    HASS[Home Assistant Context] --> Renderer
    Renderer --> Update[HASS Propagation]
    Update --> CustomCard
    Update --> HUICard

    Attach[Attachment Point Manager] --> Compute[Compute Attachment Points]
    Foreign --> Compute

    Lines[Line Overlays] -.->|connect to| Compute

    style Config fill:#4d94ff,stroke:#0066cc,color:#fff
    style Renderer fill:#ff9933,stroke:#cc6600,color:#fff
    style Foreign fill:#00cc66,stroke:#009944,color:#fff
    style HASS fill:#ffcc00,stroke:#cc9900
```

**Architecture Layers:**
1. **Configuration Layer** - YAML/JSON control overlay definitions
2. **Model Layer** - CardModel with control overlay metadata
3. **Rendering Layer** - MsdControlsRenderer and card factory
4. **Integration Layer** - SVG foreignObject positioning
5. **Context Layer** - HASS context propagation

---

## Rendering Pipeline

### Control Overlay Lifecycle

```mermaid
sequenceDiagram
    participant Config as Control Config
    participant System as SystemsManager
    participant Renderer as MsdControlsRenderer
    participant Factory as Card Factory
    participant Card as Card Element
    participant Foreign as foreignObject
    participant SVG as SVG Container
    participant HASS as Home Assistant

    Config->>System: Control overlay in model
    System->>Renderer: renderControls(controlOverlays)

    loop For each control overlay
        Renderer->>Renderer: Resolve card definition
        Renderer->>Factory: createControlElement(overlay)

        Factory->>Factory: Normalize card type
        Factory->>Factory: Determine card class

        alt Custom Card
            Factory->>Card: createElement('custom-element')
            Factory->>Card: setConfig(config)
        else Built-in Card
            Factory->>Card: createElement('hui-*-card')
            Factory->>Card: setConfig(config)
        end

        Card-->>Factory: Card element ready
        Factory-->>Renderer: controlElement

        Renderer->>Foreign: createSvgForeignObject()
        Foreign->>Foreign: Set position & size

        Renderer->>Foreign: appendChild(controlElement)
        Renderer->>SVG: appendChild(foreignObject)

        Renderer->>Card: Apply HASS context
        HASS->>Card: hass property / setHass()

        Card->>Card: Render & initialize
    end

    loop Runtime Updates
        HASS->>System: State changed
        System->>Renderer: setHass(newHass)
        Renderer->>Card: Update HASS context
        Card->>Card: Re-render with new data
    end
```

**Pipeline Stages:**
1. **Parse** - Extract control overlay configuration
2. **Resolve** - Determine card type and configuration
3. **Create** - Instantiate card element
4. **Position** - Create foreignObject with coordinates
5. **Embed** - Append card to foreignObject
6. **Integrate** - Add to SVG container
7. **Activate** - Apply HASS context and initialize

---

## SVG foreignObject Integration

### Coordinate Space Mapping

```mermaid
graph TD
    ViewBox[SVG ViewBox<br/>1920x1080 units] --> Foreign[foreignObject Element]

    Foreign --> Position[x, y coordinates<br/>in viewBox space]
    Foreign --> Size[width, height<br/>in viewBox units]

    Position --> Calc1[position: x, y from config]
    Size --> Calc2[size: width, height from config]

    Foreign --> HTML[HTML Content Space]
    HTML --> Card[Card Element<br/>100% width/height]

    Card --> Scale[Auto-scaling via<br/>SVG viewport]

    ViewBox -.->|scale transform| Scale

    style ViewBox fill:#4d94ff,stroke:#0066cc,color:#fff
    style Foreign fill:#ff9933,stroke:#cc6600,color:#fff
    style Card fill:#00cc66,stroke:#009944,color:#fff
```

**foreignObject Benefits:**
- ✅ **ViewBox Integration** - Positions in same coordinate space as other overlays
- ✅ **Automatic Scaling** - Scales with SVG viewport transformations
- ✅ **HTML Embedding** - Full HTML/CSS support inside SVG
- ✅ **Event Handling** - Native DOM events work normally
- ✅ **Z-Index Control** - Proper layering with other overlays

### Implementation Details

```javascript
// Create foreignObject in SVG namespace
const foreignObject = document.createElementNS(
  'http://www.w3.org/2000/svg',
  'foreignObject'
);

// Set position and size in viewBox coordinates
foreignObject.setAttribute('x', overlay.position[0]);
foreignObject.setAttribute('y', overlay.position[1]);
foreignObject.setAttribute('width', overlay.size[0]);
foreignObject.setAttribute('height', overlay.size[1]);

// Add metadata for debugging
foreignObject.setAttribute('data-msd-control-id', overlay.id);
foreignObject.setAttribute('data-overlay-type', 'control');

// Embed card element
foreignObject.appendChild(cardElement);

// Add to SVG container
svgContainer.appendChild(foreignObject);
```

---

## HASS Context Management

### Context Propagation Flow

```mermaid
sequenceDiagram
    participant HA as Home Assistant
    participant Pipeline as PipelineCore
    participant Systems as SystemsManager
    participant Controls as MsdControlsRenderer
    participant Card as Card Element

    HA->>Pipeline: State update event
    Pipeline->>Pipeline: Update HASS object
    Pipeline->>Systems: setHass(newHass)
    Systems->>Controls: setHass(newHass)

    Controls->>Controls: Store HASS reference
    Controls->>Controls: Iterate controlElements

    loop For each embedded card
        Controls->>Card: Detect card type

        alt CB-LCARS Card
            Controls->>Card: card.hass = hass
            Controls->>Card: card._hass = hass
            Controls->>Card: card.requestUpdate('hass')
            Note over Card: LitElement reactivity
        else Standard HA Card
            Controls->>Card: card.setHass(hass)
            Note over Card: HA card pattern
        else Unknown Card
            Controls->>Card: Try setHass() or property
            Note over Card: Fallback approach
        end

        Card->>Card: Re-render with new context
    end
```

**HASS Update Strategies:**

| Card Type | Update Method | Notes |
|-----------|---------------|-------|
| **CB-LCARS Cards** | Property assignment | Uses LitElement `requestUpdate()` |
| **Standard HA Cards** | `setHass()` method | Preferred HA card pattern |
| **Custom Cards** | Auto-detect | Try method first, fallback to property |

### State Synchronization

Control overlays maintain synchronization with Home Assistant state through:

1. **Initial HASS** - Applied during card creation
2. **Reactive Updates** - Propagated on every HA state change
3. **Entity Tracking** - Automatic subscription via card's entity reference
4. **Buffer Updates** - Real-time state without lag

---

## Attachment Point System

### 9-Point Attachment Grid

```mermaid
graph TD
    Control[Control Overlay<br/>foreignObject] --> Compute[computeAttachmentPoints]

    Compute --> Grid[9-Point Grid]

    Grid --> TL[top-left]
    Grid --> TC[top-center]
    Grid --> TR[top-right]
    Grid --> ML[middle-left]
    Grid --> MC[middle-center]
    Grid --> MR[middle-right]
    Grid --> BL[bottom-left]
    Grid --> BC[bottom-center]
    Grid --> BR[bottom-right]

    TL --> Coords1[x, y]
    TC --> Coords2[x + w/2, y]
    TR --> Coords3[x + w, y]
    ML --> Coords4[x, y + h/2]
    MC --> Coords5[x + w/2, y + h/2]
    MR --> Coords6[x + w, y + h/2]
    BL --> Coords7[x, y + h]
    BC --> Coords8[x + w/2, y + h]
    BR --> Coords9[x + w, y + h]

    Coords1 --> Lines[Line Overlays]
    Coords2 --> Lines
    Coords3 --> Lines
    Coords4 --> Lines
    Coords5 --> Lines
    Coords6 --> Lines
    Coords7 --> Lines
    Coords8 --> Lines
    Coords9 --> Lines

    style Control fill:#4d94ff,stroke:#0066cc,color:#fff
    style Grid fill:#ff9933,stroke:#cc6600,color:#fff
    style Lines fill:#00cc66,stroke:#009944,color:#fff
```

**Attachment Features:**
- ✅ **Standard Points** - Same 9-point system as other overlays
- ✅ **Dynamic Calculation** - Based on foreignObject position/size
- ✅ **Line Compatibility** - Full support for line overlay connections
- ✅ **Gap Support** - Respects `anchor_gap` and `attach_gap`

### Implementation

```javascript
static computeAttachmentPoints(overlay, anchors, container) {
  // Extract foreignObject position and size
  const x = overlay.position[0];
  const y = overlay.position[1];
  const width = overlay.size[0];
  const height = overlay.size[1];

  // Calculate 9 attachment points
  return {
    'top-left': [x, y],
    'top-center': [x + width / 2, y],
    'top-right': [x + width, y],
    'middle-left': [x, y + height / 2],
    'middle-center': [x + width / 2, y + height / 2],
    'middle-right': [x + width, y + height / 2],
    'bottom-left': [x, y + height],
    'bottom-center': [x + width / 2, y + height],
    'bottom-right': [x + width, y + height]
  };
}
```

---

## Card Type Support

### Supported Card Categories

```mermaid
graph TD
    Control[Control Overlay] --> Types[Card Types]

    Types --> Custom[Custom Cards]
    Types --> Builtin[Built-in HA Cards]

    Custom --> CBLCARS[CB-LCARS Cards]
    Custom --> MiniGraph[mini-graph-card]
    Custom --> ApexCharts[apexcharts-card]
    Custom --> Other[Other Custom Cards]

    Builtin --> Button[button]
    Builtin --> Light[light]
    Builtin --> Entities[entities]
    Builtin --> Gauge[gauge]
    Builtin --> Picture[picture]

    CBLCARS --> Pattern1[Property-based HASS]
    MiniGraph --> Pattern2[setHass method]
    ApexCharts --> Pattern2
    Other --> Pattern3[Auto-detect]

    Button --> HUI1[hui-button-card]
    Light --> HUI2[hui-light-card]
    Entities --> HUI3[hui-entities-card]
    Gauge --> HUI4[hui-gauge-card]
    Picture --> HUI5[hui-picture-card]

    HUI1 --> Pattern2
    HUI2 --> Pattern2
    HUI3 --> Pattern2
    HUI4 --> Pattern2
    HUI5 --> Pattern2

    style Control fill:#4d94ff,stroke:#0066cc,color:#fff
    style Custom fill:#ff9933,stroke:#cc6600,color:#fff
    style Builtin fill:#00cc66,stroke:#009944,color:#fff
```

**Card Type Mapping:**

| Configuration | Internal Element | HASS Method |
|---------------|------------------|-------------|
| `custom:cb-lcars-button-card` | `cb-lcars-button-card` | Property + `requestUpdate()` |
| `custom:mini-graph-card` | `mini-graph-card` | `setHass()` |
| `button` | `hui-button-card` | `setHass()` |
| `light` | `hui-light-card` | `setHass()` |
| `entities` | `hui-entities-card` | `setHass()` |

---

## Lifecycle Management

### Card Lifecycle States

```mermaid
stateDiagram-v2
    [*] --> Configured: Control overlay defined

    Configured --> Creating: renderControlOverlay()

    Creating --> Resolving: Resolve card definition
    Resolving --> Instantiating: Create card element

    Instantiating --> Configuring: setConfig(config)
    Configuring --> Positioning: Create foreignObject

    Positioning --> Embedding: Append to foreignObject
    Embedding --> Integrating: Add to SVG container

    Integrating --> Active: Apply HASS context

    Active --> Updating: HASS state changes
    Updating --> Active: Re-render

    Active --> Removing: Card removed/re-render
    Removing --> [*]

    Creating --> Error: Card creation failed
    Instantiating --> Error: Element not found
    Configuring --> Error: Config invalid

    Error --> [*]
```

**Lifecycle Events:**
1. **Configured** - Overlay definition parsed
2. **Creating** - Card element creation started
3. **Resolving** - Card type and config resolved
4. **Instantiating** - DOM element created
5. **Configuring** - Card config applied via `setConfig()`
6. **Positioning** - foreignObject created with position/size
7. **Embedding** - Card appended to foreignObject
8. **Integrating** - foreignObject added to SVG
9. **Active** - Card fully functional and receiving updates
10. **Updating** - Reactive updates on HASS changes
11. **Removing** - Cleanup on removal or re-render

---

## Performance & Optimization

### Rendering Optimizations

```mermaid
graph TD
    Render[Render Request] --> Check{Already<br/>rendering?}

    Check -->|Yes| Skip[Skip duplicate render]
    Check -->|No| Signature[Compute signature]

    Signature --> Same{Same as<br/>last render?}
    Same -->|Yes| Skip
    Same -->|No| Clear[Clear existing controls]

    Clear --> Loop[For each control overlay]

    Loop --> Exists{foreignObject<br/>exists?}
    Exists -->|Yes| Remove[Remove old element]
    Exists -->|No| Create[Create new element]

    Remove --> Create
    Create --> Apply[Apply HASS context]
    Apply --> Track[Track in controlElements Map]

    Track --> Next{More<br/>controls?}
    Next -->|Yes| Loop
    Next -->|No| Done[Rendering complete]

    style Render fill:#4d94ff,stroke:#0066cc,color:#fff
    style Skip fill:#ff9933,stroke:#cc6600,color:#fff
    style Done fill:#00cc66,stroke:#009944,color:#fff
```

**Optimization Techniques:**

| Technique | Purpose | Benefit |
|-----------|---------|---------|
| **Signature Caching** | Skip identical re-renders | Avoids unnecessary DOM manipulation |
| **Render Guard** | Prevent concurrent renders | Ensures consistency |
| **Element Tracking** | Map of overlay ID → element | Fast lookups for updates |
| **Deduplication** | Remove old foreignObject first | Prevents duplicates |
| **Batch HASS Updates** | Update all cards at once | Minimizes reflows |
| **Error Isolation** | Try/catch per overlay | One failure doesn't break all |

### Performance Characteristics

| Operation | Performance | Notes |
|-----------|-------------|-------|
| **Card Creation** | ~10-50ms | Per card, depends on complexity |
| **HASS Update** | ~1-5ms | Per card, property/method call |
| **Position Update** | ~2-10ms | foreignObject attribute changes |
| **Batch Render** | ~50-200ms | For 5-10 control overlays |
| **Memory per Card** | ~500KB-2MB | Depends on card implementation |

---

## Integration with MSD Systems

### System Integration Points

```mermaid
graph TB
    Controls[MsdControlsRenderer] --> Systems[SystemsManager]

    Systems --> DS[DataSourceManager]
    Systems --> Renderer[AdvancedRenderer]
    Systems --> APM[AttachmentPointManager]
    Systems --> Debug[MsdDebugRenderer]
    Systems --> Theme[ThemeManager]

    DS -.->|entity state| Controls
    Controls -.->|control elements| Renderer
    Controls -->|attachment points| APM
    APM -->|9-point grid| Lines[Line Overlays]
    Debug -.->|highlight| Controls
    Theme -.->|tokens| Controls

    Controls --> Map[controlElements Map]
    Map -->|track| Foreign[foreignObject Elements]
    Foreign -->|contains| Cards[HA Card Elements]

    style Controls fill:#4d94ff,stroke:#0066cc,color:#fff
    style Systems fill:#ff9933,stroke:#cc6600,color:#fff
    style Foreign fill:#00cc66,stroke:#009944,color:#fff
```

**Integration Features:**

1. **SystemsManager**
   - Initializes MsdControlsRenderer
   - Coordinates HASS propagation
   - Manages lifecycle

2. **AdvancedRenderer**
   - Provides SVG container
   - Manages z-index ordering
   - Computes attachment points

3. **AttachmentPointManager**
   - Registers control attachment points
   - Enables line connections
   - Supports gap calculations

4. **MsdDebugRenderer**
   - Highlights control overlays
   - Shows attachment points
   - Displays boundaries

5. **ThemeManager**
   - Provides theme tokens
   - Enables theme inheritance
   - Supports custom styling

---

## Debug & Introspection

### Debug Interface Access

```javascript
// Access controls renderer
window.cblcars.debug.msd.systems.controlsRenderer

// View all control elements
window.cblcars.debug.msd.systems.controlsRenderer.controlElements

// Check if HASS is set
window.cblcars.debug.msd.systems.controlsRenderer.hass

// View last render arguments
window.cblcars.debug.msd.systems.controlsRenderer.lastRenderArgs

// Get control element by ID
const element = window.cblcars.debug.msd.systems.controlsRenderer
  .controlElements.get('control1')

// Inspect card configuration
element.querySelector('[class*="card"]')?.getConfig?.()
```

### Debug Features

- **Element Tracking** - Map of all control overlays
- **HASS Inspection** - Current Home Assistant context
- **Render History** - Last render arguments and signature
- **Error Logging** - Comprehensive error messages
- **Visual Highlighting** - Debug overlay boundaries
- **Attachment Visualization** - Shows 9-point grid

---

## Technical Specifications

### Control Overlay Schema

```yaml
type: control
id: unique_id
card:
  type: custom:card-name | built-in-type
  config:
    # Card-specific configuration
    entity: sensor.example
    name: "Example"
position: [x, y]  # ViewBox coordinates
size: [width, height]  # ViewBox units
z_index: 1000  # Optional layering
```

### Required Files

| File | Purpose |
|------|---------|
| `MsdControlsRenderer.js` | Main renderer implementation |
| `SystemsManager.js` | Renderer initialization |
| `AdvancedRenderer.js` | Attachment point delegation |
| `OverlaysPanel.js` | Debug highlighting support |

---

## Summary

### Key Capabilities

- ✅ **Universal Card Embedding** - Any HA card works
- ✅ **SVG Integration** - foreignObject for precise positioning
- ✅ **HASS Propagation** - Automatic context updates
- ✅ **Line Attachments** - Full 9-point system
- ✅ **Performance** - Optimized rendering and caching
- ✅ **Debug Support** - Comprehensive introspection

### Architecture Benefits

**For Users:**
- Embed any HA card in MSD canvas
- Full interactivity maintained
- Consistent with other overlays

**For Developers:**
- Clean separation of concerns
- Type-agnostic card support
- Extensible architecture

---

**Related Documentation:**
- [Advanced Renderer](advanced-renderer.md) - SVG rendering system
- [Systems Manager](systems-manager.md) - System orchestration
- [Attachment Point Manager](attachment-point-manager.md) - Line attachment system
- [User Guide: Control Overlays](../../user-guide/configuration/overlays/control-overlay.md) - Usage guide
