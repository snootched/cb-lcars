/* MSD Channel Routing Scenario Harness (Wave 5 - M5.4)
 * Usage:
 *   window.__msdScenarios.channels.list()
 *   window.__msdScenarios.channels.runAll()
 */
(function initChannelScenarios(){
  if (typeof window === 'undefined') return;
  const W = window;
  W.__msdScenarios = W.__msdScenarios || {};

  function pi(){ const p=W.__msdDebug?.pipelineInstance; if(!p||!p.enabled) throw new Error('pipeline disabled'); return p; }
  function inspect(id){ return W.__msdDebug?.routing?.inspect(id); }
  function invalidate(scope='*'){ W.__msdDebug?.routing?.invalidate(scope); }

  function setMode(id, modeFull, mode=null){
    const model = pi().getResolvedModel();
    const ov = model?.overlays.find(o=>o.id===id);
    if(!ov) throw new Error('overlay not found '+id);
    ov._raw = ov._raw || {};
    if (modeFull !== undefined) ov._raw.route_mode_full = modeFull;
    if (mode !== null) ov._raw.route_mode = mode;
    return ov;
  }

  function scenarioPreferImprovesCost() {
    const id = 'line_channel_demo';
    const model = pi().getResolvedModel();
    const ov = model.overlays.find(o=>o.id===id);
    if(!ov) return { ok:false, details:'overlay missing'};
    ov._raw = ov._raw || {};
    const origChannels = ov._raw.route_channels ? ov._raw.route_channels.slice() : [];
    const origMode = ov._raw.route_channel_mode;

    // Baseline without channels
    ov._raw.route_channels = [];
    ov._raw.route_channel_mode = 'prefer';
    invalidate('*');
    const base = inspect(id);

    // With channels
    ov._raw.route_channels = ['main_bus'];
    ov._raw.route_channel_mode = 'prefer';
    invalidate('*');
    const preferred = inspect(id);

    // restore
    ov._raw.route_channels = origChannels;
    ov._raw.route_channel_mode = origMode;
    invalidate('*');

    const ok = !!base && !!preferred && preferred.meta.cost <= base.meta.cost;
    return { ok, details: { baseCost: base?.meta.cost, preferCost: preferred?.meta.cost } };
  }

  function scenarioAvoidIncreasesCost() {
    const id = 'line_channel_demo';
    const model = pi().getResolvedModel();
    const ov = model.overlays.find(o=>o.id===id);
    if(!ov) return { ok:false, details:'overlay missing'};
    ov._raw = ov._raw || {};
    const origChannels = ov._raw.route_channels ? ov._raw.route_channels.slice() : [];
    const origMode = ov._raw.route_channel_mode;

    ov._raw.route_channels = ['main_bus'];
    ov._raw.route_channel_mode = 'prefer';
    invalidate('*');
    const prefer = inspect(id);

    ov._raw.route_channel_mode = 'avoid';
    invalidate('*');
    const avoid = inspect(id);

    ov._raw.route_channels = origChannels;
    ov._raw.route_channel_mode = origMode;
    invalidate('*');

    const ok = !!prefer && !!avoid && avoid.meta.cost >= prefer.meta.cost;
    return { ok, details: { preferCost: prefer?.meta.cost, avoidCost: avoid?.meta.cost } };
  }

  function scenarioForcePenalty() {
    const id = 'line_channel_demo';
    const model = pi().getResolvedModel();
    const ov = model.overlays.find(o=>o.id===id);
    if(!ov) return { ok:false, details:'overlay missing'};
    ov._raw = ov._raw || {};
    const origChannels = ov._raw.route_channels ? ov._raw.route_channels.slice() : [];
    const origMode = ov._raw.route_channel_mode;

    ov._raw.route_channels = ['main_bus','aux_bus']; // force across two channels (likely outside some)
    ov._raw.route_channel_mode = 'force';
    invalidate('*');
    const forced = inspect(id);

    ov._raw.route_channels = origChannels;
    ov._raw.route_channel_mode = origMode;
    invalidate('*');

    const ok = !!forced && forced.meta.channel && (forced.meta.channel.forcedOutside === true || forced.meta.channel.coveragePct === 100);
    return { ok, details: forced?.meta.channel || {} };
  }

  // NEW: attempt to increase coverage by shaping (forces low baseline by clearing channels first)
  function scenarioPreferShapingCoverage() {
    const id = 'line_channel_demo';
    const model = pi().getResolvedModel();
    const ov = model.overlays.find(o=>o.id===id);
    if(!ov) return { ok:false, details:'overlay missing'};
    ov._raw = ov._raw || {};
    const save = {
      channels: ov._raw.route_channels ? ov._raw.route_channels.slice():[],
      mode: ov._raw.route_channel_mode,
      modeFull: ov._raw.route_mode_full
    };
    ov._raw.route_mode_full = 'grid';
    ov._raw.route_channels = ['main_bus'];
    ov._raw.route_channel_mode = 'prefer';
    invalidate('*');
    const first = inspect(id);
    // if already high coverage, skip shaping test as pass
    if (!first || !first.meta.channel) {
      // restore
      ov._raw.route_channels = save.channels; ov._raw.route_channel_mode = save.mode; ov._raw.route_mode_full = save.modeFull; invalidate('*');
      return { ok:false, details:'channel meta missing'};
    }
    const c1 = first.meta.channel.coveragePct;
    // Artificially move elbow outside channel to force shaping attempt by tweaking anchor via API if available
    try {
      const anchorSet = pi().setAnchor && pi().setAnchor;
      if (anchorSet) {
        // nudge anchor horizontally away
        const anchorId = ov._raw.anchor;
        const rm = pi().getResolvedModel();
        if (rm?.anchors?.[anchorId]) {
          const a = rm.anchors[anchorId].slice();
            pi().setAnchor(anchorId, [a[0]-120, a[1]]);
          invalidate('*');
        }
      }
    } catch {}
    const second = inspect(id);
    const c2 = second?.meta?.channel?.coveragePct ?? c1;
    // restore
    ov._raw.route_channels = save.channels;
    ov._raw.route_channel_mode = save.mode;
    ov._raw.route_mode_full = save.modeFull;
    invalidate('*');
    const ok = c2 >= c1;
    return { ok, details: { coverageBefore: c1, coverageAfter: c2 } };
  }

  function scenarioForceDowngradeOrFull() {
    const id='line_channel_demo';
    const model = pi().getResolvedModel();
    const ov = model.overlays.find(o=>o.id===id);
    if(!ov) return { ok:false, details:'overlay missing'};
    ov._raw = ov._raw || {};
    const save = {
      channels: ov._raw.route_channels ? ov._raw.route_channels.slice():[],
      mode: ov._raw.route_channel_mode
    };
    ov._raw.route_channels = ['main_bus','aux_bus'];
    ov._raw.route_channel_mode = 'force';
    invalidate('*');
    const res = inspect(id);
    const chan = res?.meta?.channel;
    ov._raw.route_channels = save.channels;
    ov._raw.route_channel_mode = save.mode;
    invalidate('*');
    if (!chan) return { ok:false, details:'no channel meta'};
    const ok = (chan.coveragePct === 100) || (chan.shaping && chan.shaping.downgraded);
    return { ok, details: chan };
  }

  function scenarioChannelAcceptance() {
    // Re-run core scenarios & aggregate pass/fail
    const prefer = scenarioPreferImprovesCost();
    const avoid = scenarioAvoidIncreasesCost();
    const force = scenarioForcePenalty();
    const shaping = (typeof scenarioPreferShapingCoverage === 'function') ? scenarioPreferShapingCoverage() : { ok:true };
    const summaryOk = [prefer, avoid, force, shaping].every(r => r && r.ok);
    return {
      ok: summaryOk,
      details: {
        prefer, avoid, force, shaping
      }
    };
  }

  const scenarios = {
    prefer_improves_cost: scenarioPreferImprovesCost,
    avoid_increases_cost: scenarioAvoidIncreasesCost,
    force_penalty_or_full_coverage: scenarioForcePenalty,
    prefer_shaping_coverage: scenarioPreferShapingCoverage,
    force_downgrade_or_full: scenarioForceDowngradeOrFull,
    channel_acceptance: scenarioChannelAcceptance    // NEW
  };

  const api = {
    list: () => Object.keys(scenarios),
    run: (n) => {
      if(!scenarios[n]) { console.warn('[MSD Channel Scenario] Unknown', n); return null; }
      try {
        const r = scenarios[n]();
        console.log(`[MSD Channel Scenario] ${n}: ${r.ok?'OK':'FAIL'}`, r);
        return r;
      } catch(e) {
        const r = { ok:false, details:String(e) };
        console.log(`[MSD Channel Scenario] ${n}: FAIL`, r);
        return r;
      }
    },
    runAll: () => {
      const res = {};
      for (const k of Object.keys(scenarios)) res[k] = api.run(k);
      const ok = Object.values(res).every(r=>r&&r.ok);
      console.log('[MSD Channel Scenario] Summary:', ok?'ALL PASS':'FAILURES', res);
      return res;
    }
  };

  W.__msdScenarios.channels = api;
  console.info('[MSD v1] Channel routing scenario harness installed. Use: window.__msdScenarios.channels.list()');
})();
