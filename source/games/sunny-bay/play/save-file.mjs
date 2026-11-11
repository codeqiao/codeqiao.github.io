import {MAP_SIZE,migrateTerrain} from './terrain.mjs';
const TYPES=new Set(['road','bridge','house','shop','farm','fishery','warehouse','park','clinic','school','port']);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const validKey=k=>{if(!/^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(k))return false;const [x,z]=k.split(',').map(Number);return x<MAP_SIZE&&z<MAP_SIZE};
export function encodeSave(state){return JSON.stringify({format:'sunny-bay',version:1,state},null,2)}
export function decodeSave(text){
 const data=JSON.parse(text),raw=data?.format==='sunny-bay'&&data.version===1?data.state:data;
 if(!record(raw)||!record(raw.tiles)||![undefined,1,2].includes(raw.terrainVersion))throw Error('不是支持的晴湾存档');
 if(raw.terrainVersion===2&&!record(raw.land))throw Error('存档缺少地形');
 const s=migrateTerrain(raw);
 if(!record(s.land)||!record(s.tiles)||!record(s.levels||{}))throw Error('存档地形无效');
 for(const [k,v] of Object.entries(s.land))if(!validKey(k)||v!==true)throw Error('存档地形无效');
 for(const [k,v] of Object.entries(s.tiles))if(!validKey(k)||!TYPES.has(v)||(v==='bridge'?!!s.land[k]:!s.land[k]))throw Error('存档建筑无效');
 for(const [k,v] of Object.entries(s.levels||{}))if(!validKey(k)||s.tiles[k]!=='house'||![1,2].includes(v))throw Error('存档等级无效');
 for(const name of ['money','month','population','foodStock','loanDebt','missionStage','dayPhase','speed'])if(s[name]!=null&&(!Number.isFinite(s[name])||Math.abs(s[name])>1e9))throw Error('存档数值无效');
 if((s.month!=null&&s.month<1)||['population','foodStock','loanDebt','missionStage'].some(k=>s[k]!=null&&s[k]<0)||s.speed!=null&&![1,2,3].includes(s.speed))throw Error('存档数值无效');
 if(s.tax!=null&&!['low','normal','high'].includes(s.tax)||s.labor!=null&&!['farm','service','shop'].includes(s.labor)||s.paused!=null&&typeof s.paused!=='boolean')throw Error('存档设置无效');
 return s;
}
