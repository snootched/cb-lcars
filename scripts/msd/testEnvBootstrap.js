// Provide minimal window + performance + crypto for modules expecting browser.
if (typeof global.window === 'undefined') {
  global.window = global;
}
if (!global.window.__msdDebug) {
  global.window.__msdDebug = {
    featureFlags: {
      msd_packs_v1_enabled: true,
      msd_external_enabled: false
    },
    packs: {
      core: { animations:[], rules:[], profiles:[], overlays:[], timelines:[] },
      builtin: {}
    }
  };
}
// Polyfill performance.now if missing.
if (typeof performance === 'undefined') {
  global.performance = { now: () => Date.now() };
}
// Ensure crypto.subtle (Node 16+: use webcrypto)
if (!global.crypto || !crypto.subtle) {
  try {
    const { webcrypto } = await import('crypto');
    global.crypto = webcrypto;
  } catch {
    throw new Error('WebCrypto not available; upgrade Node for checksum tests');
  }
}
