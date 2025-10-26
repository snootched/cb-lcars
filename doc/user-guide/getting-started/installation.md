# Installation Guide

> **Complete installation instructions for CB-LCARS**
> Choose between HACS (recommended) or manual installation.

---

## 📋 Overview

```mermaid
graph TD
    Start([Choose Installation Method]) --> Method{Which method?}

    Method -->|Recommended| HACS[HACS Installation<br/>✅ Easy updates<br/>✅ One-click install]
    Method -->|Advanced| Manual[Manual Installation<br/>⚠️ Manual updates<br/>⚠️ More steps]

    HACS --> Deps[Install Dependencies]
    Manual --> Deps

    Deps --> Theme[Setup Theme]
    Theme --> Config[Configure CB-LCARS]
    Config --> Test[Test Installation]
    Test --> Done[🎉 Ready to use!]

    style Start fill:#4d94ff,stroke:#0066cc,color:#fff
    style HACS fill:#00cc66,stroke:#009944,color:#fff
    style Manual fill:#ff9933,stroke:#cc6600,color:#fff
    style Done fill:#00cc66,stroke:#009944,color:#fff
```

---

## Prerequisites

Before installing CB-LCARS, ensure you have:

- ✅ **Home Assistant** - Version 2023.1 or newer (recommended)
- ✅ **HACS Installed** - [Home Assistant Community Store](https://hacs.xyz/docs/setup/download)
- ✅ **Admin Access** - Ability to install custom components
- ✅ **Modern Browser** - Chrome, Firefox, Safari, or Edge (recent versions)

---

## Installation Method 1: HACS (Recommended)

### Why HACS?

- ✅ **Easy updates** - One-click updates when new versions release
- ✅ **Automatic setup** - Handles file placement and configuration
- ✅ **Dependency tracking** - Helps manage required cards
- ✅ **Community standard** - Most HA users use HACS

### HACS Installation Flow

```mermaid
sequenceDiagram
    participant User
    participant HACS
    participant GitHub
    participant HA as Home Assistant

    User->>HACS: Add custom repository
    HACS->>GitHub: Fetch repository info
    GitHub-->>HACS: Repository details
    HACS-->>User: Show CB-LCARS

    User->>HACS: Click Install
    HACS->>GitHub: Download latest release
    GitHub-->>HACS: CB-LCARS files
    HACS->>HA: Install to www/community/
    HACS-->>User: Installation complete

    User->>HA: Restart Home Assistant
    HA-->>User: CB-LCARS ready!
```

### Step-by-Step: HACS Installation

#### 1. Add CB-LCARS Repository

**Option A: One-Click (Easiest)**

[![Add Repository](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=snootched&repository=cb-lcars)

**Option B: Manual**

1. Open **HACS** from your Home Assistant sidebar
2. Click **Frontend** tab
3. Click ⋮ (three dots menu, top-right)
4. Select **Custom repositories**
5. Enter repository URL:
   ```
   https://github.com/snootched/cb-lcars
   ```
6. Category: **Lovelace**
7. Click **Add**

#### 2. Install CB-LCARS

1. In HACS → Frontend, search for "CB-LCARS"
2. Click on **CB-LCARS**
3. Click **Download** (bottom-right)
4. Select latest version (or specific version if needed)
5. Click **Download** again to confirm

#### 3. Restart Home Assistant

```mermaid
graph LR
    A[Settings] --> B[System]
    B --> C[Click Restart]
    C --> D[Confirm Restart]
    D --> E[Wait ~30-60 seconds]
    E --> F[✅ CB-LCARS loaded]

    style F fill:#00cc66,stroke:#009944,color:#fff
```

**Navigation:** Settings → System → Restart

---

## Installation Method 2: Manual Installation

### Manual Installation Flow

```mermaid
graph TD
    Start([Manual Installation]) --> Download[Download from GitHub]
    Download --> Extract[Extract ZIP file]
    Extract --> Copy[Copy to HA config]
    Copy --> Register[Register in HA]
    Register --> Restart[Restart HA]
    Restart --> Done[✅ Complete]

    style Start fill:#ff9933,stroke:#cc6600,color:#fff
    style Done fill:#00cc66,stroke:#009944,color:#fff
```

### Step-by-Step: Manual Installation

#### 1. Download CB-LCARS

1. Visit: [https://github.com/snootched/cb-lcars/releases](https://github.com/snootched/cb-lcars/releases)
2. Download the latest release ZIP file
3. Extract the ZIP to a temporary location

#### 2. File Structure

Your extracted files should look like:

```
cb-lcars/
├── dist/
│   └── cb-lcars.js          ← Main file
├── src/
│   └── *.yaml               ← Configuration files
└── README.md
```

#### 3. Copy Files to Home Assistant

```mermaid
graph LR
    A[CB-LCARS files] --> B[config/www/community/]
    B --> C[config/www/community/cb-lcars/]
    C --> D[cb-lcars.js<br/>+ config files]

    style A fill:#4d94ff,stroke:#0066cc,color:#fff
    style D fill:#00cc66,stroke:#009944,color:#fff
```

**Target location:**
```
/config/www/community/cb-lcars/
```

Copy the entire `cb-lcars` folder contents to this location.

#### 4. Register as Lovelace Resource

1. Go to **Settings → Dashboards**
2. Click ⋮ (three dots, top-right)
3. Select **Resources**
4. Click **+ Add Resource**
5. Enter:
   - **URL:** `/local/community/cb-lcars/cb-lcars.js`
   - **Type:** `JavaScript Module`
6. Click **Create**

#### 5. Restart Home Assistant

**Navigation:** Settings → System → Restart

---

## Required Dependencies

CB-LCARS needs these other custom components to work:

### Dependencies Installation Flow

```mermaid
graph TD
    Start([Install Dependencies]) --> Theme[HA-LCARS Theme]
    Start --> Slider[my-slider-v2]
    Start --> CardMod[lovelace-card-mod]

    Theme --> Check{All installed?}
    Slider --> Check
    CardMod --> Check

    Check -->|Yes| Config[Configure Theme]
    Check -->|No| Start

    Config --> Font[Add Antonio Font]
    Font --> Colors[Setup Color Scheme]
    Colors --> Done[✅ Ready!]

    style Start fill:#4d94ff,stroke:#0066cc,color:#fff
    style Theme fill:#ff9933,stroke:#cc6600
    style Slider fill:#ff9933,stroke:#cc6600
    style CardMod fill:#ff9933,stroke:#cc6600
    style Done fill:#00cc66,stroke:#009944,color:#fff
```

### 1. HA-LCARS Theme (Required)

**Repository:** [https://github.com/th3jesta/ha-lcars](https://github.com/th3jesta/ha-lcars)

**Install via HACS:**
1. HACS → Frontend
2. Search "HA-LCARS"
3. Install
4. Restart HA

**Why required?** Provides base LCARS styling, colors, and fonts.

### 2. my-slider-v2 (Required)

**Repository:** [https://github.com/AnthonMS/my-cards](https://github.com/AnthonMS/my-cards)

**Install via HACS:**
1. HACS → Frontend
2. Search "my-slider"
3. Install **my-slider-v2**
4. Restart HA

**Why required?** Powers the Multimeter card sliders and gauges.

### 3. lovelace-card-mod (Required)

**Repository:** [https://github.com/thomasloven/lovelace-card-mod](https://github.com/thomasloven/lovelace-card-mod)

**Install via HACS:**
1. HACS → Frontend
2. Search "card-mod"
3. Install
4. Restart HA

**Why required?** Enables Symbiont mode (card encapsulation) and advanced styling.

### 4. Optional: lovelace-layout-card

**Repository:** [https://github.com/thomasloven/lovelace-layout-card](https://github.com/thomasloven/lovelace-layout-card)

**Why optional?** Useful for advanced dashboard layouts, but not required by CB-LCARS.

---

## Theme Configuration

### Setup LCARS Theme

```mermaid
graph LR
    A[Install HA-LCARS] --> B[Add Antonio Font]
    B --> C[Copy CB-LCARS<br/>Color Scheme]
    C --> D[Activate Theme]
    D --> E[✅ Styled!]

    style E fill:#00cc66,stroke:#009944,color:#fff
```

### 1. Add Antonio Font

Add to your `configuration.yaml`:

```yaml
frontend:
  themes: !include_dir_merge_named themes
  extra_module_url:
    - https://fonts.googleapis.com/css2?family=Antonio:wght@100..700&display=swap
```

**Font Weights:**
- 100-200: Ultra-thin (Picard-era displays)
- 300-400: Normal text
- 500-700: Bold headers and labels

> 💡 **Note:** CB-LCARS includes Microgramma and Jeffries fonts automatically.

### 2. Install CB-LCARS Color Scheme

#### Theme Color Hierarchy

```mermaid
graph TD
    Base[HA-LCARS Base Theme] --> Custom[CB-LCARS Color Scheme]
    Custom --> Active[Active Theme Selection]

    Base -.->|Includes| TNG[TNG Colors]
    Base -.->|Includes| VOY[Voyager Colors]

    Custom -.->|Adds| Picard[Picard Colors<br/>Grays, Blues, Oranges]
    Custom -.->|Adds| Extra[Extra Options<br/>Greens, Yellows]

    Active --> Display[Your Dashboard]

    style Custom fill:#4d94ff,stroke:#0066cc,color:#fff
    style Display fill:#00cc66,stroke:#009944,color:#fff
```

#### Installation Steps

1. **Copy color scheme:**
   - Source: `ha-lcars-theme/cb-lcars-lcars.yaml` (in CB-LCARS repo)
   - Destination: Your HA-LCARS `lcars.yaml` file

2. **Location in Home Assistant:**
   ```
   /config/themes/lcars.yaml
   ```

3. **Add the theme definition:**
   Copy the entire `LCARS Picard [cb-lcars]` section from `cb-lcars-lcars.yaml`

4. **Activate theme:**
   - Settings → Themes
   - Select `LCARS Picard [cb-lcars]`
   - Set as default (optional)

#### Picard Color Scheme

![Picard Colors](../../../images/themes/lcars_picard_ii_colors.png)

**Color Palette:**
- **Grays** - Backgrounds, borders
- **Blues** - Primary interactive elements
- **Oranges** - Alerts, highlights
- **Greens** - Success states, active elements
- **Yellows** - Warnings, secondary actions

---

## File Structure After Installation

```mermaid
graph TD
    Config[config/] --> WWW[www/]
    Config --> Themes[themes/]

    WWW --> Community[community/]
    Community --> CBLCARS[cb-lcars/]

    CBLCARS --> JS[cb-lcars.js]
    CBLCARS --> YAML[*.yaml configs]

    Themes --> LCARS[lcars.yaml]
    LCARS --> Picard[LCARS Picard cb-lcars]

    style Config fill:#4d94ff,stroke:#0066cc,color:#fff
    style CBLCARS fill:#00cc66,stroke:#009944
    style Picard fill:#00cc66,stroke:#009944
```

**Expected structure:**

```
config/
├── www/
│   └── community/
│       └── cb-lcars/
│           ├── cb-lcars.js         ← Main JavaScript
│           └── src/                ← Configuration files
├── themes/
│   └── lcars.yaml                  ← Theme with CB-LCARS colors
└── configuration.yaml              ← Font reference
```

---

## Verification & Testing

### Installation Checklist

```mermaid
graph TD
    Start([Verify Installation]) --> Files{Files in place?}

    Files -->|Yes| Resource{Resource registered?}
    Files -->|No| Reinstall[Reinstall CB-LCARS]

    Resource -->|Yes| Deps{Dependencies installed?}
    Resource -->|No| Register[Register resource]

    Deps -->|Yes| Theme{Theme active?}
    Deps -->|No| InstallDeps[Install dependencies]

    Theme -->|Yes| Test[Create test card]
    Theme -->|No| ActivateTheme[Activate theme]

    Test --> Works{Card displays?}
    Works -->|Yes| Success[✅ Installation complete!]
    Works -->|No| Troubleshoot[Check troubleshooting]

    style Start fill:#4d94ff,stroke:#0066cc,color:#fff
    style Success fill:#00cc66,stroke:#009944,color:#fff
    style Troubleshoot fill:#ff3333,stroke:#cc0000,color:#fff
```

### Quick Test

Create this test card to verify installation:

```yaml
type: custom:cb-lcars-elbow-card
cblcars_card_type: cb-lcars-header
name: "INSTALLATION TEST"
label: "CB-LCARS"
```

**Expected:** Blue LCARS header with text.

---

## Troubleshooting

### Common Issues & Solutions

```mermaid
graph TD
    Problem([Installation Issue?]) --> Type{What's wrong?}

    Type -->|Card not found| NotFound[Check resource<br/>registration]
    Type -->|Wrong styling| WrongStyle[Verify theme<br/>is active]
    Type -->|Missing fonts| NoFonts[Add Antonio font<br/>resource]
    Type -->|Errors in console| Errors[Check browser<br/>console F12]

    NotFound --> Clear1[Clear cache +<br/>restart HA]
    WrongStyle --> Activate[Activate LCARS<br/>Picard theme]
    NoFonts --> AddFont[Add font to<br/>configuration.yaml]
    Errors --> CheckDeps[Verify all<br/>dependencies]

    Clear1 --> Retry{Fixed?}
    Activate --> Retry
    AddFont --> Retry
    CheckDeps --> Retry

    Retry -->|Yes| Success[✅ Working!]
    Retry -->|No| Help[Get help on<br/>GitHub]

    style Problem fill:#ff3333,stroke:#cc0000,color:#fff
    style Success fill:#00cc66,stroke:#009944,color:#fff
```

### Issue: "Custom element doesn't exist: cb-lcars-elbow-card"

**Causes:**
- Resource not registered
- Cache not cleared
- HA not restarted

**Solutions:**
1. Clear browser cache (Ctrl+Shift+R)
2. Verify resource registration in Settings → Dashboards → Resources
3. Restart Home Assistant
4. Check browser console (F12) for load errors

### Issue: Wrong colors or missing styling

**Causes:**
- Theme not active
- Wrong theme selected
- Theme not installed

**Solutions:**
1. Go to Settings → Themes
2. Verify HA-LCARS is installed
3. Select `LCARS Picard [cb-lcars]`
4. Hard refresh browser (Ctrl+Shift+R)

### Issue: Fonts look wrong

**Causes:**
- Antonio font not loaded
- Font resource missing
- Browser font cache

**Solutions:**
1. Add Antonio font to `configuration.yaml` (see Theme Configuration)
2. Clear browser cache
3. Check browser console for font load errors
4. CB-LCARS will auto-load fonts if missing (may be slower)

### Issue: Cards show but interactions don't work

**Causes:**
- Missing dependencies
- card-mod not installed
- JavaScript errors

**Solutions:**
1. Verify all dependencies installed (see Dependencies section)
2. Check browser console for errors
3. Reinstall CB-LCARS and dependencies
4. Clear cache + restart HA

---

## Updating CB-LCARS

### HACS Updates

```mermaid
sequenceDiagram
    participant User
    participant HACS
    participant GitHub
    participant HA as Home Assistant

    HACS->>GitHub: Check for updates
    GitHub-->>HACS: New version available
    HACS->>User: 🔔 Update notification

    User->>HACS: Click Update
    HACS->>GitHub: Download new version
    GitHub-->>HACS: CB-LCARS files
    HACS->>HA: Replace old files

    User->>HA: Restart Home Assistant
    HA-->>User: ✅ Updated!
```

**Update Process:**
1. HACS will notify you of updates
2. Go to HACS → CB-LCARS
3. Click **Update**
4. Restart Home Assistant
5. Clear browser cache

### Manual Updates

1. Download latest release from GitHub
2. Delete old `cb-lcars` folder
3. Copy new files to `/config/www/community/cb-lcars/`
4. Restart Home Assistant
5. Clear browser cache

---

## Uninstallation

If you need to remove CB-LCARS:

### HACS Uninstall

```mermaid
graph LR
    A[HACS → CB-LCARS] --> B[Click Remove]
    B --> C[Confirm removal]
    C --> D[Restart HA]
    D --> E[✅ Uninstalled]

    style E fill:#00cc66,stroke:#009944,color:#fff
```

1. HACS → Frontend → CB-LCARS
2. Click ⋮ (menu) → Remove
3. Confirm removal
4. Restart Home Assistant

### Manual Uninstall

1. Delete `/config/www/community/cb-lcars/` folder
2. Remove resource registration (Settings → Dashboards → Resources)
3. Remove any CB-LCARS cards from dashboards
4. Restart Home Assistant

---

## Next Steps

**Installation complete!** 🎉

Now that CB-LCARS is installed:

1. **[Quick Start Guide](quickstart.md)** - Create your first card in 5 minutes
2. **[First Card Tutorial](first-card.md)** - Build a complete interface
3. **[Overlay System](../configuration/overlays/README.md)** - Add dynamic elements
4. **[Example Gallery](../examples/)** - Browse configurations

---

**Navigation:**
- 🏠 [Documentation Home](../../README.md)
- 🚀 [Quick Start](quickstart.md)
- 📖 [First Card Tutorial](first-card.md)
- 🎨 [Example Gallery](../examples/)
