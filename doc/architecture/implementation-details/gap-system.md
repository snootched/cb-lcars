# Gap System

> **Precise control over line attachment offsets**
> The gap system allows you to offset lines from overlay attachment points using `anchor_gap` and `attach_gap`.

---

## 🎯 Overview

When connecting overlays with lines, you often want the line to start or end with some spacing from the overlay edge. The gap system provides two complementary properties:

- **`anchor_gap`**: Offset at the **source** (starting point) of the line
- **`attach_gap`**: Offset at the **destination** (ending point) of the line

```yaml
overlays:
  - id: line1
    type: line
    anchor: button1
    anchor_gap: 20        # 20px offset from button1
    attach_to: button2
    attach_gap: 30        # 30px offset from button2
```

---

## 📐 How Gaps Work

### Visual Example

```
Without gaps:
┌─────────┐                    ┌─────────┐
│ button1 ├────────────────────┤ button2 │
└─────────┘                    └─────────┘

With anchor_gap: 20, attach_gap: 30:
┌─────────┐                          ┌─────────┐
│ button1 │   ─────────────────────  │ button2 │
└─────────┘                          └─────────┘
          ^20px                   30px^
```

### Directional Behavior

Gaps are applied **outward** from the overlay based on the attachment side:

| Side | Gap Direction |
|------|---------------|
| `left` | Leftward (negative X) |
| `right` | Rightward (positive X) |
| `top` | Upward (negative Y) |
| `bottom` | Downward (positive Y) |

**Example:**
```yaml
- id: button1
  type: button
  position: [100, 100]
  size: [200, 50]

- id: line1
  type: line
  anchor: button1
  anchor_side: right  # Attaches to right side of button1
  anchor_gap: 30      # 30px to the RIGHT of button1's right edge
  attach_to: button2
```

**Result:** Line starts at `[330, 125]` instead of `[300, 125]`
- Right edge of button1: `100 + 200 = 300`
- With 30px gap: `300 + 30 = 330`

---

## 🔧 Configuration

### anchor_gap

**Type:** `number`
**Default:** `0`
**Units:** Pixels

Offset the line's starting point from the source anchor.

```yaml
anchor_gap: 20  # 20px offset from source
```

### attach_gap

**Type:** `number`
**Default:** `0`
**Units:** Pixels

Offset the line's ending point from the destination attachment point.

```yaml
attach_gap: 30  # 30px offset from destination
```

### Directional Gaps (Advanced)

For asymmetric offsets, use directional properties:

```yaml
anchor_gap_x: 20   # Horizontal offset only
anchor_gap_y: 10   # Vertical offset only

attach_gap_x: 15
attach_gap_y: 25
```

**Note:** If `anchor_gap_x` or `anchor_gap_y` are specified, they override `anchor_gap` for that axis.

---

## 📋 Complete Example

```yaml
overlays:
  # Source button
  - id: source_button
    type: button
    position: [100, 100]
    size: [200, 50]
    content: Source
    style:
      lcars_button_preset: rounded-pill
      lcars_color: var(--lcars-orange)

  # Destination button
  - id: dest_button
    type: button
    position: [500, 100]
    size: [200, 50]
    content: Destination
    style:
      lcars_button_preset: rounded-pill
      lcars_color: var(--lcars-blue)

  # Connecting line with gaps
  - id: connection_line
    type: line
    anchor: source_button
    anchor_side: right      # Auto-determined if omitted
    anchor_gap: 20          # 20px from source button
    attach_to: dest_button
    attach_side: left       # Auto-determined if omitted
    attach_gap: 25          # 25px from destination button
    route: auto
    style:
      stroke: var(--lcars-white)
      stroke-width: 2
```

---

## 🎨 Use Cases

### 1. Visual Breathing Room
Add space between overlays for cleaner layouts:

```yaml
- id: label_line
  anchor: label_text
  anchor_gap: 10
  attach_to: value_display
  attach_gap: 10
```

### 2. Connector Dots/Arrows
Leave room for decorative elements at line endpoints:

```yaml
- id: connection
  anchor: node1
  anchor_gap: 15  # Room for connector dot
  attach_to: node2
  attach_gap: 15
```

### 3. Multi-Line Offsets
Create parallel lines with different gaps:

```yaml
- id: line1
  anchor: source
  anchor_gap: 10
  attach_to: dest
  attach_gap: 10

- id: line2
  anchor: source
  anchor_gap: 20  # Offset further
  attach_to: dest
  attach_gap: 20
```

### 4. Status Indicators
Position lines around status indicators:

```yaml
- id: status_line
  anchor: status_grid
  anchor_side: left
  anchor_gap: 30  # Clear of grid border
  attach_to: control_button
```

---

## 🏗️ Implementation Details

### How Gaps Are Applied

1. **Attachment Point Resolution**
   - AdvancedRenderer computes attachment points for overlays
   - Points stored in AttachmentPointManager

2. **Gap Application**
   - `_applyAttachGap()` method applies gap offset
   - Direction determined by attachment side
   - Gap-adjusted coordinate computed

3. **Virtual Anchor Creation**
   - Gap-adjusted points stored as virtual anchors
   - Format: `overlayId.side` (e.g., `button1.right`)
   - Virtual anchors used by LineOverlay for rendering

4. **LineOverlay Resolution**
   - LineOverlay queries virtual anchors from AttachmentPointManager
   - Pre-computed gap-adjusted coordinates returned
   - Line rendered with correct offsets

### Key Functions

**`_applyAttachGap(point, side, config, bbox)`**
Location: `src/msd/renderer/AdvancedRenderer.js`

Applies gap offset to an attachment point based on side and configuration.

**Parameters:**
- `point`: `[x, y]` - Base attachment point
- `side`: `string` - Attachment side (left, right, top, bottom, etc.)
- `config`: `object` - Contains `anchor_gap`, `attach_gap`, or directional variants
- `bbox`: `object` - Overlay bounding box (for validation)

**Returns:** `[x + dx, y + dy]` - Gap-adjusted coordinate

**Example:**
```javascript
const basePt = [300, 125];      // Right side of button
const side = 'right';
const config = { anchor_gap: 20 };
const gapPt = this._applyAttachGap(basePt, side, config, bbox);
// Result: [320, 125]  (moved 20px to the right)
```

---

## 🐛 Troubleshooting

### Gap Not Applied

**Problem:** Line connects directly to overlay edge, ignoring gap.

**Causes:**
1. Gap property misspelled (`anchor_gap` vs `anchorGap` - both work)
2. Gap value is `0` or not a number
3. Attachment side is `center` (gaps don't apply to center)

**Solution:**
```yaml
# Correct:
anchor_gap: 20

# Also correct (camelCase):
anchorGap: 20

# Won't work - center has no direction:
anchor_side: center
anchor_gap: 20  # Ignored
```

### Gap Goes Wrong Direction

**Problem:** Gap moves line toward overlay instead of away.

**Cause:** Attachment side is opposite of intended.

**Solution:** Explicitly set `anchor_side` or `attach_side`:
```yaml
anchor: button1
anchor_side: right  # Force right side
anchor_gap: 20      # Will go rightward
```

### Asymmetric Gap Needed

**Problem:** Need different horizontal and vertical offsets.

**Solution:** Use directional properties:
```yaml
anchor_gap_x: 30  # 30px horizontal
anchor_gap_y: 10  # 10px vertical
```

---

## 🔗 Related Documentation

- [Line Overlay Configuration](../../user-guide/configuration/overlays/line.md)
- [Attachment Point Manager](../components/attachment-point-manager.md)
- [Auto-Attach System](auto-attach.md)
- [Virtual Anchors](virtual-anchors.md)
- [Connecting Overlays Guide](../../user-guide/guides/connecting-overlays.md)

---

## 📝 History

**October 2025:**
- Implemented `anchor_gap` for source-side offsets
- Fixed `attach_gap` font stabilization race condition
- Extended `_applyAttachGap()` to handle both gap types
- Added bbox validation to prevent invalid updates

**See:** [maintenance/2025-10/](../../maintenance/2025-10/) for detailed fix history

---

**Last Updated:** October 26, 2025
**Version:** 2025.10.1-fuk.42-69
