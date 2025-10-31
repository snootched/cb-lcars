// ONE-LINE ROLLING STATS CHECK (Using proper CB-LCARS API)
// Copy/paste these in browser console for instant diagnosis

// ============================================================================
// OPTION 1: Ultra compact - Check temp_range.hourly_range
// ============================================================================
(()=>{const i=window.cblcars.debug.msd.MsdInstanceManager.getCurrentInstance();if(!i)return console.log('❌ No MSD');const d=i.getDataSourceManager(),s=d.sources.get('temp_range');if(!s)return console.log('❌ Not found');const data=s.getCurrentData(),v=data.aggregations?.hourly_range;console.log('📊 Value:',v,'Type:',Array.isArray(v)?`Array[${v.length}]`:typeof v);})();

// ============================================================================
// OPTION 2: Readable version - Check temp_range
// ============================================================================
(function() {
  const instance = window.cblcars?.debug?.msd?.MsdInstanceManager?.getCurrentInstance();
  if (!instance) return console.log('❌ No MSD instance');
  const dsManager = instance.getDataSourceManager?.();
  if (!dsManager) return console.log('❌ No DataSourceManager');
  const ds = dsManager.sources.get('temp_range');
  if (!ds) return console.log('❌ temp_range not found. Available:', Array.from(dsManager.sources.keys()));
  const data = ds.getCurrentData();
  const value = data.aggregations?.hourly_range;
  console.log('temp_range.hourly_range:', value, '\nIs Array?:', Array.isArray(value));
})();

// ============================================================================
// OPTION 3: Check ALL datasources for rolling stats arrays
// ============================================================================
(function() {
  const instance = window.cblcars?.debug?.msd?.MsdInstanceManager?.getCurrentInstance();
  if (!instance) return console.log('❌ No MSD instance');
  const dsManager = instance.getDataSourceManager?.();
  if (!dsManager) return console.log('❌ No DataSourceManager');
  console.log('🔍 Searching for array-type aggregations:');
  dsManager.sources.forEach((ds, name) => {
    const data = ds.getCurrentData();
    const aggs = data.aggregations || {};
    Object.entries(aggs).forEach(([key, val]) => {
      if (Array.isArray(val)) console.log(`✅ ${name}.aggregations.${key}:`, val, `[${val.length} items]`);
    });
  });
})();

