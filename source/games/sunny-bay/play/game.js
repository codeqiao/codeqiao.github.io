import * as THREE from './three.module.min.js';
import {cityStats,hasAccess,advancePopulation,nextCalendarEvent} from './simulation.mjs';
import {planJourneys,journeyPoints,isNight,returnHomeLeg} from './commute.mjs';
import {coastalWater,portRoutes,activeFerries} from './ferry.mjs';
import {MAP_SIZE,migrateTerrain,plannedLand,plannedRoad,buildingFacing} from './terrain.mjs';
import {missionMetrics,advanceMissions,missionView} from './missions.mjs';
import {borrow,loanPayment,settleLoan} from './finance.mjs';
import {encodeSave,decodeSave} from './save-file.mjs';
const $=s=>document.querySelector(s), N=MAP_SIZE, TYPES={land:{name:'填海',icon:'▧',cost:25},road:{name:'道路',icon:'▰',cost:20},bridge:{name:'桥梁',icon:'🌉',cost:45},port:{name:'港口',icon:'⚓',cost:240},house:{name:'住宅',icon:'🏠',cost:120},shop:{name:'商店',icon:'🏪',cost:180},farm:{name:'农田',icon:'🌾',cost:140},fishery:{name:'渔场',icon:'🐟',cost:120},warehouse:{name:'粮仓',icon:'▤',cost:160},park:{name:'公园',icon:'🌳',cost:100},clinic:{name:'诊所',icon:'✚',cost:240},school:{name:'学校',icon:'📚',cost:260},upgrade:{name:'升级',icon:'⬆',cost:160},inspect:{name:'查看',icon:'⌕',cost:0},bulldoze:{name:'拆除',icon:'✕',cost:0}};
let city, roadKeys=[], landBrush=1, roadLine=false, roadStart=null, roadEnd=null,selectedPort=null;
let state={money:1800,month:1,tiles:{},land:{},terrainVersion:2,levels:{},tax:'normal',labor:'farm',population:0,foodStock:0,loanDebt:0,roadAnchor:null,missionStage:null,dayPhase:0,speed:1,paused:false}, tool='land', meshes={}, timer=0, legacyDecor=false;
try{let saved=JSON.parse(localStorage.getItem('sunnybay-v1'));if(saved&&saved.tiles&&typeof saved.tiles==='object'){legacyDecor=saved.terrainVersion==null||saved.legacyDecor===true;state={...state,...migrateTerrain(saved)};if(saved.population==null)state.population=null}}catch(e){}
const scene=new THREE.Scene();scene.background=new THREE.Color('#bce6e3');scene.fog=new THREE.Fog('#bce6e3',28,65);const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,100);let az=0.7,el=.7,dist=22,target=new THREE.Vector3(0,0,0);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;$('#world').appendChild(renderer.domElement);
const skyLight=new THREE.HemisphereLight(0xfff4d6,0x6faba5,2.2);scene.add(skyLight);const sun=new THREE.DirectionalLight(0xfff3d7,2.6);sun.position.set(-8,15,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12});sun.shadow.bias=-.0003;scene.add(sun);
const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.85});const mats={grass:mat('#86b983'),grass2:mat('#91c18a'),sand:mat('#e7d2a0'),soil:mat('#b79569'),water:new THREE.MeshStandardMaterial({color:'#66bdbb',roughness:.35,metalness:.08}),road:mat('#c3b9a3'),white:mat('#f9ead0'),roof:mat('#d77f5e'),wood:mat('#997154'),leaf:mat('#609d75'),dark:mat('#4d7771'),window:mat('#78afad'),farm:mat('#a77b52'),crop:mat('#d9bd6b'),pink:mat('#eaa985'),skinLight:mat('#edc6a4'),skinWarm:mat('#bd8867'),hair:mat('#594b43'),leafLight:mat('#83b680'),roofGold:mat('#d6a360'),roofBlue:mat('#638e92'),wallMint:mat('#d8e7cd'),wallBlue:mat('#d7e6df'),wallPeach:mat('#f2dfc7'),hull:mat('#bd7255'),cream:mat('#fff5de'),foam:new THREE.MeshBasicMaterial({color:'#d9f3e5',transparent:true,opacity:.52})};
// A visual day lasts six game months; pausing freezes the cycle.
const daySky=new THREE.Color('#bce6e3'),nightSky=new THREE.Color('#334f68'),stormSky=new THREE.Color('#718d96'),dayWater=new THREE.Color('#66bdbb'),nightWater=new THREE.Color('#315e76');
let shownTime='';
function updateDaylight(){
 const phase=Number.isFinite(state.dayPhase)?state.dayPhase:0,light=(1+Math.cos(phase*Math.PI*2))/2;
 const daylight=THREE.MathUtils.smoothstep(light,.08,.92),night=1-daylight;
 scene.background.copy(nightSky).lerp(daySky,daylight);if(city?.event.title==='夏季风暴')scene.background.lerp(stormSky,.45);scene.fog.color.copy(scene.background);
 mats.water.color.copy(nightWater).lerp(dayWater,daylight);
 skyLight.intensity=.65+1.55*daylight;sun.intensity=.3+2.3*daylight;
 mats.window.emissive.set('#e4a85e');mats.window.emissiveIntensity=night*.42;seaGrid.material.opacity=.08+.16*daylight;
 const label=light>.7?'白天':light<.3?'夜晚':phase<.5?'黄昏':'清晨';
 if(label!==shownTime){shownTime=label;$('#daytime').textContent=label}
}
// Reuse primitive geometry between models; removing a building does not free shared assets.
const geometryCache=new Map();
function sharedGeometry(key,create){let geometry=geometryCache.get(key);if(!geometry){geometry=create();geometry.userData.shared=true;geometryCache.set(key,geometry)}return geometry}
function box(w,h,d,m,x=0,y=0,z=0,group=scene){let geometry=sharedGeometry('b:'+w+','+h+','+d,()=>new THREE.BoxGeometry(w,h,d));let mesh=new THREE.Mesh(geometry,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh}
function cyl(r1,r2,h,m,x,y,z,group=scene,n=7){let geometry=sharedGeometry('c:'+r1+','+r2+','+h+','+n,()=>new THREE.CylinderGeometry(r1,r2,h,n));let mesh=new THREE.Mesh(geometry,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh}
function tree(g,x,z,scale=1){
 cyl(.045*scale,.07*scale,.38*scale,mats.wood,x,.19*scale,z,g);
 cyl(0,.30*scale,.58*scale,mats.leaf,x,.57*scale,z,g,7);
 cyl(0,.22*scale,.43*scale,mats.leafLight,x,.81*scale,z,g,7);
 }
let ocean=new THREE.Mesh(new THREE.PlaneGeometry(200,200),mats.water);ocean.rotation.x=-Math.PI/2;ocean.position.y=-.42;ocean.receiveShadow=true;scene.add(ocean);
function valid(x,z){return x>=0&&z>=0&&x<N&&z<N}
function key(x,z){return x+','+z}function pos(n){return n-(N-1)/2}
// Shared instanced geometry keeps draw calls bounded as more islands are built.
const maxLand=N*N,soilGeometry=new THREE.BoxGeometry(1,.28,1),grassGeometry=new THREE.BoxGeometry(.99,.12,.99),shoreGeometry=new THREE.BoxGeometry(.14,.012,.99);
const soilInstances=new THREE.InstancedMesh(soilGeometry,mats.soil,maxLand),grassA=new THREE.InstancedMesh(grassGeometry,mats.grass,maxLand),grassB=new THREE.InstancedMesh(grassGeometry,mats.grass2,maxLand),shoreInstances=new THREE.InstancedMesh(shoreGeometry,mats.sand,maxLand*4);
const terrainInstances=[soilInstances,grassA,grassB,shoreInstances];for(const mesh of terrainInstances){mesh.count=0;mesh.receiveShadow=true;scene.add(mesh)}
const terrainTransform=new THREE.Object3D();
function renderLand(){
 let soil=0,a=0,b=0,shore=0;
 const set=(mesh,index,x,y,z,rotation=0)=>{terrainTransform.position.set(x,y,z);terrainTransform.rotation.set(0,rotation,0);terrainTransform.updateMatrix();mesh.setMatrixAt(index,terrainTransform.matrix)};
 for(const k of Object.keys(state.land)){
  const [x,z]=k.split(',').map(Number);if(!valid(x,z))continue;const px=pos(x),pz=pos(z);
  set(soilInstances,soil++,px,-.22,pz);if((x+z)%3)set(grassA,a++,px,-.02,pz);else set(grassB,b++,px,-.02,pz);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(!state.land[key(x+dx,z+dz)])set(shoreInstances,shore++,px+dx*.43,.045,pz+dz*.43,dz?Math.PI/2:0);
 }
 [soilInstances.count,grassA.count,grassB.count,shoreInstances.count]=[soil,a,b,shore];
 for(const mesh of terrainInstances){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere()}
}
renderLand();
// One invisible picking plane and one line mesh keep the sea grid light.
const pickPlane=new THREE.Mesh(new THREE.PlaneGeometry(N,N),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
pickPlane.rotation.x=-Math.PI/2;pickPlane.position.y=.05;scene.add(pickPlane);
const gridPoints=[];for(let i=0;i<=N;i++){let n=i-N/2;gridPoints.push(-N/2,-.40,n,N/2,-.40,n,n,-.40,-N/2,n,-.40,N/2)}
const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gridPoints,3));
const seaGrid=new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:'#d5f1e6',transparent:true,opacity:.24,depthWrite:false}));scene.add(seaGrid);
// A single dynamic line mesh covers the whole map, avoiding one object per drop.
const rainCount=500,rainArray=new Float32Array(rainCount*6),rainSeeds=[];
for(let i=0;i<rainCount;i++)rainSeeds.push({x:((i*37)%251)/251*N-N/2,z:((i*83)%257)/257*N-N/2,phase:((i*53)%263)/263});
const rainGeometry=new THREE.BufferGeometry(),rainAttribute=new THREE.BufferAttribute(rainArray,3);rainAttribute.setUsage(THREE.DynamicDrawUsage);rainGeometry.setAttribute('position',rainAttribute);
const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#d5edf0',transparent:true,opacity:.6,depthWrite:false}));rain.visible=false;rain.frustumCulled=false;scene.add(rain);let rainTime=0;
function updateRain(delta){
 rain.visible=city.event.title==='夏季风暴';if(!rain.visible)return;
 if(!state.paused)rainTime+=delta*state.speed;
 for(let i=0;i<rainCount;i++){const seed=rainSeeds[i],y=((seed.phase-rainTime*.35)%1+1)%1*6-.2,j=i*6;rainArray[j]=seed.x;rainArray[j+1]=y;rainArray[j+2]=seed.z;rainArray[j+3]=seed.x+.07;rainArray[j+4]=y+.28;rainArray[j+5]=seed.z+.03}
 rainAttribute.needsUpdate=true;
}
// A small hand-built harbor sits outside the playable grid.
const harbor=new THREE.Group();harbor.position.set(6.45,0,.3);harbor.visible=legacyDecor;scene.add(harbor);
box(2.1,.10,.9,mats.wood,0,.02,0,harbor);
for(let i=0;i<11;i++)box(.025,.018,.88,mats.cream,-.95+i*.19,.08,0,harbor);
for(let x of [-.8,.8])for(let z of [-.34,.34])cyl(.055,.06,.62,mats.wood,x,-.16,z,harbor,7);
for(let z of [-.4,.4]){box(2,.04,.04,mats.cream,0,.37,z,harbor);for(let x of [-.8,0,.8])box(.04,.4,.04,mats.wood,x,.21,z,harbor)}
let boat=new THREE.Group();boat.visible=legacyDecor;scene.add(boat);boat.position.set(7.5,-.25,1.35);
const hullGeometry=new THREE.CylinderGeometry(.42,.24,1.15,5,1);hullGeometry.rotateZ(Math.PI/2);hullGeometry.scale(1,.42,.75);let hull=new THREE.Mesh(hullGeometry,mats.hull);hull.castShadow=true;boat.add(hull);
box(.52,.07,.38,mats.cream,0,.08,0,boat);cyl(.025,.025,1.05,mats.wood,0,.58,0,boat,8);
const sailGeo=new THREE.BufferGeometry();sailGeo.setAttribute('position',new THREE.Float32BufferAttribute([.02,.96,0,.02,.18,0,.62,.18,0],3));sailGeo.computeVertexNormals();let sail=new THREE.Mesh(sailGeo,new THREE.MeshStandardMaterial({color:'#fff4dd',side:THREE.DoubleSide,roughness:1}));boat.add(sail);
const ripples=[];for(let i=0;i<17;i++){let a=i*2.4,r=8+(i%4)*.65;let wave=new THREE.Mesh(new THREE.RingGeometry(.21,.23,20,1,.15,Math.PI*.8),mats.foam);wave.rotation.x=-Math.PI/2;wave.rotation.z=i;wave.position.set(Math.cos(a)*r,-.405,Math.sin(a)*r);scene.add(wave);ripples.push(wave)}
const legacyRocks=new THREE.Group();legacyRocks.visible=legacyDecor;scene.add(legacyRocks);
if(legacyDecor)for(let i=0;i<18;i++){let a=i*2.4,r=8.3+(i%3)*.9;let rock=cyl(.13,.27,.25,mat(i%2?'#e8d8ab':'#d4c7a4'),Math.cos(a)*r,-.28,Math.sin(a)*r,legacyRocks,6);rock.rotation.z=.4}
const directions=[[1,0],[-1,0],[0,1],[0,-1]];
function neighborRoads(x,z){return directions.map(([dx,dz])=>['road','bridge'].includes(state.tiles[key(x+dx,z+dz)]))}
function model(type,x,z,level=1){let g=new THREE.Group();if(type==='road'){
 box(.98,.055,.98,mats.road,0,.08,0,g);
 let [east,west,south,north]=neighborRoads(x,z);
 // Marks follow the road instead of appearing through every junction.
 if((east||west)&&!(north||south)){box(.34,.008,.035,mats.white,0,.112,0,g)}
 else if((north||south)&&!(east||west)){box(.035,.008,.34,mats.white,0,.112,0,g)}
 for(let side of [-1,1]){if((east||west)&&!(north||south))box(.96,.01,.025,mats.white,0,.114,side*.4,g);else if((north||south)&&!(east||west))box(.025,.01,.96,mats.white,side*.4,.114,0,g)}
 }if(type==='bridge'){
 const [east,west,south,north]=neighborRoads(x,z);
 box(.98,.10,.98,mats.road,0,.08,0,g);
 // Leave each connected edge open, including junctions and corners.
 for(const [connected,axis,side] of [[east,'x',1],[west,'x',-1],[south,'z',1],[north,'z',-1]]){
  if(connected)continue;
  if(axis==='x')box(.045,.045,.98,mats.cream,side*.43,.27,0,g);
  else box(.98,.045,.045,mats.cream,0,.27,side*.43,g);
 }
 for(let x of [-.4,.4])for(let z of [-.4,.4])box(.04,.2,.04,mats.wood,x,.17,z,g);
 for(let x of [-.32,.32])for(let z of [-.32,.32])cyl(.04,.05,.47,mats.wood,x,-.19,z,g,6);
 }if(type==='house'){
 const tall=level===2,height=tall?.94:.57,variant=(x*11+z*7)%3;
 const roofMat=[mats.roof,mats.roofGold,mats.roofBlue][variant],wall=[mats.wallPeach,mats.wallMint,mats.wallBlue][variant];
 box(.76,.07,.72,mats.sand,0,.075,0,g);box(.70,height,.64,wall,0,.11+height/2,0,g);
 const roofGeometry=sharedGeometry('gable',()=>{const shape=new THREE.Shape();shape.moveTo(-.43,0);shape.lineTo(0,.30);shape.lineTo(.43,0);shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth:.78,bevelEnabled:false});geometry.translate(0,0,-.39);return geometry});
 const roof=new THREE.Mesh(roofGeometry,roofMat);roof.position.y=.11+height;roof.castShadow=true;g.add(roof);
 box(.78,.04,.04,mats.cream,0,.12+height,.39,g);box(.76,.035,.04,mats.cream,0,.12+height,-.39,g);
 box(.16,.26,.025,mats.wood,0,.25,.333,g);box(.19,.025,.11,mats.sand,0,.105,.38,g);
 box(.23,.045,.11,roofMat,0,.43,.39,g);cyl(.012,.012,.025,mats.crop,.05,.25,.35,g,6).rotation.x=Math.PI/2;
 const windowAt=(wx,wy)=>{
  box(.15,.15,.02,mats.window,wx,wy,.334,g);box(.02,.15,.025,mats.cream,wx,wy,.35,g);box(.15,.02,.025,mats.cream,wx,wy,.35,g);
  for(const side of [-1,1])box(.035,.16,.025,mats.wood,wx+side*.096,wy,.34,g);
  box(.13,.055,.065,mats.wood,wx,wy-.095,.37,g);for(const side of [-1,0,1])cyl(.018,.018,.035,variant===1?mats.pink:mats.crop,wx+side*.035,wy-.05,.37,g,5);
 };
 windowAt(-.23,.40);windowAt(.23,.40);
 if(tall){windowAt(-.23,.76);windowAt(.23,.76);box(.70,.03,.67,mats.cream,0,.62,0,g)}
 for(const side of [-1,1]){box(.02,.16,.16,mats.window,side*.356,.43,-.10,g);box(.025,.02,.16,mats.cream,side*.37,.43,-.10,g)}
 cyl(.04,.045,.26,mats.wood,.21,.11+height+.22,-.12,g);
}if(type==='shop'){box(.75,.55,.7,mats.white,0,.33,0,g);box(.82,.12,.77,mats.dark,0,.67,0,g);box(.48,.18,.04,mats.window,0,.36,.365,g);box(.62,.07,.16,mats.roof,0,.56,.42,g);box(.18,.25,.02,mats.wood,.25,.2,.36,g);
 for(let i=0;i<5;i++)box(.1,.018,.17,i%2?mats.white:mats.roof,-.25+i*.125,.605,.42,g);
 box(.38,.12,.025,mats.wood,-.05,.56,.37,g);box(.26,.02,.03,mats.white,-.05,.57,.39,g);
 box(.10,.10,.08,mats.crop,-.28,.18,.41,g);box(.10,.10,.08,mats.pink,-.16,.18,.41,g);box(.5,.025,.08,mats.wood,-.08,.25,.41,g);
 for(const side of [-1,1]){box(.025,.20,.34,mats.window,side*.385,.38,0,g);box(.035,.025,.34,mats.cream,side*.395,.38,0,g)}
 box(.38,.17,.025,mats.window,0,.40,-.36,g);box(.42,.03,.04,mats.cream,0,.40,-.38,g);box(.28,.06,.25,mats.wood,.17,.76,-.1,g)
 }if(type==='farm'){
  box(.9,.07,.9,mats.sand,0,.09,0,g);box(.78,.06,.78,mats.farm,0,.15,0,g);
  // Raised rows and a narrow irrigation channel make the plot legible from above.
  box(.035,.012,.76,mats.window,-.30,.19,0,g);
  for(const x of [-.15,.06,.27]){
   box(.14,.035,.72,mats.soil,x,.19,0,g);
   for(const z of [-.27,-.09,.09,.27]){
    cyl(.012,.014,.17,mats.leaf,x,.30,z,g,5);
    cyl(.035,.018,.09,mats.crop,x,.41,z,g,5);
    box(.075,.018,.025,mats.leafLight,x+.025,.28,z,g).rotation.z=.4;
   }
  }
  // A small scarecrow gives the field a human scale and a distinct silhouette.
  cyl(.018,.022,.53,mats.wood,-.34,.44,.32,g,6);
  box(.25,.025,.03,mats.wood,-.34,.55,.32,g);
  box(.11,.16,.07,mats.roofBlue,-.34,.52,.32,g);
  cyl(.045,.05,.09,mats.skinLight,-.34,.66,.32,g,6);
  cyl(.09,.07,.035,mats.crop,-.34,.72,.32,g,7);
  box(.15,.018,.13,mats.crop,-.34,.70,.32,g);
 }if(type==='park'){box(.85,.06,.85,mats.grass2,0,.1,0,g);tree(g,-.18,-.1,.85);tree(g,.22,.18,.65);box(.28,.07,.1,mats.wood,.15,.17,-.25,g);box(.28,.05,.05,mats.wood,.15,.24,-.29,g);
 for(const x of [.05,.25])box(.035,.12,.04,mats.wood,x,.13,-.25,g);
 for(let i=0;i<4;i++)cyl(.03,.03,.04,mats.pink,-.3+i*.14,.15,.3,g,6);
 for(let i=0;i<3;i++)box(.12,.012,.1,mats.sand,-.28+i*.19,.137,-.32+i*.16,g);
 cyl(.018,.025,.38,mats.dark,.34,.31,.31,g,6);cyl(.06,.045,.09,mats.cream,.34,.53,.31,g,6)}
 if(type==='warehouse'){
  box(.82,.10,.76,mats.sand,0,.11,0,g);box(.72,.54,.66,mats.wood,0,.43,0,g);
  box(.80,.11,.74,mats.roofGold,0,.75,0,g);box(.33,.30,.035,mats.dark,0,.31,.35,g);
  for(const x of [-.12,0,.12])box(.025,.30,.045,mats.cream,x,.31,.37,g);
  box(.28,.05,.13,mats.cream,0,.49,.40,g);box(.16,.12,.14,mats.crop,-.29,.19,.32,g);box(.14,.10,.13,mats.roofGold,.29,.18,.32,g);
 }
 if(type==='fishery'){
  box(.86,.08,.84,mats.wood,0,.11,0,g);
  for(let i=0;i<5;i++)box(.025,.012,.8,mats.cream,-.32+i*.16,.16,0,g);
  box(.45,.35,.42,mats.wallBlue,-.14,.33,-.12,g);box(.52,.10,.48,mats.roofBlue,-.14,.56,-.12,g);
  box(.15,.19,.025,mats.wood,-.14,.26,.10,g);box(.12,.10,.03,mats.window,-.29,.39,.10,g);
  box(.23,.10,.16,mats.crop,.25,.22,.24,g);box(.18,.08,.12,mats.cream,.25,.30,.24,g);
  cyl(.018,.018,.62,mats.wood,.32,.46,-.28,g,6);box(.22,.10,.025,mats.roof,.40,.70,-.28,g);
  for(const x of [-.34,.34])for(const z of [-.34,.34])cyl(.035,.04,.32,mats.wood,x,-.10,z,g,6);
  const sea=coastalWater(key(x,z),state.land)[0];
  if(sea){
   const [sx,sz]=sea.split(',').map(Number),dock=new THREE.Group();
   dock.rotation.y=Math.atan2(sx-x,sz-z)-buildingFacing(state.tiles,x,z);g.add(dock);
   box(.26,.05,.40,mats.wood,0,.08,.59,dock);
   for(const dx of [-.10,.10])cyl(.025,.03,.42,mats.wood,dx,-.14,.73,dock,6);
   const skiff=cyl(.12,.09,.36,mats.hull,.23,-.30,.75,dock,6);skiff.rotation.x=Math.PI/2;
   box(.17,.025,.21,mats.cream,.23,-.19,.75,dock);
   cyl(.012,.012,.28,mats.wood,.23,-.05,.75,dock,6);
   box(.13,.09,.015,mats.white,.29,.03,.75,dock);
   // The dock is decorative: clicking the adjacent sea must select that cell.
   dock.traverse(item=>{if(item.isMesh)item.raycast=()=>{}});
  }
 }
 if(type==='port'){
  box(.88,.08,.84,mats.wood,0,.11,0,g);for(let i=0;i<5;i++)box(.02,.012,.82,mats.cream,-.34+i*.17,.16,0,g);
  box(.46,.40,.40,mats.wallBlue,-.12,.36,-.12,g);box(.52,.10,.46,mats.roofBlue,-.12,.61,-.12,g);
  box(.18,.16,.025,mats.window,-.12,.43,.09,g);box(.14,.22,.03,mats.wood,-.12,.25,.10,g);
  cyl(.025,.025,.63,mats.wood,.32,.45,-.25,g,6);box(.23,.12,.025,mats.roof,.41,.70,-.25,g);
  box(.16,.14,.16,mats.crop,.25,.24,.24,g);box(.13,.12,.13,mats.roofGold,.05,.23,.25,g);
 }
 if(type==='clinic'){
  box(.78,.54,.7,mats.white,0,.33,0,g);box(.84,.12,.77,mats.roofBlue,0,.65,0,g);
  box(.28,.26,.025,mats.window,-.2,.37,.36,g);box(.15,.28,.025,mats.dark,.2,.23,.36,g);
  box(.24,.19,.025,mats.cream,0,.56,.37,g);box(.12,.045,.035,mats.roof,0,.56,.39,g);box(.045,.13,.035,mats.roof,0,.56,.39,g);
  box(.12,.045,.08,mats.cream,.2,.44,.39,g);
 }
 if(type==='school'){
  box(.8,.59,.72,mats.cream,0,.35,0,g);box(.86,.12,.78,mats.roofGold,0,.7,0,g);
  for(const wx of [-.27,0,.27]){box(.16,.18,.03,mats.window,wx,.41,.375,g);box(.02,.18,.04,mats.white,wx,.41,.39,g)}
  box(.17,.25,.035,mats.wood,0,.2,.38,g);box(.32,.07,.1,mats.white,0,.65,.41,g);
  cyl(.025,.025,.4,mats.wood,.28,.96,-.12,g,6);box(.22,.12,.025,mats.roof,.38,1.08,-.12,g);
 }
 return g}
const walkers=[];let restSummary='';
function disposeGroup(group){group.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose()})}
let ferries=new Map();
function syncFerries(){
 const previous=ferries;ferries=new Map();
 for(const route of activeFerries(city.network)){
  const signature=JSON.stringify(route.water),old=previous.get(route.key);
  if(old?.signature===signature){ferries.set(route.key,old);previous.delete(route.key);continue}
  const vessel=new THREE.Group();box(.42,.10,.21,mats.hull,0,.06,0,vessel);box(.28,.035,.22,mats.cream,0,.13,0,vessel);
  box(.16,.12,.14,mats.wallBlue,-.02,.20,0,vessel);box(.19,.025,.17,mats.roofBlue,-.02,.27,0,vessel);
  box(.045,.035,.15,mats.window,-.02,.21,.01,vessel);cyl(.018,.018,.16,mats.wood,.10,.27,0,vessel,6);
  vessel.traverse(item=>{if(item.isMesh)item.raycast=()=>{}});scene.add(vessel);
  ferries.set(route.key,{vessel,signature,points:route.water.map(k=>k.split(',').map(Number)),travel:0});
 }
 for(const ferry of previous.values()){scene.remove(ferry.vessel);disposeGroup(ferry.vessel)}
}
function moveFerries(delta){
 for(const ferry of ferries.values()){
  const points=ferry.points,span=points.length-1;
  if(span>0&&!state.paused)ferry.travel=(ferry.travel+delta*state.speed*.34)%(span*2);
  const forward=ferry.travel<=span,t=forward?ferry.travel:span*2-ferry.travel,i=Math.min(Math.floor(t),Math.max(0,span-1)),p=t-i;
  const a=points[i],b=points[Math.min(i+1,span)],dx=b[0]-a[0],dz=b[1]-a[1];
  ferry.vessel.position.set(pos(a[0]+dx*p),-.39,pos(a[1]+dz*p));
  if(dx||dz)ferry.vessel.rotation.y=Math.atan2(dx*(forward?1:-1),dz*(forward?1:-1))+Math.PI/2;
 }
}
const routeOverlay=new THREE.Group(),routeMaterial=new THREE.LineDashedMaterial({color:'#fff2b0',dashSize:.25,gapSize:.16,transparent:true,opacity:.95,depthWrite:false});scene.add(routeOverlay);
function refreshPortRoutes(){
 for(const child of [...routeOverlay.children]){routeOverlay.remove(child);child.geometry.dispose()}
 if(!selectedPort||state.tiles[selectedPort]!=='port'){selectedPort=null;return 0}
 const routes=portRoutes(city.network,selectedPort);
 for(const route of routes){
  const points=[route.fromPort,...route.water,route.toPort].map(k=>{const [x,z]=k.split(',').map(Number);return new THREE.Vector3(pos(x),-.30,pos(z))});
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),routeMaterial);line.computeLineDistances();line.raycast=()=>{};routeOverlay.add(line);
 }
 return routes.length;
}
function makeWalker(index){
 const g=new THREE.Group(),shirts=[mats.roof,mats.dark,mats.pink,mats.roofGold,mats.roofBlue],shirt=shirts[index%shirts.length],skin=index%3===0?mats.skinWarm:mats.skinLight;
 box(.13,.18,.09,shirt,0,.26,0,g);box(.09,.025,.095,mats.cream,0,.18,0,g);
 const head=new THREE.Mesh(sharedGeometry('resident-head',()=>new THREE.SphereGeometry(.075,10,8)),skin);head.position.y=.415;head.castShadow=true;g.add(head);
 const hair=new THREE.Mesh(sharedGeometry('resident-hair',()=>new THREE.SphereGeometry(.077,10,6,0,Math.PI*2,0,Math.PI*.48)),mats.hair);hair.position.y=.43;g.add(hair);
 for(const x of [-.027,.027])box(.012,.012,.009,mats.hair,x,.42,.071,g);
 if(index%3===0){box(.13,.018,.12,mats.crop,0,.49,0,g);cyl(.048,.055,.035,mats.crop,0,.515,0,g,8)}
 else if(index%3===1){box(.045,.095,.038,mats.hair,-.055,.385,-.035,g);box(.045,.095,.038,mats.hair,.055,.385,-.035,g)}
 else box(.10,.035,.025,mats.cream,0,.35,.05,g);
 const legL=box(.045,.12,.05,mats.dark,-.035,.105,0,g),legR=box(.045,.12,.05,mats.dark,.035,.105,0,g);
 const armL=box(.04,.15,.045,shirt,-.085,.25,0,g),armR=box(.04,.15,.045,shirt,.085,.25,0,g);
 box(.035,.035,.045,skin,0,-.075,0,armL);box(.035,.035,.045,skin,0,-.075,0,armR);
 box(.05,.035,.07,mats.wood,-.035,.04,.01,g);box(.05,.035,.07,mats.wood,.035,.04,.01,g);
 g.scale.setScalar(.65);scene.add(g);
 const vessel=new THREE.Group();box(.25,.08,.13,mats.hull,0,.05,0,vessel);box(.11,.07,.10,mats.cream,0,.12,0,vessel);cyl(.015,.015,.18,mats.wood,0,.22,0,vessel,6);vessel.visible=false;scene.add(vessel);
 const resident={group:g,vessel,legL,legR,armL,armR,index};g.userData.resident=resident;return resident;
}
function rebuild(){
 city=cityStats(state.tiles,state.levels||{},state.tax,state.population,state.labor,state.land,state.foodStock,state.roadAnchor,state.month);state.population=city.pop;state.foodStock=city.foodStock;roadKeys=[...city.network];if(!city.network.has(state.roadAnchor))state.roadAnchor=roadKeys[0]??null;
 const previous=meshes;meshes={};
 for(const [k,t] of Object.entries(state.tiles)){
  const [x,z]=k.split(',').map(Number);if(!valid(x,z)||!['road','bridge','house','shop','farm','fishery','warehouse','park','clinic','school','port'].includes(t))continue;
  const isRoad=t==='road'||t==='bridge',level=state.levels?.[k]||1;
  const facing=['house','shop','clinic','school','port','fishery','warehouse'].includes(t)?buildingFacing(state.tiles,x,z):0;
  const inactive=isRoad?!city.network.has(k):!hasAccess(k,city.network)||(['port','fishery'].includes(t)&&!coastalWater(k,state.land).length);
  const signature=JSON.stringify([t,level,facing,inactive,isRoad?neighborRoads(x,z):null,t==='fishery'?coastalWater(k,state.land)[0]:null]);
  if(previous[k]?.userData.signature===signature){meshes[k]=previous[k];delete previous[k];continue}
  const g=model(t,x,z,level);g.userData={x,z,signature};g.rotation.y=facing;
  if(inactive){box(.16,.22,.08,mats.roof,.32,.35,.32,g);box(.06,.06,.09,mats.white,.32,.38,.32,g)}
  g.position.set(pos(x),0,pos(z));scene.add(g);meshes[k]=g;
 }
 for(const m of Object.values(previous)){scene.remove(m);disposeGroup(m)}
 refreshPortRoutes();
 syncFerries();
 syncWalkers();
}
function syncWalkers(){
 const count=Math.min(14,Math.ceil(city.pop/8*1.5),roadKeys.length);
 while(walkers.length>count){let w=walkers.pop();scene.remove(w.group);scene.remove(w.vessel);disposeGroup(w.group);disposeGroup(w.vessel)}
 while(walkers.length<count)walkers.push(makeWalker(walkers.length));
 const plans=planJourneys(state.tiles,city.network,city.pop,city.jobs,count,city.workforce,city.services,state.land);
 walkers.forEach((w,i)=>{
  const plan=plans[i];if(!plan)return;
  const signature=JSON.stringify([plan,[...city.network.ferries]]);if(w.signature===signature)return;
  w.signature=signature;w.plan=plan;w.legIndex=0;w.activeLeg=plan.legs[0];w.points=journeyPoints(w.activeLeg,city.network);w.segment=0;w.progress=0;w.rest=i*.22;w.returning=false;w.sleeping=isNight(state.dayPhase);
 });
}

function stats(){return city}
function update(){let a=stats();const payment=loanPayment(state.loanDebt),netIncome=a.income-payment;$('#loanStatus').textContent=payment?'待还 '+state.loanDebt+' · 每月还 '+payment:'借 500 · 总还 600 · 每月还 50';$('#loan').disabled=payment>0;const upcoming=nextCalendarEvent(state.month);$('#season').textContent=a.event.title+' · '+a.event.description+'；'+upcoming.month+'月 '+upcoming.title+'（'+upcoming.description+'）';$('#prosperity').textContent='幸福度影响产业收入：当前 '+Math.round(a.prosperity*100)+'%';$('#taxRevenue').textContent='+'+a.taxRevenue;$('#businessRevenue').textContent='+'+a.businessRevenue;$('#maintenance').textContent='−'+a.maintenance+(a.ferryCost?'（航线 '+a.ferryCost+'）':'');document.querySelectorAll('[data-tax]').forEach(b=>{let active=b.dataset.tax===(state.tax||'normal');b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});$('#laborNote').textContent='农业 '+a.workforce.farm+' · 服务 '+a.workforce.service+' · 商业 '+a.workforce.shop;document.querySelectorAll('[data-labor]').forEach(b=>{let active=b.dataset.labor===(state.labor||'farm');b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});$('#money').textContent='☀ '+Math.floor(state.money);$('#population').textContent=a.pop+'/'+a.capacity+' 人';$('#happiness').textContent=a.happy+'%';$('#income').textContent=(netIncome>=0?'+':'')+netIncome;$('#date').textContent='第 '+(Math.floor((state.month-1)/12)+1)+' 年 · '+((state.month-1)%12+1)+' 月';$('#pause').textContent=state.paused?'▶':'Ⅱ';$('#speed').textContent=state.speed+'×';const goal=missionView(state.missionStage,missionMetrics(state.land,state.tiles,a));$('#goal').textContent=goal.title;$('#goaltext').textContent=goal.description+'（'+goal.current+'/'+goal.target+'）'+(goal.reward?' · 奖励 '+goal.reward:'');$('#progress').style.width=Math.min(100,goal.current/goal.target*100)+'%';$('#hint').textContent=Object.keys(state.land).length<4?'选择“填海”，在海上点击地块；再铺路、建造住宅和农田。':`航线 ${a.ferryCount} · 就业 ${a.employed}/${a.jobs} · 粮食产 ${a.food}/需 ${a.pop} · 储粮 ${a.foodStock}/${a.stockCapacity} · 购物 ${a.services.shopping}/${a.pop} · 休闲 ${a.services.leisure}/${a.pop} · 医疗 ${a.services.health}/${a.pop} · 教育 ${a.services.education}/${a.pop} · 停摆 ${a.inactive}。可在财政面板调整人手优先行业；有空住房、岗位和食物且幸福度≥60时居民迁入。`; document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('#brush').hidden=tool!=='land'&&tool!=='road';$('#brush').textContent=tool==='road'?(roadLine?'连线铺路':'单格道路'):landBrush+'×'+landBrush+' 填海';$('#brush').setAttribute('aria-label',tool==='road'?'切换道路铺设方式':'切换填海范围');$('#brush').title=tool==='road'?'切换单格或两点连线铺路':'切换单格或九格填海';$('#brush').setAttribute('aria-pressed',String(tool==='road'?roadLine:landBrush===3))}
function checkMissions(){
 const result=advanceMissions(state.missionStage,missionMetrics(state.land,state.tiles,city));
 state.missionStage=result.stage;state.money+=result.reward;
 return result.reward?'完成「'+result.completed.join('、')+'」 · 奖励 '+result.reward:'';
}
function notify(t){let n=$('#notice');n.textContent=t;n.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>n.classList.remove('show'),2200)}function save(){localStorage.setItem('sunnybay-v1',JSON.stringify(state))}function place(x,z){let k=key(x,z), old=state.tiles[k];if(!tool)return;if(tool==='inspect'){describeTile(x,z);return}if(tool==='road'&&roadLine){if(!roadStart){roadStart={x,z};notify('已选择道路起点，再点击终点；先横向再纵向');return}const route=plannedRoad(roadStart,{x,z},state.land,state.tiles,N);if(route.blocked){clearRoadPreview();notify('路线遇到海面或建筑，请选择其他终点');return}const cost=route.cells.length*TYPES.road.cost;if(!route.cells.length){clearRoadPreview();notify('这条路线已有道路，请选择其他终点');return}if(state.money<cost){clearRoadPreview();notify('资金不足，本次铺路需要 '+cost);return}if(!roadEnd||roadEnd.x!==x||roadEnd.z!==z){previewRoad(route,{x,z});return}roadStart=null;clearRoadPreview();state.money-=cost;for(const cell of route.cells)state.tiles[cell]='road';const stockBefore=state.foodStock;rebuild();const lost=stockBefore-state.foodStock,reward=checkMissions();update();save();notify((reward?reward+'；':'')+'铺设道路 '+route.cells.length+' 格，花费 '+cost+(lost>0?'；仓容下降，损失储粮 '+lost:''));return}if(tool==='land'){
 const cells=plannedLand(x,z,landBrush,state.land,state.tiles,N),cost=cells.length*TYPES.land.cost;
 if(!cells.length){notify('范围内没有可填海的海域');return}
 if(state.money<cost){notify('资金不足，本次填海需要 '+cost);return}
 const stockBefore=state.foodStock;state.money-=cost;for(const cell of cells)state.land[cell]=true;renderLand();if(Object.values(state.tiles).some(t=>t==='port'||t==='fishery'))rebuild();
 const lost=stockBefore-state.foodStock,reward=checkMissions();update();save();notify((reward||('填海 '+cells.length+' 格，花费 '+cost))+(lost>0?'；仓容下降，损失储粮 '+lost:''));return
 }if(tool==='bulldoze'&&!old&&state.land[k]){const stockBefore=state.foodStock;delete state.land[k];state.money+=Math.floor(TYPES.land.cost*.3);renderLand();rebuild();const lost=stockBefore-state.foodStock,reward=checkMissions();update();save();notify((reward?reward+'；':'')+'空地已恢复为海面 · 返还 7'+(lost>0?'；仓容下降，损失储粮 '+lost:''));return}if(tool==='bridge'&&state.land[k]){notify('桥梁需要建在海面上，陆地请铺道路');return}if(!state.land[k]&&tool!=='bridge'&&!(tool==='bulldoze'&&old==='bridge')){notify('请先在海上填出陆地');return}if(['port','fishery'].includes(tool)&&!coastalWater(k,state.land).length){notify(TYPES[tool].name+'需要建在临海的陆地');return}if(tool==='upgrade'){if(old!=='house'){notify('只能升级住宅，请点击一座住宅');return}if(state.levels?.[k]===2){notify('这座住宅已达到最高等级');return}if(state.money<TYPES.upgrade.cost){notify('资金不足，住宅升级需要 160');return}state.money-=TYPES.upgrade.cost;state.levels=state.levels||{};state.levels[k]=2;notify('住宅已升级，可容纳更多居民')}else if(tool==='bulldoze'){if(!old){notify('这里没有可拆除的建筑');return}delete state.tiles[k];let bonus=state.levels?.[k]===2?TYPES.upgrade.cost:0;if(state.levels)delete state.levels[k];state.money+=Math.floor((TYPES[old].cost+bonus)*.3)}else{if(old){notify('这块地已经被占用');return}if(state.money<TYPES[tool].cost){notify('资金不足，等待每月收入或拆除建筑');return}state.money-=TYPES[tool].cost;state.tiles[k]=tool}const stockBefore=state.foodStock;rebuild();const lost=stockBefore-state.foodStock,reward=checkMissions();update();save();let message=reward||'';if(lost>0)message+=(message?'；':'')+'仓容下降，损失储粮 '+lost;if(!old&&state.tiles[k]===tool){const connected=['road','bridge'].includes(tool)?city.network.has(k):hasAccess(k,city.network);if(!connected)message+=(message?'；':'')+TYPES[tool].name+'已建造，但未接入主路网，请连接道路或港口'}if(message)notify(message)}
$('#brush').addEventListener('click',()=>{if(tool==='road'){roadLine=!roadLine;roadStart=null;clearRoadPreview();notify(roadLine?'连线铺路：依次点击起点和终点':'已切换单格道路')}else landBrush=landBrush===1?3:1;update();cursor.visible=false});
document.querySelector('.labor-options').addEventListener('click',e=>{const button=e.target.closest('[data-labor]');if(!button)return;state.labor=button.dataset.labor;city=cityStats(state.tiles,state.levels||{},state.tax,state.population,state.labor,state.land,state.foodStock,state.roadAnchor,state.month);syncWalkers();update();save();notify('人手分配已调整，产出与服务随之变化')});
$('#loan').addEventListener('click',()=>{const result=borrow(state.money,state.loanDebt);if(!result)return;state.money=result.money;state.loanDebt=result.debt;update();save();notify('获得贷款 500，之后每月偿还 50，共还 600')});
document.querySelector('.tax-options').addEventListener('click',e=>{let button=e.target.closest('[data-tax]');if(!button)return;state.tax=button.dataset.tax;city=cityStats(state.tiles,state.levels||{},state.tax,state.population,state.labor,state.land,state.foodStock,state.roadAnchor,state.month);update();save();notify('税收政策已调整，下月结算生效')});
$('#exportSave').onclick=()=>{const url=URL.createObjectURL(new Blob([encodeSave(state)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='晴湾物语存档.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('存档已导出')};
$('#importSave').onclick=()=>$('#saveFile').click();
$('#saveFile').addEventListener('change',async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  if(file.size>1024*1024)throw Error('存档文件过大');
  const imported=decodeSave(await file.text());
  if(!confirm('导入会替换当前浏览器中的城镇。请先导出当前存档。确定继续吗？'))return;
  state={money:1800,month:1,tiles:{},land:{},terrainVersion:2,levels:{},tax:'normal',labor:'farm',population:0,foodStock:0,loanDebt:0,roadAnchor:null,missionStage:null,dayPhase:0,speed:1,paused:false,...imported};
  legacyDecor=state.legacyDecor===true;harbor.visible=legacyDecor;boat.visible=legacyDecor;legacyRocks.visible=legacyDecor;
  timer=0;tool='land';landBrush=1;roadLine=false;roadStart=null;selectedPort=null;clearRoadPreview();renderLand();rebuild();
  if(state.missionStage==null)state.missionStage=advanceMissions(0,missionMetrics(state.land,state.tiles,city),false).stage;
  update();save();notify('存档导入成功');
 }catch(error){notify('导入失败：'+(error instanceof SyntaxError?'文件不是有效 JSON':error.message))}
});
$('#tools').innerHTML=Object.entries(TYPES).map(([id,t])=>`<button class="tool" data-tool="${id}"><span class="icon">${t.icon}</span><b>${t.name}</b><small>${t.cost?'☀ '+t.cost:id==='inspect'?'查看状态':id==='bulldoze'?'建筑 / 空地':'返还 30%'}</small></button>`).join('');$('#tools').onclick=e=>{let b=e.target.closest('[data-tool]');if(b){tool=b.dataset.tool;roadStart=null;clearRoadPreview();if(selectedPort){selectedPort=null;refreshPortRoutes()}update();if(tool==='port')notify('港口须临海并接路，同片水域的港口自动通航');if(tool==='fishery')notify('渔场须临海并接路，最多4人工作，平时满员月产16粮食');if(tool==='bulldoze')notify('点击建筑拆除；点击空地可恢复为海面')}};$('#pause').onclick=()=>{state.paused=!state.paused;update()};$('#speed').onclick=()=>{state.speed=state.speed===1?2:state.speed===2?3:1;update()};$('#save').onclick=()=>{save();notify('小镇已保存到此浏览器')};$('#reset').onclick=()=>{if(confirm('确定重新开始？当前小镇存档将被覆盖。')){state={money:1800,month:1,tiles:{},land:{},terrainVersion:2,levels:{},tax:'normal',labor:'farm',population:0,foodStock:0,loanDebt:0,roadAnchor:null,missionStage:0,dayPhase:0,speed:1,paused:false};renderLand();harbor.visible=false;boat.visible=false;legacyRocks.visible=false;tool='land';landBrush=1;roadLine=false;roadStart=null;selectedPort=null;clearRoadPreview();rebuild();update();save()}};window.addEventListener('keydown',e=>{if(e.key==='Escape'){roadStart=null;clearRoadPreview();selectedPort=null;refreshPortRoutes();tool=null;update()}});
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null,panMode=false,keyboardTile={x:Math.floor(N/2),z:Math.floor(N/2)};renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','游戏地图：方向键选择地块，回车建设');$('#zoomIn').onclick=()=>{dist=Math.max(10,dist-3)};$('#zoomOut').onclick=()=>{dist=Math.min(42,dist+3)};$('#panMode').onclick=()=>{panMode=!panMode;$('#panMode').textContent=panMode?'拖动平移':'拖动旋转';$('#panMode').setAttribute('aria-pressed',String(panMode))};
const cursor=new THREE.Group(),cursorGeometry=new THREE.PlaneGeometry(.94,.94);
const cursorValid=new THREE.MeshBasicMaterial({color:0xa9e6c5,transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide});
const cursorInvalid=new THREE.MeshBasicMaterial({color:0xf4a49a,transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide});
const cursorTiles=[];for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const mesh=new THREE.Mesh(cursorGeometry,cursorValid);mesh.rotation.x=-Math.PI/2;mesh.position.set(dx,.105,dz);cursor.add(mesh);cursorTiles.push({dx,dz,mesh})}cursor.visible=false;scene.add(cursor);
const roadPreview=new THREE.InstancedMesh(cursorGeometry,cursorValid,N*2);roadPreview.count=0;roadPreview.raycast=()=>{};scene.add(roadPreview);
const roadPreviewTransform=new THREE.Object3D();
function clearRoadPreview(){roadEnd=null;roadPreview.count=0;$('#roadPreview').hidden=true}
function previewRoad(route,end){
 roadEnd=end;roadPreview.count=route.cells.length;
 route.cells.forEach((cell,i)=>{const [x,z]=cell.split(',').map(Number);roadPreviewTransform.position.set(pos(x),.13,pos(z));roadPreviewTransform.rotation.set(-Math.PI/2,0,0);roadPreviewTransform.updateMatrix();roadPreview.setMatrixAt(i,roadPreviewTransform.matrix)});
 roadPreview.instanceMatrix.needsUpdate=true;roadPreview.computeBoundingSphere();
 const label=$('#roadPreview');label.hidden=false;label.textContent='预览 '+route.cells.length+' 格 · 花费 '+route.cells.length*TYPES.road.cost+' · 再点终点确认；切换工具取消';
}
function showCursor(tile){
 cursor.visible=!!tile&&!!tool;if(!cursor.visible)return;cursor.position.set(pos(tile.x),0,pos(tile.z));
 const radius=tool==='land'&&landBrush===3?1:0;
 for(const item of cursorTiles){const x=tile.x+item.dx,z=tile.z+item.dz,k=key(x,z),occupied=!!state.tiles[k],land=!!state.land[k];
  item.mesh.visible=Math.abs(item.dx)<=radius&&Math.abs(item.dz)<=radius&&valid(x,z);if(!item.mesh.visible)continue;
  const allowed=tool==='land'||tool==='bridge'?!land&&!occupied:['port','fishery'].includes(tool)?land&&!occupied&&coastalWater(k,state.land).length>0:tool==='inspect'?true:tool==='bulldoze'?occupied||land:tool==='upgrade'?state.tiles[k]==='house':land&&!occupied;
  item.mesh.material=allowed?cursorValid:cursorInvalid;
 }
}
function describeTile(x,z){let k=key(x,z),t=state.tiles[k];if(t!=='port'&&selectedPort){selectedPort=null;refreshPortRoutes()}if(!t){notify(state.land[k]?'空地：可在这里建设':'海域：选择填海来开辟陆地');return}if(t==='road'||t==='bridge'){notify(TYPES[t].name+(city.network.has(k)?'：已接入主路网':'：未接入主路网'));return}if(t==='fishery'){const active=hasAccess(k,city.network)&&coastalWater(k,state.land).length;notify('渔场 · 4个岗位 · 平时满员月产16粮食'+(active?'：已接通':'：需要临海并接路'));return}if(t==='shop'){const shop=city.services.shops[k];notify(shop?'商店 · 员工 '+shop.workers+'/8 · 顾客 '+shop.customers+'/'+(shop.workers*3)+' · 购物范围6格':'商店停摆：需要接入主路网');return}if(t==='park'){const active=hasAccess(k,city.network);notify('公园 · 最多服务24人 · 路程6格'+(active?'：已接通':'：需要接入主路网'));return}if(t==='warehouse'){const active=hasAccess(k,city.network);notify('粮仓 · 容量 +120 · 月维护6'+(active?'：已接通':'：需要接入主路网'));return}if(t==='port'){selectedPort=k;const links=refreshPortRoutes(),active=hasAccess(k,city.network)&&coastalWater(k,state.land).length;notify('港口 · 月维护10'+(active?' · 已显示航线 '+links+' 条':' · 需要临海并接入主路网'));return}let active=hasAccess(k,city.network),level=t==='house'&&state.levels?.[k]===2?' · 2级':'',service=t==='clinic'||t==='school'?' · 最多服务24人 · 人手'+Math.round(city.serviceStaffing*100)+'% · 路程6格 · 月维护10':'';let home=city.services.homes[k];if(t==='house'&&active&&home){notify('住宅'+level+'：居民 '+home.residents+' · 购物 '+home.shopping+' · 休闲 '+home.leisure+' · 医疗 '+home.health+' · 教育 '+home.education);return}notify(TYPES[t].name+level+service+(active?'：已接通，正常运作':'：停摆，请连接主路网'))}
function residentAt(e){
 mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(mouse,camera);
 let hit=ray.intersectObjects(walkers.map(w=>w.group),true)[0]?.object;
 while(hit&&!hit.userData.resident)hit=hit.parent;return hit?.userData.resident;
}
function describeResident(w){
 const p=w.plan;if(!p)return;
 const label=k=>{const [x,z]=k.split(',').map(Number);return (TYPES[state.tiles[k]]?.name||'建筑')+' '+(x+1)+'-'+(z+1)};
 const names=['小岚','阿禾','小屿','阿晴','小舟','阿麦','小雨','阿林','小海','阿宁','小夏','阿星','小川','阿木'];const leg=w.activeLeg;notify('居民代表 '+names[w.index%names.length]+'：住在'+label(p.home)+'；'+(leg?'下一站'+leg.activity+'（'+label(leg.to)+'）':'在家')); 
}
function tileAt(e){
 mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(mouse,camera);
 const hit=ray.intersectObjects([pickPlane,...Object.values(meshes)],true)[0];if(!hit)return;
 if(hit.object===pickPlane){const x=Math.floor(hit.point.x+N/2),z=Math.floor(hit.point.z+N/2);return valid(x,z)?{x,z}:undefined}
 let object=hit.object;while(object&&object.userData.x===undefined)object=object.parent;return object?.userData;
}
renderer.domElement.addEventListener('keydown',e=>{const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(offsets[e.key]){e.preventDefault();keyboardTile.x=THREE.MathUtils.clamp(keyboardTile.x+offsets[e.key][0],0,N-1);keyboardTile.z=THREE.MathUtils.clamp(keyboardTile.z+offsets[e.key][1],0,N-1);target.x=pos(keyboardTile.x);target.z=pos(keyboardTile.z);showCursor(keyboardTile);notify('地块 '+(keyboardTile.x+1)+'-'+(keyboardTile.z+1));}else if(e.key==='Enter'||e.key===' '){e.preventDefault();place(keyboardTile.x,keyboardTile.z)}else if(e.key==='+'||e.key==='=')dist=Math.max(10,dist-3);else if(e.key==='-')dist=Math.min(42,dist+3)});
renderer.domElement.addEventListener('pointerleave',()=>{cursor.visible=false});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,button:e.button,moved:false};renderer.domElement.setPointerCapture(e.pointerId)});renderer.domElement.addEventListener('pointermove',e=>{if(!down){let tile=tileAt(e);showCursor(tile);return}let dx=e.clientX-down.lastX,dy=e.clientY-down.lastY;if(Math.abs(e.clientX-down.x)+Math.abs(e.clientY-down.y)>5)down.moved=true;if(down.moved){if(down.button===2||panMode){const scale=dist*.0015;target.x=THREE.MathUtils.clamp(target.x-(Math.cos(az)*dx+Math.sin(az)*dy)*scale,-N/2,N/2);target.z=THREE.MathUtils.clamp(target.z+(Math.sin(az)*dx-Math.cos(az)*dy)*scale,-N/2,N/2)}else{az-=dx*.008;el=Math.max(.35,Math.min(1.25,el+dy*.006))}}down.lastX=e.clientX;down.lastY=e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(down&&!down.moved&&down.button===0){let resident=tool==='inspect'?residentAt(e):null;if(resident)describeResident(resident);else{let tile=tileAt(e);if(tile)place(tile.x,tile.z)}}down=null});renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(10,Math.min(42,dist+e.deltaY*.01))},{passive:false});window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
rebuild();if(state.missionStage==null)state.missionStage=advanceMissions(0,missionMetrics(state.land,state.tiles,city),false).stage;update();let last=performance.now();function animate(now){requestAnimationFrame(animate);let delta=Math.min(.1,(now-last)/1000);last=now;if(!state.paused){state.dayPhase=((state.dayPhase||0)+delta*state.speed/72)%1;timer+=delta*state.speed;if(timer>=12){timer=0;let a=stats();state.money+=a.income;const loan=settleLoan(state.money,state.loanDebt);state.money=loan.money;state.loanDebt=loan.debt;state.month++;let before=a.pop;state.foodStock=a.foodAfter;state.population=advancePopulation(a);city=cityStats(state.tiles,state.levels||{},state.tax,state.population,state.labor,state.land,state.foodStock,state.roadAnchor,state.month);syncWalkers();const reward=checkMissions();if(city.pop!==before)notify(city.pop>before?'生活条件改善，有居民迁入':'生活条件不足，有居民迁出');if(state.money<0)notify('财政赤字！增加居民和商店收入');if(reward)notify(reward);update();save()}}updateDaylight();updateRain(delta);moveFerries(delta);walkers.forEach(w=>{
  const night=isNight(state.dayPhase);
  if(w.sleeping){
   if(night||state.paused){w.group.visible=false;w.vessel.visible=false;return}
   w.sleeping=false;w.returning=false;w.legIndex=0;w.activeLeg=w.plan.legs[0];w.points=journeyPoints(w.activeLeg,city.network);w.segment=0;w.progress=0;w.rest=w.index*.22;
  }
  if(!w.points||w.points.length<2)return;
  const dt=state.paused?0:delta*state.speed;
  if(w.rest>0)w.rest=Math.max(0,w.rest-dt);
  else{
    w.progress+=dt*.42;
    if(w.progress>=1){
      w.segment++;w.progress=0;
      if(w.segment>=w.points.length-1){
       const arrived=w.activeLeg.to;
       if(w.returning||night){
        if(arrived===w.plan.home){w.returning=false;w.sleeping=night;w.legIndex=0;w.activeLeg=w.plan.legs[0]}
        else{w.activeLeg=returnHomeLeg(arrived,w.plan.home,city.network);w.returning=!!w.activeLeg;if(!w.activeLeg){w.legIndex=0;w.activeLeg=w.plan.legs[0]}}
       }else{w.legIndex=(w.legIndex+1)%w.plan.legs.length;w.activeLeg=w.plan.legs[w.legIndex]}
       if(w.sleeping){w.group.visible=false;w.vessel.visible=false;return}
       w.points=journeyPoints(w.activeLeg,city.network);w.segment=0;w.rest=1.2;
      }
    }
  }
  const from=w.points[w.segment],to=w.points[w.segment+1]||from,p=w.progress;
  const dx=to.x-from.x,dz=to.z-from.z,x=pos(from.x+dx*p),z=pos(from.z+dz*p),sailing=!!to.sea;
  w.group.visible=!sailing;w.vessel.visible=sailing;w.group.position.set(x,.11+(dt&&!w.rest?Math.abs(Math.sin(p*24))*.012:0),z);w.vessel.position.set(x,-.32,z);
  if(dx||dz){w.group.rotation.y=Math.atan2(dx,dz);w.vessel.rotation.y=Math.atan2(dx,dz)+Math.PI/2}
  const stride=dt&&!w.rest?Math.sin(p*24)*.45:0;w.legL.rotation.x=stride;w.legR.rotation.x=-stride;w.armL.rotation.x=-stride;w.armR.rotation.x=stride;
 });
 const restText='居民代表休息 '+walkers.filter(w=>w.sleeping).length+'/'+walkers.length;if(restText!==restSummary){restSummary=restText;$('#restStatus').textContent=restText}
 boat.position.y=-.25+Math.sin(now*.0012)*.035;boat.rotation.z=Math.sin(now*.0009)*.035;mats.foam.opacity=.42+.08*Math.sin(now*.001);
 camera.position.set(target.x+Math.sin(az)*Math.cos(el)*dist,target.y+Math.sin(el)*dist,target.z+Math.cos(az)*Math.cos(el)*dist);camera.lookAt(target);renderer.render(scene,camera)}requestAnimationFrame(animate);





