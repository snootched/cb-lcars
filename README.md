<p align="center">
  <img src="https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/main/icons/folder-moon.svg" width="100" alt="project-logo">
</p>


<p align="center">
    <h1 align="center">HA-LCARDS</h1>
</p>
<p align="center">
    <em>A collection of custom button-card templates for building LCARS styled dashboards for Home Assistant</em>
</p>
<p align="center">
	<img src="https://img.shields.io/github/v/release/snootched/ha-lcards?display_name=release&logo=startrek" alt="release">
	<img src="https://img.shields.io/github/license/snootched/ha-lcards?style=default&logo=opensourceinitiative&logoColor=white&color=0080ff" alt="license">
	<img src="https://img.shields.io/github/last-commit/snootched/ha-lcards?style=default&logo=git&logoColor=white&color=0080ff" alt="last-commit">
	<img src="https://img.shields.io/github/languages/top/snootched/ha-lcards?style=default&color=0080ff" alt="repo-top-language">
	<img src="https://img.shields.io/github/languages/count/snootched/ha-lcards?style=default&color=0080ff" alt="repo-language-count">
<p>
<p align="center">
	<!-- default option, no dependency badges. -->
</p>

<br><!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary><br>

- [ Overview](#-overview)
- [ Features](#-features)
- [ Repository Structure](#-repository-structure)
- [ Modules](#-modules)
- [ Getting Started](#-getting-started)
  - [ Installation](#-installation)
  - [ Usage](#-usage)
  - [ Tests](#-tests)
- [ Project Roadmap](#-project-roadmap)
- [ Contributing](#-contributing)
- [ License](#-license)
- [ Acknowledgments](#-acknowledgments)
</details>
<hr>

##  Overview

Write something here that isn't this AI-generated bs :D

Ha-lcards is a home automation project that offers personalized dashboards for users, enhancing their interactive experience. Through user-specific settings like animated backgrounds and customized profiles, ha-lcards tailors the dashboard interface to individual preferences, improving usability and engagement. Configuration files within the codebase manage visual aspects and user interactions, ensuring a seamless and personalized home automation system.

---


## The Templates

### Foundational Templates

<details closed><summary>Base Templates</summary>

#### Base Templates

| Template             | Description    |
| -------------------- | -------------- |
| `cb-lcars-functions` | A libary of custom reuasable javascript functions that can be leveraged when building complex/dynamic cards. |
| `cb-lcars-base`      | This is the base template for cb-lcars.  This defines most variables and styles that are used by the rest of the library of tempalates.  This template is not meant to be used on its own, but rather can be included when building out new types of controls etc.  |
| `cb-lcars-card-base` | This is a foundational card that can be used when building complex controls.  It can be used when using a custom-button card as a 'canvas' with custom elements to build complex controls (eg. cb-lcars-multimeter)  Has some features such as changing the background color of the card when debug mode is enabled. |
| `cb-lcars-debug`     | Adapted from a very nice template by <insert name/link>  This template can be added to enable console debugging of any custom button card. |
</details>

<details closed><summary>Actions</summary>

#### Actions

| Template                     | Description |
| ---------------------------- | ----------- |
| `cb-lcars-actions-disable`   | Disables all actions for the button.  |
| `cb-lcars-actions-toggle`    | Sets tap action to `toggle`, hold action to `more-info`, and double-tap to `more-info` |
| `cb-lcars-actions-more-info` | Sets all actions to `more-info`           |
| `cb-lcars-actions-hue`       | Uses <insert hue cared name..> API to pop up the Hue screen on tap, `more-info` on hold, and ??? on double-tap.            |
</details>

<details closed><summary>Flare</summary>

#### Flare

| Template                 | Description |
| ------------------------ | ----------- |
| `cb-lcars-animate-press` | Adds an animation to the button when pressed. |
| `cb-lcars-state-blink`   | Causes the button to blink when active. |
</details>

---

### LCARS Basic Shapes

<details closed><summary>Headers</summary>

#### LCARS Headers

| Template                       | Description                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| `cb-lcars-header`              | ![cb-lcars-header](images/button_samples/cb-lcars-header.png)              |
| `cb-lcars-header-right`        | ![cb-lcars-header-right](images/button_samples/cb-lcars-header-right.png)        |
| `cb-lcars-header-contained`    | ![cb-lcars-header-contained](images/button_samples/cb-lcars-header-contained.png)    |
| `cb-lcars-header-open`         | ![cb-lcars-header-open](images/button_samples/cb-lcars-header-open.png)         |
| `cb-lcars-header-picard`       | ![cb-lcars-header-picard](images/button_samples/cb-lcars-header-picard.png)       |
| `cb-lcars-header-picard-right` | ![cb-lcars-header-picard-right](images/button_samples/cb-lcars-header-picard-right.png) |
</details>


<details closed><summary>Footers</summary>

#### LCARS Footers

| Template                       | Description                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| `cb-lcars-footer-base`         |                                                             |
| `cb-lcars-footer`              | ![cb-lcars-footer](images/button_samples/cb-lcars-footer.png)              |
| `cb-lcars-footer-right`        | ![cb-lcars-footer-right](images/button_samples/cb-lcars-footer-right.png)        |
| `cb-lcars-footer-contained`    | ![cb-lcars-footer-contained](images/button_samples/cb-lcars-footer-contained.png)    |
| `cb-lcars-footer-open`         | ![cb-lcars-footer-open](images/button_samples/cb-lcars-footer-open.png)         |
| `cb-lcars-footer-picard`       | ![cb-lcars-footer-picard](images/button_samples/cb-lcars-footer-picard.png)       |
| `cb-lcars-footer-picard-right` | ![cb-lcars-footer-picard-right](images/button_samples/cb-lcars-footer-picard-right.png) |
</details>

<details closed><summary>Callouts</summary>

#### LCARS Callouts

| Template                        | Description                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| `cb-lcars-callout-base`         |                                                              |
| `cb-lcars-header-callout`       | ![cb-lcars-header-callout](images/button_samples/cb-lcars-header-callout.png)       |
| `cb-lcars-header-callout-right` | ![cb-lcars-header-callout-right](images/button_samples/cb-lcars-header-callout-right.png) |
| `cb-lcars-footer-callout`       | ![cb-lcars-footer-callout](images/button_samples/cb-lcars-footer-callout.png)       |
| `cb-lcars-footer-callout-right` | ![cb-lcars-footer-callout-right](images/button_samples/cb-lcars-footer-callout-right.png) |
</details>

<details closed><summary>Text/Labels</summary>

#### LCARS Text Labels

| Template         | Description |
| ---------------- | ----------- |
| `cb-lcars-label` | ![cb-lcars-label](images/button_samples/cb-lcars-label.png) |


</details>

---

### LCARS Buttons

<details closed><summary>Base Templates</summary>

#### Base Templates
| Template                                           | Example                                             |
| -------------------------------------------------- | --------------------------------------------------- |
| `cb-lcars-button-base`<br>`cb-lcars-button-square` | ![cb-lcars-button-base](images/button_samples/cb-lcars-button-base.png) |
#### Rounded Buttons
| Template                                                     | Description                                            |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| `cb-lcars-button-lozenge`<br>`cb-lcars-button-lozenge-right` | ![cb-lcars-button-lozenge](images/button_samples/cb-lcars-button-lozenge.png) |
| `cb-lcars-button-bullet`<br>`cb-lcars-button-bullet-right`   | ![cb-lcars-button-bullet](images/button_samples/cb-lcars-button-bullet.png)  |
| `cb-lcars-button-capped`<br>`cb-lcars-button-capped-right`   | ![cb-lcars-button-capped](images/button_samples/cb-lcars-button-capped.png)  |
</details>

<details closed><summary>Picard-Style Buttons</summary>
#### Picard-Style Buttons

| Template                                                                             | Description                                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `cb-lcars-button-picard`<br>`cb-lcars-button-picard-right`<br>                       | ![cb-lcars-button-picard](images/button_samples/cb-lcars-button-picard.png)              |
| `cb-lcars-button-picard-dense`<br>`cb-lcars-button-picard-dense-right`               | ![cb-lcars-button-picard-dense](images/button_samples/cb-lcars-button-picard-dense.png)        |
| `cb-lcars-button-picard-filled`<br>`cb-lcars-button-picard-filled-right`             | ![cb-lcars-button-picard-filled](images/button_samples/cb-lcars-button-picard-filled.png)       |
| `cb-lcars-button-picard-filled-dense`<br>`cb-lcars-button-picard-filled-dense-right` | ![cb-lcars-button-picard-filled-dense](images/button_samples/cb-lcars-button-picard-filled-dense.png) |
| `cb-lcars-button-picard-icon`                                                        | ![cb-lcars-button-picard-icon](images/button_samples/cb-lcars-button-picard-icon.png)         |
</details>

<details closed><summary>Picard-Style Text Modifiers</summary>
#### Picard-Style Text Modifiers
| Template                                                                   | Description                                                    |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `cb-lcars-button-picard-[label\|state\|name]-[east\|west\|ne\|nw\|se\|sw]` | ![cb-lcars-button-picard-label-nw](images/button_samples/cb-lcars-button-picard-label-nw.png) |
</details>

---

### LCARS Constructors
| Template                     | Description                                               |
| ---------------------------- | --------------------------------------------------------- |
| `cb-lcars-button-grid`       | ![cb-lcars-button-grid](images/button_samples/cb-lcars-button-grid.png)       |
| `cb-lcars-button-grid-icons` | ![cb-lcars-button-grid-icons](images/button_samples/cb-lcars-button-grid-icons.png) |


---
### LCARS Controls

| Template                           | Description                                                     |
| ---------------------------------- | --------------------------------------------------------------- |
| `cb-lcars-meter`                   | ![cb-lcars-meter](images/button_samples/cb-lcars-meter.png)                   |
| `cb-lcars-meter-horizontal`        | ![cb-lcars-meter-horizontal](images/button_samples/cb-lcars-meter-horizontal.png)        |
| `cb-lcars-slider`                  | ![cb-lcars-slider](images/button_samples/cb-lcars-slider.png)                  |
| `cb-lcars-slider-gauge`            | ![cb-lcars-slider-gauge](images/button_samples/cb-lcars-slider-gauge.png)            |
| `cb-lcars-slider-horizontal`       | ![cb-lcars-slider-horizontal](images/button_samples/cb-lcars-slider-horizontal.png)       |
| `cb-lcars-slider-horizontal-gauge` | ![cb-lcars-slider-horizontal-gauge](images/button_samples/cb-lcars-slider-horizontal-gauge.png) |
| `cb-lcars-multimeter`              | ![cb-lcars-multimeter](images/button_samples/cb-lcars-multimeter.png)              |
| `cb-lcars-dpad`                    | ![cb-lcars-dpad](images/button_samples/cb-lcars-dpad.png)                    |


---
---
---
---
EXAMPLE SHIT FROM AI SCRIPT BELOW

---

##  Repository Structure

```sh
└── ha-lcards/
    ├── README.md
    ├── backup
    │   ├── dashboard-2024-05-03.1.yaml
    │   ├── dashboard-2024-05-04.1.yaml
    │   ├── dev-dash.yaml
    │   ├── prod-dash.yaml
    │   ├── themes
    │   └── v2
    └── scratch
        ├── split-main-dash-2024-05-03.1.yaml
        ├── split-scratch-dash-2024-05-01.2.yaml
        ├── split-scratch-dash-2024-05-03.1.yaml
        ├── split-scratch-dash-2024-05-04.1.yaml
        ├── split-scratch-dash-2024-05-04.2.yaml
        └── split-scratch-home2-before-import.yaml
```

---


---

##  Getting Started

**System Requirements:**

* **YAML**: `version x.y.z`

###  Installation

<h4>From <code>source</code></h4>

> 1. Clone the ha-lcards repository:
>
> ```console
> $ git clone https://github.com/snootched/ha-lcards
> ```
>
> 2. Change to the project directory:
> ```console
> $ cd ha-lcards
> ```
>
> 3. Install the dependencies:
> ```console
> $ > INSERT-INSTALL-COMMANDS
> ```

###  Usage

<h4>From <code>source</code></h4>

> Run ha-lcards using the command below:
> ```console
> $ > INSERT-RUN-COMMANDS
> ```

###  Tests

> Run the test suite using the command below:
> ```console
> $ > INSERT-TEST-COMMANDS
> ```

---

##  Project Roadmap

- [X] `► INSERT-TASK-1`
- [ ] `► INSERT-TASK-2`
- [ ] `► ...`

---

##  Contributing

Contributions are welcome! Here are several ways you can contribute:

- **[Report Issues](https://github.com/snootched/ha-lcards/issues)**: Submit bugs found or log feature requests for the `ha-lcards` project.
- **[Submit Pull Requests](https://github.com/snootched/ha-lcards/blob/main/CONTRIBUTING.md)**: Review open PRs, and submit your own PRs.
- **[Join the Discussions](https://github.com/snootched/ha-lcards/discussions)**: Share your insights, provide feedback, or ask questions.

<details closed>
<summary>Contributing Guidelines</summary>

1. **Fork the Repository**: Start by forking the project repository to your github account.
2. **Clone Locally**: Clone the forked repository to your local machine using a git client.
   ```sh
   git clone https://github.com/snootched/ha-lcards
   ```
3. **Create a New Branch**: Always work on a new branch, giving it a descriptive name.
   ```sh
   git checkout -b new-feature-x
   ```
4. **Make Your Changes**: Develop and test your changes locally.
5. **Commit Your Changes**: Commit with a clear message describing your updates.
   ```sh
   git commit -m 'Implemented new feature x.'
   ```
6. **Push to github**: Push the changes to your forked repository.
   ```sh
   git push origin new-feature-x
   ```
7. **Submit a Pull Request**: Create a PR against the original project repository. Clearly describe the changes and their motivations.
8. **Review**: Once your PR is reviewed and approved, it will be merged into the main branch. Congratulations on your contribution!
</details>

<details closed>
<summary>Contributor Graph</summary>
<br>
<p align="center">
   <a href="https://github.com{/snootched/ha-lcards/}graphs/contributors">
      <img src="https://contrib.rocks/image?repo=snootched/ha-lcards">
   </a>
</p>
</details>

---

##  License

This project is protected under the [SELECT-A-LICENSE](https://choosealicense.com/licenses) License. For more details, refer to the [LICENSE](https://choosealicense.com/licenses/) file.

---

##  Acknowledgments

- List any resources, contributors, inspiration, etc. here.

[**Return**](#-overview)

---
