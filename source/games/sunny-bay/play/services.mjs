// Public services reach residences within six road steps. Each facility has a
// finite capacity; nearby residences are served first, with stable tie breaks.
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]], RANGE=6, CAPACITY=24;
const adjacent=(key,network)=>{const [x,z]=key.split(',').map(Number);return DIRS.map(([dx,dz])=>`${x+dx},${z+dz}`).filter(k=>network.has(k))};
function roadDistances(starts,network){
 const distances=new Map(starts.map(k=>[k,0])),queue=[...starts];
 for(let i=0;i<queue.length;i++){
  const k=queue[i],distance=distances.get(k);if(distance>=RANGE)continue;
  const [x,z]=k.split(',').map(Number);
  for(const [dx,dz] of DIRS){const next=`${x+dx},${z+dz}`;if(network.has(next)&&!distances.has(next)){distances.set(next,distance+1);queue.push(next)}}
 }
 return distances;
}
export function serviceCoverage(tiles,levels,network,population,staffing=1,shopWorkers=0){
 const homes=Object.keys(tiles).filter(k=>tiles[k]==='house'&&adjacent(k,network).length).sort();
 const totalCapacity=homes.reduce((sum,k)=>sum+(levels[k]===2?16:8),0);
 const rows=homes.map(k=>{const capacity=levels[k]===2?16:8,exact=totalCapacity?population*capacity/totalCapacity:0;return {key:k,residents:Math.floor(exact),fraction:exact-Math.floor(exact),health:0,education:0,leisure:0,shopping:0}});
 let remaining=population-rows.reduce((sum,r)=>sum+r.residents,0);
 for(const row of [...rows].sort((a,b)=>b.fraction-a.fraction||a.key.localeCompare(b.key))){if(remaining<=0)break;row.residents++;remaining--}
 const leisureParks={},shops={},shoppingShops={};
 const serve=(type,field,staff=staffing)=>{
  const facilities=Object.keys(tiles).filter(k=>tiles[k]===type&&adjacent(k,network).length).sort();
  const candidates=[],capacity=new Map();
  for(const [index,facility] of facilities.entries()){
   const distances=roadDistances(adjacent(facility,network),network);
   const workers=field==='shopping'?Math.floor(shopWorkers/facilities.length)+(index<shopWorkers%facilities.length?1:0):0;
   capacity.set(facility,field==='shopping'?workers*3:Math.floor(CAPACITY*Math.max(0,Math.min(1,staff))));
   if(field==='shopping')shops[facility]={workers,customers:0};
   for(const row of rows){const distance=Math.min(...adjacent(row.key,network).map(k=>distances.get(k)??Infinity));if(distance<=RANGE)candidates.push({row,facility,distance})}
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.facility.localeCompare(b.facility)||a.row.key.localeCompare(b.row.key));
  for(const {row,facility} of candidates){
   const available=capacity.get(facility),served=Math.min(available,row.residents-row[field]);if(!served)continue;
   row[field]+=served;capacity.set(facility,available-served);
   if(field==='leisure')(leisureParks[row.key]??=[]).push(facility);
   if(field==='shopping'){(shoppingShops[row.key]??=[]).push(facility);shops[facility].customers+=served}
  }
  return rows.reduce((sum,row)=>sum+row[field],0);
 };
 const health=serve('clinic','health'),education=serve('school','education'),leisure=serve('park','leisure',1),shopping=serve('shop','shopping');
 return {health,education,leisure,shopping,leisureParks,shoppingShops,shops,homes:Object.fromEntries(rows.map(({key,residents,health,education,leisure,shopping})=>[key,{residents,health,education,leisure,shopping}]))};
}
