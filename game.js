import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

let renderer, scene, camera, controls, animationId, running=false, selectedMode="open_world", worldMode=null, resizeBound=false, clickBound=false;
let targets=[],enemies=[],obstacles=[],keys={},ammo=30,reserve=120,score=0,playerHealth=100,reloading=false,lastShot=0,weaponModel=null,muzzleFlash=null;
let yaw=0,pitch=0,stick={x:0,y:0},touchLook=null;
let weaponRecoil=0,audioContext=null;
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
 const group=new THREE.Group();group.position.set(x,0,z);
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.72,4,8),mat(index%2?0x586a61:0x6d5949));body.position.y=1.05;body.castShadow=true;group.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.22,12,10),mat(0xb5a28b));head.position.y=1.78;head.castShadow=true;group.add(head);
 const vest=new THREE.Mesh(new THREE.BoxGeometry(.48,.38,.24),mat(0x303b40));vest.position.set(0,1.15,-.02);group.add(vest);
 const pack=new THREE.Mesh(new THREE.BoxGeometry(.34,.42,.18),mat(0x26312e));pack.position.set(0,1.18,.18);group.add(pack);
 group.userData={isBot:true,alive:true,hp:100,parts:[body,head,vest,pack],spawn:new THREE.Vector3(x,0,z),nextShot:performance.now()+1200+index*180,respawnAt:0,phase:index*1.7};
 scene.add(group);enemies.push(group);return group;
}
function updateEnemies(dt){
 const now=performance.now();
 enemies.forEach(bot=>{
  const data=bot.userData;
  if(!data.alive){if(now>=data.respawnAt){data.alive=true;data.hp=100;bot.position.copy(data.spawn);bot.visible=true;}return;}
  const dx=camera.position.x-bot.position.x,dz=camera.position.z-bot.position.z,dist=Math.hypot(dx,dz);
  if(dist>4.2&&dist<42){
   const approach=dist>10?1:.12,strafe=Math.sin(now*.0014+data.phase)*.28;
   const vx=(dx/dist*approach+(-dz/dist)*strafe)*dt*2.05;
   const vz=(dz/dist*approach+(dx/dist)*strafe)*dt*2.05;
   const nx=bot.position.x+vx,nz=bot.position.z+vz;
   if(!blocked(nx,bot.position.z))bot.position.x=nx;
   if(!blocked(bot.position.x,nz))bot.position.z=nz;
  }
  if(dist<27&&now>data.nextShot){
   data.nextShot=now+1450+Math.random()*850;
   if(Math.random()<Math.max(.18,.72-dist/48)){
    playerHealth=Math.max(0,playerHealth-(6+Math.floor(Math.random()*8)));
    $("game-health").textContent=String(playerHealth).padStart(3,"0");
    if(playerHealth===0){playerHealth=100;camera.position.set(0,1.7,selectedMode==="small_arena"?20:12);$("game-health").textContent="100";$("game-help").textContent="OPERATOR DOWN · RESPAWN COMPLETE";}
   }
  }
  if(dist>0.01)bot.rotation.y=Math.atan2(dx,dz);
 });
}

function makeEnemy(x,z,index){
 const drone=index%3===2,group=new THREE.Group();group.position.set(x,0,z);const parts=[];
 if(drone){
  const shell=new THREE.Mesh(new THREE.SphereGeometry(.48,16,12),mat(0x39464e,.45));shell.position.y=2.25;group.add(shell);parts.push(shell);
  const core=new THREE.Mesh(new THREE.SphereGeometry(.2,12,10),new THREE.MeshStandardMaterial({color:0xe24c40,emissive:0x861b13,emissiveIntensity:1.2}));core.position.y=2.25;group.add(core);parts.push(core);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.57,.055,8,24),mat(0x9aa6aa,.35));ring.position.y=2.25;ring.rotation.x=Math.PI/2;group.add(ring);parts.push(ring);
  for(let n=0;n<4;n++){const angle=n*Math.PI/2,arm=new THREE.Mesh(new THREE.BoxGeometry(.9,.07,.09),mat(0x59656a,.5));arm.position.set(Math.cos(angle)*.48,2.28,Math.sin(angle)*.48);arm.rotation.y=-angle;group.add(arm);parts.push(arm);const rotor=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.045,12),mat(0x171d21,.45));rotor.position.set(Math.cos(angle)*.9,2.32,Math.sin(angle)*.9);group.add(rotor);parts.push(rotor);}
  group.userData={kind:"drone",alive:true,hp:100,parts,spawn:new THREE.Vector3(x,0,z),nextAttack:performance.now()+1300+index*170,phase:index*1.6};
 }else{
  const skin=mat(0x657b56),dark=mat(0x29342b),cloth=mat(0x39463a),eye=new THREE.MeshStandardMaterial({color:0xe24c40,emissive:0x7e140c,emissiveIntensity:1.1});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.37,.7,4,8),cloth);body.position.y=1.02;group.add(body);parts.push(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.25,12,10),skin);head.position.set(0,1.72,-.04);group.add(head);parts.push(head);
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(.3,.14,.27),dark);jaw.position.set(0,1.53,-.12);group.add(jaw);parts.push(jaw);
  for(const side of [-.09,.09]){const e=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),eye);e.position.set(side,1.77,-.265);group.add(e);parts.push(e);}
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.16,.62,.17),skin);arm.position.set(-.43,1.04,-.12);arm.rotation.z=-.45;group.add(arm);parts.push(arm);const arm2=arm.clone();arm2.position.x=.43;arm2.rotation.z=.45;group.add(arm2);parts.push(arm2);
  group.userData={kind:"zombie",alive:true,hp:100,parts,spawn:new THREE.Vector3(x,0,z),nextAttack:0,phase:index*1.4};
 }
 group.userData.respawnAt=0;scene.add(group);enemies.push(group);return group;
}
function updateEnemies(dt){
 const now=performance.now();
 enemies.forEach(enemy=>{
  const d=enemy.userData;if(!d.alive){if(now>=d.respawnAt){d.alive=true;d.hp=100;enemy.position.copy(d.spawn);enemy.visible=true;}return;}
  const dx=camera.position.x-enemy.position.x,dz=camera.position.z-enemy.position.z,dist=Math.hypot(dx,dz);
  if(d.kind==="zombie"){
   if(dist>1.25&&dist<65){const speed=dist>12?2.25:1.45,nx=enemy.position.x+dx/Math.max(dist,.01)*speed*dt,nz=enemy.position.z+dz/Math.max(dist,.01)*speed*dt;if(!blocked(nx,enemy.position.z))enemy.position.x=nx;if(!blocked(enemy.position.x,nz))enemy.position.z=nz;}
   if(dist<1.65&&now>d.nextAttack){d.nextAttack=now+1050;damagePlayer(12+Math.floor(Math.random()*7));}
   enemy.rotation.y=Math.atan2(dx,dz);
  }else{
   enemy.position.y=THREE.MathUtils.lerp(enemy.position.y,2.7+Math.sin(now*.002+d.phase)*.28,Math.min(1,dt*3));
   if(dist>4&&dist<75){enemy.position.x+=dx/Math.max(dist,.01)*3.1*dt;enemy.position.z+=dz/Math.max(dist,.01)*3.1*dt;}
   enemy.rotation.y=Math.atan2(dx,dz);
   if(dist<23&&now>d.nextAttack){
    d.nextAttack=now+1850+Math.random()*700;
    const material=new THREE.LineBasicMaterial({color:0xff5147,transparent:true,opacity:.85}),geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(enemy.position.x,2.25,enemy.position.z),new THREE.Vector3(camera.position.x,1.3,camera.position.z)]),beam=new THREE.Line(geometry,material);scene.add(beam);setTimeout(()=>{scene?.remove(beam);geometry.dispose();material.dispose();},160);
    damagePlayer(8+Math.floor(Math.random()*7));
   }
  }
 });
 const el=$("game-enemy-count");if(el)el.textContent=String(enemies.filter(e=>e.userData.alive).length).padStart(2,"0");
}
function damagePlayer(amount){
 playerHealth=Math.max(0,playerHealth-amount);$("game-health").textContent=String(playerHealth).padStart(3,"0");
 if(playerHealth===0){playerHealth=100;camera.position.set(0,1.7,selectedMode==="small_arena"?20:12);camera.rotation.set(0,0,0);yaw=0;pitch=0;$("game-health").textContent="100";$("game-help").textContent="YOU WERE OVERRUN · BACK IN THE FIGHT";updateHud();}
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
  addEnvironmentModel(sceneRef,"tree-large.glb",-39,34,6);
  addEnvironmentModel(sceneRef,"tree-large.glb",39,-39,6);
  addEnvironmentModel(sceneRef,"tree-large.glb",-39,-39,6);
  addEnvironmentModel(sceneRef,"construction-barrier.glb",-12,10,1.2,Math.PI/2);
  addEnvironmentModel(sceneRef,"construction-barrier.glb",12,10,1.2,Math.PI/2);
  addEnvironmentModel(sceneRef,"construction-cone.glb",-16,10,.9);
  addEnvironmentModel(sceneRef,"construction-cone.glb",16,10,.9);
 }
}

function disposeWorld(){
 if(controls)controls.disconnect();
 if(scene){scene.traverse(node=>{if(node.geometry)node.geometry.dispose();if(node.material){const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});scene.clear();}
 targets=[];enemies=[];obstacles=[];
}
function buildWorld(mode){
 if(scene)disposeWorld();
 const arena=mode==="small_arena";obstacles=[];targets=[];enemies=[];scene=new THREE.Scene();scene.background=new THREE.Color(0x9aa5a3);scene.fog=new THREE.Fog(0x9aa5a3,35,arena?65:125);
 camera=new THREE.PerspectiveCamera(76,canvas.clientWidth/canvas.clientHeight,.1,250);camera.position.set(0,1.7,12);camera.rotation.order="YXZ";scene.add(camera);
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
 const hemi=new THREE.HemisphereLight(0xdce6e5,0x303a32,2.1);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffe5c2,2.2);sun.position.set(-25,45,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-70;sun.shadow.camera.right=70;sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(arena?64:180,arena?64:180),mat(0x59645b));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const grid=new THREE.GridHelper(arena?64:180,arena?32:90,0x839083,0x667568);grid.position.y=.012;grid.material.transparent=true;grid.material.opacity=.12;scene.add(grid);
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
  for(let i=-3;i<=3;i++){const x=i*13;box(x,3,-47,11,6,2,concrete);box(x,3,47,11,6,2,concrete);}
  for(let i=-3;i<=3;i++){const z=i*13;box(-47,3,z,2,6,11,concrete);box(47,3,z,2,6,11,concrete);}
  const structures=[[-20,-22,13,7,13],[-3,-29,10,9,8],[22,-18,14,6,12],[-25,12,12,5,10],[23,19,13,8,11],[0,34,16,5,8]];
  structures.forEach(([x,z,w,h,d],i)=>{box(x,h/2,z,w,h,d,i%2?concrete:sand);box(x,h+.12,z,w+.3,.25,d+.3,dark,false);});
  for(let i=0;i<14;i++){const x=(i%7)*6-18,z=Math.floor(i/7)*-8+2;box(x,.65,z,2.3,1.3,1.5,i%2?metal:green);}
  for(let i=0;i<10;i++){const x=(i%5)*8-16,z=22+Math.floor(i/5)*6;box(x,.55,z,2,1.1,1.2,sand);}
  for(let i=0;i<12;i++){const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,1.1,12),mat(0x59645e));barrel.position.set((i%4)*5-7,.55,-10-Math.floor(i/4)*5);barrel.castShadow=true;scene.add(barrel);obstacles.push({x:barrel.position.x,z:barrel.position.z,w:.9,d:.9});}
  for(let i=0;i<16;i++){const x=-42+i*5.6;box(x,2.5,-54,3,5,1,metal);box(x,2.5,54,3,5,1,metal);}
  for(let i=0;i<7;i++)makeTarget(-18+i*6,-39-(i%2)*3);
  for(let i=0;i<4;i++)makeTarget(-32+i*7,4);
  for(let i=0;i<12;i++)makeEnemy(-36+(i%6)*14,-22+Math.floor(i/6)*34,i);
  camera.position.set(0,1.7,12);
 }

 loadEnvironmentAssets(scene,arena);
 controls=new PointerLockControls(camera,renderer.domElement);
 controls.addEventListener("lock",()=>{$("game-help").style.display="none";});
 controls.addEventListener("unlock",()=>{if(running)$("game-help").style.display="block";});
 if(!clickBound){renderer.domElement.addEventListener("click",()=>{if(!matchMedia("(pointer: coarse)").matches&&!controls.isLocked)controls.lock();});clickBound=true;}
 if(!resizeBound){window.addEventListener("resize",resize,{passive:true});window.addEventListener("orientationchange",()=>setTimeout(resize,180),{passive:true});window.visualViewport?.addEventListener("resize",resize,{passive:true});resizeBound=true;}
}
function resize(){if(!renderer||!camera)return;const w=canvas.clientWidth,h=canvas.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia("(pointer: coarse)").matches?1.25:1.6));}
function blocked(x,z){return obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.42&&Math.abs(z-o.z)<o.d/2+.42);}
function move(dt){
 const forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-stick.y;
 const side=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+stick.x;
 const v=new THREE.Vector3(side,0,-forward);if(v.lengthSq()>1)v.normalize();v.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
 const speed=keys.ShiftLeft?8.2:5.4;const nx=camera.position.x+v.x*speed*dt,nz=camera.position.z+v.z*speed*dt;
 const edge=selectedMode==="small_arena"?22:43;
 if(!blocked(nx,camera.position.z))camera.position.x=THREE.MathUtils.clamp(nx,-edge,edge);
 if(!blocked(camera.position.x,nz))camera.position.z=THREE.MathUtils.clamp(nz,-edge,edge);
}
function shoot(){
 if(!running||reloading||ammo<=0||performance.now()-lastShot<145)return;
 lastShot=performance.now();ammo--;weaponRecoil=.12;playShotSound();updateHud();if(muzzleFlash){muzzleFlash.visible=true;setTimeout(()=>{if(muzzleFlash)muzzleFlash.visible=false;},45);}
 raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
 const meshes=[];targets.forEach(t=>{if(t.userData.alive)t.userData.parts.forEach(p=>meshes.push(p));});enemies.forEach(e=>{if(e.userData.alive)e.userData.parts.forEach(p=>meshes.push(p));});
 const hit=raycaster.intersectObjects(meshes,false)[0];
 if(hit){
  const bot=enemies.find(b=>b.userData.parts.includes(hit.object));
  if(bot){bot.userData.hp-=50;if(bot.userData.hp<=0){bot.userData.alive=false;bot.userData.respawnAt=performance.now()+6500;bot.visible=false;score++;$("game-score").textContent=String(score).padStart(2,"0");}}
  else{const target=targets.find(t=>t.userData.parts.includes(hit.object));if(target){target.userData.alive=false;target.userData.respawn=performance.now()+2400;target.visible=false;score++;$("game-score").textContent=String(score).padStart(2,"0");}}
 }
}
function reload(){if(reloading||ammo===30||reserve<=0)return;reloading=true;$("game-ammo").textContent="RELOADING";setTimeout(()=>{const n=Math.min(30-ammo,reserve);ammo+=n;reserve-=n;reloading=false;updateHud();},1150);}
function updateHud(){$("game-ammo").textContent=ammo+" / "+reserve;}
function updateTargets(){const now=performance.now();targets.forEach(t=>{if(!t.userData.alive&&now>=t.userData.respawn){t.userData.alive=true;t.visible=true;}});}
function animate(){
 if(!running)return;animationId=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);
 if(controls?.isLocked){yaw=camera.rotation.y;}move(dt);updateTargets();updateEnemies(dt);
 if(weaponModel){weaponRecoil=Math.max(0,weaponRecoil-dt*.95);const moving=stick.x!==0||stick.y!==0||keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD;const sway=moving?Math.sin(clock.elapsedTime*9)*.008:0;weaponModel.position.set(sway,moving?Math.abs(Math.cos(clock.elapsedTime*9))*.006:0,weaponRecoil);}
 

 renderer.render(scene,camera);
}
function bindControls(){
 window.addEventListener("keydown",e=>{keys[e.code]=true;if(e.code==="KeyR")reload();});window.addEventListener("keyup",e=>keys[e.code]=false);
 window.addEventListener("mousedown",e=>{if(e.button===0&&controls?.isLocked)shoot();});
 $("fire-touch").addEventListener("touchstart",e=>{e.preventDefault();shoot();},{passive:false});
 $("reload-touch").addEventListener("touchstart",e=>{e.preventDefault();reload();},{passive:false});
 const zone=$("stick-zone"),knob=$("stick-knob");let stickId=null;
 zone.addEventListener("touchstart",e=>{const t=e.changedTouches[0];stickId=t.identifier;},{passive:true});
 zone.addEventListener("touchmove",e=>{for(const t of e.changedTouches){if(t.identifier!==stickId)continue;const r=zone.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=t.clientX-cx,dy=t.clientY-cy;const len=Math.hypot(dx,dy),max=40;if(len>max){dx=dx/len*max;dy=dy/len*max;}stick.x=dx/max;stick.y=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`; }},{passive:true});
 const reset=()=>{stickId=null;stick={x:0,y:0};knob.style.transform="translate(0,0)";};zone.addEventListener("touchend",reset);zone.addEventListener("touchcancel",reset);
 canvas.addEventListener("touchstart",e=>{if(e.touches.length===1){touchLook={x:e.touches[0].clientX,y:e.touches[0].clientY};}},{passive:true});
 canvas.addEventListener("touchmove",e=>{if(!touchLook)return;const t=e.touches[0],dx=t.clientX-touchLook.x,dy=t.clientY-touchLook.y;touchLook={x:t.clientX,y:t.clientY};yaw-=dx*.004;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-1.35,1.35);camera.rotation.set(pitch,yaw,0,"YXZ");},{passive:true});
 canvas.addEventListener("touchend",()=>touchLook=null);
}
window.startLoopOutGame=function(mode="open_world"){
 try{if(screen.orientation?.lock)screen.orientation.lock("landscape").catch(()=>{});}catch(_){}
 selectedMode=mode;if(running)stopGame();running=true;ammo=30;reserve=120;score=0;playerHealth=100;reloading=false;yaw=0;pitch=0;stick={x:0,y:0};keys={};$("game-help").textContent=matchMedia("(pointer: coarse)").matches?"LEFT STICK MOVE · DRAG TO AIM · FIRE / RELOAD":"CLICK FIELD TO LOCK MOUSE · WASD MOVE · MOUSE AIM · CLICK FIRE · R RELOAD";
 $("game-score").textContent="00";$("game-health").textContent="100";updateHud();
 if(!renderer||worldMode!==mode){buildWorld(mode);worldMode=mode;}else{camera.position.set(0,1.7,mode==="small_arena"?20:12);camera.rotation.set(0,0,0);targets.forEach(t=>{t.visible=true;t.userData.alive=true;});enemies.forEach(e=>{e.visible=true;e.userData.alive=true;e.userData.hp=100;e.position.copy(e.userData.spawn);});}
 resize();clock.start();animate();
};
function stopGame(){
 running=false;if(animationId)cancelAnimationFrame(animationId);if(controls?.isLocked)controls.unlock();
}
window.stopLoopOutGame=stopGame;
bindControls();