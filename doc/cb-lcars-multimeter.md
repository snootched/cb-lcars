LCARS Multimeter Template [`cb-lcars-multimeter`]

This is an adaptable card that gives the LCARS look of sliders/gauges/icons bordered by a button/frame as seen in many Picard screens<br>

<table>
<tr>
<td> <code>variables:</code> YAML Section</td> <td> Description </td>
</tr>

<tr>
<td>

```yaml
 variables:
    card:
      width: 500px
      height: 60px
    panel:
      width: 380px
      height: 50px
      padding:
        top: 5px
        left: 5px
        right: 0px
        bottom: 0px
      mode: slider
```
</td>
<td>
Variables to set the overall card dimensions.<br><br>
The <code>panel:</code> is the area where the contol lives.  You can set the panel dimensions, and the button/frame dimensions are automatically calculated based on the overall card minus the panel.  <code>padding:</code> controls the border/gap between the controls and the framing.<br>
<br>
Panel <code>mode:</code> can be <code> slider | gauge | icons </code> (default: slider)<br><br>

![multimeter-1](../images/button_samples/cb-lcars-multimeter.png)
</td>
</tr>

<tr>
<td>

```yaml
variables:
  .
  .
  .
  entity_match_gauge: false
  entity_match_header: false
  entity_match_slider_start: false
  entity_match_slider_end: false 

```
</td>
<td>
These options will match elements to the color of the entity.<br><br>
Gauge (the slider bar)<br>
Header (the button/framing around the panel)<br>
Slider Start/End (gradient position on the slider)
</td>
</tr>



</table>


<details closed><summary>Full YAML</summary>

```yaml
  variables:
    card:
      width: 500px
      height: 60px
    panel:
      width: 380px
      height: 50px
      padding:
        top: 5px
        left: 5px
        right: 0px
        bottom: 0px
      mode: slider
    entity: '[[[ return entity.entity_id ]]]'
    entity_color: '[[[ return variables.__get_light_css_color(variables.entity) ]]]'
    entity_match_gauge: false
    entity_match_slider: '[[[ return variables.entity_match_gauge ]]]'
    entity_match_header: false
    entity_match_slider_start: false
    entity_match_slider_end: false
    slider:
      entity: '[[[ return variables.entity ]]]'
      entity_match_slider_start: '[[[ return variables.entity_match_slider_start ]]]'
      entity_match_slider_end: '[[[ return variables.entity_match_slider_end ]]]'
    gauge:
      entity: '[[[ return variables.entity ]]]'
      entity_match_slider: '[[[ return variables.entity_match_slider ]]]'
    label: null
    header_button:
      variables:
        text:
          label:
            font_size: 24px
          state:
            font_size: 24px
          name:
            font_size: 24px
        card:
          color:
            active: >
              [[[ return  variables.entity_match_header ?
              variables.entity_color :

              "var(--lcars-ui-secondary)" ]]]
            inactive: var(--lcars-ui-primary)
            background:
              active: >
                [[[ return  variables.entity_match_header ?
                variables.entity_color :

                "var(--lcars-ui-secondary)" ]]]
              inactive: var(--lcars-ui-primary)
            border: null
        icon:
          color:
            active: null
            inactive: null
            background:
              active: null
              inactive: null
```
</details>