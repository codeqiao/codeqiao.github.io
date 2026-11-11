import {ferryLinks,coastalWater,activeFerries} from './ferry.mjs';
import {serviceCoverage} from './services.mjs';
// Prefer the network serving the most homes, then the largest network. This
// keeps an empty new island from displacing an established residential area.
// Coordinate ordering makes ties stable across save/load.
export const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1]];
export function tileKey(x,z){ return `${x},${z}` }
export function roadNetwork(tiles,land={},anchor=null){
  const ferries=ferryLinks(tiles,land),ferryNeighbors=new Map();
  for(const edge of ferries.keys()){const [from,to]=edge.split('>');if(!ferryNeighbors.has(from))ferryNeighbors.set(from,[]);ferryNeighbors.get(from).push(to)}
  const roads=Object.keys(tiles).filter(k=>tiles[k]==='road'||tiles[k]==='bridge').sort((a,b)=>{
    const [ax,az]=a.split(',').map(Number),[bx,bz]=b.split(',').map(Number);
    return ax-bx||az-bz;
  });
  const all=new Set(roads),visited=new Set(),homes=Object.keys(tiles).filter(k=>tiles[k]==='house');let largest=[],mostHomes=-1,anchored=null,anchorHomes=0;
  for(const start of roads){
    if(visited.has(start))continue;
    const component=[start];visited.add(start);
    for(let i=0;i<component.length;i++){
      const [x,z]=component[i].split(',').map(Number);
      for(const [dx,dz] of DIRECTIONS){let next=tileKey(x+dx,z+dz);if(all.has(next)&&!visited.has(next)){visited.add(next);component.push(next)}}
      for(const to of ferryNeighbors.get(component[i])||[])if(all.has(to)&&!visited.has(to)){visited.add(to);component.push(to)}
    }
    const componentSet=new Set(component),served=homes.filter(k=>hasAccess(k,componentSet)).length;
    if(componentSet.has(anchor)){anchored=component;anchorHomes=served}
    if(served>mostHomes||served===mostHomes&&component.length>largest.length){largest=component;mostHomes=served}
  }
  const network=new Set(anchored&&(anchorHomes>0||mostHomes===0)?anchored:largest);network.ferries=ferries;network.ferryNeighbors=ferryNeighbors;return network;
}
export function hasAccess(k,network){const [x,z]=k.split(',').map(Number);return DIRECTIONS.some(([dx,dz])=>network.has(tileKey(x+dx,z+dz)))}
export const TAX_POLICIES={low:{label:'低税',factor:0.65,happiness:10},normal:{label:'普通',factor:1,happiness:0},high:{label:'高税',factor:1.35,happiness:-15}};
const CALENDAR={4:{title:'春季丰收',description:'粮食产量 +25%',foodFactor:1.25,tradeFactor:1},8:{title:'夏季风暴',description:'粮食产量 −25%',foodFactor:.75,tradeFactor:1},10:{title:'秋季集市',description:'商店收入 +50%',foodFactor:1,tradeFactor:1.5}};
export function calendarEvent(month){return CALENDAR[(Math.max(1,Math.floor(month)||1)-1)%12+1]||{title:'平稳月份',description:'产出正常',foodFactor:1,tradeFactor:1}}
export function nextCalendarEvent(month){for(let offset=1;offset<=12;offset++){const next=Math.max(1,Math.floor(month)||1)+offset,event=calendarEvent(next);if(event.title!=='平稳月份')return {offset,month:(next-1)%12+1,...event}}}
const LABOR_ORDERS={farm:['farm','service','shop'],service:['service','farm','shop'],shop:['shop','farm','service']};
export function allocateWorkforce(pop,capacities,policy='farm'){
  const result={farm:0,service:0,shop:0};let available=Math.max(0,Math.floor(pop));
  for(const sector of LABOR_ORDERS[policy]||LABOR_ORDERS.farm){result[sector]=Math.min(available,capacities[sector]);available-=result[sector]}
  return result;
}
export function cityStats(tiles,levels={},tax='normal',population=null,laborPolicy='farm',land={},storedFood=0,anchor=null,month=1){
  const policy=TAX_POLICIES[tax]||TAX_POLICIES.normal;
  const event=calendarEvent(month);
  const network=roadNetwork(tiles,land,anchor), c={house:0,shop:0,farm:0,fishery:0,park:0,clinic:0,school:0,port:0,warehouse:0};let upgraded=0,inactive=0;
  for(const [k,t] of Object.entries(tiles)){
    if(!Object.hasOwn(c,t))continue;
    if(hasAccess(k,network)&&(!['port','fishery'].includes(t)||coastalWater(k,land).length)){c[t]++;if(t==='house'&&levels[k]===2)upgraded++}else inactive++;
  }
  const capacity=c.house*8+upgraded*8, pop=population==null?capacity:Math.max(0,Math.min(capacity,Math.floor(population)));
  const farmJobs=(c.farm+c.fishery)*4,serviceJobs=(c.clinic+c.school)*4,shopJobs=c.shop*8,jobs=farmJobs+serviceJobs+shopJobs;
  const workforce=allocateWorkforce(pop,{farm:farmJobs,service:serviceJobs,shop:shopJobs},laborPolicy);
  const {farm:farmWorkers,service:serviceWorkers,shop:shopWorkers}=workforce,employed=farmWorkers+serviceWorkers+shopWorkers;
  const food=Math.floor(farmWorkers*4*event.foodFactor),foodPotential=Math.floor((c.farm+c.fishery)*16*event.foodFactor),healthcare=c.clinic*24,education=c.school*24;
  const stockCapacity=60+c.warehouse*120,foodStock=Math.max(0,Math.min(stockCapacity,Number.isFinite(storedFood)?Math.floor(storedFood):0));
  const foodAvailable=food+foodStock,foodAfter=Math.min(stockCapacity,Math.max(0,foodAvailable-pop));
  const prospectivePopulation=Math.min(capacity,pop+2,foodPotential+foodAfter,jobs);
  const prospectiveFood=Math.floor(allocateWorkforce(prospectivePopulation,{farm:farmJobs,service:serviceJobs,shop:shopJobs},laborPolicy).farm*4*event.foodFactor);
  const serviceStaffing=serviceJobs?serviceWorkers/serviceJobs:0;
  const services=serviceCoverage(tiles,levels,network,pop,serviceStaffing,shopWorkers);
  const serviceScore=(coverage)=>pop===0?0:coverage>=pop?6:pop>=24?-6:0;
  const parkBonus=pop?Math.round(16*services.leisure/pop):0;
  const happy=Math.max(20,Math.min(100,60+parkBonus+(foodAvailable>=pop?10:-15)+(jobs>=pop?10:-10)+serviceScore(services.health)+serviceScore(services.education)+policy.happiness));
  const prosperity=happy<50?0.65:happy<70?0.85:1;
  const shopDemand=shopWorkers?Math.min(1,services.shopping/(shopWorkers*3)):0;
  const ferryCount=activeFerries(network).length,ferryCost=ferryCount*4;
  const taxRevenue=Math.round(pop*4*policy.factor),businessRevenue=Math.round((services.shopping*.75*event.tradeFactor+farmWorkers*2)*prosperity),maintenance=Object.keys(tiles).length*2+Object.values(tiles).filter(t=>t==='clinic'||t==='school'||t==='port').length*8+Object.values(tiles).filter(t=>t==='warehouse').length*4+ferryCost;
  const income=taxRevenue+businessRevenue-maintenance;
  return {network,c,pop,capacity,jobs,employed,workforce,food,foodPotential,foodStock,foodAvailable,foodAfter,stockCapacity,prospectiveFood,prospectivePopulation,healthcare,education,serviceStaffing,shopDemand,services,happy,income,inactive,taxRevenue,businessRevenue,maintenance,ferryCount,ferryCost,prosperity,event};
}

// Population changes on settlement, not when the player merely places a house.
export function advancePopulation(city){
  const {pop,capacity,jobs,food,happy}=city,foodPotential=city.foodPotential??food,prospectiveFood=city.prospectiveFood??foodPotential,foodAvailable=city.foodAvailable??food,foodAfter=city.foodAfter??0;
  if(pop>0&&(foodAvailable<pop||happy<45||jobs<pop*.5))return Math.max(0,pop-Math.min(2,pop));
  const next=city.prospectivePopulation??Math.min(capacity,pop+2,foodPotential+foodAfter,jobs);
  if(next>pop&&foodAvailable>=pop&&prospectiveFood+foodAfter>=next&&happy>=60)return next;
  return pop;
}
