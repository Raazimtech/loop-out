import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/SkeletonUtils.js";

let renderer, scene, camera, controls, animationId, running=false, selectedMode="open_world", worldMode=null, resizeBound=false, clickBound=false;
let targets=[],enemies=[],obstacles=[],keys={},ammo=30,reserve=120,score=0,playerHealth=100,reloading=false,lastShot=0,weaponModel=null,muzzleFlash=null;
let zombieTemplate=null,zombieAssetLoading=false;
let yaw=0,pitch=0,stick={x:0,y:0},touchLook=null;
let weaponRecoil=0,audioContext=null,slideUntil=0,slideDirection=0,lastSlide=0,damageGraceUntil=0,lastDamageAt=0,lastPlayerHitAt=0;
const moveVelocity=new THREE.Vector3(),slideVector=new THREE.Vector3();
const raycaster=new THREE.Raycaster();
const clock=new THREE.Clock();
const assetLoader=new GLTFLoader();
const assetRoot="./assets/blackout/";
const canvas=document.getElementById("game-canvas");
const $=id=>document.getElementById(id);
const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
function box(x,y,z,w,h,d,material,collide=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);if(collide)obstacles.push({x,z,w,d});return m;}
function makeTarget(x,z){
 const group=new THREE.Group();group.position.set(x,0,z);
 const dark=mat(0x29343b), vest=mat(0x7a6549), head=mat(0xb5a28b), plate=mat(0xc8a66a);
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.62,4,8),vest);body.position.y=1.15;body.castShadow=true;group.add(body);
 const headMesh=new THREE.Mesh(new THREE.SphereGeometry(.22,12,10),head);headMesh.position.y=1.78;headMesh.castShadow=true;group.add(headMesh);
 const leg1=new THREE.Mesh(new THREE.BoxGeometry(.17,.65,.2),dark);leg1.position.set(-.13,.42,0);group.add(leg1);
 const leg2=leg1.clone();leg2.position.x=.13;group.add(leg2);
 const plateMesh=new THREE.Mesh(new THREE.BoxGeometry(.45,.3,.06),plate);plateMesh.position.set(0,1.2,-.31);group.add(plateMesh);
 group.userData={alive:true,respawn:0,parts:[body,headMesh,leg1,leg2,plateMesh]};
 scene.add(group);targets.push(group);return group;
}


function makeEnemy(x,z,index){
 const drone=index%6===5,group=new THREE.Group();group.position.set(x,0,z);const parts=[];
 if(drone){
  const shell=new THREE.Mesh(new THREE.SphereGeometry(.48,16,12),mat(0x39464e,.45));shell.position.y=0;group.add(shell);parts.push(shell);
  const core=new THREE.Mesh(new THREE.SphereGeometry(.2,12,10),new THREE.MeshStandardMaterial({color:0xe24c40,emissive:0x861b13,emissiveIntensity:1.2}));core.position.y=0;group.add(core);parts.push(core);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.57,.055,8,24),mat(0x9aa6aa,.35));ring.position.y=0;ring.rotation.x=Math.PI/2;group.add(ring);parts.push(ring);
  for(let n=0;n<4;n++){const angle=n*Math.PI/2,arm=new THREE.Mesh(new THREE.BoxGeometry(.9,.07,.09),mat(0x59656a,.5));arm.position.set(Math.cos(angle)*.48,.03,Math.sin(angle)*.48);arm.rotation.y=-angle;group.add(arm);parts.push(arm);const rotor=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.045,12),mat(0x171d21,.45));rotor.position.set(Math.cos(angle)*.9,.07,Math.sin(angle)*.9);group.add(rotor);parts.push(rotor);}
  group.userData={kind:"drone",alive:true,hp:100,parts,spawn:new THREE.Vector3(x,0,z),nextAttack:performance.now()+1300+index*170,phase:index*1.6};
 }else{
  const skin=mat(0x687b57),dark=mat(0x202a25),cloth=mat(0x3d493b),torn=mat(0x59634a),eye=new THREE.MeshStandardMaterial({color:0xe24c40,emissive:0x7e140c,emissiveIntensity:1.1});
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.62,6,12),cloth);torso.position.y=1.05;group.add(torso);parts.push(torso);
  const chest=new THREE.Mesh(new THREE.BoxGeometry(.56,.36,.18),torn);chest.position.set(0,1.23,-.25);group.add(chest);parts.push(chest);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.105,.13,.18,10),skin);neck.position.y=1.55;group.add(neck);parts.push(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.235,16,12),skin);head.scale.set(.92,1.12,.9);head.position.set(0,1.76,-.035);group.add(head);parts.push(head);
  const brow=new THREE.Mesh(new THREE.BoxGeometry(.34,.07,.08),dark);brow.position.set(0,1.84,-.235);group.add(brow);parts.push(brow);
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(.28,.13,.22),dark);jaw.position.set(0,1.57,-.14);group.add(jaw);parts.push(jaw);
  for(const side of [-.09,.09]){const e=new THREE.Mesh(new THREE.SphereGeometry(.032,10,8),eye);e.position.set(side,1.79,-.247);group.add(e);parts.push(e);}
  const limb=(w,h,d,x,y,z,material)=>{const m=new THREE.Mesh(new THREE.CapsuleGeometry(w/2,Math.max(.08,h-w),4,8),material);m.scale.z=d/(w);m.position.set(x,y,z);m.castShadow=true;group.add(m);parts.push(m);return m;};
  const armL=limb(.17,.65,.17,-.43,1.04,-.08,skin);armL.rotation.z=-.32;
  const armR=limb(.17,.65,.17,.43,1.04,-.08,skin);armR.rotation.z=.32;
  const handL=new THREE.Mesh(new THREE.SphereGeometry(.105,10,8),skin);handL.position.set(-.49,.69,-.12);group.add(handL);parts.push(handL);
  const handR=handL.clone();handR.position.x=.49;group.add(handR);parts.push(handR);
  const belt=new THREE.Mesh(new THREE.BoxGeometry(.58,.11,.37),dark);belt.position.y=.68;group.add(belt);parts.push(belt);
  const legL=limb(.2,.72,.22,-.17,.37,0,dark);const legR=limb(.2,.72,.22,.17,.37,0,dark);
  const bootL=new THREE.Mesh(new THREE.BoxGeometry(.23,.16,.36),dark);bootL.position.set(-.17,.09,-.07);group.add(bootL);parts.push(bootL);
  const bootR=bootL.clone();bootR.position.x=.17;group.add(bootR);parts.push(bootR);
  const pack=new THREE.Mesh(new THREE.BoxGeometry(.42,.52,.2),mat(0x303b32));pack.position.set(0,1.12,.31);group.add(pack);parts.push(pack);
  group.userData={kind:"zombie",alive:true,hp:100,parts,spawn:new THREE.Vector3(x,0,z),nextAttack:0,phase:index*1.4,stuck:0,lastPosition:new THREE.Vector3(x,0,z)};
 }
 group.userData.respawnAt=0;scene.add(group);enemies.push(group);return group;
}
const ZOMBIE_MODEL_URL="https://cdn.jsdelivr.net/gh/mrdoob/three.js@r180/examples/models/gltf/Soldier.glb";
function attachZombieModel(enemy,gltf){
 const d=enemy.userData;
 if(d.kind!=="zombie"||d.model)return;
 const model=cloneSkeleton(gltf.scene);
 const bounds=new THREE.Box3().setFromObject(model);
 const size=bounds.getSize(new THREE.Vector3());
 const scale=size.y?1.88/size.y:1;
 model.scale.setScalar(scale);
 model.position.y=-bounds.min.y*scale;
 model.traverse(node=>{
  if(!node.isMesh)return;
  node.castShadow=true;node.receiveShadow=true;
  const tint=material=>{
   const copy=material.clone();
   if(copy.color)copy.color.multiply(new THREE.Color(0.82,0.91,0.76));
   return copy;
  };
  node.material=Array.isArray(node.material)?node.material.map(tint):tint(node.material);
  d.parts.push(node);
 });
 // Remove the procedural placeholder only after the real rig has been cloned.
 for(const child of [...enemy.children]){
  enemy.remove(child);
  child.traverse(node=>{
   if(node.geometry)node.geometry.dispose();
   if(node.material)(Array.isArray(node.material)?node.material:[node.material]).forEach(m=>m.dispose());
  });
 }
 enemy.add(model);
 d.parts=d.parts.filter(part=>part.parent);
 d.model=model;
 d.mixer=new THREE.AnimationMixer(model);
 const runClip=gltf.animations.find(clip=>/run/i.test(clip.name))||gltf.animations.find(clip=>/walk/i.test(clip.name))||gltf.animations[0];
 if(runClip)d.mixer.clipAction(runClip).play();
}
function loadZombieAsset(){
 if(zombieTemplate){enemies.forEach(enemy=>attachZombieModel(enemy,zombieTemplate));return;}
 if(zombieAssetLoading)return;
 zombieAssetLoading=true;
 assetLoader.load(ZOMBIE_MODEL_URL,gltf=>{
  zombieTemplate=gltf;zombieAssetLoading=false;
  enemies.forEach(enemy=>attachZombieModel(enemy,gltf));
 },undefined,()=>{zombieAssetLoading=false;});
}
function updateEnemies(dt){
 const now=performance.now();
 enemies.forEach(enemy=>{
  const d=enemy.userData;
  if(d.mixer)d.mixer.update(dt);
  if(!d.alive){if(now>=d.respawnAt){d.alive=true;d.hp=100;enemy.position.copy(d.spawn);enemy.visible=true;d.nextAttack=now+900;}return;}
  const dx=camera.position.x-enemy.position.x,dz=camera.position.z-enemy.position.z,dist=Math.hypot(dx,dz);
  if(d.kind==="zombie"){
   if(dist>1.35&&dist<260){
    const baseAngle=Math.atan2(dz,dx),speed=dist>18?3.05:2.05;
    const separation=new THREE.Vector2();
    enemies.forEach(other=>{if(other===enemy||!other.userData.alive||other.userData.kind!=="zombie")return;const ox=enemy.position.x-other.position.x,oz=enemy.position.z-other.position.z,od=Math.hypot(ox,oz);if(od>0&&od<2.5){separation.x+=ox/od*(2.5-od);separation.y+=oz/od*(2.5-od);}});
    let moved=false;
    for(const offset of [0,.42,-.42,.82,-.82,1.25,-1.25,Math.PI]){
     const a=baseAngle+offset,tx=Math.cos(a)+separation.x*.32,tz=Math.sin(a)+separation.y*.32,len=Math.hypot(tx,tz)||1,nx=enemy.position.x+tx/len*speed*dt,nz=enemy.position.z+tz/len*speed*dt;
     if(!blocked(nx,nz)){enemy.position.x=nx;enemy.position.z=nz;moved=true;break;}
    }
    if(!moved)d.stuck+=dt;else d.stuck=0;
    if(d.stuck>.8){d.phase+=1.7;d.stuck=0;}
   }
   if(dist<1.75&&now>d.nextAttack){d.nextAttack=now+2700;damagePlayer(3.5);}
   enemy.rotation.y=Math.atan2(dx,dz);
   if(!d.mixer){const swing=Math.sin(now*.009+d.phase)*.12;if(d.parts[8])d.parts[8].rotation.z=-.32+swing;if(d.parts[9])d.parts[9].rotation.z=.32-swing;}
  }else{
   enemy.position.y=THREE.MathUtils.lerp(enemy.position.y,2.7+Math.sin(now*.002+d.phase)*.28,Math.min(1,dt*3));
   if(dist>4&&dist<100){
    const nx=enemy.position.x+dx/Math.max(dist,.01)*2.65*dt,nz=enemy.position.z+dz/Math.max(dist,.01)*2.65*dt;
    if(!blocked(nx,nz)){enemy.position.x=nx;enemy.position.z=nz;}
   }
   enemy.rotation.y=Math.atan2(dx,dz);
   if(dist<20&&now>d.nextAttack&&!lineBlocked(enemy.position.x,enemy.position.z,camera.position.x,camera.position.z)){
    d.nextAttack=now+6500+Math.random()*900;
    const beamScene=scene;
    const material=new THREE.LineBasicMaterial({color:0xff5147,transparent:true,opacity:.9});
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(enemy.position.x,enemy.position.y+.2,enemy.position.z),new THREE.Vector3(camera.position.x,1.3,camera.position.z)]);
    const beam=new THREE.Line(geometry,material);beamScene.add(beam);
    // Telegraph the shot so players can dodge instead of taking invisible instant damage.
    setTimeout(()=>{
     if(running&&scene===beamScene&&d.alive){
      const currentDistance=enemy.position.distanceTo(new THREE.Vector3(camera.position.x,enemy.position.y,camera.position.z));
      if(currentDistance<22&&!lineBlocked(enemy.position.x,enemy.position.z,camera.position.x,camera.position.z))damagePlayer(2);
     }
     beamScene.remove(beam);geometry.dispose();material.dispose();
    },430);
   }
  }
 });
 const el=$("game-enemy-count");if(el)el.textContent=String(enemies.filter(e=>e.userData.alive).length).padStart(2,"0");
}
function playHitSound(){
 try{
  if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();
  if(audioContext.state==="suspended")audioContext.resume();
  const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type="triangle";osc.frequency.setValueAtTime(92,now);osc.frequency.exponentialRampToValueAtTime(38,now+.19);
  gain.gain.setValueAtTime(.18,now);gain.gain.exponentialRampToValueAtTime(.001,now+.22);
  osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+.23);
 }catch(_){}
}
function damagePlayer(amount){
 const now=performance.now();if(now<damageGraceUntil||now-lastPlayerHitAt<1400)return;
 lastPlayerHitAt=now;lastDamageAt=now;playerHealth=Math.max(0,playerHealth-Math.min(amount,4));
 $("game-health").textContent=String(Math.ceil(playerHealth)).padStart(3,"0");
 const meter=$("health-fill");if(meter){meter.style.width=playerHealth+"%";meter.style.background=playerHealth<30?"#d16b62":playerHealth<60?"#c8a66a":"#8fae91";}
 playHitSound();if(navigator.vibrate)navigator.vibrate([65,35,45]);
 const flash=$("damage-flash");if(flash){flash.classList.remove("hit");void flash.offsetWidth;flash.classList.add("hit");}
 if(playerHealth===0){
  playerHealth=100;camera.position.set(0,1.7,selectedMode==="small_arena"?20:12);camera.rotation.set(0,0,0);yaw=0;pitch=0;moveVelocity.set(0,0,0);lastDamageAt=now;lastPlayerHitAt=now;damageGraceUntil=now+2500;
  $("game-health").textContent="100";if(meter){meter.style.width="100%";meter.style.background="#8fae91";}$("game-help").textContent="OVERRUN · RESPAWN COMPLETE";updateHud();
 }
}
function updateHealthRegen(dt){
 if(playerHealth<100&&performance.now()-lastDamageAt>2500){playerHealth=Math.min(100,playerHealth+dt*8);$("game-health").textContent=String(Math.ceil(playerHealth)).padStart(3,"0");const meter=$("health-fill");if(meter){meter.style.width=playerHealth+"%";meter.style.background=playerHealth<30?"#d16b62":playerHealth<60?"#c8a66a":"#8fae91";}}
}
function playShotSound(){
 try{
  if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();
  if(audioContext.state==="suspended")audioContext.resume();
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type="sawtooth";osc.frequency.setValueAtTime(125,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(42,audioContext.currentTime+.11);
  gain.gain.setValueAtTime(.075,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.12);
  osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.13);
 }catch(_){/* Audio is optional; gameplay must continue if unavailable. */}
}

function addEnvironmentModel(sceneRef,file,x,z,targetHeight,rotation=0){
 assetLoader.load(assetRoot+file,gltf=>{
  if(scene!==sceneRef)return;
  const model=gltf.scene;
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  if(!size.y)return;
  const scale=targetHeight/size.y;
  model.scale.setScalar(scale);
  model.rotation.y=rotation;
  model.position.set(x,-bounds.min.y*scale,z);
  model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
  sceneRef.add(model);
 },undefined,()=>{/* Procedural geometry remains as a safe fallback. */});
}
function loadEnvironmentAssets(sceneRef,arena){
 if(arena){
  addEnvironmentModel(sceneRef,"construction-barrier.glb",-16,5,1.15,Math.PI/2);
  addEnvironmentModel(sceneRef,"construction-barrier.glb",16,-5,1.15,Math.PI/2);
  addEnvironmentModel(sceneRef,"construction-cone.glb",-20,-18,.9);
  addEnvironmentModel(sceneRef,"construction-cone.glb",20,18,.9);
 }else{
  addEnvironmentModel(sceneRef,"building-type-a.glb",-34,-29,7,Math.PI/2);
  addEnvironmentModel(sceneRef,"building-type-b.glb",34,-28,7,Math.PI);
  addEnvironmentModel(sceneRef,"building-type-c.glb",34,31,7,-Math.PI/2);
 }
}
function addForest(sceneRef,count=105,radius=260){
 let seed=817;
 const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const locations=[];
 while(locations.length<count){
  const x=(rand()*2-1)*radius,z=(rand()*2-1)*radius;
  if(Math.hypot(x,z)<30)continue;
  locations.push({x,z,scale:.72+rand()*.72,rotation:rand()*Math.PI*2});
 }
 assetLoader.load(assetRoot+"tree-large.glb",gltf=>{
  if(scene!==sceneRef)return;
  const source=gltf.scene,bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3());
  const baseScale=size.y?6.5/size.y:1;
  locations.forEach(p=>{
   const tree=source.clone(true),scale=baseScale*p.scale;
   tree.scale.setScalar(scale);tree.position.set(p.x,-bounds.min.y*scale,p.z);tree.rotation.y=p.rotation;
   tree.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
   sceneRef.add(tree);
  });
 },undefined,()=>{
  const trunkGeo=new THREE.CylinderGeometry(.22,.34,2.8,7),leafGeo=new THREE.ConeGeometry(2.1,5.8,7);
  const trunks=new THREE.InstancedMesh(trunkGeo,mat(0x554332),count),crowns=new THREE.InstancedMesh(leafGeo,mat(0x304b36),count);
  const dummy=new THREE.Object3D();
  locations.forEach((p,i)=>{
   dummy.position.set(p.x,1.4*p.scale,p.z);dummy.scale.setScalar(p.scale);dummy.rotation.y=p.rotation;dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
   dummy.position.set(p.x,4.15*p.scale,p.z);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);
  });
  trunks.castShadow=true;crowns.castShadow=true;trunks.receiveShadow=true;crowns.receiveShadow=true;sceneRef.add(trunks,crowns);
 });
}

function disposeWorld(){
 if(controls)controls.disconnect();
 if(scene){scene.traverse(node=>{if(node.geometry)node.geometry.dispose();if(node.material){const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});scene.clear();}
 targets=[];enemies=[];obstacles=[];
}
function buildWorld(mode){
 if(scene)disposeWorld();
 const arena=mode==="small_arena";obstacles=[];targets=[];enemies=[];scene=new THREE.Scene();scene.background=new THREE.Color(arena?0x9aa5a3:0x9ab5bf);scene.fog=new THREE.Fog(arena?0x9aa5a3:0xc0bba7,arena?35:90,arena?65:390);
 camera=new THREE.PerspectiveCamera(76,canvas.clientWidth/canvas.clientHeight,.1,850);camera.position.set(0,1.7,12);camera.rotation.order="YXZ";scene.add(camera);
 weaponModel=new THREE.Group();
 const gunMetal=mat(0x242b30,.55),gunEdge=mat(0x59636a,.5),gunGrip=mat(0x303a35,.9);
 const receiver=new THREE.Mesh(new THREE.BoxGeometry(.16,.17,.52),gunMetal);receiver.position.set(.34,-.27,-.55);weaponModel.add(receiver);
 const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.56,10),gunEdge);barrel.rotation.x=Math.PI/2;barrel.position.set(.34,-.23,-.99);weaponModel.add(barrel);
 const stock=new THREE.Mesh(new THREE.BoxGeometry(.13,.13,.3),gunGrip);stock.position.set(.34,-.28,-.22);weaponModel.add(stock);
 const grip=new THREE.Mesh(new THREE.BoxGeometry(.11,.22,.14),gunGrip);grip.position.set(.34,-.44,-.49);grip.rotation.x=-.18;weaponModel.add(grip);
 const sight=new THREE.Mesh(new THREE.BoxGeometry(.08,.07,.12),gunEdge);sight.position.set(.34,-.16,-.62);weaponModel.add(sight);
 muzzleFlash=new THREE.Mesh(new THREE.SphereGeometry(.085,8,8),new THREE.MeshBasicMaterial({color:0xffc56c}));muzzleFlash.position.set(.34,-.23,-1.28);muzzleFlash.visible=false;weaponModel.add(muzzleFlash);
 camera.add(weaponModel);
 if(!renderer){renderer=new THREE.WebGLRenderer({canvas,antialias:!matchMedia("(pointer: coarse)").matches,powerPreference:"high-performance",stencil:false,depth:true});renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia("(pointer: coarse)").matches?1.25:1.6));renderer.shadowMap.enabled=!matchMedia("(pointer: coarse)").matches;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;}renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
 const hemi=new THREE.HemisphereLight(0xe5f0f2,0x594b35,arena?2.1:2.5);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffd59b,arena?2.2:3.35);sun.position.set(-110,145,90);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-150;sun.shadow.camera.right=150;sun.shadow.camera.top=150;sun.shadow.camera.bottom=-150;sun.shadow.bias=-.00018;scene.add(sun);
 if(!arena){const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(13,24,18),new THREE.MeshBasicMaterial({color:0xffd99c}));sunDisc.position.set(-180,150,-240);scene.add(sunDisc);}
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(arena?64:1200,arena?64:1200),mat(arena?0x59645b:0x756e58));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const grid=new THREE.GridHelper(arena?64:1200,arena?32:200,0x839083,0x667568);grid.position.y=.012;grid.material.transparent=true;grid.material.opacity=.12;scene.add(grid);
 const concrete=mat(0x777e7c),dark=mat(0x343d40),sand=mat(0x9b8b6d),metal=mat(0x4a5559),green=mat(0x46564a);
 if(arena){
  // Compact close-quarters map with short lanes and hard cover.
  box(-25,2.5,0,1,5,52,metal);box(25,2.5,0,1,5,52,metal);
  box(0,2.5,-25,52,5,1,metal);box(0,2.5,25,52,5,1,metal);
  box(-12,1.7,-8,2,3.4,13,concrete);box(12,1.7,8,2,3.4,13,concrete);
  box(0,1.1,0,10,2.2,2,sand);box(-9,.7,12,5,1.4,2,green);box(9,.7,-12,5,1.4,2,green);
  for(let i=0;i<8;i++){const x=(i%4)*8-12,z=i<4?-17:17;const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,1.1,12),mat(0x59645e));barrel.position.set(x,.55,z);barrel.castShadow=true;scene.add(barrel);obstacles.push({x,z,w:.9,d:.9});}
  for(let i=0;i<5;i++)makeTarget(-16+i*8,-20);
  for(let i=0;i<3;i++)makeTarget(-12+i*12,18);
  for(let i=0;i<8;i++)makeEnemy(-18+(i%4)*12,-9+Math.floor(i/4)*17,i);
  camera.position.set(0,1.7,20);
 }else{
  // Larger open-world training compound and firing lanes.
  /* Open terrain: no perimeter walls or invisible map edge. */
  const structures=[[-20,-22,13,7,13],[-3,-29,10,9,8],[22,-18,14,6,12],[-25,12,12,5,10],[23,19,13,8,11],[0,34,16,5,8]];
  structures.forEach(([x,z,w,h,d],i)=>{box(x,h/2,z,w,h,d,i%2?concrete:sand);box(x,h+.12,z,w+.3,.25,d+.3,dark,false);});
  for(let i=0;i<14;i++){const x=(i%7)*6-18,z=Math.floor(i/7)*-8+2;box(x,.65,z,2.3,1.3,1.5,i%2?metal:green);}
  for(let i=0;i<10;i++){const x=(i%5)*8-16,z=22+Math.floor(i/5)*6;box(x,.55,z,2,1.1,1.2,sand);}
  for(let i=0;i<12;i++){const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,1.1,12),mat(0x59645e));barrel.position.set((i%4)*5-7,.55,-10-Math.floor(i/4)*5);barrel.castShadow=true;scene.add(barrel);obstacles.push({x:barrel.position.x,z:barrel.position.z,w:.9,d:.9});}
  for(let i=0;i<7;i++)makeTarget(-18+i*6,-39-(i%2)*3);
  for(let i=0;i<4;i++)makeTarget(-32+i*7,4);
  for(let i=0;i<24;i++){const a=i*2.399,r=34+(i%5)*15;makeEnemy(Math.cos(a)*r,Math.sin(a)*r,i);}
  camera.position.set(0,1.7,12);addForest(scene,190,260);
 }

 loadEnvironmentAssets(scene,arena);
 if(!arena)loadZombieAsset();
 controls=new PointerLockControls(camera,renderer.domElement);
 controls.addEventListener("lock",()=>{$("game-help").style.display="none";});
 controls.addEventListener("unlock",()=>{if(running)$("game-help").style.display="block";});
 if(!clickBound){renderer.domElement.addEventListener("click",()=>{if(!matchMedia("(pointer: coarse)").matches&&!controls.isLocked)controls.lock();});clickBound=true;}
 if(!resizeBound){window.addEventListener("resize",resize,{passive:true});window.addEventListener("orientationchange",()=>setTimeout(resize,180),{passive:true});window.visualViewport?.addEventListener("resize",resize,{passive:true});resizeBound=true;}
}
function resize(){if(!renderer||!camera)return;const w=canvas.clientWidth,h=canvas.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia("(pointer: coarse)").matches?1.25:1.6));}
function blocked(x,z){return obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.42&&Math.abs(z-o.z)<o.d/2+.42);}
function lineBlocked(x1,z1,x2,z2){const steps=Math.max(4,Math.ceil(Math.hypot(x2-x1,z2-z1)/1.2));for(let i=1;i<steps;i++){const t=i/steps;if(blocked(x1+(x2-x1)*t,z1+(z2-z1)*t))return true;}return false;}
function startSlide(direction){
 const now=performance.now();if(!running||now-lastSlide<560)return;
 lastSlide=now;slideDirection=Math.sign(direction)||1;slideUntil=now+480;damageGraceUntil=Math.max(damageGraceUntil,now+520);
 if(navigator.vibrate)navigator.vibrate(32);
}
function move(dt){
 let forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-stick.y;
 let side=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+stick.x;
 if(Math.abs(forward)<.12)forward=0;if(Math.abs(side)<.12)side=0;
 const input=new THREE.Vector3(side,0,-forward);if(input.lengthSq()>1)input.normalize();input.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
 const now=performance.now(),sliding=now<slideUntil;
 const desired=new THREE.Vector3();
 if(sliding){slideVector.set(slideDirection,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);desired.copy(slideVector).multiplyScalar(10.6);const forwardMove=input.clone();forwardMove.y=0;desired.add(forwardMove.multiplyScalar(6.2));}
 else{const sprint=keys.ShiftLeft||keys.ShiftRight||stick.y<-.72;desired.copy(input).multiplyScalar(sprint?11.4:7.1);}
 moveVelocity.lerp(desired,Math.min(1,dt*(sliding?18:11)));
 const nx=camera.position.x+moveVelocity.x*dt,nz=camera.position.z+moveVelocity.z*dt;
 if(!blocked(nx,nz)){camera.position.x=nx;camera.position.z=nz;}
 else{if(!blocked(nx,camera.position.z))camera.position.x=nx;if(!blocked(camera.position.x,nz))camera.position.z=nz;moveVelocity.multiplyScalar(.45);}
 camera.position.y=THREE.MathUtils.lerp(camera.position.y,sliding?.96:1.7,Math.min(1,dt*14));
 if(selectedMode==="small_arena"){camera.position.x=THREE.MathUtils.clamp(camera.position.x,-22,22);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-22,22);}
}
function shoot(){
 if(!running||reloading||ammo<=0||performance.now()-lastShot<145)return;
 lastShot=performance.now();ammo--;weaponRecoil=.12;playShotSound();updateHud();if(muzzleFlash){muzzleFlash.visible=true;setTimeout(()=>{if(muzzleFlash)muzzleFlash.visible=false;},45);}
 raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
 const meshes=[];targets.forEach(t=>{if(t.userData.alive)t.userData.parts.forEach(p=>meshes.push(p));});enemies.forEach(e=>{if(e.userData.alive)e.userData.parts.forEach(p=>meshes.push(p));});
 const hit=raycaster.intersectObjects(meshes,false)[0];
 if(hit){
  const enemy=enemies.find(e=>e.userData.parts.includes(hit.object));
  if(enemy){enemy.userData.hp-=50;if(enemy.userData.hp<=0){enemy.userData.alive=false;enemy.userData.respawnAt=performance.now()+4200;enemy.visible=false;score++;reserve=Math.min(240,reserve+8);updateHud();$("game-score").textContent=String(score).padStart(2,"0");}}
  else{const target=targets.find(t=>t.userData.parts.includes(hit.object));if(target){target.userData.alive=false;target.userData.respawn=performance.now()+2400;target.visible=false;score++;$("game-score").textContent=String(score).padStart(2,"0");}}
 }
}
function reload(){if(reloading||ammo===30||reserve<=0)return;reloading=true;$("game-ammo").textContent="RELOADING";setTimeout(()=>{const n=Math.min(30-ammo,reserve);ammo+=n;reserve-=n;reloading=false;updateHud();},1150);}
function updateHud(){$("game-ammo").textContent=ammo+" / "+reserve;}
function updateTargets(){const now=performance.now();targets.forEach(t=>{if(!t.userData.alive&&now>=t.userData.respawn){t.userData.alive=true;t.visible=true;}});}
function animate(){
 if(!running)return;animationId=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);
 if(controls?.isLocked){yaw=camera.rotation.y;}move(dt);updateTargets();updateEnemies(dt);updateHealthRegen(dt);
 if(weaponModel){weaponRecoil=Math.max(0,weaponRecoil-dt*.95);const moving=stick.x!==0||stick.y!==0||keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD;const sway=moving?Math.sin(clock.elapsedTime*9)*.008:0;weaponModel.position.set(sway,moving?Math.abs(Math.cos(clock.elapsedTime*9))*.006:0,weaponRecoil);}
 

 renderer.render(scene,camera);
}
function bindControls(){
 window.addEventListener("keydown",e=>{keys[e.code]=true;if(e.code==="KeyR")reload();if(e.code==="KeyQ")startSlide(-1);if(e.code==="KeyE")startSlide(1);});window.addEventListener("keyup",e=>keys[e.code]=false);
 window.addEventListener("mousedown",e=>{if(e.button===0&&controls?.isLocked)shoot();});
 $("fire-touch").addEventListener("touchstart",e=>{e.preventDefault();shoot();},{passive:false});
 $("reload-touch").addEventListener("touchstart",e=>{e.preventDefault();reload();},{passive:false});
 const zone=$("stick-zone"),knob=$("stick-knob");let stickPointer=null;
 const updateStick=e=>{
  if(stickPointer!==e.pointerId)return;
  const r=zone.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=e.clientX-cx,dy=e.clientY-cy;const max=Math.min(r.width,r.height)*.34,len=Math.hypot(dx,dy);
  if(len>max){dx=dx/len*max;dy=dy/len*max;}
  stick.x=dx/max;stick.y=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`;
 };
 const resetStick=e=>{
  if(stickPointer!==e.pointerId)return;
  stickPointer=null;stick={x:0,y:0};knob.style.transform="translate(0,0)";
 };
 zone.addEventListener("pointerdown",e=>{
  if(stickPointer!==null)return;
  e.preventDefault();stickPointer=e.pointerId;zone.setPointerCapture(e.pointerId);updateStick(e);
 });
 zone.addEventListener("pointermove",updateStick);
 zone.addEventListener("pointerup",resetStick);
 zone.addEventListener("pointercancel",resetStick);
 zone.addEventListener("lostpointercapture",resetStick);
 const swipeZone=$("swipe-zone");if(swipeZone){
  let swipeStart=null;
  swipeZone.addEventListener("pointerdown",e=>{
   e.preventDefault();swipeStart={x:e.clientX,y:e.clientY,id:e.pointerId};
   swipeZone.setPointerCapture(e.pointerId);
  });
  swipeZone.addEventListener("pointerup",e=>{
   if(!swipeStart||swipeStart.id!==e.pointerId)return;
   const dx=e.clientX-swipeStart.x,dy=e.clientY-swipeStart.y;
   if(Math.abs(dx)>22&&Math.abs(dx)>Math.abs(dy)*1.05)startSlide(dx>0?1:-1);
   swipeStart=null;
  });
  swipeZone.addEventListener("pointercancel",()=>swipeStart=null);
 }
 let lookPointer=null;
 canvas.addEventListener("pointerdown",e=>{if(e.pointerType!=="touch")return;lookPointer=e.pointerId;touchLook={x:e.clientX,y:e.clientY};});
 canvas.addEventListener("pointermove",e=>{if(e.pointerId!==lookPointer||!touchLook)return;const dx=e.clientX-touchLook.x,dy=e.clientY-touchLook.y;touchLook={x:e.clientX,y:e.clientY};yaw-=dx*.004;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-1.35,1.35);camera.rotation.set(pitch,yaw,0,"YXZ");});
 const stopLook=e=>{if(e.pointerId===lookPointer){lookPointer=null;touchLook=null;}};
 canvas.addEventListener("pointerup",stopLook);canvas.addEventListener("pointercancel",stopLook);
}
window.startLoopOutGame=function(mode="open_world"){
 try{if(screen.orientation?.lock)screen.orientation.lock("landscape").catch(()=>{});}catch(_){}
 selectedMode=mode;if(running)stopGame();running=true;ammo=30;reserve=120;score=0;playerHealth=100;reloading=false;yaw=0;pitch=0;stick={x:0,y:0};keys={};slideUntil=0;lastSlide=0;damageGraceUntil=0;lastDamageAt=performance.now();lastPlayerHitAt=0;moveVelocity.set(0,0,0);$("game-help").textContent=matchMedia("(pointer: coarse)").matches?"LEFT STICK MOVE / RUN · SWIPE LEFT OR RIGHT TO DODGE · DRAG TO AIM":"WASD MOVE · SHIFT RUN · Q / E DODGE · MOUSE AIM · CLICK FIRE · R RELOAD";
 $("game-score").textContent="00";$("game-health").textContent="100";const healthMeter=$("health-fill");if(healthMeter){healthMeter.style.width="100%";healthMeter.style.background="#8fae91";}updateHud();
 if(!renderer||worldMode!==mode){buildWorld(mode);worldMode=mode;}else{camera.position.set(0,1.7,mode==="small_arena"?20:12);camera.rotation.set(0,0,0);targets.forEach(t=>{t.visible=true;t.userData.alive=true;});enemies.forEach(e=>{e.visible=true;e.userData.alive=true;e.userData.hp=100;e.position.copy(e.userData.spawn);});}
 resize();clock.start();animate();
};
function stopGame(){
 running=false;if(animationId)cancelAnimationFrame(animationId);if(controls?.isLocked)controls.unlock();
}
window.stopLoopOutGame=stopGame;
bindControls();
if(window.__loopOutStartRequested)window.startLoopOutGame("open_world");