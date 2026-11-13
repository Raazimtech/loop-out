import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/PointerLockControls.js";

let renderer, scene, camera, controls, animationId, running=false, selectedMode="open_world", worldMode=null, resizeBound=false;
let targets=[], obstacles=[], keys={}, ammo=30, reserve=120, score=0, reloading=false, lastShot=0;
let yaw=0,pitch=0,stick={x:0,y:0},touchLook=null;
const raycaster=new THREE.Raycaster();
const clock=new THREE.Clock();
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
function buildWorld(mode){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x9aa5a3);scene.fog=new THREE.Fog(0x9aa5a3,35,125);
 camera=new THREE.PerspectiveCamera(76,canvas.clientWidth/canvas.clientHeight,.1,250);camera.position.set(0,1.7,12);camera.rotation.order="YXZ";
 if(!renderer){renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;}renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
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
  camera.position.set(0,1.7,12);
 }

 controls=new PointerLockControls(camera,renderer.domElement);
 controls.addEventListener("lock",()=>{$("game-help").style.display="none";});
 controls.addEventListener("unlock",()=>{if(running)$("game-help").style.display="block";});
 renderer.domElement.addEventListener("click",()=>{if(!matchMedia("(pointer: coarse)").matches&&!controls.isLocked)controls.lock();});
 if(!resizeBound){window.addEventListener("resize",resize);resizeBound=true;}
}
function resize(){if(!renderer||!camera)return;const w=canvas.clientWidth,h=canvas.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
function blocked(x,z){return obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.42&&Math.abs(z-o.z)<o.d/2+.42);}
function move(dt){
 const forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-stick.y;
 const side=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+stick.x;
 const v=new THREE.Vector3(side,0,-forward);if(v.lengthSq()>1)v.normalize();v.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
 const speed=keys.ShiftLeft?8.2:5.4;const nx=camera.position.x+v.x*speed*dt,nz=camera.position.z+v.z*speed*dt;
 if(!blocked(nx,camera.position.z))camera.position.x=THREE.MathUtils.clamp(nx,-43,43);
 if(!blocked(camera.position.x,nz))camera.position.z=THREE.MathUtils.clamp(nz,-50,50);
}
function shoot(){
 if(!running||reloading||ammo<=0||performance.now()-lastShot<145)return;
 lastShot=performance.now();ammo--;updateHud();
 raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
 const meshes=[];targets.forEach(t=>{if(t.userData.alive)t.userData.parts.forEach(p=>meshes.push(p));});
 const hit=raycaster.intersectObjects(meshes,false)[0];
 if(hit){const target=targets.find(t=>t.userData.parts.includes(hit.object));if(target){target.userData.alive=false;target.userData.respawn=performance.now()+2400;target.visible=false;score++;$("game-score").textContent=String(score).padStart(2,"0");}}
}
function reload(){if(reloading||ammo===30||reserve<=0)return;reloading=true;$("game-ammo").textContent="RELOADING";setTimeout(()=>{const n=Math.min(30-ammo,reserve);ammo+=n;reserve-=n;reloading=false;updateHud();},1150);}
function updateHud(){$("game-ammo").textContent=ammo+" / "+reserve;}
function updateTargets(){const now=performance.now();targets.forEach(t=>{if(!t.userData.alive&&now>=t.userData.respawn){t.userData.alive=true;t.visible=true;}});}
function animate(){if(!running)return;animationId=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(controls?.isLocked){yaw=camera.rotation.y;}move(dt);updateTargets();renderer.render(scene,camera);}
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
window.startBlackoutGame=function(mode="open_world"){
 selectedMode=mode;if(running)stopGame();running=true;ammo=30;reserve=120;score=0;reloading=false;yaw=0;pitch=0;stick={x:0,y:0};keys={};
 $("game-score").textContent="00";$("game-health").textContent="100";updateHud();
 if(!renderer||worldMode!==mode){buildWorld(mode);worldMode=mode;}else{camera.position.set(0,1.7,mode==="small_arena"?20:12);camera.rotation.set(0,0,0);targets.forEach(t=>{t.visible=true;t.userData.alive=true;});}
 resize();clock.start();animate();
};
function stopGame(){running=false;if(animationId)cancelAnimationFrame(animationId);if(controls?.isLocked)controls.unlock();}
window.stopBlackoutGame=stopGame;
bindControls();