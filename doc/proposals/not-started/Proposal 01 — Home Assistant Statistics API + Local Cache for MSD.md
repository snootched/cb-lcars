# Proposal 01 — Home Assistant Statistics API + Local Cache for MSD

Version: 1.0.0  
Date: 2025-10-20  
Author: CB-LCARS MSD Team (proposal drafted by @snootched via Copilot Space)

Status: Proposed — Not Started

---

Table of contents
- Summary
- Motivation & goals
- Background: History vs Statistics in Home Assistant
- High-level design
  - Where this fits in MSD pipeline
  - Optional, opt-in behaviour
- Configuration (YAML): examples & schema
- DataSource / DataSourceManager changes
- Cache design
  - storage backend
  - keys & validation
  - eviction & TTL policy
  - compression
- Statistics path design (recorder/statistics_during_period)
  - mapping statistics types (mean/max/min/sum/state)
  - alignment & display timestamp rules
- UI / UX considerations
  - "No data", "Loading from cache", "Stale" indicators
- Implementation plan (phases & milestones)
- Testing strategy
- Backwards compatibility & migration concerns
- Performance & security notes
- Acceptance criteria
- Appendix: short pseudocode for core methods

---

Summary

Add optional support for Home Assistant's Statistics API as an alternative/higher-level path for loading long-range, aggregated historical data and add an optional, local, short-lived persistent cache for datasource history to improve load time and reduce HA recorder API load — particularly useful for lower-powered devices and mobile reloads.

Both features are opt-in per-datasource (or global defaults) and preserve the MSD's streaming-first design: streaming (live) updates remain the canonical real-time source; statistics + cache only affect how historical data is preloaded and bootstrap performance.

Motivation & goals

- Improve initial load time on low-powered devices and mobile (fast rebuilds after page refresh).
- Reduce load on HA recorder and HTTP/WebSocket endpoints when many dashboards/cards reload.
- Provide an efficient path for long-range trend charts (days → months) using HA's aggregated statistics (low-resolution but performant).
- Keep behavior opt-in and predictable to users; no surprises.
- Reuse patterns proven by major community cards (apexcharts-card) but keep MSD's architecture and streaming-first semantics.

Background: History vs Statistics in Home Assistant

- History (history/period API): raw state changes, high resolution, expensive for long periods.
- Statistics (recorder/statistics_during_period WS method): recorder produces aggregated values by period (5min/hour/day/week/month), returning fields like mean, min, max, sum, and state. Great for long-range trend queries and much lighter for both HA and frontend.

RomRider's apexcharts-card uses both strategies: history for fine-grain recent data, statistics for aggregated long-range. We will adopt a similar idea but integrated into MSD's DataSourceManager and optional cache.

High-level design

Where this fits in MSD pipeline
- DataSource (MsdDataSource) already performs:
  - live streaming via WebSocket subscribe to state_changed
  - in-memory rolling buffer for live values
  - optional history preload on initialization
- Proposal adds:
  1. Optional "statistics" preload path that requests recorder statistics for range and period, converts returned bucketed statistics into [timestamp, value] points for the buffer.
  2. Optional local persistent cache (IndexedDB via localforage) to store recent historical data for datasources across reloads and to enable incremental updates (fetch only since last cached timestamp).

Optional, opt-in behaviour
- Both features are opt-in on a per-datasource basis using `statistics` and `cache` keys in datasource configuration.
- Reason: existing MSD users should not experience behavior changes unless they enable them.

Configuration (YAML) — examples & schema

High level: `msd.datasources` (example excerpt)

```yaml
msd:
  datasources:
    - id: warp_core_power
      entity: sensor.warp_core_power
      history:
        enabled: true
        hours: 168  # fallback historical load window (7 days)
      statistics:
        enabled: true        # enable statistics preload
        period: hour         # 5minute | hour | day | week | month
        type: mean           # mean | max | min | sum | state
        align: middle        # middle | start | end (display timestamp alignment)
      cache:
        enabled: true
        ttl: 30m             # 30 minutes cache validity
        compress: true       # use lz-string compression in IndexedDB
        max_points: 20000    # soft upper limit for points stored
```

Schema notes (informal):
- `statistics` is optional object with { enabled: boolean, period: string, type: string, align: string }.
- `cache` is optional object with { enabled: boolean, ttl: duration-string, compress: boolean, max_points: number }.
- If `statistics.enabled` is true and statistics are available for that entity, MSD will prefer a statistics-based preload for requested historical window.

DataSource / DataSourceManager changes

We will augment MsdDataSource with the following responsibilities:

1. Configuration properties:
   - `useStatistics` (boolean)
   - `statisticsPeriod`, `statisticsType`, `statisticsAlign`
   - `cacheEnabled`, `cacheTtlMs`, `cacheCompress`, `cacheMaxPoints`

2. Startup flow (preloadHistory):
   - If cacheEnabled:
     - try load cached series (loadFromCache)
     - if cached and valid: populate in-memory buffer with cached points and mark `historyReady = true` quickly
     - set `fetchStart` to lastCachedTimestamp + 1ms (if cached)
   - If useStatistics:
     - call `_preloadStatistics(fetchStart, end)`
       - convert statistics buckets into [timestamp, value]
       - apply transform pipeline to statistic values (same transforms used for raw states)
       - push into buffer and update cache
   - Else fallback to `_preloadHistoryStates(fetchStart, end)` (existing history API)
   - after fetch, set `historyReady = true` and emit an initial batch.

3. Incremental updates:
   - Use cached last timestamp to only fetch new history/statistics.
   - Save updated merged dataset back to cache (saveToCache).

Cache design

Storage backend
- Use localforage (IndexedDB) for persistence. localforage is well-tested for frontend caches and capable of storing structured JSON and large arrays.
- Add localforage as a dependency if not present.

Cache keys & validation
- Cache key per-datasource formed from:
  - entity id
  - effective graph span (hours requested)
  - configuration hash of transformations/aggregations that affect historical values
  - statistics config (period & type) or history flag
- Example key: `msd_cache__sensor.warp_core_power__span_168h__md5cfgabcd1234`
- Cache stored object:
  ```json
  {
    "configHash": "<hash>",
    "span": 168*3600000,
    "last_fetched": "<ISO timestamp>",
    "card_version": "<msd-version>",
    "data": [[timestamp, value], ...]
  }
  ```

Cache validation
- Valid if:
  - `configHash` matches current datasource config hash
  - `Date.now() - last_fetched <= cacheTtlMs`
  - `data.length > 0`
- If invalid -> delete cache and fall back to direct fetch.

Eviction & TTL policy
- Default TTL: 30 minutes (configurable)
- Soft limit on `max_points`: default 20k (configurable)
- If storing would exceed `max_points`, trim oldest points before storing.
- Policy: LRU per-datasource not necessary initially; keep TTL + max_points.

Compression
- For space savings, support optional lz-string compression on stored payloads (same tool used in apexcharts-card).
- compress only the `data` array or the full cache object; compressed strings stored under same key.

Cache UX / debug
- Provide logs for cache hits/misses in `cblcars.dev` debug and a small status field on MsdDataSource for devtools visibility:
  - `cacheHit: boolean`
  - `cacheAgeMs: number`
  - `cachedPoints: number`

Statistics path design

Fetch via Home Assistant Recorder WS call:

```js
// WebSocket message shape (recorder/statistics_during_period)
{
  type: 'recorder/statistics_during_period',
  start_time: <ISO>,
  end_time: <ISO>,
  statistic_ids: [entity_id],
  period: 'hour' // or '5minute', 'day', ...
}
```

Returned arrays with objects containing: `{ statistic_id, start, end, mean, min, max, sum, state, change, last_reset }`

Mapping rules
- Choose which statistic field to use based on `statistics.type` config.
- Choose displayed timestamp:
  - `align: middle` -> display timestamp = midpoint between start and end for each bucket (preferred)
  - `align: start` -> display = start
  - `align: end` -> display = end
- Apply transforms & fill rules to statistic values (same transform pipeline used for raw history).
- If statistics unavailable or empty for requested range, fallback to history API.

Edge cases
- Entities without `state_class` may not have recorder statistics — fallback to history and optionally warn via logs.
- Some statistics (sum) may represent totals for the bucket; document expected semantics for users.

UI / UX considerations

- When cache is used and a cache hit occurs: show overlays quickly, then seamlessly append newly fetched data when fresher points are retrieved.
- Provide an unobtrusive "Loading history..." indicator or status field (optional) so the user knows data are preloaded (prefer off by default; verbose only in dev/debug mode).
- If statistics path is used, explain in docs the difference (lower resolution/aggregated values).
- If no historical data available, show "NO DATA" overlay/dimmed chart (existing behavior).

Implementation plan (phases & milestones)

Phase 1 — Foundation (1 week)
- Add `localforage` and `lz-string` as optional dependencies.
- Add `CacheManager` util (single file) implementing get/set/remove + config hashing helper.
- Update project docs mentioning cache opt-in.
- Add config schema snippets and validation rules.

Phase 2 — DataSource integration (1–2 weeks)
- Extend `MsdDataSource`:
  - Add config parsing for `statistics` and `cache`.
  - Implement `_preloadStatistics(start, end)` using WebSocket recorder statistics.
  - Integrate `CacheManager` into preload flow (load cached points, incremental fetch, save).
  - Add debug flags & logs.

Phase 3 — Tests & validation (1 week)
- Unit tests for CacheManager: store/load/validate/evict.
- Integration tests for DataSource flow: simulate cached data, incremental fetch.
- Manual QA with HA instance (test stats on entities with `state_class`).

Phase 4 — Docs & examples (1 week)
- Update `/doc`:
  - User guide for `statistics` config, `cache` config (examples).
  - Dev docs for CacheManager and debug utilities (`cblcars.dev`).
- Add sample pack with datasource configs showing statistics + caching.

Phase 5 — Rollout
- Merge PR, release a minor version with the opt-in features.
- Monitor telemetry and logs (if enabled) and gather user feedback.

Testing strategy

- Unit tests for cache serialization, TTL/expiry, compression.
- Simulation tests:
  - Simulate cache hit path: create cached data, ensure DataSource loads from cache and only fetches incremental data.
  - Simulate cache miss path: ensure a full fetch occurs.
  - Simulate statistics present vs. absent for entity: validate fallback to history.
- Manual tests on different browser environments (desktop/mobile) to ensure IndexedDB quotas not exceeded and UX is smooth.
- Performance tests: measure initial load time with/without cache on low-power device.

Backwards compatibility & migration

- All changes are opt-in. Existing MSD configs that don't set `statistics` or `cache` behave exactly as before.
- Cache stored keys include `configHash` and `span` so upgrades or config changes won't silently reuse old incompatible cached blobs.
- No schema migration required.

Performance & security notes

- Be careful with localforage size: IndexedDB may be cleaned by browser under storage pressure. Do not rely on cache for correctness.
- Avoid storing untrusted code: cache only numerical arrays and metadata.
- Do not store sensitive tokens or private keys in client cache.
- Respect browser privacy: do not enable cache by default if any privacy policies restrict persistent storage.

Acceptance criteria

- Feature toggles: `statistics.enabled` and `cache.enabled` must be honored per data source.
- CacheManager must store and retrieve compressed/uncompressed data reliably.
- Statistics preload should return aggregated points and populate the DataSource buffer.
- Incremental fetch: when there is a valid cached dataset, only new points are fetched and appended.
- Unit tests and integration tests pass.
- Documentation updated with schema and examples.
- No changes to default behavior for existing users.

Appendix: core pseudocode (DataSource flow)

```javascript
async preloadHistory(start, end) {
  if (this.cacheEnabled) {
    const cached = await CacheManager.get(this.cacheKey);
    if (cached && CacheManager.isValid(cached, this.configHash, this.cacheTtlMs)) {
      this.buffer.load(cached.data);
      this._stats.cacheHit = true;
      fetchStart = cached.data[cached.data.length - 1][0] + 1;
    } else {
      fetchStart = start;
    }
  } else {
    fetchStart = start;
  }

  if (this.useStatistics) {
    const stats = await this._fetchStatistics(fetchStart, end, this.statisticsPeriod);
    const converted = this._convertStatisticsToPoints(stats, this.statisticsType, this.statisticsAlign);
    this.buffer.append(converted);
  } else {
    const history = await this._fetchHistory(fetchStart, end);
    const points = this._convertHistoryToPoints(history);
    this.buffer.append(points);
  }

  if (this.cacheEnabled) {
    const merged = this.buffer.getAll(); // apply max_points trimming
    await CacheManager.set(this.cacheKey, {
      configHash: this.configHash,
      span: this.graphSpan,
      last_fetched: new Date().toISOString(),
      data: merged
    }, { compress: this.cacheCompress });
  }

  this._stats.historyReady = true;
}
```

Files to add / change (proposed PR contents)

- Add new doc: `doc/proposals/not-started/Proposal-01-Statistics-and-Local-Cache.md` (this file)
- New util: `src/msd/cache/CacheManager.js` (localforage wrapper, compression helpers)
- Update `src/msd/data/MsdDataSource.js`
  - Add config parsing for statistics & cache
  - Add `_preloadStatistics()` and integrate CacheManager
- Tests: `tests/msd/cache/CacheManager.test.js` and `tests/msd/MsdDataSource.statistics.test.js`
- Docs: `doc/user-guide/datasources.md` update with `statistics` and `cache` examples
- Dev tools: expose `cblcars.dev.cacheStats()` helper to view cache state (optional)

Estimated effort
- Implementation: 2–3 weeks (one engineer full-time)
- Tests & docs: 1 week
- Manual QA & iteration: 1 week

Risks & mitigations

- Risk: IndexedDB quota exceeded on constrained mobile devices.
  - Mitigation: default TTL short (30m), max_points, configurable, use compression.
- Risk: Users confuse statistics (aggregated) vs history (raw).
  - Mitigation: clear documentation and optional UI notes; `historyReady` flag for overlays.
- Risk: Inconsistent results between cached data & live feed if transforms change.
  - Mitigation: include configHash; invalidate cache on transformation config change.
- Risk: HA recorder not configured for statistics for some entities.
  - Mitigation: fallback to history API transparently; log helpful message.

Open questions for team

1. Default TTL value — propose 30 minutes. Acceptable?
2. Where to surface cache controls in UI (advanced dev area only or quick toggle)?
3. Should cache be enabled by default for mobile user agents? (recommendation: keep opt-in)
4. Compression default true — OK with storage/CPU tradeoff?
5. Should we store transformed values (post-transform) or raw states and re-run transforms on load?
   - Recommendation: store transformed points to avoid re-running user JS transforms on load; but include configHash to invalidate when transforms change.

---

If you approve this proposal I will:
1. Draft the PR with the CacheManager utility file and modify MsdDataSource (small patch) with feature flags and tests.
2. Add documentation pages (user guide) demonstrating how to enable statistics and cache for a datasource and example Packs.
3. Provide example config snippets for Packs and update `cblcars.dev` with cache debug helpers.

Would you like me to:
- Create the initial PR draft files now (CacheManager + MsdDataSource changes + tests stubs)?
- Or first iterate on the YAML schema and TTL/compression defaults?
