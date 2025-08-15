/**
 * CB-LCARS MSD Validation utilities
 * - Enforces unique overlay ids
 * - Type-specific required fields checks
 * - Basic value sanity checks (attach_side/attach_align)
 *
 * All messages are returned; caller decides how to display/log them.
 */

/**
 * @typedef {Object} ValidationContext
 * @property {Array<Object>} overlays
 * @property {Record<string,[number,number]>} [anchors]
 * @property {[number,number,number,number]} [viewBox]
 */

/**
 * Validate a single overlay object by type.
 * Returns an array of warnings and errors (strings).
 * Missing id is an error for 'control', and a warning for other types (renderer can autogen ids).
 * @param {Object} ov
 * @param {number} index
 * @returns {{errors: string[], warnings: string[]}}
 */
function validateOverlayShape(ov, index) {
  const errors = [];
  const warnings = [];

  if (!ov || typeof ov !== 'object') {
    errors.push(`Overlay at index ${index} is not a valid object.`);
    return { errors, warnings };
  }

  const t = String(ov.type || '').trim().toLowerCase();
  if (!t) {
    errors.push(`Overlay at index ${index} is missing required "type".`);
    return { errors, warnings };
  }

  const id = ov.id;
  // ID policy: control must have an explicit id; others warn if missing.
  if (!id || typeof id !== 'string' || !id.trim()) {
    if (t === 'control') errors.push(`Control overlay at index ${index} requires an "id".`);
    else warnings.push(`Overlay type "${t}" at index ${index} has no "id" (renderer will autogenerate).`);
  }

  // Type-specific checks
  if (t === 'text') {
    if (ov.position === undefined) {
      warnings.push(`Text "${id ?? `text_${index}`}" is missing "position".`);
    }
  } else if (t === 'line') {
    const hasPoints = Array.isArray(ov.points) && ov.points.length >= 2;
    const hasSteps = Array.isArray(ov.steps) && ov.steps.length > 0;
    const hasAnchorAttach = (ov.anchor !== undefined) && (ov.attach_to !== undefined);
    if (!hasPoints && !hasSteps && !hasAnchorAttach) {
      errors.push(`Line "${id ?? `line_${index}`}" requires either "points" (>=2), "steps" (>0), or both "anchor" and "attach_to".`);
    }

    // attach_side / attach_align early sanity (if present)
    if (ov.attach_side !== undefined) {
      const side = String(ov.attach_side).toLowerCase();
      const allowedSides = ['auto', 'left', 'right', 'top', 'bottom'];
      if (!allowedSides.includes(side)) {
        warnings.push(`Line "${id ?? `line_${index}`}" has unsupported attach_side="${ov.attach_side}". Allowed: ${allowedSides.join(', ')}.`);
      }
    }
    if (ov.attach_align !== undefined) {
      const align = String(ov.attach_align).toLowerCase();
      const allowedAlign = ['center', 'start', 'end'];
      const isPercent = align.startsWith('percent:');
      const isToward = align === 'toward-anchor';
      if (!allowedAlign.includes(align) && !isPercent && !isToward) {
        warnings.push(`Line "${id ?? `line_${index}`}" has unsupported attach_align="${ov.attach_align}". Allowed: center|start|end|percent:<0-1>|toward-anchor.`);
      } else if (isPercent) {
        const v = Number(align.split(':')[1]);
        if (!Number.isFinite(v) || v < 0 || v > 1) {
          warnings.push(`Line "${id ?? `line_${index}`}" attach_align percent must be 0..1, got "${align}". Falling back to "center".`);
        }
      }
    }
  } else if (t === 'sparkline') {
    if (ov.position === undefined || ov.size === undefined) {
      errors.push(`Sparkline "${id ?? `spark_${index}`}" requires "position" and "size".`);
    }
    if (!ov.source) {
      errors.push(`Sparkline "${id ?? `spark_${index}`}" requires "source".`);
    }
  } else if (t === 'ribbon') {
    if (ov.position === undefined || ov.size === undefined) {
      errors.push(`Ribbon "${id ?? `ribbon_${index}`}" requires "position" and "size".`);
    }
    const hasSource = !!ov.source;
    const hasSources = Array.isArray(ov.sources) && ov.sources.length > 0;
    if (!hasSource && !hasSources) {
      errors.push(`Ribbon "${id ?? `ribbon_${index}`}" requires "source" or "sources".`);
    }
  } else if (t === 'control') {
    if (ov.position === undefined || ov.size === undefined) {
      errors.push(`Control "${id ?? `control_${index}`}" requires "position" and "size".`);
    }
    if (!ov.card || typeof ov.card !== 'object' || !ov.card.type) {
      errors.push(`Control "${id ?? `control_${index}`}" requires a valid "card" with "type".`);
    }
  } else if (t === 'free') {
    if (!ov.targets) {
      warnings.push(`Free overlay "${id ?? `free_${index}`}" has no "targets".`);
    }
  } else {
    warnings.push(`Overlay at index ${index} has unknown type "${ov.type}".`);
  }

  return { errors, warnings };
}

/**
 * Validate the overlays array (global + per-item rules).
 * @param {ValidationContext} ctx
 * @returns {{errors: string[], warnings: string[], detailsById: Record<string,{errors:string[],warnings:string[]}>}}
 */
export function validateOverlays(ctx) {
  const overlays = Array.isArray(ctx?.overlays) ? ctx.overlays : [];
  const errors = [];
  const warnings = [];
  const detailsById = {}; // id -> { errors:[], warnings:[] }

  // Unique id check
  const idMap = new Map(); // id -> firstIndex
  overlays.forEach((ov, i) => {
    const id = ov && typeof ov.id === 'string' ? ov.id.trim() : '';
    if (!id) return;
    if (idMap.has(id)) {
      const first = idMap.get(id);
      const msg = `Duplicate overlay id "${id}" found at indices ${first} and ${i}. Overlay ids must be unique.`;
      errors.push(msg);
      // Attribute duplicate to this id as well for per-id diagnostics
      detailsById[id] = detailsById[id] || { errors: [], warnings: [] };
      detailsById[id].errors.push(msg);
    } else {
      idMap.set(id, i);
    }
  });

  // Per-item validation
  overlays.forEach((ov, i) => {
    const v = validateOverlayShape(ov, i);
    errors.push(...v.errors);
    warnings.push(...v.warnings);
    const id = ov && typeof ov.id === 'string' ? ov.id.trim() : '';
    if (id) {
      detailsById[id] = detailsById[id] || { errors: [], warnings: [] };
      detailsById[id].errors.push(...v.errors);
      detailsById[id].warnings.push(...v.warnings);
    }
  });

  return { errors, warnings, detailsById };
}