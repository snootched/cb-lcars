import { linearMap } from '../util/linearMap.js';

export function compileRule(rule, issues) {
  const raw = rule.when;
  const compiled = {
    tree: raw ? compileNode(raw, issues, rule.id) : alwaysTrueNode(),
    deps: {
      entities: new Set(),
      perf: new Set(),
      flags: new Set()
    }
  };
  collectDeps(compiled.tree, compiled.deps);
  return compiled;
}

function compileNode(node, issues, ruleId) {
  if (!node) return alwaysTrueNode();
  if (Array.isArray(node)) {
    return { type: 'all', nodes: node.map(n => compileNode(n, issues, ruleId)) };
  }
  if (node.all) {
    return { type: 'all', nodes: node.all.map(n => compileNode(n, issues, ruleId)) };
  }
  if (node.any) {
    return { type: 'any', nodes: node.any.map(n => compileNode(n, issues, ruleId)) };
  }
  if (node.not) {
    return { type: 'not', node: compileNode(node.not, issues, ruleId) };
  }
  if (node.map_range_cond) {
    const c = { ...node.map_range_cond };
    return { type: 'map_range_cond', c };
  }
  if (node.entity || node.entity_attr) {
    return { type: node.entity ? 'entity' : 'entity_attr', c: node };
  }
  if (node.time_between) {
    return { type: 'time_between', range: node.time_between };
  }
  if (node.weekday_in) {
    return { type: 'weekday_in', list: node.weekday_in };
  }
  if (node.sun_elevation) {
    return { type: 'sun_elevation', cmp: node.sun_elevation };
  }
  if (node.perf_metric) {
    return { type: 'perf_metric', c: node.perf_metric };
  }
  if (node.flag) {
    return { type: 'flag', c: node.flag };
  }
  if (node.random_chance != null) {
    return { type: 'random_chance', p: node.random_chance };
  }
  // Fallback treat as entity-like invalid condition → always false
  return { type: 'invalid', reason: 'unrecognized', raw: node };
}

function collectDeps(node, deps) {
  switch (node.type) {
    case 'all':
    case 'any':
      node.nodes.forEach(n => collectDeps(n, deps));
      break;
    case 'not':
      collectDeps(node.node, deps);
      break;
    case 'entity':
    case 'entity_attr':
    case 'map_range_cond':
      if (node.c?.entity) deps.entities.add(node.c.entity);
      break;
    case 'perf_metric':
      if (node.c?.key) deps.perf.add(node.c.key);
      break;
    case 'flag':
      if (node.c?.debugFlagName) deps.flags.add(node.c.debugFlagName);
      break;
  }
}

function alwaysTrueNode() {
  return { type: 'always' };
}

export function evalCompiled(tree, ctx) {
  switch (tree.type) {
    case 'always': return true;
    case 'all': return tree.nodes.every(n => evalCompiled(n, ctx));
    case 'any': return tree.nodes.some(n => evalCompiled(n, ctx));
    case 'not': return !evalCompiled(tree.node, ctx);
    case 'entity': return evalEntity(tree.c, ctx);
    case 'entity_attr': return evalEntityAttr(tree.c, ctx);
    case 'map_range_cond': return evalMapRangeCond(tree.c, ctx);
    case 'time_between': return evalTimeBetween(tree.range, ctx);
    case 'weekday_in': return evalWeekdayIn(tree.list, ctx);
    case 'sun_elevation': return evalSunElevation(tree.cmp, ctx);
    case 'perf_metric': return evalPerfMetric(tree.c, ctx);
    case 'flag': return evalFlag(tree.c, ctx);
    case 'random_chance': return Math.random() < (tree.p || 0);
    default: return false;
  }
}

function getEntity(c, ctx) {
  if (!c.entity) return null;
  return ctx.getEntity?.(c.entity) || null;
}

function evalEntity(c, ctx) {
  const ent = getEntity(c, ctx);
  if (!ent) return false;
  const valRaw = ent.state;
  return compareValue(valRaw, c);
}

function evalEntityAttr(c, ctx) {
  const ent = getEntity(c, ctx);
  if (!ent) return false;
  const attrName = c.attribute;
  if (!attrName) return false;
  const valRaw = ent.attributes ? ent.attributes[attrName] : undefined;
  return compareValue(valRaw, c);
}

function evalMapRangeCond(c, ctx) {
  const ent = getEntity(c, ctx);
  if (!ent) return false;
  const val = Number(ent.state);
  if (!Number.isFinite(val)) return false;
  const [inA, inB] = c.input || [];
  const [outA, outB] = c.output || [];
  if (![inA,inB,outA,outB].every(Number.isFinite)) return false;
  const mapped = linearMap(val, inA, inB, outA, outB, c.clamp);
  return compareValue(mapped, c);
}

function compareValue(valRaw, c) {
  const num = Number(valRaw);
  const isNum = Number.isFinite(num);
  if (c.equals != null) return valRaw == c.equals;
  if (c.not_equals != null) return valRaw != c.not_equals;
  if (c.in) return Array.isArray(c.in) && c.in.includes(valRaw);
  if (c.not_in) return Array.isArray(c.not_in) && !c.not_in.includes(valRaw);
  if (c.regex) {
    try {
      const re = new RegExp(c.regex);
      return re.test(String(valRaw));
    } catch {
      return false;
    }
  }
  if (c.above != null && isNum && !(num > c.above)) return false;
  if (c.below != null && isNum && !(num < c.below)) return false;
  if (c.above != null || c.below != null) return true;
  // If only equals-like handled earlier; default false unless no operator (treated as truthy existence)
  return c.equals == null && c.not_equals == null && c.in == null && c.not_in == null && c.regex == null ? !!valRaw : false;
}

function evalTimeBetween(range, ctx) {
  if (typeof range !== 'string') return false;
  const m = range.match(/^(\d\d):(\d\d)-(\d\d):(\d\d)$/);
  if (!m) return false;
  const now = ctx.now ? new Date(ctx.now) : new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  if (start <= end) return mins >= start && mins <= end;
  // wrap past midnight
  return mins >= start || mins <= end;
}

function evalWeekdayIn(list, ctx) {
  if (!Array.isArray(list) || !list.length) return false;
  const wd = (ctx.now ? new Date(ctx.now) : new Date()).getDay(); // 0=Sun
  const map = ['sun','mon','tue','wed','thu','fri','sat'];
  return list.map(s => s.toLowerCase()).includes(map[wd]);
}

function evalSunElevation(cmp, ctx) {
  const elev = ctx.sun?.elevation;
  if (!Number.isFinite(elev)) return false;
  if (cmp.above != null && !(elev > cmp.above)) return false;
  if (cmp.below != null && !(elev < cmp.below)) return false;
  return true;
}

function evalPerfMetric(c, ctx) {
  const val = ctx.getPerf?.(c.key);
  const num = Number(val);
  if (!Number.isFinite(num)) return false;
  if (c.above != null && !(num > c.above)) return false;
  if (c.below != null && !(num < c.below)) return false;
  if (c.equals != null) return num == c.equals;
  return true;
}

function evalFlag(c, ctx) {
  const val = ctx.flags?.[c.debugFlagName];
  if (c.is === true) return !!val;
  if (c.is === false) return !val;
  return !!val;
}
