# First Card Tutorial

> **Build your first complete LCARS interface in 10 minutes**
> This step-by-step tutorial will guide you from a simple card to a functional LCARS panel.

---

## 🎯 What You'll Build

By the end of this tutorial, you'll create:
- ✅ LCARS header with ship name
- ✅ Interactive button that controls a light
- ✅ Status text showing sensor data
- ✅ LCARS footer completing the frame

```mermaid
graph TD
    Start([Empty Dashboard]) --> Step1[Step 1: Basic Header]
    Step1 --> Step2[Step 2: Add Button]
    Step2 --> Step3[Step 3: Add Status Text]
    Step3 --> Step4[Step 4: Add Footer]
    Step4 --> Step5[Step 5: Connect Data]
    Step5 --> Done[🎉 Complete LCARS Panel!]

    style Start fill:#4d94ff,stroke:#0066cc,color:#fff
    style Done fill:#00cc66,stroke:#009944,color:#fff
```

**Time Required:** ~10 minutes
**Difficulty:** Beginner
**Prerequisites:** CB-LCARS installed ([Installation Guide](installation.md))

---

## Tutorial Structure

This tutorial follows a **progressive enhancement** approach:

```mermaid
graph LR
    A[Simple<br/>Static Card] --> B[Add<br/>Styling]
    B --> C[Add<br/>Interaction]
    C --> D[Connect<br/>Live Data]
    D --> E[Polish &<br/>Enhance]

    style A fill:#4d94ff,stroke:#0066cc,color:#fff
    style E fill:#00cc66,stroke:#009944,color:#fff
```

Each step builds on the previous one, so you can:
- ✅ Stop at any level and have a working card
- ✅ Understand what each property does
- ✅ Customize as you go
- ✅ Learn progressively

---

## Step 1: Create a Basic Header

Let's start with the simplest possible LCARS card.

### 1.1 Open Dashboard Editor

```mermaid
graph LR
    A[Open Dashboard] --> B[Click Edit<br/>top-right]
    B --> C[Click + Add Card]
    C --> D[Scroll to bottom]
    D --> E[Choose Manual YAML]

    style A fill:#4d94ff,stroke:#0066cc,color:#fff
    style E fill:#00cc66,stroke:#009944,color:#fff
```

1. Open your Home Assistant dashboard
2. Click **Edit** (pencil icon, top-right)
3. Click **+ Add Card**
4. Scroll to bottom
5. Select **Manual** card (for YAML editing)

### 1.2 Paste Basic Header

```yaml
type: custom:cb-lcars-elbow-card
cblcars_card_type: cb-lcars-header
name: "USS ENTERPRISE"
```

**Save the card.** You should see:

![Basic Header](../../../images/button_samples/cb-lcars-header.png)

### Understanding the Code

```mermaid
graph TD
    Type[type: custom:cb-lcars-elbow-card] --> Card[Tells HA to use<br/>CB-LCARS elbow card]
    CardType[cblcars_card_type:<br/>cb-lcars-header] --> Style[Specifies header style<br/>with elbow corner]
    Name[name: USS ENTERPRISE] --> Text[Main text displayed<br/>on the card]

    style Type fill:#4d94ff,stroke:#0066cc,color:#fff
    style CardType fill:#4d94ff,stroke:#0066cc,color:#fff
    style Name fill:#4d94ff,stroke:#0066cc,color:#fff
```

**Key Properties:**
- `type` - Which card to use (always `custom:cb-lcars-elbow-card` for headers/footers)
- `cblcars_card_type` - Which LCARS style (header, footer, button, etc.)
- `name` - Text to display on the card

### 1.3 Add a Label

Let's add more detail:

```yaml
type: custom:cb-lcars-elbow-card
cblcars_card_type: cb-lcars-header
name: "USS ENTERPRISE"
label: "NCC-1701-D"
```

**Result:** You now have a ship name and registry number!

---

## Step 2: Add an Interactive Button

Now let's add a button that can control something.

### 2.1 Card Layout Concept

```mermaid
graph TD
    Dashboard[Your Dashboard] --> Layout[Layout/Grid]
    Layout --> Header[Header Card<br/>row 1]
    Layout --> Button[Button Card<br/>row 2 NEW!]

    style Button fill:#00cc66,stroke:#009944,color:#fff
```

### 2.2 Create Button Card

**Add a new card** (same process as before):

```yaml
type: custom:cb-lcars-button-card
cblcars_card_type: cb-lcars-button
name: "LIGHTS"
```

**Result:** A basic LCARS button!

### 2.3 Connect to Home Assistant Entity

Let's make it control a light:

```yaml
type: custom:cb-lcars-button-card
cblcars_card_type: cb-lcars-button
entity: light.living_room
name: "LIVING ROOM"
show_state: true
tap_action:
  action: toggle
```

**Replace `light.living_room` with one of your entities!**

### Understanding Button Properties

```mermaid
graph TD
    Entity[entity: light.living_room] --> Connect[Connects to HA entity<br/>monitors state]
    ShowState[show_state: true] --> Display[Shows ON/OFF<br/>below button]
    TapAction[tap_action: toggle] --> Action[Click to toggle<br/>light on/off]

    style Entity fill:#ff9933,stroke:#cc6600,color:#fff
    style ShowState fill:#ff9933,stroke:#cc6600,color:#fff
    style TapAction fill:#ff9933,stroke:#cc6600,color:#fff
```

### 2.4 Add Icon

Make it more visual:

```yaml
type: custom:cb-lcars-button-card
cblcars_card_type: cb-lcars-button
entity: light.living_room
name: "LIVING ROOM"
icon: mdi:lightbulb
show_state: true
tap_action:
  action: toggle
```

**Icon changes based on state!** (on = bright, off = dim)

---

## Step 3: Add Status Text

Display live sensor data with text overlays.

### 3.1 Text Card Concept

```mermaid
graph LR
    Entity[HA Sensor] --> DataSource[CB-LCARS<br/>monitors value]
    DataSource --> Update[Auto-updates<br/>when changes]
    Update --> Display[Displays on<br/>your card]

    style Entity fill:#4d94ff,stroke:#0066cc,color:#fff
    style Display fill:#00cc66,stroke:#009944,color:#fff
```

### 3.2 Simple Text Card

Add another card:

```yaml
type: custom:cb-lcars-text-card
cblcars_card_type: cb-lcars-text
entity: sensor.temperature_living_room
name: "TEMPERATURE"
show_state: true
```

**Replace with your sensor entity!**

### 3.3 Format the Value

Add units and formatting:

```yaml
type: custom:cb-lcars-text-card
cblcars_card_type: cb-lcars-text
entity: sensor.temperature_living_room
name: "TEMPERATURE"
show_state: true
state_display: "[[[return `${entity.state}°C`]]]"
```

**Now shows:** "22.5°C" instead of just "22.5"

---

## Step 4: Complete the Frame with Footer

LCARS interfaces have headers AND footers for that classic look.

### 4.1 Add Footer Card

```yaml
type: custom:cb-lcars-elbow-card
cblcars_card_type: cb-lcars-footer
name: "DECK 1"
label: "MAIN BRIDGE"
```

### 4.2 Current Layout

```mermaid
graph TD
    Panel[Your LCARS Panel] --> Header[Header<br/>USS ENTERPRISE<br/>NCC-1701-D]
    Panel --> Button[Button<br/>LIVING ROOM<br/>toggle light]
    Panel --> Text[Text<br/>TEMPERATURE<br/>22.5°C]
    Panel --> Footer[Footer<br/>DECK 1<br/>MAIN BRIDGE]

    style Panel fill:#4d94ff,stroke:#0066cc,color:#fff
    style Header fill:#00cc66,stroke:#009944
    style Button fill:#00cc66,stroke:#009944
    style Text fill:#00cc66,stroke:#009944
    style Footer fill:#00cc66,stroke:#009944
```

**You now have a complete LCARS frame!**

---

## Step 5: Add Color and Polish

Let's make it look more authentic.

### 5.1 Card Color System

```mermaid
graph LR
    Theme[LCARS Theme] --> Colors[Color Variables]
    Colors --> Orange[--lcars-orange<br/>Alerts/Actions]
    Colors --> Blue[--lcars-blue<br/>Standard/Status]
    Colors --> Red[--lcars-red<br/>Warnings]
    Colors --> Gold[--lcars-gold<br/>Important]

    style Orange fill:#ff9933,stroke:#cc6600,color:#fff
    style Blue fill:#4d94ff,stroke:#0066cc,color:#fff
    style Red fill:#ff3333,stroke:#cc0000,color:#fff
    style Gold fill:#ffcc00,stroke:#cc9900
```

### 5.2 Add Colors to Header

```yaml
type: custom:cb-lcars-elbow-card
cblcars_card_type: cb-lcars-header
name: "USS ENTERPRISE"
label: "NCC-1701-D"
styles:
  card:
    - --lcars-card-color: var(--lcars-orange)
```

### 5.3 Color the Button

```yaml
type: custom:cb-lcars-button-card
cblcars_card_type: cb-lcars-button
entity: light.living_room
name: "LIVING ROOM"
icon: mdi:lightbulb
show_state: true
tap_action:
  action: toggle
styles:
  card:
    - --lcars-card-color: var(--lcars-blue)
```

### 5.4 Style the Footer

```yaml
type: custom:cb-lcars-elbow-card
cblcars_card_type: cb-lcars-footer
name: "DECK 1"
label: "MAIN BRIDGE"
styles:
  card:
    - --lcars-card-color: var(--lcars-gold)
```

---

## Complete Example

Here's the full configuration for all cards:

### Full Dashboard YAML

```yaml
# Header Card
- type: custom:cb-lcars-elbow-card
  cblcars_card_type: cb-lcars-header
  name: "USS ENTERPRISE"
  label: "NCC-1701-D"
  styles:
    card:
      - --lcars-card-color: var(--lcars-orange)

# Button Card
- type: custom:cb-lcars-button-card
  cblcars_card_type: cb-lcars-button
  entity: light.living_room
  name: "LIVING ROOM"
  icon: mdi:lightbulb
  show_state: true
  tap_action:
    action: toggle
  styles:
    card:
      - --lcars-card-color: var(--lcars-blue)

# Text Card
- type: custom:cb-lcars-text-card
  cblcars_card_type: cb-lcars-text
  entity: sensor.temperature_living_room
  name: "TEMPERATURE"
  show_state: true
  state_display: "[[[return `${entity.state}°C`]]]"

# Footer Card
- type: custom:cb-lcars-elbow-card
  cblcars_card_type: cb-lcars-footer
  name: "DECK 1"
  label: "MAIN BRIDGE"
  styles:
    card:
      - --lcars-card-color: var(--lcars-gold)
```

**Remember:** Replace entity IDs with your own!

---

## Progressive Enhancement Examples

Want to go further? Here are some enhancements:

### Enhancement 1: Dynamic Button Colors

Make button color match light color:

```yaml
type: custom:cb-lcars-button-card
cblcars_card_type: cb-lcars-button
entity: light.living_room
name: "LIVING ROOM"
icon: mdi:lightbulb
show_state: true
color: auto  # Matches light color!
tap_action:
  action: toggle
```

### Enhancement 2: Conditional Styling

Change color based on state:

```yaml
type: custom:cb-lcars-text-card
cblcars_card_type: cb-lcars-text
entity: sensor.temperature_living_room
name: "TEMPERATURE"
show_state: true
state_display: "[[[return `${entity.state}°C`]]]"
state:
  - value: 0
    operator: "<"
    styles:
      card:
        - --lcars-card-color: var(--lcars-blue)  # Cold
  - value: 25
    operator: ">"
    styles:
      card:
        - --lcars-card-color: var(--lcars-red)  # Hot
```

### Enhancement 3: Animations

Add blink animation for alerts:

```yaml
type: custom:cb-lcars-button-card
cblcars_card_type: cb-lcars-button
entity: binary_sensor.door_open
name: "DOOR STATUS"
icon: mdi:door
show_state: true
state:
  - value: "on"
    styles:
      card:
        - animation: blink 1s infinite
```

---

## Learning Path

```mermaid
graph TD
    Start([You are here!<br/>Basic cards working]) --> Next{What's next?}

    Next -->|Learn concepts| Overlay[Overlay System<br/>Advanced layouts]
    Next -->|Connect data| DataSource[DataSources<br/>Live data integration]
    Next -->|See examples| Gallery[Example Gallery<br/>Copy-paste configs]
    Next -->|Deep dive| Advanced[Advanced Topics<br/>Themes & validation]

    Overlay --> Master[Master Builder!]
    DataSource --> Master
    Gallery --> Master
    Advanced --> Master

    style Start fill:#00cc66,stroke:#009944,color:#fff
    style Master fill:#ffcc00,stroke:#cc9900
```

### Recommended Next Steps

**Level 2: Understand the System**
1. **[Overlay System Guide](../configuration/overlays/README.md)** - How overlays work
2. **[DataSource Guide](../configuration/datasources.md)** - Connecting to HA entities

**Level 3: More Examples**
3. **[Example Gallery](../examples/)** - Browse working configurations
4. **[Button Examples](../configuration/overlays/button-overlay.md)** - More button patterns

**Level 4: Advanced Topics**
5. **[Theme Creation](../advanced/theme_creation_tutorial.md)** - Create custom color schemes
6. **[Style Priority](../advanced/style-priority.md)** - Control style resolution
7. **[Actions](../advanced/msd-actions.md)** - Advanced button actions

---

## Common Patterns

### Pattern: Sensor Grid

Display multiple sensors in a grid:

```yaml
# Temperature
- type: custom:cb-lcars-text-card
  cblcars_card_type: cb-lcars-text
  entity: sensor.temperature
  name: "TEMP"

# Humidity
- type: custom:cb-lcars-text-card
  cblcars_card_type: cb-lcars-text
  entity: sensor.humidity
  name: "HUMIDITY"

# Pressure
- type: custom:cb-lcars-text-card
  cblcars_card_type: cb-lcars-text
  entity: sensor.pressure
  name: "PRESSURE"
```

### Pattern: Control Panel

Group related controls:

```yaml
# Header
- type: custom:cb-lcars-elbow-card
  cblcars_card_type: cb-lcars-header
  name: "LIGHTING CONTROL"

# Light buttons
- type: custom:cb-lcars-button-card
  entity: light.room_1
  name: "ROOM 1"
  tap_action: {action: toggle}

- type: custom:cb-lcars-button-card
  entity: light.room_2
  name: "ROOM 2"
  tap_action: {action: toggle}

# Footer
- type: custom:cb-lcars-elbow-card
  cblcars_card_type: cb-lcars-footer
  name: "DECK 2"
```

### Pattern: Status Panel

Monitor system status:

```yaml
# Header
- type: custom:cb-lcars-elbow-card
  cblcars_card_type: cb-lcars-header
  name: "SYSTEM STATUS"

# Status indicators
- type: custom:cb-lcars-text-card
  entity: binary_sensor.door
  name: "MAIN DOOR"
  show_state: true

- type: custom:cb-lcars-text-card
  entity: sensor.battery_level
  name: "POWER LEVEL"
  show_state: true

# Footer
- type: custom:cb-lcars-elbow-card
  cblcars_card_type: cb-lcars-footer
  name: "ALL SYSTEMS NOMINAL"
```

---

## Troubleshooting

### Card doesn't update

```mermaid
graph TD
    Problem([Card not updating?]) --> Check1{Entity exists?}
    Check1 -->|No| Fix1[Check entity ID<br/>in Developer Tools]
    Check1 -->|Yes| Check2{HA updating?}

    Check2 -->|No| Fix2[Check sensor<br/>is working]
    Check2 -->|Yes| Check3{Browser cache?}

    Check3 --> Fix3[Hard refresh<br/>Ctrl+Shift+R]

    Fix1 --> Retry{Fixed?}
    Fix2 --> Retry
    Fix3 --> Retry

    Retry -->|Yes| Success[✅ Working!]
    Retry -->|No| Console[Check browser<br/>console F12]

    style Problem fill:#ff3333,stroke:#cc0000,color:#fff
    style Success fill:#00cc66,stroke:#009944,color:#fff
```

### Common Issues

| Problem | Solution |
|---------|----------|
| "Entity not found" | Check entity ID in Developer Tools → States |
| Card shows "Unavailable" | Entity might be offline, check its state |
| Button doesn't toggle | Verify `tap_action` is set correctly |
| Colors don't match | Make sure LCARS theme is active |
| Card looks different | Check `cblcars_card_type` is spelled correctly |

### Getting Help

**Before asking for help:**
1. ✅ Check entity IDs are correct (Developer Tools → States)
2. ✅ Verify LCARS theme is active
3. ✅ Clear browser cache (Ctrl+Shift+R)
4. ✅ Check browser console for errors (F12)
5. ✅ Compare your config with examples in this tutorial

**Where to get help:**
- 📖 [Documentation](../../README.md)
- 🐛 [GitHub Issues](https://github.com/snootched/cb-lcars/issues)
- 💬 [Home Assistant Community](https://community.home-assistant.io/)

---

## Summary

**Congratulations!** 🎉

You've learned:
- ✅ How to create LCARS headers and footers
- ✅ How to add interactive buttons
- ✅ How to display live sensor data
- ✅ How to apply colors and styling
- ✅ Progressive enhancement techniques

### Your LCARS Journey

```mermaid
graph LR
    A[✅ First Card<br/>Complete] --> B[📖 Learn<br/>Concepts]
    B --> C[🎨 Browse<br/>Examples]
    C --> D[🚀 Build<br/>Dashboard]
    D --> E[🌟 Master<br/>LCARS]

    style A fill:#00cc66,stroke:#009944,color:#fff
    style E fill:#ffcc00,stroke:#cc9900
```

---

**What's Next?**

Choose your path:
- **[Overlay System](../configuration/overlays/README.md)** - Understand how overlays work
- **[DataSources](../configuration/datasources.md)** - Master data connections
- **[Example Gallery](../examples/)** - See what's possible
- **[Advanced Topics](../advanced/README.md)** - Deep dive into features

**Happy building!** 🖖

---

**Navigation:**
- 🏠 [Documentation Home](../../README.md)
- 🚀 [Quick Start](quickstart.md)
- 🔧 [Installation](installation.md)
- 📚 [User Guide](../README.md)
