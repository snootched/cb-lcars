/**
 * MSD Configuration Validation - Following Ratified Schema V1
 * Validates merged configuration against schema requirements
 */

export function validateMerged(config) {
  const issues = {
    errors: [],
    warnings: []
  };

  if (!config || typeof config !== 'object') {
    issues.errors.push({
      code: 'config.invalid',
      message: 'Configuration must be an object'
    });
    return issues;
  }

  // Core validation functions
  validateStructure(config, issues);
  validateAnchors(config, issues);
  validateOverlays(config, issues);
  validateRules(config, issues);
  validateAnimations(config, issues);
  validateProfiles(config, issues);
  validatePalettes(config, issues);
  validateRouting(config, issues);
  validateDuplicateIds(config, issues);

  return issues;
}

function validateStructure(config, issues) {
  // Version validation
  if (!config.version) {
    issues.warnings.push({
      code: 'version.missing',
      message: 'Missing version field - assuming version 1'
    });
  } else if (typeof config.version !== 'number' || config.version !== 1) {
    issues.errors.push({
      code: 'version.invalid',
      message: 'Version must be 1 (only supported version)'
    });
  }

  // View box validation
  if (config.view_box !== undefined) {
    const vb = config.view_box;
    if (vb !== 'auto' && (!Array.isArray(vb) || vb.length !== 4 || !vb.every(n => typeof n === 'number'))) {
      issues.errors.push({
        code: 'view_box.invalid',
        message: 'view_box must be "auto" or array of 4 numbers [x, y, width, height]'
      });
    }
  }
}

function validateAnchors(config, issues) {
  if (!config.anchors) return;

  Object.entries(config.anchors).forEach(([anchorId, coordinates]) => {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      issues.errors.push({
        code: 'anchor.coordinates.invalid',
        anchor_id: anchorId,
        message: `Anchor '${anchorId}' coordinates must be array of 2 elements [x, y]`
      });
      return;
    }

    coordinates.forEach((coord, index) => {
      const axis = index === 0 ? 'x' : 'y';
      if (typeof coord === 'string') {
        // Percentage validation
        if (!coord.endsWith('%') || isNaN(parseFloat(coord.slice(0, -1)))) {
          issues.errors.push({
            code: 'anchor.coordinates.invalid',
            anchor_id: anchorId,
            message: `Anchor '${anchorId}' ${axis}-coordinate '${coord}' must be number or percentage string`
          });
        }
      } else if (typeof coord !== 'number') {
        issues.errors.push({
          code: 'anchor.coordinates.invalid',
          anchor_id: anchorId,
          message: `Anchor '${anchorId}' ${axis}-coordinate must be number or percentage string`
        });
      }
    });
  });
}

function validateOverlays(config, issues) {
  if (!config.overlays) return;

  const anchors = new Set(Object.keys(config.anchors || {}));

  // Add overlay IDs as "virtual anchors" - any overlay can be an attachment target
  config.overlays.forEach(overlay => {
    if (overlay && overlay.id) {
      anchors.add(overlay.id); // Make overlay IDs valid anchor targets
    }
  });

  config.overlays.forEach(overlay => {
    if (!overlay.id) {
      issues.errors.push({
        code: 'id.missing',
        collection: 'overlays',
        message: 'Overlay missing required id field'
      });
      return;
    }

    if (!overlay.type) {
      issues.errors.push({
        code: 'overlay.type.missing',
        overlay_id: overlay.id,
        message: `Overlay '${overlay.id}' missing required type field`
      });
    }

    // Validate position/anchor references
    ['anchor', 'attach_to'].forEach(field => {
      if (overlay[field]) {
        if (typeof overlay[field] === 'string' && !anchors.has(overlay[field])) {
          issues.errors.push({
            code: 'anchor.missing',
            collection: 'overlays',
            item_id: overlay.id,
            anchor: overlay[field],
            message: `Overlay '${overlay.id}' references missing anchor '${overlay[field]}'`
          });
        } else if (Array.isArray(overlay[field])) {
          validateCoordinateArray(overlay[field], issues, `Overlay '${overlay.id}' ${field}`);
        }
      }
    });

    console.debug(`[Validation] Validating overlay properties for ${overlay.id}:`, {
      type: overlay.type,
      anchor_side: overlay.anchor_side,
      attach_side: overlay.attach_side,
      anchor_gap: overlay.anchor_gap,
      attach_gap: overlay.attach_gap,
      allKeys: Object.keys(overlay)
    });

    // Validate anchor_side property
    if (overlay.anchor_side !== undefined) {
      const validSides = [
        'center', 'top', 'bottom', 'left', 'right',
        'topLeft', 'topRight', 'bottomLeft', 'bottomRight',
        'top-left', 'top-right', 'bottom-left', 'bottom-right'
      ];
      if (!validSides.includes(overlay.anchor_side)) {
        issues.errors.push({
          code: 'anchor_side.invalid',
          overlay_id: overlay.id,
          anchor_side: overlay.anchor_side,
          message: `Overlay '${overlay.id}' has invalid anchor_side '${overlay.anchor_side}'. Valid values: ${validSides.join(', ')}`
        });
      }
    }

    // Validate attach_side property (ensure consistency with anchor_side validation)
    if (overlay.attach_side !== undefined) {
      const validSides = [
        'center', 'top', 'bottom', 'left', 'right',
        'topLeft', 'topRight', 'bottomLeft', 'bottomRight',
        'top-left', 'top-right', 'bottom-left', 'bottom-right'
      ];
      if (!validSides.includes(overlay.attach_side)) {
        issues.errors.push({
          code: 'attach_side.invalid',
          overlay_id: overlay.id,
          attach_side: overlay.attach_side,
          message: `Overlay '${overlay.id}' has invalid attach_side '${overlay.attach_side}'. Valid values: ${validSides.join(', ')}`
        });
      }
    }

    // Validate anchor_gap property
    if (overlay.anchor_gap !== undefined && typeof overlay.anchor_gap !== 'number') {
      issues.errors.push({
        code: 'anchor_gap.invalid',
        overlay_id: overlay.id,
        anchor_gap: overlay.anchor_gap,
        message: `Overlay '${overlay.id}' anchor_gap must be a number`
      });
    }

    // Validate attach_gap property (ensure consistency)
    if (overlay.attach_gap !== undefined && typeof overlay.attach_gap !== 'number') {
      issues.errors.push({
        code: 'attach_gap.invalid',
        overlay_id: overlay.id,
        attach_gap: overlay.attach_gap,
        message: `Overlay '${overlay.id}' attach_gap must be a number`
      });
    }

    if (overlay.position && Array.isArray(overlay.position)) {
      validateCoordinateArray(overlay.position, issues, `Overlay '${overlay.id}' position`);
    }

    // Validate animation references
    if (overlay.animation_ref && config.animations) {
      const animExists = config.animations.some(anim => anim.id === overlay.animation_ref);
      if (!animExists) {
        issues.errors.push({
          code: 'animation.missing',
          overlay_id: overlay.id,
          animation_ref: overlay.animation_ref,
          message: `Overlay '${overlay.id}' references missing animation '${overlay.animation_ref}'`
        });
      }
    }
  });
}

function validateRules(config, issues) {
  if (!config.rules) return;

  config.rules.forEach(rule => {
    if (!rule.id) {
      issues.errors.push({
        code: 'id.missing',
        collection: 'rules',
        message: 'Rule missing required id field'
      });
      return;
    }

    if (!rule.when) {
      issues.errors.push({
        code: 'rule.when.missing',
        rule_id: rule.id,
        message: `Rule '${rule.id}' missing required when conditions`
      });
      return;
    }

    // Validate when conditions structure
    const hasAll = Array.isArray(rule.when.all);
    const hasAny = Array.isArray(rule.when.any);

    if (!hasAll && !hasAny) {
      issues.errors.push({
        code: 'rule.when.invalid',
        rule_id: rule.id,
        message: `Rule '${rule.id}' when must have 'all' or 'any' array of conditions`
      });
    }

    // Validate time_between format
    [...(rule.when.all || []), ...(rule.when.any || [])].forEach(condition => {
      if (condition.time_between) {
        if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(condition.time_between)) {
          issues.errors.push({
            code: 'rule.time_between.invalid',
            rule_id: rule.id,
            message: `Rule '${rule.id}' time_between must be format "HH:MM-HH:MM"`
          });
        }
      }

      // Validate regex patterns
      if (condition.regex) {
        try {
          new RegExp(condition.regex);
        } catch (e) {
          issues.warnings.push({
            code: 'rule.regex.invalid',
            rule_id: rule.id,
            message: `Rule '${rule.id}' has invalid regex pattern - rule will be ignored`
          });
        }
      }
    });

    // Validate priority
    if (rule.priority !== undefined && (!Number.isInteger(rule.priority))) {
      issues.errors.push({
        code: 'rule.priority.invalid',
        rule_id: rule.id,
        message: `Rule '${rule.id}' priority must be an integer`
      });
    }
  });
}

function validateAnimations(config, issues) {
  if (!config.animations) return;

  config.animations.forEach(animation => {
    if (!animation.id) {
      issues.errors.push({
        code: 'id.missing',
        collection: 'animations',
        message: 'Animation missing required id field'
      });
      return;
    }

    if (!animation.preset) {
      issues.errors.push({
        code: 'animation.preset.missing',
        animation_id: animation.id,
        message: `Animation '${animation.id}' missing required preset field`
      });
    }

    // Validate duration
    if (animation.params?.duration && typeof animation.params.duration !== 'number') {
      issues.errors.push({
        code: 'animation.duration.invalid',
        animation_id: animation.id,
        message: `Animation '${animation.id}' duration must be a number (milliseconds)`
      });
    }
  });
}

function validateProfiles(config, issues) {
  if (!config.profiles) return;

  config.profiles.forEach(profile => {
    if (!profile.id) {
      issues.errors.push({
        code: 'id.missing',
        collection: 'profiles',
        message: 'Profile missing required id field'
      });
    }
  });

  // Validate active_profiles references
  if (config.active_profiles) {
    if (!Array.isArray(config.active_profiles)) {
      issues.errors.push({
        code: 'active_profiles.invalid',
        message: 'active_profiles must be an array of profile IDs'
      });
    } else {
      const profileIds = new Set((config.profiles || []).map(p => p.id));
      config.active_profiles.forEach(profileId => {
        if (!profileIds.has(profileId)) {
          issues.warnings.push({
            code: 'profile.missing',
            profile_id: profileId,
            message: `active_profiles references missing profile '${profileId}'`
          });
        }
      });
    }
  }
}

function validatePalettes(config, issues) {
  if (!config.palettes) return;

  Object.entries(config.palettes).forEach(([paletteName, tokens]) => {
    if (typeof tokens !== 'object' || Array.isArray(tokens)) {
      issues.errors.push({
        code: 'palette.tokens.invalid',
        palette_name: paletteName,
        message: `Palette '${paletteName}' tokens must be an object`
      });
    }
  });
}

function validateRouting(config, issues) {
  if (!config.routing) return;

  const routing = config.routing;

  // Validate clearance
  if (routing.clearance !== undefined && typeof routing.clearance !== 'number') {
    issues.errors.push({
      code: 'routing.clearance.invalid',
      message: 'routing.clearance must be a number'
    });
  }

  // Validate grid_resolution
  if (routing.grid_resolution !== undefined && typeof routing.grid_resolution !== 'number') {
    issues.errors.push({
      code: 'routing.grid_resolution.invalid',
      message: 'routing.grid_resolution must be a number'
    });
  }

  // Validate smoothing_mode
  if (routing.smoothing_mode !== undefined) {
    const validModes = ['none', 'chaikin'];
    if (!validModes.includes(routing.smoothing_mode)) {
      issues.warnings.push({
        code: 'routing.smoothing_mode.invalid',
        message: `routing.smoothing_mode '${routing.smoothing_mode}' invalid, using 'none'`
      });
    }
  }
}

function validateDuplicateIds(config, issues) {
  const collections = ['overlays', 'rules', 'animations', 'profiles', 'timelines'];

  collections.forEach(collection => {
    const items = config[collection] || [];
    const seenIds = new Set();

    items.forEach((item, index) => {
      if (!item || !item.id) {
        issues.errors.push({
          code: 'id.missing',
          collection,
          index,
          message: `Missing id in ${collection} item at index ${index}`
        });
        return;
      }

      if (seenIds.has(item.id)) {
        issues.errors.push({
          code: 'duplicate.id',
          collection,
          id: item.id,
          message: `Duplicate ${collection} ID: ${item.id}`
        });
      } else {
        seenIds.add(item.id);
      }
    });
  });
}

function validateCoordinateArray(coords, issues, context) {
  if (!Array.isArray(coords) || coords.length !== 2) {
    issues.errors.push({
      code: 'coordinates.invalid',
      message: `${context} must be array of 2 elements [x, y]`
    });
    return;
  }

  coords.forEach((coord, index) => {
    const axis = index === 0 ? 'x' : 'y';
    if (typeof coord === 'string') {
      if (!coord.endsWith('%') || isNaN(parseFloat(coord.slice(0, -1)))) {
        issues.errors.push({
          code: 'coordinates.invalid',
          message: `${context} ${axis}-coordinate '${coord}' must be number or percentage string`
        });
      }
    } else if (typeof coord !== 'number') {
      issues.errors.push({
        code: 'coordinates.invalid',
        message: `${context} ${axis}-coordinate must be number or percentage string`
      });
    }
  });
}

