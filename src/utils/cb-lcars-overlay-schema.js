/**
 * Overlay Schema Registry (Foundation, no animation dependencies)
 * Provides lightweight field definitions to drive the overlay editor form.
 * This does NOT replace full validation – it is UI/meta only.
 */
(function(){
  if(!window.cblcars) window.cblcars = {};
  const ns = window.cblcars.overlaySchema = window.cblcars.overlaySchema || {};

  /**
   * Field definition:
   * name        (string) key
   * type        'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object'
   * enumValues  (string[]) when type==='enum'
   * default     (any) optional default for UI
   * required    (boolean)
   * help        (string) short helper text
   */
  const common = [
    { name:'id', type:'string', required:true, help:'Unique overlay ID.' },
    { name:'type', type:'enum', enumValues:['line','ribbon','sparkline','text','free'], required:true },
    { name:'visible', type:'boolean', default:true }
  ];

  const defs = {
    line: [
      ...common,
      { name:'anchor', type:'string', help:'Start anchor (id or [x,y]).' },
      { name:'attach_to', type:'string', help:'Target overlay id or anchor/pos.' },
      { name:'route', type:'enum', enumValues:['auto','none'], default:'none' },
      { name:'route_mode', type:'enum', enumValues:['auto','xy','yx'], default:'auto' },
      { name:'route_mode_full', type:'enum', enumValues:['manhattan','grid','smart'], help:'Full routing strategy.' },
      { name:'route_channels', type:'array', help:'Channel IDs list.' },
      { name:'route_channel_mode', type:'enum', enumValues:['allow','prefer','require'], default:'allow' },
      { name:'avoid', type:'array', help:'Obstacle overlay IDs.' },
      { name:'smart_proximity', type:'number', help:'SMART gating proximity.' },
      { name:'color', type:'string' },
      { name:'width', type:'number', default:2 },
      { name:'corner_style', type:'enum', enumValues:['round','bevel','sharp','square'], default:'round' },
      { name:'corner_radius', type:'number', default:12 }
    ],
    ribbon: [
      ...common,
      { name:'position', type:'array', help:'[x,y]' },
      { name:'size', type:'array', help:'[w,h]' },
      { name:'source', type:'string' },
      { name:'sources', type:'array', help:'Multiple binary sources.' },
      { name:'threshold', type:'number', default:1 },
      { name:'on_color', type:'string', default:'var(--lcars-yellow)' },
      { name:'off_color', type:'string' },
      { name:'lane_gap', type:'number', default:2 }
    ],
    sparkline: [
      ...common,
      { name:'source', type:'string', required:true },
      { name:'position', type:'array' },
      { name:'size', type:'array' },
      { name:'color', type:'string', default:'var(--lcars-yellow)' },
      { name:'width', type:'number', default:2 },
      { name:'windowSeconds', type:'number', default:3600 },
      { name:'smooth', type:'boolean', default:false },
      { name:'smooth_tension', type:'number', default:0.5 },
      { name:'y_range', type:'array' },
      { name:'label_last', type:'object' },
      { name:'markers', type:'object' }
    ],
    text: [
      ...common,
      { name:'position', type:'array' },
      { name:'value', type:'string', help:'Literal or [[[ template ]]]' },
      { name:'color', type:'string' },
      { name:'font_size', type:'number', default:14 },
      { name:'align', type:'enum', enumValues:['start','middle','end'], default:'start' }
    ],
    free: [
      ...common,
      { name:'targets', type:'array', help:'Selector list for external anim/actions.' }
    ]
  };

  function getSchema(type){
    return (defs[type] || common).map(f=>({...f}));
  }
  function listTypes(){ return Object.keys(defs); }
  function applyDefaults(overlay){
    if(!overlay || typeof overlay!=='object') return overlay;
    getSchema(overlay.type||'').forEach(f=>{
      if(f.default!==undefined && overlay[f.name]===undefined){
        overlay[f.name]=f.default;
      }
    });
    return overlay;
  }

  ns.getSchema = getSchema;
  ns.listTypes = listTypes;
  ns.applyDefaults = applyDefaults;
})();