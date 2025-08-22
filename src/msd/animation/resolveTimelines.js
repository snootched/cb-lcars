import { deepMerge } from '../util/deepMerge.js';

export function resolveDesiredTimelines(timelineDefs = []) {
  return timelineDefs.map(tl => {
    const globals = { ...(tl.globals || {}) };
    const steps = (tl.steps || []).map(s => ({
      targets: s.targets,
      preset: s.preset,
      params: deepMerge({}, s.params || {}),
      offset: s.offset
    }));
    return {
      id: tl.id,
      globals,
      steps
    };
  });
}
