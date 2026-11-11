// Stages are irreversible achievements; rewards are paid once when a stage advances.
export const MISSIONS=[
 {title:'从大海开始',description:'填出 9 格陆地',target:9,reward:100,value:m=>m.land},
 {title:'铺出第一条路',description:'铺设并接通一格道路',target:1,reward:60,value:m=>m.roads},
 {title:'欢迎新邻居',description:'建造一座接通道路的住宅',target:1,reward:120,value:m=>m.houses},
 {title:'让食物有来源',description:'建造一座接通道路的农田或临海渔场',target:1,reward:150,value:m=>m.farms},
 {title:'小镇开始生活',description:'让 4 位居民迁入',target:4,reward:150,value:m=>m.population},
 {title:'街角的生意',description:'建造一座接通道路的商店',target:1,reward:180,value:m=>m.shops},
 {title:'绿意与休息',description:'建造一座接通道路的公园',target:1,reward:120,value:m=>m.parks},
 {title:'照顾邻里',description:'建造一座接通道路的诊所',target:1,reward:200,value:m=>m.clinics},
 {title:'繁荣的晴湾',description:'让居民达到 24 人',target:24,reward:300,value:m=>m.population},
 {title:'启航群岛',description:'建设两座接路港口，开通一条航线',target:1,reward:300,value:m=>m.ferryRoutes},
 {title:'海上的邻居',description:'让两座不同岛屿都有接路住宅',target:2,reward:350,value:m=>m.inhabitedIslands},
];
export function missionMetrics(land,tiles,city){
 const islands=new Map();let count=0;
 for(const start of Object.keys(land)){
  if(islands.has(start))continue;
  const queue=[start];islands.set(start,count);
  for(let i=0;i<queue.length;i++){
   const [x,z]=queue[i].split(',').map(Number);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=`${x+dx},${z+dz}`;if(land[k]&&!islands.has(k)){islands.set(k,count);queue.push(k)}}
  }
  count++;
 }
 const homes=new Set();
 for(const [k,t] of Object.entries(tiles))if(t==='house'&&islands.has(k)){
  const [x,z]=k.split(',').map(Number);
  if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>city.network.has(`${x+dx},${z+dz}`)))homes.add(islands.get(k));
 }
 let routes=0;for(const edge of city.network.ferries.keys()){const [a,b]=edge.split('>');if(city.network.has(a)&&city.network.has(b))routes++}
 return {land:Object.keys(land).length,roads:[...city.network].filter(k=>tiles[k]==='road').length,houses:city.c.house,farms:city.c.farm+city.c.fishery,population:city.pop,shops:city.c.shop,parks:city.c.park,clinics:city.c.clinic,ferryRoutes:routes/2,inhabitedIslands:homes.size};
}
export function advanceMissions(stage,metrics,grant=true){
 let index=Math.max(0,Math.min(MISSIONS.length,Math.floor(stage)||0)),reward=0;const completed=[];
 while(index<MISSIONS.length&&MISSIONS[index].value(metrics)>=MISSIONS[index].target){const mission=MISSIONS[index];if(grant)reward+=mission.reward;completed.push(mission.title);index++}
 return {stage:index,reward,completed};
}
export function missionView(stage,metrics){
 const mission=MISSIONS[stage];if(!mission)return {title:'自由建设',description:'继续发展你的群岛',current:1,target:1,reward:0};
 return {title:mission.title,description:mission.description,current:Math.min(mission.target,mission.value(metrics)),target:mission.target,reward:mission.reward};
}
