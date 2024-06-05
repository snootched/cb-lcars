LCARS Base Template [`cb-lcars-base`]




| YAML section | Property/Key | Type | Default     | Description |
|--------------|--------------|------|-------------|-------------|
| `text:`<br>&nbsp;&nbsp;`label:` | | |  | `label:`,`name:`,`state:` have the same set of properties.
| | `font_size` | String | normal  | .. |
| | `font_weight` | String | left  | .. |
| | `align` | String | center  | .. |
| | `align_items` | String | center  | .. |
| | `justify` | String | 20px  | .. |
| | `transform` | String | none  | Apply a text transform such as `uppercase` |
| | `padding:`<br>&nbsp;&nbsp;`top:`<br>&nbsp;&nbsp;`left:`<br>&nbsp;&nbsp;`right:`<br>&nbsp;&nbsp;`bottom:` | String | 10px<br>0px<br>0px<br>10px  | Padding around text for positioning. |
| | `color:`<br>&nbsp;&nbsp;`default:`<br>&nbsp;&nbsp;`'on':`<br>&nbsp;&nbsp;`'off':`<br>&nbsp;&nbsp;`zero:`<br>&nbsp;&nbsp;`non_zero:`<br>&nbsp;&nbsp;`hvac_heat:`<br>&nbsp;&nbsp;`hvac_cool:`<br>&nbsp;&nbsp;`hvac_other:` | String/CSS variable | var(--primary-text-color)<br>var(--primary-text-color)<br>var(--primary-text-color)<br>var(--lcars-green)<br>var(--lcars-blue)<br>var(--lcars-orange)<br>var(--lcars-blue)<br>var(--lcars-purple)<br>  | Default colors based on the current state of the `entity:` when defined. |







<table>
<tr>
<td> YAML </td> <td> Result </td>
</tr>
<tr>
<td>

```yaml
variables:
  text:
    label:
      font_size: 20px
```
</td>
<td>
blah
</td>
</tr>

<tr>
<td>
       

        font_weight: normal

</td>     
<td>
shiiiet
</td>
<td>
        align: left
<td>

</td>
</table>



```yaml
  variables:
    text:
      label:
        font_size: 20px
        font_weight: normal                          #inline
        align: left                                  #fdsa
        align_items: center                          #fdsa
        justify: center
        transform: none
        padding:
          top: 10px
          left: 0px                                  #fads
          right: 0px
          bottom: 10px
        color:
          default: var(--primary-text-color)         #inline comment
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