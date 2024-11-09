***
**Note:** This project is active development.  Functionality and configurations may change over time.  Things may break - so you may not want to use this on your primary dashboard just yet.
***

<p align="center">

![cb-lcars](images/screenshots/cb-lcars-banner.png)
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


- [Overview](#overview)
    - [What is this?](#what-is-this)
    - [What it isn't...](#what-it-isnt)
    - [What can be done...](#what-can-be-done)
- [Make it so!](#make-it-so)
    - [1. Dependencies and Extras](#1-dependencies-and-extras)
    - [2. HA-LCARS Theme - Setup and Customizations](#2-ha-lcars-theme---setup-and-customizations)
      - [Font](#font)
      - [Customized *CB-LCARS* Color Scheme](#customized-cb-lcars-color-scheme)
    - [3. Install CB-LCARS from HACS](#3-install-cb-lcars-from-hacs)
      - [3a. Create Input Helpers](#3a-create-input-helpers)
    - [4. Boldly Go...](#4-boldly-go)
      - [New Dashboard w/Strategy](#new-dashboard-wstrategy)
      - [Engage!](#engage)
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
- [Screenshots](#screenshots)
      - [Button Samples](#button-samples)
      - [Sliders/Gauges](#slidersgauges)
      - [Row of sliders (Transporter controls? :grin:)](#row-of-sliders-transporter-controls-grin)
      - [Room Selector with Sliders for Lights](#room-selector-with-sliders-for-lights)
    - [Some Dashboard possibilities...](#some-dashboard-possibilities)
- [Acknowledgements \& Thanks](#acknowledgements--thanks)
- [License](#license)


<br>

#  Overview

### What is this?
This is a set of custom cards to build yourself an LCARS-inspired Home Assistant dashboard.
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


# Make it so!

---

> :dizzy: tl;dr: Express Startup Sequence
>
> - Clear All Moorings and Open Starbase Doors
>   - Install 'required' dependencies from HACS
> - Thrusters Ahead, Take Us Out
>   - Setup HA-LCARS theme (notes below)
>   - Add font (customized URL)
>   - Add CB-LCARS custom style to HA-LCARS theme
> - Bring Warp Core Online, Engines to Full Power
>   - Install CB-LCARS from HACS
>   - Create CB-LCARS input helper(s)
> - Plot Course
>   - Create new dashboard and jumpstart with strategy
>   - Take Control and...
> - Engage!
>


---


### 1. Dependencies and Extras

The following should be installed and working in your Home Assistant instance - these are available in HACS
<br><b>Please follow the instructions in the respective project documentation for installation details. </b>

| Custom Card                                                                 |  Required?  | Function    |
|-----------------------------------------------------------------------------|-------------|-------------|
| [ha-lcars theme](https://github.com/th3jesta/ha-lcars)                      | Required    | Provides base theme elements, styes, color variables, etc. |
| [lovelace-layout-card](https://github.com/thomasloven/lovelace-layout-card) | Required    | Used internally.<br><br>Also handy for the ultimate in dashboard layout customization! |
| [lovelace-card-mod](https://github.com/thomasloven/lovelace-card-mod)       | Required | Not strictly needed for CB-LCARS, but is required by HA-LCARS theming at the time of writing.<br><br>Very useful for modifying the elements/styles of other cards to fit the theme (overriding fonts, colors, remove backgrounds etc.) |
|  [lovelace-hue-like-light-card](https://github.com/Gh61/lovelace-hue-like-light-card) | Optional | Provides ability to use a Hue-style light and scene control popup card over the native HA light controls. |
| [custom-button-card](https://github.com/custom-cards/button-card)           | *Now Included*   | Base Framework<br><br>**Additional install no longer required.** |
| [my-cards/my-slider-v2](https://github.com/AnthonMS/my-cards)               | *Now Included*    | Provides slider function which is used in the slider/gauge controls.<br><br>**Additional install no longer required.** |


<br>

### 2. HA-LCARS Theme - Setup and Customizations

#### Font
When setting up the font resource, we use a slightly updated Antonio font resouce string.<br>
This includes weights 100-700 allowing for more fine-grained control of the text as seen in Picard (some displays use really thin font, 100 or 200)

Simply substitute the following resource string when setting up ha-lcars:
`https://fonts.googleapis.com/css2?family=Antonio:wght@100..700&display=swap`

#### Customized *CB-LCARS* Color Scheme

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

#### 3a. Create Input Helpers

Create the following input helpers in your Home Asstant.
<br>Names are configurable, but Entity ID is required to match.

| Name              | Entity ID                               | Type                    | Values |
|-------------------|-----------------------------------------|-------------------------|-------------------------------------------------|
| ALERT CONDITION   | `input_select.lcars_ui_alert_condition` | Dropdown (input select) | GREEN<br>RED<br>YELLOW<br>BLUE<br>BLACK<br>GRAY |

<br>

### 4. Boldly Go...

CB-LCARS (currently) requires the `custom-button-card` templates to be added do the dashboard config.

The easiest way to begin is to start with a new dashboard, and activate the **CB-LCARS Dashboard Strategy**
After this, simply take control and go wild.

#### New Dashboard w/Strategy
1.  Create a new empty dashboard in Home Assistant (`New Dashboard From Scratch`)
2.  Navigate to the new dashboard - enter *edit mode -> Raw Configuration Editor* (from menu at top right)
3.  Clear the existing default yaml code, and replace with the strategy:
```yaml
strategy:
  type: custom:cb-lcars
```
1.  Save the configuration and exit the yaml editor.
2.  The new dashboard configuarion elements should begin to load.
3.  Before editing, click "Done" at the top to exit edit mode and refresh page if necessary.

The base dashboard configuration is now available on this dashboard via the strategy.
You can now "Take Control" and begin your LCARS adventure!

#### Engage!
1. Click on the pencil at the top right to entire edit mode.
2. A dialog will pop up with information on the strategy.
3. Click the 3 dots in the top right and choose *Take Control*
4. On the next dialog just click **Take Control**  *(do not choose to start with an empty dashboard!)*

<br>

---

# CB-LCARS Cards

These are the cards found in CB-LCARS.  These are highly configurable - some default styles are shown.  Additional style possibilities can be found in the screenshots section.

<br>

## LCARS Elbows


### `type: custom:cb-lcars-elbow-card`


| `cblcars_card_type:`                                            | Default Style          |
| --------------------------------------------------------------- | ---------------------- |
| [`cb-lcars-header`](cb-lcars/cb-lcars-header.yaml)              | ![cb-lcars-header](images/button_samples/cb-lcars-header.png)              |
| [`cb-lcars-header-right`](cb-lcars/cb-lcars-header.yaml)        | ![cb-lcars-header-right](images/button_samples/cb-lcars-header-right.png)        |
| [`cb-lcars-header-contained`](cb-lcars/cb-lcars-header.yaml)    | ![cb-lcars-header-contained](images/button_samples/cb-lcars-header-contained.png)    |
| [`cb-lcars-header-open`](cb-lcars/cb-lcars-header.yaml)         | ![cb-lcars-header-open](images/button_samples/cb-lcars-header-open.png)         |


| `cblcars_card_type:`                                            | Default Style          |
| --------------------------------------------------------------- | ---------------------- |
| [`cb-lcars-footer`](cb-lcars/cb-lcars-footer.yaml)              | ![cb-lcars-footer](images/button_samples/cb-lcars-footer.png)              |
| [`cb-lcars-footer-right`](cb-lcars/cb-lcars-footer.yaml)        | ![cb-lcars-footer-right](images/button_samples/cb-lcars-footer-right.png) |
| [`cb-lcars-footer-contained`](cb-lcars/cb-lcars-footer.yaml)    | ![cb-lcars-footer-contained](images/button_samples/cb-lcars-footer-contained.png)    |
| [`cb-lcars-footer-open`](cb-lcars/cb-lcars-footer.yaml)         | ![cb-lcars-footer-open](images/button_samples/cb-lcars-footer-open.png)         |

| `cblcars_card_type:`                                              | Default Style          |
| ----------------------------------------------------------------- | ---------------------- |
| [`cb-lcars-header-callout`](cb-lcars/cb-lcars-callout.yaml)       | ![cb-lcars-header-callout](images/button_samples/cb-lcars-header-callout.png)       |
| [`cb-lcars-header-callout-right`](cb-lcars/cb-lcars-callout.yaml) | ![cb-lcars-header-callout-right](images/button_samples/cb-lcars-header-callout-right.png) |
| [`cb-lcars-footer-callout`](cb-lcars/cb-lcars-callout.yaml)       | ![cb-lcars-footer-callout](images/button_samples/cb-lcars-footer-callout.png)       |
| [`cb-lcars-footer-callout-right`](cb-lcars/cb-lcars-callout.yaml) | ![cb-lcars-footer-callout-right](images/button_samples/cb-lcars-footer-callout-right.png) |

<br>

### `type: custom:cb-lcars-double-elbow-card`

| `cblcars_card_type:`                                                   | Default Style          |
| ---------------------------------------------------------------------- | ---------------------- |
| [`cb-lcars-header-picard`](cb-lcars/cb-lcars-header-picard.yaml)       | ![cb-lcars-header-picard](images/button_samples/cb-lcars-header-picard.png)       |
| [`cb-lcars-header-picard-right`](cb-lcars/cb-lcars-header-picard.yaml) | ![cb-lcars-header-picard-right](images/button_samples/cb-lcars-header-picard-right.png) |
| [`cb-lcars-footer-picard`](cb-lcars/cb-lcars-footer-picard.yaml)       | ![cb-lcars-footer-picard](images/button_samples/cb-lcars-footer-picard.png)       |
| [`cb-lcars-footer-picard-right`](cb-lcars/cb-lcars-footer-picard.yaml) | ![cb-lcars-footer-picard-right](images/button_samples/cb-lcars-footer-picard-right.png) |

<br>

## LCARS Buttons

### `type: custom:cb-lcars-button-card`

| `cblcars_card_type:`                                                                 | Default Style          |
| ------------------------------------------------------------------------------------ | ---------------------- |
| [`cb-lcars-button-lozenge`](cb-lcars/cb-lcars-button-lozenge.yaml)                   | ![cb-lcars-button-lozenge](images/button_samples/cb-lcars-button-lozenge.png) |
| [`cb-lcars-button-bullet`](cb-lcars/cb-lcars-button-bullet.yaml)                     | ![cb-lcars-button-bullet](images/button_samples/cb-lcars-button-bullet.png)  |
| [`cb-lcars-button-capped`](cb-lcars/cb-lcars-button-capped.yaml)                     | ![cb-lcars-button-capped](images/button_samples/cb-lcars-button-capped.png)  |
| [`cb-lcars-button-picard`](cb-lcars/cb-lcars-button-picard.yaml)                     | ![cb-lcars-button-picard](images/button_samples/cb-lcars-button-picard.png)              |
| [`cb-lcars-button-picard-dense`](cb-lcars/cb-lcars-button-picard.yaml)               | ![cb-lcars-button-picard-dense](images/button_samples/cb-lcars-button-picard-dense.png)        |
| [`cb-lcars-button-picard-filled`](cb-lcars/cb-lcars-button-picard-filled.yaml)       | ![cb-lcars-button-picard-filled](images/button_samples/cb-lcars-button-picard-filled.png)       |
| [`cb-lcars-button-picard-filled-dense`](cb-lcars/cb-lcars-button-picard-filled.yaml) | ![cb-lcars-button-picard-filled-dense](images/button_samples/cb-lcars-button-picard-filled-dense.png) |
| [`cb-lcars-button-picard-icon`](cb-lcars/cb-lcars-button-picard-icon.yaml)           | ![cb-lcars-button-picard-icon](images/button_samples/cb-lcars-button-picard-icon.png)         |

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
| [`cb-lcars-label`](cb-lcars/cb-lcars-label.yaml) | ![picard-callout-2](images/screenshots/label-2.png) |
| [`cb-lcars-label-picard`](cb-lcars/cb-lcars-label-presets.yaml) | ![cb-lcars-label](images/button_samples/cb-lcars-label.png)<br>![cb-lcars-label-2](images/button_samples/cb-lcars-label-2.png) |
| [`cb-lcars-cascade`](cb-lcars/cb-lcars-cascade.yaml) | ![cb-lcars-cascade](images/screenshots/data_cascade.gif) |

TODOs:
- add presets/expose options for cascade animation settings
- add alternative text sources (sensors?)

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
