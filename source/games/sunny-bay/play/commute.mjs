import {DIRECTIONS,hasAccess,tileKey} from './simulation.mjs';
import {coastalWater} from './ferry.mjs';

function adjacentRoads(building,network){
  const [x,z]=building.split(',').map(Number);
  return DIRECTIONS.map(([dx,dz])=>tileKey(x+dx,z+dz)).filter(k=>network.has(k));
}

// Breadth-first search over the actual main road network; route includes both ends.
export function findRoadPath(network,start,end){
  if(!network.has(start)||!network.has(end))return [];
  const queue=[start],previous=new Map([[start,null]]);
  for(let i=0;i<queue.length;i++){
    const current=queue[i];if(current===end)break;
    const [x,z]=current.split(',').map(Number);
    for(const [dx,dz] of DIRECTIONS){
      const next=tileKey(x+dx,z+dz);
      if(network.has(next)&&!previous.has(next)){previous.set(next,current);queue.push(next)}
    }
    for(const to of network.ferryNeighbors?.get(current)||[])if(network.has(to)&&!previous.has(to)){previous.set(to,current);queue.push(to)}
  }
  if(!previous.has(end))return [];
  const result=[];for(let k=end;k!==null;k=previous.get(k))result.push(k);
  return result.reverse();
}
export function isNight(phase){return Number.isFinite(phase)&&phase>.315&&phase<.685}
export function returnHomeLeg(from,home,network){
 if(from===home)return null;
 const route=findRoadPath(network,adjacentRoads(from,network)[0],adjacentRoads(home,network)[0]);
 return route.length?{from,to:home,activity:'回家休息',route}:null;
}

// These are visual representatives, not one mesh per simulated resident.
export function planJourneys(tiles,network,population,jobs,count,workforce=null,coverage=null,land={}){
  const connected=type=>Object.keys(tiles).filter(k=>tiles[k]===type&&hasAccess(k,network)).sort();
  const homes=connected('house'),parks=connected('park');
  const farms=[...connected('farm'),...connected('fishery').filter(k=>coastalWater(k,land).length)],shops=connected('shop'),services=[...connected('clinic'),...connected('school')];
  let workplaces=[...farms,...shops,...services];
  if(workforce){
   workplaces=[];
   for(const [sites,workers] of [[farms,workforce.farm],[services,workforce.service],[shops,workforce.shop]]){
    if(sites.length)for(let i=0;i<workers;i++)workplaces.push(sites[i%sites.length]);
   }
  }
  if(!homes.length||!count)return [];
  const workerCount=Math.min(count,Math.round(count*Math.min(population,workforce?workplaces.length:jobs)/Math.max(1,population)));
  return Array.from({length:count},(_,i)=>{
    let home=homes[i%homes.length];
    if(coverage&&population>0){let resident=Math.floor((i+.5)*population/count);for(const candidate of homes){resident-=coverage.homes[candidate]?.residents||0;if(resident<0){home=candidate;break}}}
    const works=i<workerCount&&workplaces.length>0;
    const workplace=works?workplaces[Math.floor(i*workplaces.length/Math.max(1,workerCount))]:null;
    const availableParks=coverage?coverage.leisureParks[home]||[]:parks;
    const availableShops=coverage?coverage.shoppingShops[home]||[]:shops;
    const leisure=availableParks.length?availableParks[i%availableParks.length]:availableShops.find(k=>k!==workplace)||null;
    const destination=workplace||leisure||home;
    const activity=workplace?'工作':leisure?(tiles[leisure]==='park'?'去公园':'逛商店'):'在家附近休息';
    const stops=[{place:home,activity:'在家'}];
    if(workplace)stops.push({place:workplace,activity:'工作'});
    if(leisure&&leisure!==workplace)stops.push({place:leisure,activity:tiles[leisure]==='park'?'游园':'购物'});
    stops.push({place:home,activity:'回家'});
    const legs=[];
    for(let j=1;j<stops.length;j++){
      const from=stops[j-1].place,to=stops[j].place,start=adjacentRoads(from,network)[0],end=adjacentRoads(to,network)[0];
      const route=findRoadPath(network,start,end);if(route.length)legs.push({from,to,activity:stops[j].activity,route});
    }
    return {home,destination,activity,route:legs[0]?.route||[],legs};
  });
}

// Expand ferry transfers into coastal and water points so boats follow water.
export function journeyPoints(leg,network){
 if(!leg)return [];
 const coords=k=>k.split(',').map(Number),roads=leg.route;if(!roads.length)return [];
 const point=(k,sea=false)=>{const [x,z]=coords(k);return {x,z,sea}};
 const entrance=(building,road)=>{const [bx,bz]=coords(building),[rx,rz]=coords(road);return {x:rx+(bx-rx)*.34,z:rz+(bz-rz)*.34,sea:false}};
 const points=[entrance(leg.from,roads[0]),point(roads[0])];
 for(let i=1;i<roads.length;i++){
  const ferry=network.ferries?.get(roads[i-1]+'>'+roads[i]);
  if(ferry){points.push(point(ferry.fromPort));for(const sea of ferry.water)points.push(point(sea,true));points.push(point(ferry.toPort,true))}
  points.push(point(roads[i]));
 }
 points.push(entrance(leg.to,roads[roads.length-1]));return points;
}
