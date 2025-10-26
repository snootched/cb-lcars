# Quick Start Guide

> **Get your LCARS interface up and running in 5 minutes!**
> This guide will walk you through the fastest path to your first CB-LCARS card.

---

## 🚀 5-Minute Startup Sequence

```mermaid
graph LR
    A[Install<br/>Dependencies] --> B[Setup<br/>Theme]
    B --> C[Install<br/>CB-LCARS]
    C --> D[Add Your<br/>First Card]
    D --> E[🎉 Success!]

    style A fill:#4d94ff,stroke:#0066cc,color:#fff
    style B fill:#4d94ff,stroke:#0066cc,color:#fff
    style C fill:#4d94ff,stroke:#0066cc,color:#fff
    style D fill:#4d94ff,stroke:#0066cc,color:#fff
    style E fill:#00cc66,stroke:#009944,color:#fff
```

---

## Prerequisites

Before starting, make sure you have:
- ✅ Home Assistant running (2023.1 or newer recommended)
- ✅ HACS installed and configured
- ✅ Admin access to your Home Assistant instance

---

## Step 1: Install Dependencies (2 minutes)

CB-LCARS requires a few other custom cards to work properly.

### Required HACS Cards

```mermaid
graph TD
    Start([Install from HACS]) --> Theme[HA-LCARS Theme<br/>Required]
    Start --> Slider[my-slider-v2<br/>Required]
    Start --> CardMod[lovelace-card-mod<br/>Required]

    Theme --> Check{All installed?}
    Slider --> Check
    CardMod --> Check

    Check -->|Yes| Next[✅ Continue to Step 2]
    Check -->|No| Start

    style Start fill:#4d94ff,stroke:#0066cc,color:#fff
    style Next fill:#00cc66,stroke:#009944,color:#fff
    style Theme fill:#ff9933,stroke:#cc6600
    style Slider fill:#ff9933,stroke:#cc6600
    style CardMod fill:#ff9933,stroke:#cc6600
```

**Quick Install:**

1. Open HACS → Frontend
2. Search and install:
   - `HA-LCARS` (theme)
   - `my-slider-v2`
   - `lovelace-card-mod`
3. Restart Home Assistant when prompted

> 💡 **Tip:** Need detailed instructions? See the [Installation Guide](installation.md).

---

## Step 2: Setup Theme (1 minute)

### Apply the LCARS Theme

1. Go to **Settings → Themes**
2. Find `LCARS Picard [cb-lcars]` (or any LCARS theme)
3. Set as your active theme

### Add Antonio Font (recommended)

Add this to your Home Assistant configuration:

```yaml
# configuration.yaml
frontend:
  themes: !include_dir_merge_named themes
  extra_module_url:
    - https://fonts.googleapis.com/css2?family=Antonio:wght@100..700&display=swap
```

> 📝 **Note:** CB-LCARS will load the font automatically if it's missing, but adding it yourself is faster.

---

## Step 3: Install CB-LCARS (1 minute)

### Add Repository & Install

[![Open your Home Assistant instance and show the add repository dialog](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=snootched&repository=cb-lcars)

**Manual Steps:**
1. Open HACS → Frontend
2. Click ⋮ (menu) → Custom repositories
3. Add: `https://github.com/snootched/cb-lcars`
4. Category: `Lovelace`
5. Click **Add**
6. Find "CB-LCARS" in HACS
7. Click **Download**
8. Restart Home Assistant

---

## Step 4: Add Your First Card (1 minute)

Let's create a simple header card to verify everything works!

### Quick Test Card

```mermaid
graph LR
    A[Open Dashboard] --> B[Edit Dashboard]
    B --> C[Add Card]
    C --> D[Choose Manual YAML]
    D --> E[Paste Example]
    E --> F[Save]
    F --> G[🎉 See Your Card!]

    style A fill:#4d94ff,stroke:#0066cc,color:#fff
    style G fill:#00cc66,stroke:#009944,color:#fff
```

**Copy-Paste Example:**

```yaml
type: custom:cb-lcars-elbow-card
cblcars_card_type: cb-lcars-header
name: "USS ENTERPRISE"
label: "NCC-1701-D"
```

**Expected Result:**

![Sample Header Card](../../../images/button_samples/cb-lcars-header.png)

> 🎉 **Success!** You should see a blue LCARS header with your text.

---

## What's Next?

Now that CB-LCARS is working, explore these guides:

### Next Steps Flow

```mermaid
graph TD
    Start([Your First Card Works!]) --> Choice{What interests you?}

    Choice -->|Learn basics| Tutorial[📖 First Card Tutorial<br/>Step-by-step guide]
    Choice -->|See examples| Examples[🎨 Example Gallery<br/>Copy-paste configs]
    Choice -->|Understand system| Concepts[🧠 Core Concepts<br/>How it works]

    Tutorial --> Advanced[🚀 Ready for more?]
    Examples --> Advanced
    Concepts --> Advanced

    Advanced --> Overlays[Overlay System]
    Advanced --> Data[DataSources]
    Advanced --> Themes[Theme Creation]

    style Start fill:#00cc66,stroke:#009944,color:#fff
    style Tutorial fill:#4d94ff,stroke:#0066cc,color:#fff
    style Examples fill:#4d94ff,stroke:#0066cc,color:#fff
    style Concepts fill:#4d94ff,stroke:#0066cc,color:#fff
    style Advanced fill:#ff9933,stroke:#cc6600,color:#fff
```

### Recommended Learning Path

1. **[First Card Tutorial](first-card.md)** - Create a complete LCARS interface (10 minutes)
2. **[Overlay System Guide](../configuration/overlays/README.md)** - Add dynamic elements
3. **[DataSource Guide](../configuration/datasources.md)** - Connect to Home Assistant entities
4. **[Example Gallery](../examples/)** - Browse copy-paste configurations

---

## Troubleshooting

### Card Doesn't Appear

```mermaid
graph TD
    Problem([Card not showing?]) --> Check1{Cleared cache?}
    Check1 -->|No| Clear[Clear browser cache<br/>Ctrl+Shift+R]
    Clear --> Check2
    Check1 -->|Yes| Check2{Restarted HA?}

    Check2 -->|No| Restart[Restart Home Assistant]
    Restart --> Check3
    Check2 -->|Yes| Check3{Check console?}

    Check3 --> Console[Open browser console<br/>F12]
    Console --> Errors{See errors?}

    Errors -->|Card not found| Reinstall[Reinstall CB-LCARS<br/>from HACS]
    Errors -->|Theme missing| Theme[Install HA-LCARS theme]
    Errors -->|Other error| Help[Ask for help<br/>GitHub Issues]

    style Problem fill:#ff3333,stroke:#cc0000,color:#fff
    style Help fill:#4d94ff,stroke:#0066cc,color:#fff
```

**Quick Fixes:**
- ✅ Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- ✅ Restart Home Assistant
- ✅ Check all dependencies are installed
- ✅ Verify LCARS theme is active
- ✅ Check browser console (F12) for errors

### Common Issues

| Problem | Solution |
|---------|----------|
| "Custom element doesn't exist" | Clear cache + restart HA |
| Wrong fonts | Add Antonio font resource |
| Colors don't match screenshots | Activate `LCARS Picard [cb-lcars]` theme |
| Card configuration invalid | Check YAML indentation |

---

## Getting Help

```mermaid
graph LR
    Question([Need Help?]) --> Search[🔍 Search Documentation]
    Question --> Examples[📚 Check Examples]
    Question --> Issues[🐛 GitHub Issues]
    Question --> Community[💬 HA Community]

    style Question fill:#ff9933,stroke:#cc6600,color:#fff
    style Search fill:#4d94ff,stroke:#0066cc,color:#fff
    style Examples fill:#4d94ff,stroke:#0066cc,color:#fff
    style Issues fill:#4d94ff,stroke:#0066cc,color:#fff
    style Community fill:#4d94ff,stroke:#0066cc,color:#fff
```

### Resources

- **[Documentation](../../README.md)** - Complete user guide
- **[GitHub Issues](https://github.com/snootched/cb-lcars/issues)** - Report bugs or ask questions
- **[Home Assistant Community](https://community.home-assistant.io/)** - General HA help
- **[Example Configs](../examples/)** - Working configurations to learn from

---

## Summary

**You did it!** 🎉

In just 5 minutes, you:
- ✅ Installed all dependencies
- ✅ Setup the LCARS theme
- ✅ Installed CB-LCARS
- ✅ Created your first card

**Ready for more?** Continue to the [First Card Tutorial](first-card.md) to build a complete LCARS interface!

---

**Navigation:**
- 📖 Next: [First Card Tutorial](first-card.md)
- 🏠 [Documentation Home](../../README.md)
- 🔧 [Installation Details](installation.md)
