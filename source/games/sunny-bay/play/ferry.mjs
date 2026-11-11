import {MAP_SIZE} from './terrain.mjs';
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const key=(x,z)=>`${x},${z}`;
const neighbors=k=>{const [x,z]=k.split(',').map(Number);return DIRS.map(([dx,dz])=>[x+dx,z+dz]).filter(([a,b])=>a>=0&&b>=0&&a<MAP_SIZE&&b<MAP_SIZE).map(([a,b])=>key(a,b))};
export function coastalWater(k,land){return neighbors(k).filter(n=>!land[n])}
// Return only routes that belong to the active network and originate here.
export function portRoutes(network,port){
 const result=[];
 for(const [edge,route] of network.ferries||[]){const [from,to]=edge.split('>');if(route.fromPort===port&&network.has(from)&&network.has(to))result.push(route)}
 return result;
}
export function activeFerries(network){
 const routes=[];
 for(const [edge,route] of network.ferries||[]){const [from,to]=edge.split('>');if(from<to&&network.has(from)&&network.has(to))routes.push({key:edge,...route})}
 return routes.sort((a,b)=>a.key.localeCompare(b.key));
}
function waterPath(start,end,land){
 const queue=[start],previous=new Map([[start,null]]);
 for(let i=0;i<queue.length;i++){const current=queue[i];if(current===end)break;for(const next of neighbors(current))if(!land[next]&&!previous.has(next)){previous.set(next,current);queue.push(next)}}
 if(!previous.has(end))return [];const path=[];for(let k=end;k!==null;k=previous.get(k))path.push(k);return path.reverse();
}
// Ports in the same body of water connect through a stable hub. A port must
// touch both water and a road; barriers of land separate water regions.
let cachedSignature=null,cachedLinks=null;
export function ferryLinks(tiles,land){
 const ports=Object.keys(tiles).filter(k=>tiles[k]==='port'&&land[k]).sort();if(ports.length<2)return new Map();
 const signature=JSON.stringify([Object.keys(land).sort(),Object.entries(tiles).filter(([,t])=>t==='road'||t==='bridge'||t==='port').sort(([a],[b])=>a.localeCompare(b))]);
 if(signature===cachedSignature)return cachedLinks;
 const waterRegion=new Map();let region=0;
 for(let x=0;x<MAP_SIZE;x++)for(let z=0;z<MAP_SIZE;z++){
  const start=key(x,z);if(land[start]||waterRegion.has(start))continue;
  const queue=[start];waterRegion.set(start,region);
  for(let i=0;i<queue.length;i++)for(const next of neighbors(queue[i]))if(!land[next]&&!waterRegion.has(next)){waterRegion.set(next,region);queue.push(next)}
  region++;
 }
 const groups=new Map();
 for(const port of ports){
  const road=neighbors(port).find(k=>tiles[k]==='road'||tiles[k]==='bridge');if(!road)continue;
  const seen=new Set();for(const sea of coastalWater(port,land)){const r=waterRegion.get(sea);if(seen.has(r))continue;seen.add(r);if(!groups.has(r))groups.set(r,[]);groups.get(r).push({port,road,sea})}
 }
 const links=new Map();
 for(const group of groups.values()){
  if(group.length<2)continue;const hub=group[0];
  for(const other of group.slice(1)){
   if(hub.road===other.road)continue;const path=waterPath(hub.sea,other.sea,land);if(!path.length)continue;
   const forward={fromPort:hub.port,toPort:other.port,water:path},reverse={fromPort:other.port,toPort:hub.port,water:[...path].reverse()};
   links.set(`${hub.road}>${other.road}`,forward);links.set(`${other.road}>${hub.road}`,reverse);
  }
 }
 cachedSignature=signature;cachedLinks=links;return links;
}
