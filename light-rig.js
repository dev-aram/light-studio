import {shadowMap,visibility} from './render.js';

export const targets={whole:['전신',1.42],face:['얼굴',2.67],chest:['가슴',2.1],belly:['복부',1.67]};
export function newRig(){
 return {key:{angle:-35,height:40,power:100},fill:{angle:50,height:15,power:30},fillOn:false,target:'whole',bg:'#888888',brightness:100};
}
export function backdrop(rig){
 const values=rig.bg.slice(1).match(/../g).map(c=>Math.min(255,Math.round(parseInt(c,16)*rig.brightness/100)));
 return '#'+values.map(c=>c.toString(16).padStart(2,'0')).join('');
}
const caches=new WeakMap();
function response(mesh,light,target,channel){
 let cache=caches.get(mesh);
 if(!cache){
  const pos=Float32Array.from(mesh.pos,(v,i)=>i%3===2?v-1.42:v);
  cache={geometry:{pos,idx:mesh.indices,shadowScale:.30}};caches.set(mesh,cache);
 }
 const stamp=[light.angle,light.height,target].join('/');
 if(cache[channel]?.stamp===stamp)return cache[channel].values;
 const a=light.angle*Math.PI/180,e=light.height*Math.PI/180;
 const L=[Math.sin(a)*Math.cos(e),-Math.cos(a)*Math.cos(e),Math.sin(e)];
 const map=shadowMap(cache.geometry,L),values=new Float32Array(mesh.spec.length);
 const pos=cache.geometry.pos,n=mesh.norm;
 for(let i=0;i<values.length;i++){
  const k=i*3,cos=Math.max(0,n[k]*L[0]+n[k+1]*L[1]+n[k+2]*L[2]);
  if(!cos)continue;
  const x=pos[k],y=pos[k+1],z=pos[k+2];
  let beam=1;
  if(target!=='whole'){
   const dz=z+1.42-targets[target][1],dy=y+.09;
   const axial=x*L[0]+dy*L[1]+dz*L[2];
   const radial=Math.max(0,x*x+dy*dy+dz*dz-axial*axial);
   beam=Math.exp(-radial/(target==='face'?.16:.32));
  }
  values[i]=cos*visibility(map,x,y,z,cos)*beam;
 }
 cache[channel]={stamp,values};return values;
}
export function relight(mesh,rig){
 const key=response(mesh,rig.key,rig.target,'key');
 const fill=rig.fillOn?response(mesh,rig.fill,'whole','fill'):null;
 const color=new Uint8Array(mesh.color.length);
 for(let i=0;i<key.length;i++){
  const energy=.075+1.38*(key[i]*rig.key.power+(fill?fill[i]*rig.fill.power:0))/100;
  const value=Math.min(255,Math.round(157*Math.pow(energy,1/2.2)));
  color.fill(value,i*3,i*3+3);
 }
 return color;
}

// Upper-hemisphere visibility and ground transfer are integrated over the actual mesh.
const decoded=Array.from({length:256},(_,v)=>Math.pow(v/255,2.2));
const encoded=Uint8Array.from({length:4097},(_,i)=>Math.round(255*Math.pow(i/4096,1/2.2)));
const clayReflectance=decoded[157];
const floorExposure={scene:.88,cloud:.87,sun:1.12,sunset:.43,night:.29,spot:.52,side:.47,below:.18};

export function indirectColor(mesh,base,rig,preset){
 const channels=rig.bg.slice(1).match(/../g).map(v=>decoded[parseInt(v,16)]*Math.pow(rig.brightness/100,2.2));
 if(channels.every(v=>v===0))return base;
 const groundLight=light=>Math.max(0,Math.sin(light.height*Math.PI/180))*light.power/100;
 const floor=preset?floorExposure[preset]:.18+.92*(groundLight(rig.key)+(rig.fillOn?groundLight(rig.fill):0));
 const color=new Uint8Array(base.length);
 for(let i=0;i<mesh.spec.length;i++){
  const sky=mesh.environment[2*i]/255,ground=mesh.environment[2*i+1]/255;
  const transmission=clayReflectance*(.72*sky+1.05*ground*floor);
  for(let d=0;d<3;d++){
   const k=i*3+d;
   const energy=decoded[base[k]]+channels[d]*transmission;
   color[k]=encoded[Math.min(4096,Math.round(4096*energy))];
  }
 }
 return color;
}
