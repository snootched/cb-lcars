LCARS Base Template [`cb-lcars-base`]

This is the base card for the entire library.<br>
Common styling variables for the card, text, icons, etc. are defined here that apply as the defaults for all the descendant cards.<br>
Control cards (buttones, headers, etc.) include this base template, and then override defaults, add new variables, etc.<br>
<br>
You do not include this template in your dashboards - it is used to build new controls only.<br>
<br>
You would, however, be able to override variables from the base in your instance of a card on the dashboard.
<table>
<tr>
<td> <code>variables:</code> YAML Section</td> <td> Description </td>
</tr>

<tr>
<td>

```yaml
variables:
  text:
    label:
    state:
    name:
      font_size: 20px
      font_weight: normal
      align: left
      align_items: center
      justify: center
      transform: none
      padding:
        top: 10px
        left: 0px
        right: 0px
        bottom: 10px
      color:
        default: var(--primary-text-color)
        'on': var(--primary-text-color)
        'off': var(--primary-text-color)
        zero: var(--lcars-green)
        non_zero: var(--lcars-blue)
        hvac_heat: var(--lcars-orange)
        hvac_cool: var(--lcars-blue)
        hvac_other: var(--lcars-purple)

```
</td>
<td>
These CSS properties control the default text styling for <code>label</code> <code>name</code> and <code>state</code> text cells of the base button card.<br><br>
The <code>color:</code> sub-key contains a collection of state values and their color.  These colors are used when an <code>entity:</code> is defined and we want to change color based on that state.
</td>
</tr>

<tr>
<td>

```yaml
variables:
  .
  .
  .
  card:
    height: null
    min_height: 10px
    width: null
    color:
      active: var(--lcars-ui-secondary)
      inactive: var(--lcars-ui-tertiary)
      background:
        default: none
        active: transparent
        inactive: transparent
    border:
      top:
        left_radius: 0px
        right_radius: 0px
        size: 0px
      bottom:
        left_radius: 0px
        right_radius: 0px
        size: 0px
      left:
        size: 0px
      right:
        size: 0px
      inner:
        factor: 2
        min_radius: 30px
        width: 35px
      color: var(--lcars-card-top-color)

```
</td>
<td>
These CSS properties control the styling for the base button card.<br><br>
The <code>border.color</code> sub-key is the property that controls the LCARS elbow color in controls like <code>cb-lcars-header-*</code><br>
<br>
The <code>color.background.*</code> sub-keys are the properties that controls the LCARS colors in controls like <code>cb-lcars-button-*</code><br>
</td>
</tr>

<tr>
<td>

```yaml
variables:
  .
  .
  .
  icon:
  box_size: 35px
  size: 24px
  justify: left
  color:
    default: black
    active: null
    inactive: null
    background:
      active: null
      inactive: null

```
</td>
<td>
These CSS properties control the styling for the icon of button card.<br><br>
The <code>color</code> sub-key properties that controls the icon and icon background colors based on active/inactive state of a defined <code>entity:</code>
</td>
</tr>

</table>


<details closed><summary>Full YAML</summary>

```yaml
  variables:
    text:
      label:
        font_size: 20px
        font_weight: normal
        align: left
        align_items: center
        justify: center
        transform: none
        padding:
          top: 10px
          left: 0px
          right: 0px
          bottom: 10px
        color:
          default: var(--primary-text-color)
          'on': var(--primary-text-color)
          'off': var(--primary-text-color)
          zero: var(--lcars-green)
          non_zero: var(--lcars-blue)
          hvac_heat: var(--lcars-orange)
          hvac_cool: var(--lcars-blue)
          hvac_other: var(--lcars-purple)
      name:
        font_size: 20px
        font_weight: normal
        align: left
        align_items: center
        justify: center
        transform: none
        padding:
          top: 10px
          left: 0px
          right: 0px
          bottom: 10px
        color:
          default: var(--primary-text-color)
          'on': var(--primary-text-color)
          'off': var(--primary-text-color)
          zero: var(--lcars-green)
          non_zero: var(--lcars-blue)
          hvac_heat: var(--lcars-orange)
          hvac_cool: var(--lcars-blue)
          hvac_other: var(--lcars-purple)
      state:
        font_size: 20px
        font_weight: normal
        align: left
        align_items: center
        justify: center
        transform: none
        padding:
          top: 10px
          left: 0px
          right: 0px
          bottom: 10px
        color:
          default: var(--primary-text-color)
          'on': var(--primary-text-color)
          'off': var(--primary-text-color)
          zero: var(--lcars-green)
          non_zero: var(--lcars-blue)
          hvac_heat: var(--lcars-orange)
          hvac_cool: var(--lcars-blue)
          hvac_other: var(--lcars-purple)
    card:
      height: null
      min_height: 10px
      width: null
      color:
        active: var(--lcars-ui-secondary)
        inactive: var(--lcars-ui-tertiary)
        background:
          default: none
          active: transparent
          inactive: transparent
      border:
        top:
          left_radius: 0px
          right_radius: 0px
          size: 0px
        bottom:
          left_radius: 0px
          right_radius: 0px
          size: 0px
        left:
          size: 0px
        right:
          size: 0px
        inner:
          factor: 2
          min_radius: 30px
          width: 35px
        color: var(--lcars-card-top-color)
    icon:
      box_size: 35px
      size: 24px
      justify: left
      color:
        default: black
        active: null
        inactive: null
        background:
          active: null
          inactive: null
```
</details>