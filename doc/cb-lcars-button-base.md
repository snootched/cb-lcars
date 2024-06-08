LCARS Base Template [`cb-lcars-button-base`]

This is the base card for buttons.<br>
This builds on top of [`cb-lcars-base`](cb-lcars-base.md) for the card, and adds specific settings for buttons that descend from it.<br>
<br>
You do not include this template in your dashboards - it is used to build new controls only.<br>
<br>
You would, however, be able to override variables from this template in your instance of a card on the dashboard.
<table>
<tr>
<td> <code>variables:</code> YAML Section</td> <td> Description </td>
</tr>

<tr>
<td>

```yaml
  variables:
    label: ' '
    card:
      height: 60px
      min_height: 45px
      color:
        active: var(--lcars-ui-secondary)
        inactive: var(--lcars-ui-tertiary)
        background:
          default: null
          active: var(--lcars-ui-secondary)
          inactive: var(--lcars-ui-tertiary)
```
</td>
<td>
These CSS properties for setting the button height, min-height, and colors.
</td>
</tr>

<tr>
<td>

```yaml
variables:
  .
  .
  .
  text:
    label:
      padding:
        top: 5px
        bottom: 5px
        right: 24px
        left: 24px
      transform: uppercase
      font_size: null
      justify: right
      align_items: end
      color:
        default: black
        'on': black
        'off': black
        zero: black
        non_zero: black
    state:
      padding:
        top: 5px
        bottom: 5px
        right: 24px
        left: 24px
      transform: uppercase
      font_size: null
      justify: right
      align_items: end
      color:
        default: black
        'on': black
        'off': black
        zero: black
        non_zero: black
    name:
      padding:
        top: 5px
        bottom: 5px
        right: 24px
        left: 24px
      transform: uppercase
      font_size: null
      justify: right
      align_items: end
      color:
        default: black
        'on': black
        'off': black
        zero: black
        non_zero: black

```
</td>
<td>
Default text settings for <code>label</code>, <code>name</code> and <code>state</code> fields.  Default styling is black text, forced uppercase. and positioned in bottom right of the button.
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
    size: 24px
    color:
    default: black
    justify: left
    border:
      top:
        size: 0px
        color: transparent
      bottom:
        size: 0px
        color: transparent
      right:
        size: 6px
        color: black
        padding: 1.0%
        margin: 0
      left:
        size: 6px
        color: transparent
        padding: 1.0%
        margin: null

```
</td>
<td>
Default icon style (if <code>show_icon: true</code> is set)<br>
Icon is by default on the left side of the button and has a thin black border to the right as to appear separated.
</td>
</tr>

</table>


<details closed><summary>Full YAML</summary>

```yaml
  variables:
    label: ' '
    card:
      height: 60px
      min_height: 45px
      color:
        active: var(--lcars-ui-secondary)
        inactive: var(--lcars-ui-tertiary)
        background:
          default: null
          active: var(--lcars-ui-secondary)
          inactive: var(--lcars-ui-tertiary)
    text:
      label:
        padding:
          top: 5px
          bottom: 5px
          right: 24px
          left: 24px
        transform: uppercase
        font_size: null
        justify: right
        align_items: end
        color:
          default: black
          'on': black
          'off': black
          zero: black
          non_zero: black
      state:
        padding:
          top: 5px
          bottom: 5px
          right: 24px
          left: 24px
        transform: uppercase
        font_size: null
        justify: right
        align_items: end
        color:
          default: black
          'on': black
          'off': black
          zero: black
          non_zero: black
      name:
        padding:
          top: 5px
          bottom: 5px
          right: 24px
          left: 24px
        transform: uppercase
        font_size: null
        justify: right
        align_items: end
        color:
          default: black
          'on': black
          'off': black
          zero: black
          non_zero: black
    icon:
      size: 24px
      color:
        default: black
      justify: left
      border:
        top:
          size: 0px
          color: transparent
        bottom:
          size: 0px
          color: transparent
        right:
          size: 6px
          color: black
          padding: 1.0%
          margin: 0
        left:
          size: 6px
          color: transparent
          padding: 1.0%
          margin: null
  size: 1.75em
```
</details>