import './testEnvBootstrap.js';
import { stableStringify } from '../../src/msd/packs/checksum.js';
import { installWindowStub, assert, pass, summarize, snapshot } from './_testUtils.js';

installWindowStub();

const o1 = { b:2, a:1, z:{ k:5, a:3, m:{ y:9, a:1 } }, arr:[{ b:2, a:1 }, { z:3, y:2 }] };
const o2 = { z:{ m:{ a:1, y:9 }, k:5, a:3 }, a:1, b:2, arr:[{ a:1, b:2 }, { y:2, z:3 }] };

const s1 = stableStringify(o1);
const s2 = stableStringify(o2);
assert(s1 === s2, 'stableStringify should produce identical ordering independent of input key order');

const snap1 = snapshot(o1, stableStringify);
const snap2 = snapshot(o2, stableStringify);
assert(snap1 === snap2, 'snapshot hash must match');

// NEW: nested array/object determinism cases
const n1 = { arr:[ { b:2, a:1 }, { d:4, c:3 } ] };
const n2 = { arr:[ { a:1, b:2 }, { c:3, d:4 } ] };
assert(stableStringify(n1) === stableStringify(n2), 'object key order inside arrays normalized');

const n3 = { wrap:{ list:[ { x:1, y:2 }, { y:3, x:4 } ] } };
const n4 = { wrap:{ list:[ { y:2, x:1 }, { x:4, y:3 } ] } };
assert(stableStringify(n3) === stableStringify(n4), 'nested arrays of objects stable');

pass('stableStringify deterministic for nested objects & arrays');
summarize('testStableStringify');

// Mutation safety
const orig = { a: { b:2, a:1 } };
const before = JSON.stringify(orig);
stableStringify(orig);
assert('no mutation of source object', before === JSON.stringify(orig));

console.log('[test:stable] COMPLETE');
