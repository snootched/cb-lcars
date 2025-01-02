***
**Note:**

This project is active development.


Functionality and configurations may change over time until stabilized.  Things may break - so you may not want to use this on your primary dashboard just yet.
***

<p align="center">

![cb-lcars](images/screenshots/cb-lcars-banner-3.gif)
</p>
<p align="center">
    <em>A collection of custom cards for building LCARS styled dashboards in Home Assistant</em>
</p>
<p align="left">
	<img src="https://img.shields.io/github/v/release/snootched/cb-lcars?display_name=release&logo=startrek&color=37a6d1" alt="release">
	<img src="https://img.shields.io/badge/license-MIT-37a6d1?logo=opensourceinitiative&logoColor=white" alt="license">
  <img src="https://img.shields.io/github/last-commit/snootched/cb-lcars?style=default&logo=git&logoColor=white&color=37a6d1" alt="last-commit">
<p>
<p align="center">
	<!-- default option, no dependency badges. -->
</p>


- [Breaking Changes](#breaking-changes)
- [Installation - Make it so!](#installation---make-it-so)
    - [1. Dependencies and Extras](#1-dependencies-and-extras)
    - [2. HA-LCARS Theme - Setup and Customizations](#2-ha-lcars-theme---setup-and-customizations)
      - [Font](#font)
      - [Customized *CB-LCARS* Color Scheme](#customized-cb-lcars-color-scheme)
    - [3. Install CB-LCARS from HACS](#3-install-cb-lcars-from-hacs)
      - [4. Engage!](#4-engage)
- [Overview](#overview)
    - [What is this?](#what-is-this)
    - [What it isn't...](#what-it-isnt)
    - [What can be done...](#what-can-be-done)
- [States](#states)
- [CB-LCARS Cards](#cb-lcars-cards)
  - [LCARS Elbows](#lcars-elbows)
    - [`type: custom:cb-lcars-elbow-card`](#type-customcb-lcars-elbow-card)
    - [`type: custom:cb-lcars-double-elbow-card`](#type-customcb-lcars-double-elbow-card)
  - [LCARS Buttons](#lcars-buttons)
    - [`type: custom:cb-lcars-button-card`](#type-customcb-lcars-button-card)
  - [LCARS Multimeter (Sliders/Gauges)](#lcars-multimeter-slidersgauges)
    - [`type:cb-lcars-multimeter-card`](#typecb-lcars-multimeter-card)
  - [LCARS Label (Stylized Text)](#lcars-label-stylized-text)
    - [`type:cb-lcars-label-card`](#typecb-lcars-label-card)
  - [LCARS DPAD](#lcars-dpad)
    - [`type:cb-lcars-dpad-card`](#typecb-lcars-dpad-card)
- [Animations](#animations)
  - [Data Cascade](#data-cascade)
  - [Pulse Wave](#pulse-wave)
- [Screenshots](#screenshots)
      - [Button Samples](#button-samples)
      - [Sliders/Gauges](#slidersgauges)
      - [Row of sliders (Transporter controls? :grin:)](#row-of-sliders-transporter-controls-grin)
      - [Room Selector with Sliders for Lights](#room-selector-with-sliders-for-lights)
    - [Some Dashboard possibilities...](#some-dashboard-possibilities)
- [Acknowledgements \& Thanks](#acknowledgements--thanks)
- [License](#license)


<br>

---

# Breaking Changes

If you have used the previous version whereby you had to copy the button card templates from github into your lovelace dashboard yaml code - you _will_ run into errors with the latest versions.

If you can - it's advisable to start with a fresh dashboard.

<br>

<details closed><summary>To Retrofit</summary>
It is necessary to remove those old templates from your dashboard file, and potentially update any card configs.

The old `cblcars_card_templates:` should no longer be in your dashboard file (unless you are _intentially_ trying to override the templates that come with the distribution)

```yaml
cblcars_card_templates:      <-- this section should be removed
  template_name:
```

Card config structure also changed slightly from original.
Everything that was in `cblcars_card_config:` section, has been moved up one level.

```yaml
cblcars_card_config:
  variables:
    label: "my label"

would become:

variables:
  label: "my label"
```
If you are coming from previous version and run into any quirks - please try on a blank dashboard to see if it resolves it.
</details>

---

<br>

# Installation - Make it so!


> :dizzy: tl;dr: Express Startup Sequence
>
> - _Clear All Moorings and Open Starbase Doors_
>   - Install 'required' dependencies from HACS
> - _Thrusters Ahead, Take Us Out_
>   - Setup HA-LCARS theme (notes below)
>   - Add font (customized URL)
>   - Add CB-LCARS custom style to HA-LCARS theme
> - _Bring Warp Core Online, Engines to Full Power_
>   - Install CB-LCARS from HACS
> - _Engage!_
>


---

### 1. Dependencies and Extras

The following should be installed and working in your Home Assistant instance - these are available in HACS
<br><b>Please follow the instructions in the respective project documentation for installation details. </b>

| Custom Card                                                                 |  Required?  | Function    |
|-----------------------------------------------------------------------------|-------------|-------------|
| [ha-lcars theme](https://github.com/th3jesta/ha-lcars)                      | Required    | Provides base theme elements, styes, color variables, etc. |
| [my-slider-v2](https://github.com/AnthonMS/my-cards)                      | Required    | Provided slider function in Multimeter card. |
| [lovelace-card-mod](https://github.com/thomasloven/lovelace-card-mod)       | Required | Not strictly needed for CB-LCARS, but is required by HA-LCARS theming at the time of writing.<br><br>Very useful for modifying the elements/styles of other cards to fit the theme (overriding fonts, colors, remove backgrounds etc.) |
| | |
| [lovelace-layout-card](https://github.com/thomasloven/lovelace-layout-card) | Optional    | No longer used internally but it's handy for the ultimate in dashboard layout customization! |
|  [lovelace-hue-like-light-card](https://github.com/Gh61/lovelace-hue-like-light-card) | Optional | Provides ability to use a Hue-style light and scene control popup card over the native HA light controls. |



<br>

### 2. HA-LCARS Theme - Setup and Customizations

#### Font
When adding the font resource, use a slightly updated Antonio font resouce string.<br>

This will include weights 100-700 allowing for more thinner/lighter text as seen in Picard (some displays use really thin font, 100 or 200)

Substitute the following resource string when setting up font in HA-LCARS theme:
`https://fonts.googleapis.com/css2?family=Antonio:wght@100..700&display=swap`

_(Note: if the font is missing, the card will attempt to load it dynamically from the above URL.)_


#### Customized *CB-LCARS* Color Scheme

 *Ideally, add and use this cb-lcars profile into your HA-LCARS theme.  If not, the additional color definitions will be made available to use on runtime by the cards.*

 Copy the custom `LCARS Picard [cb-lcars]` definition from [cb-lcars-lcars.yaml](ha-lcars-theme/cb-lcars-lcars.yaml) to your HA-LCARS `lcars.yaml` file in Home Assistant (per instructions for [adding custom themes to HA-LCARS](https://github.com/th3jesta/ha-lcars?tab=readme-ov-file#make-your-own-color-themes)).

Set `LCARS Picard [cb-lcars]` as the active theme.

<details closed><summary>Picard [cb-lcars]</summary>
Grays, Blues, and Oranges are the core colours.  Greens and Yellows added for additional options.

![Picard theme](images/themes/lcars_picard_ii_colors.png)

These are the colors used for the ha-lcars defined variables.

![Picard ha-lcars](images/themes/lcars_picard_ii_ha-lcars_settings.png)
</details>

<br>

### 3. Install CB-LCARS from HACS

1. Add CB-LCARS git repository as a custom repo in HACS.
2. Install CB-LCARS from HACS like any other project.


#### 4. Engage!

Add CB-LCARS cards to your dashboard just like any other card.

<br>


#  Overview

### What is this?
This is a set of custom cards to build yourself an LCARS-inspired Home Assistant dashboard.

These cards are built upon `custom-button-card` with some enhancements to base function and internal template management.

<br>

- Inspired by, and meant to be used side-by-side with the amazing [ha-lcars-theme](https://github.com/th3jesta/ha-lcars)
- Provides a (growing) library of elements found in LCARS interfaces like:
  - Buttons
  - Sliders/Guages
  - 'Elbows'
  - That d-pad thing
  - etc.
- Designed with HA 'Sections' or other grid layouts in mind.  YMMV with other layouts.
- Collaborative - There are likely way better ways of doing some things - open to any and all suggestions, comments, etc.
- WIP - learn, break, iterate (and probably break again.)
<br>

### What it isn't...

- This is not a standalone theme - it provides lovelace dashboard cards.
<br>The intention is to use [ha-lcars-theme](https://github.com/th3jesta/ha-lcars) to provide the base theme styles, color variables, etc.
- It is not a fully standalone set of components (at present.)<br>
For some controls you need to install other cards from HACS (all requirements listed below)
- Professional work.<br>As this is my first crack at an HA custom card - it's a WIP and as I learn, updates and optimaztions will be made.  Hobbyist here, not a pro.
- A complete set of bugless components to fit every use-case you can imagine.  Maybe in the next-class starship :P


<br>


### What can be done...


In no particular ordeer:
- Customizable variables/settings for just about everything:
   - default colors / per-instance colors
   - colors based on entity state
   - font sizes/weights
   - text positions
   - full icon customization
   - gradients for sliders with automatice step and shade calculations
   - really too much to list - you can customize just about anything you like
- Matching control colors to the light entity (buttons, sliders, gradients, etc.)
- Additional 'flare' such as animating button presses, blinking buttons
- Automatic 'random' button labels in LCARS style (hex numbers)
- Optional: invocation of [lovelace-hue-like-light-card](https://github.com/Gh61/lovelace-hue-like-light-card) popups for light and scene controls


---

# States

The cards support the changing styles/colors depending on the current state of the entity.

If no entity is defined, `default` will be used.  If the entity is unavailable or unknown, then `unavailable` will be used.

Each of these is configurable in the UI editor for the cards.

| Entity State Value           |  State Variable Name   |
|------------------------------|------------------------|
| N/A - no entity assigned     | `default:`             |
| `on` `open` `locked`         | `active:`              |
| `off` `closed` `unlocked`    | `inactive:`            |
| Number (zero): `0`           | `zero:`                |
| Number (non-zero)            | `non_zero:`            |
| `heat` (hvac/climate entity) | `hvac_heat:`           |
| `cool` (hvac/climate entity) | `hvac_cool:`           |
| `unavailable` `unkown`       | `unavailable:`         |


---

# CB-LCARS Cards

For reference - these are the cards found in CB-LCARS.
They are highly configurable - and some default styles are shown.

Additional style possibilities can be found in the screenshots section.

Settings are available in the UI editor.


<br>

## LCARS Elbows


### `type: custom:cb-lcars-elbow-card`


| `cblcars_card_type:`                                            | Default Style          |
| --------------------------------------------------------------- | ---------------------- |
| [`cb-lcars-header`](src/cb-lcars/cb-lcars-header.yaml)              | ![cb-lcars-header](images/button_samples/cb-lcars-header.png)              |
| [`cb-lcars-header-right`](src/cb-lcars/cb-lcars-header.yaml)        | ![cb-lcars-header-right](images/button_samples/cb-lcars-header-right.png)        |
| [`cb-lcars-header-contained`](src/cb-lcars/cb-lcars-header.yaml)    | ![cb-lcars-header-contained](images/button_samples/cb-lcars-header-contained.png)    |
| [`cb-lcars-header-open`](src/cb-lcars/cb-lcars-header.yaml)         | ![cb-lcars-header-open](images/button_samples/cb-lcars-header-open.png)         |


| `cblcars_card_type:`                                            | Default Style          |
| --------------------------------------------------------------- | ---------------------- |
| [`cb-lcars-footer`](src/cb-lcars/cb-lcars-footer.yaml)              | ![cb-lcars-footer](images/button_samples/cb-lcars-footer.png)              |
| [`cb-lcars-footer-right`](src/cb-lcars/cb-lcars-footer.yaml)        | ![cb-lcars-footer-right](images/button_samples/cb-lcars-footer-right.png) |
| [`cb-lcars-footer-contained`](src/cb-lcars/cb-lcars-footer.yaml)    | ![cb-lcars-footer-contained](images/button_samples/cb-lcars-footer-contained.png)    |
| [`cb-lcars-footer-open`](src/cb-lcars/cb-lcars-footer.yaml)         | ![cb-lcars-footer-open](images/button_samples/cb-lcars-footer-open.png)         |

| `cblcars_card_type:`                                              | Default Style          |
| ----------------------------------------------------------------- | ---------------------- |
| [`cb-lcars-header-callout`](src/cb-lcars/cb-lcars-callout.yaml)       | ![cb-lcars-header-callout](images/button_samples/cb-lcars-header-callout.png)       |
| [`cb-lcars-header-callout-right`](src/cb-lcars/cb-lcars-callout.yaml) | ![cb-lcars-header-callout-right](images/button_samples/cb-lcars-header-callout-right.png) |
| [`cb-lcars-footer-callout`](src/cb-lcars/cb-lcars-callout.yaml)       | ![cb-lcars-footer-callout](images/button_samples/cb-lcars-footer-callout.png)       |
| [`cb-lcars-footer-callout-right`](src/cb-lcars/cb-lcars-callout.yaml) | ![cb-lcars-footer-callout-right](images/button_samples/cb-lcars-footer-callout-right.png) |

<br>

### `type: custom:cb-lcars-double-elbow-card`

| `cblcars_card_type:`                                                   | Default Style          |
| ---------------------------------------------------------------------- | ---------------------- |
| [`cb-lcars-header-picard`](src/cb-lcars/cb-lcars-header-picard.yaml)       | ![cb-lcars-header-picard](images/button_samples/cb-lcars-header-picard.png)       |
| [`cb-lcars-header-picard-right`](src/cb-lcars/cb-lcars-header-picard.yaml) | ![cb-lcars-header-picard-right](images/button_samples/cb-lcars-header-picard-right.png) |
| [`cb-lcars-footer-picard`](src/cb-lcars/cb-lcars-footer-picard.yaml)       | ![cb-lcars-footer-picard](images/button_samples/cb-lcars-footer-picard.png)       |
| [`cb-lcars-footer-picard-right`](src/cb-lcars/cb-lcars-footer-picard.yaml) | ![cb-lcars-footer-picard-right](images/button_samples/cb-lcars-footer-picard-right.png) |

<br>

## LCARS Buttons

### `type: custom:cb-lcars-button-card`

| `cblcars_card_type:`                                                                 | Default Style          |
| ------------------------------------------------------------------------------------ | ---------------------- |
| [`cb-lcars-button-lozenge`](src/cb-lcars/cb-lcars-button-lozenge.yaml)                   | ![cb-lcars-button-lozenge](images/button_samples/cb-lcars-button-lozenge.png) |
| [`cb-lcars-button-bullet`](src/cb-lcars/cb-lcars-button-bullet.yaml)                     | ![cb-lcars-button-bullet](images/button_samples/cb-lcars-button-bullet.png)  |
| [`cb-lcars-button-capped`](src/cb-lcars/cb-lcars-button-capped.yaml)                     | ![cb-lcars-button-capped](images/button_samples/cb-lcars-button-capped.png)  |
| [`cb-lcars-button-picard`](src/cb-lcars/cb-lcars-button-picard.yaml)                     | ![cb-lcars-button-picard](images/button_samples/cb-lcars-button-picard.png)              |
| [`cb-lcars-button-picard-dense`](src/cb-lcars/cb-lcars-button-picard.yaml)               | ![cb-lcars-button-picard-dense](images/button_samples/cb-lcars-button-picard-dense.png)        |
| [`cb-lcars-button-picard-filled`](src/cb-lcars/cb-lcars-button-picard-filled.yaml)       | ![cb-lcars-button-picard-filled](images/button_samples/cb-lcars-button-picard-filled.png)       |
| [`cb-lcars-button-picard-filled-dense`](src/cb-lcars/cb-lcars-button-picard-filled.yaml) | ![cb-lcars-button-picard-filled-dense](images/button_samples/cb-lcars-button-picard-filled-dense.png) |
| [`cb-lcars-button-picard-icon`](src/cb-lcars/cb-lcars-button-picard-icon.yaml)           | ![cb-lcars-button-picard-icon](images/button_samples/cb-lcars-button-picard-icon.png)         |

<br>

## LCARS Multimeter (Sliders/Gauges)

### `type:cb-lcars-multimeter-card`

- Run in Slider or Guage mode
- Horizontal or Vertical orientation
- Configurable multi-modal slider control:
  - Light: brightness, temperature, hue, saturation
  - Media Player: volume, seek
  - etc.
- Fully configurable borders, label/text, slider
- Color match [border|slider|gauge|gradient start/end etc.] to entity color
- Configurable min, max, gauge increments, slider step size
- Show/Hide Units, Override unit
- Configurable Subticks
  - Show/Hide
  - Size
  - Count (number of subticks per segement)

![cb-lcars-multimeter](images/screenshots/multimeter.gif)

TODOs:
- update slider mode to new code (code that gauge uses - better performance)
- expose customization parameters for slider (rounded/square, width/height, etc.)
- add RTL (right-to-left) support (?)

<br>

## LCARS Label (Stylized Text)

### `type:cb-lcars-label-card`

| `cblcars_card_type:`        | Styles          |
| -------------- | ---------------------- |
| [`cb-lcars-label`](src/cb-lcars/cb-lcars-label.yaml) | ![picard-callout-2](images/screenshots/label-2.png) |
| [`cb-lcars-label-picard`](src/cb-lcars/cb-lcars-label-presets.yaml) | ![cb-lcars-label](images/button_samples/cb-lcars-label.png)<br>![cb-lcars-label-2](images/button_samples/cb-lcars-label-2.png) |

<br>

## LCARS DPAD

### `type:cb-lcars-dpad-card`

- Card-wide active/inactive colors
- Per-segment active/inactive colors
- Assignable entity per segment
- Assignable actions/controls per segment (deafult `toggle`)

![cb-lcars-dpad](images/screenshots/dpad.gif)

TODOs:
- update/remove ripple effect
- add 'match entity color' for active state

<br>

---

# Animations

TODO: background animations section

<br>

## Data Cascade

| template ||
|----------|----------------|
| [`cb-lcars-cascade`](src/cb-lcars/cb-lcars-cascade.yaml) | ![cb-lcars-cascade](images/screenshots/data_cascade.gif) |

| setting | default |
|---------|---------|


```yaml
type: custom:cb-lcars-base-card
label: CB-LCARS Base Card
show_label: true
configSample:
  actionSelector: {}
grid_options:
  columns: 12
  rows: 5
template:
  - cb-lcars-animation-cascade
variables:
  animation:
    cascade:
      pattern: custom
      custom_pattern: |
        [
          { "duration": 1, "delay": 0.1 },
          { "duration": 1.5, "delay": 0.2 },
          { "duration": 2, "delay": 0.3 },
          { "duration": 2.5, "delay": 0.4 },
          { "duration": 3, "delay": 0.5 },
          { "duration": 3.5, "delay": 0.6 },
          { "duration": 4, "delay": 0.7 },
          { "duration": 4.5, "delay": 0.8 }
        ]
      custom_keyframes: |
        @keyframes colorchange {
          0% {color: #ff0000}
          25% {color: #00ff00}
          50% {color: #0000ff}
          75% {color: #ffff00}
          80% {color: #ff00ff}
          90% {color: #00ffff}
          100% {color: #ffffff}
        }
```

TODOs:
- add presets/expose options for cascade animation settings
- add alternative text sources (sensors?)

## Pulse Wave

---

# Screenshots

Below are screenshots and snippets of potential variations of the controls.

#### Button Samples

![picard-button-1](images/screenshots/picard-button-1.png)
![picard-button-1-off](images/screenshots/picard-button-1-off.png)
![picard-button-2](images/screenshots/picard-button-2.png)
![picard-button-2-off](images/screenshots/picard-button-2-off.png)
![lozenge-button-1](images/screenshots/lozenge-button-1.png)
![lozenge-button-1-off](images/screenshots/lozenge-button-1-off.png)
![cb-lcars-button-grid](images/button_samples/cb-lcars-button-grid.png)
![button-grid-1](images/screenshots/button-grid-1.png)
![button-grid-2](images/screenshots/button-grid-2.png)
![icon-gird-1](images/screenshots/icon-grid-1.png)



#### Sliders/Gauges

![meter-1](images/screenshots/meter-1.png) ![meter-2](images/screenshots/meter-2.png) ![meter-3](images/screenshots/meter-3.png) ![meter-4](images/screenshots/meter-4.png)

![cb-lcars-multimeter](images/button_samples/cb-lcars-multimeter.png)

![multimeter-1](images/screenshots/multimeter-1.png)



#### Row of sliders (Transporter controls? :grin:)

![dashboard_light_sliders](images/screenshots/dashboard_light_sliders.png)

#### Room Selector with Sliders for Lights
![dashboard_light_grid](images/screenshots/dashboard_light_grid.png)

### Some Dashboard possibilities...

![dashboard_1](images/screenshots/dashboard_sample_1.png)

<br>

![dashboard_2](images/screenshots/dashboard_sample_2.png)

<br>

![dashboard_red_alert_1](images/screenshots/dashboard_sample_red_alert_1.png)

<br>

![dashboard_3](images/screenshots/dashboard_sample_3.png)

---

# Acknowledgements & Thanks

A very sincere thanks to these projects and their authors, contributers and communities for doing what they do, and making it available.  It really does make this a fun hobby to tinker with.

[**ha-lcars theme**](https://github.com/th3jesta/ha-lcars) (the definitive LCARS theme for HA!)

[**custom-button-card**](https://github.com/custom-cards/button-card)

[**my-cards/my-slider-v2**](https://github.com/AnthonMS/my-cards)

[**lovelace-layout-card**](https://github.com/thomasloven/lovelace-layout-card)

[**lovelace-card-mod**](https://github.com/thomasloven/lovelace-card-mod)

[**lovelace-hue-like-light-card**](https://github.com/Gh61/lovelace-hue-like-light-card)

<br>
As well, some shout-outs and attributions to these great projects:
<br><br>

[lovelace-animated-background](https://github.com/rbogdanov/lovelace-animated-background) - Allows for animated/video backgrounds on the dashboard (stars look great.)  Additionally, Home Assistant natively supports background images (can be configured in UI from 2024.6+)

[lovelace-wallpanel](https://github.com/j-a-n/lovelace-wallpanel) - Great panel-mode features - including hiding side/top bars, screensaver function (with cards support)

[LCARSlad London](https://twitter.com/lcarslad) for excellent LCARS images and diagrams for reference.

[meWho Titan.DS](https://www.mewho.com/titan) for such a cool interactive design demo and color reference.

[TheLCARS.com]( https://www.thelcars.com) a great LCARS design reference.

[wfurphy creative-button-card-templates](https://github.com/wfurphy/creative-button-card-templates) for debugging code template that dumps variables to the browswer console - super handy.

[lcars](https://github.com/joernweissenborn/lcars) for the SVG used inline in the dpad control.

---
#  License

This project uses the MIT License. For more details, refer to the [LICENSE](LICENSE) file.

---
