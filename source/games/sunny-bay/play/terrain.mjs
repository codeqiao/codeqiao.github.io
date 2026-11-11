export const MAP_SIZE=24;
// Preserve the world-space position of every old 12x12 tile in the larger map.
export function legacyIsland(){
 const land={};for(let x=0;x<12;x++)for(let z=0;z<12;z++)if(Math.hypot(x-5.5,z-5.5)<7.1)land[`${x},${z}`]=true;return land;
}
function shiftRecord(record,offset){
 const result={};for(const [key,value] of Object.entries(record||{})){const [x,z]=key.split(',').map(Number);if(Number.isInteger(x)&&Number.isInteger(z))result[`${x+offset},${z+offset}`]=value}return result;
}
export function migrateTerrain(saved){
 if(saved.terrainVersion===2&&saved.land&&typeof saved.land==='object')return {...saved,land:{...saved.land}};
 const oldLand=saved.terrainVersion===1&&saved.land&&typeof saved.land==='object'?saved.land:legacyIsland();
 return {...saved,terrainVersion:2,legacyDecor:saved.legacyDecor===true||saved.terrainVersion==null,land:shiftRecord(oldLand,6),tiles:shiftRecord(saved.tiles,6),levels:shiftRecord(saved.levels,6)};
}
// Returns only available sea cells, clipped to the map; occupied bridges are never overwritten.
export function plannedLand(x,z,size,land,tiles,mapSize=MAP_SIZE){
 const radius=size===3?1:0,result=[];
 for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
  const a=x+dx,b=z+dz,k=`${a},${b}`;
  if(a>=0&&b>=0&&a<mapSize&&b<mapSize&&!land[k]&&!tiles[k])result.push(k);
 }
 return result;
}
// An orthogonal route, first along x and then z. Existing roads are free;
// water and buildings block the whole route rather than being overwritten.
export function plannedRoad(start,end,land,tiles,mapSize=MAP_SIZE){
 const cells=[];let {x,z}=start;
 if(![x,z,end.x,end.z].every(n=>Number.isInteger(n)&&n>=0&&n<mapSize))return {cells,blocked:true};
 while(true){
  const k=`${x},${z}`,tile=tiles[k];
  if(!land[k]||tile&&tile!=='road')return {cells:[],blocked:true};
  if(!tile)cells.push(k);
  if(x===end.x&&z===end.z)break;
  if(x!==end.x)x+=Math.sign(end.x-x);else z+=Math.sign(end.z-z);
 }
 return {cells,blocked:false};
}
// Facades face an adjacent road or bridge; prefer south, north, east, west on ties.
export function buildingFacing(tiles,x,z){
 for(const [dx,dz,angle] of [[0,1,0],[0,-1,Math.PI],[1,0,Math.PI/2],[-1,0,-Math.PI/2]]){
  if(['road','bridge'].includes(tiles[`${x+dx},${z+dz}`]))return angle;
 }
 return 0;
}
