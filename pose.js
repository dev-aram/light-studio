// Coordinates use X across the shoulders, Y toward the back, and Z upward.
export const joints = [
 ['body','상체',[0,0,1.47]], ['head','고개',[0,-.07,2.39]],
 ...[[-1,'오른'],[1,'왼']].flatMap(([s,side])=>[
  ['arm'+s,side+' 어깨',[s*.355,-.035,2.23],'body'],
  ['elbow'+s,side+' 팔꿈치',[s*.64,-.07,1.89],'arm'+s],
  ['hip'+s,side+' 고관절',[s*.16,0,1.42]],
  ['knee'+s,side+' 무릎',[s*.19,0,.78],'hip'+s]
 ])
];
joints[1][3]='body';
export const poses=[
 ['기본 자세',{}],
 ['양팔 벌리기',{'arm1':[45,0],'arm-1':[-45,0]}],
 ['한 팔 들어 올리기',{'arm-1':[-108,-10],'elbow-1':[0,15]}],
 ['양손 들어 올리기',{'arm1':[83,0],'arm-1':[-83,0],'elbow1':[38,25],'elbow-1':[-38,25]}],
 ['앞으로 손 뻗기',{'arm-1':[10,64],'elbow-1':[0,10],body:[0,8]}],
 ['팔꿈치 굽히기',{'elbow1':[0,82],'elbow-1':[0,58]}],
 ['옆으로 기울이기',{body:[22,0],head:[-9,0],'arm1':[58,0]}],
 ['한 발 내딛기',{'hip1':[0,26],'knee1':[0,-10],'hip-1':[0,-12],'arm-1':[0,27]}],
 ['한쪽 무릎 들기',{'hip1':[0,62],'knee1':[0,-79],'arm-1':[0,28]}],
 ['무릎 굽혀 앉기',{body:[0,-22],'hip1':[4,54],'hip-1':[-4,54],'knee1':[0,-92],'knee-1':[0,-92],'arm1':[0,35],'arm-1':[0,35]}]
];
const clamp=n=>Math.max(0,Math.min(1,n));
function smooth(a,b,x){const t=clamp((x-a)/(b-a));return t*t*(3-2*t);}
function rotate([x,y,z],a,b){
 const yy=b.c*y+b.s*z,zz=-b.s*y+b.c*z;
 return [a.c*x-a.s*zz,yy,a.s*x+a.c*zz];
}
const trig=d=>({c:Math.cos(d*Math.PI/180),s:Math.sin(d*Math.PI/180)});
const weightsCache=new WeakMap();
function weights(mesh){
 if(weightsCache.has(mesh))return weightsCache.get(mesh);
 const out=joints.map(()=>new Float32Array(mesh.spec.length));
 for(let i=0;i<mesh.spec.length;i++){
  const x=mesh.pos[i*3],ax=Math.abs(x),z=mesh.pos[i*3+2];
  const arm=smooth(.22,.44,ax)*smooth(.31,.51,ax+(2.18-z)*-.36)*smooth(1.30,1.42,z);
  const torso=smooth(1.34,1.63,z);
  out[0][i]=torso*(1-arm)+arm; out[1][i]=smooth(2.33,2.48,z)*(1-arm);
  const j=x<0?2:6;
  out[j][i]=arm; out[j+1][i]=arm*smooth(-.09,.09,(ax-.64)*.67+(1.89-z)*.73);
  out[j+2][i]=(1-smooth(1.30,1.53,z))*(1-arm)*(z<1.16?1:smooth(0,.14,ax));
  out[j+3][i]=out[j+2][i]*(1-smooth(.69,.88,z));
 }
 weightsCache.set(mesh,out);return out;
}
// Apply local rotations from the extremities toward the pelvis, blending at joint boundaries.
export function deform(mesh,angles){
 const w=weights(mesh),pos=mesh.pos.slice(),norm=mesh.norm.slice(),pivots={};
 const active=joints.map(([key,_,origin],j)=>({key,j,origin,angles:angles[key]||[0,0]})).filter(t=>t.angles.some(Boolean)).reverse();
 for(const t of active){
  const [a,b]=t.angles.map(trig),[ox,oy,oz]=t.origin;
  for(let i=0;i<mesh.spec.length;i++){
   const f=w[t.j][i];if(!f)continue;
   const k=i*3,x=pos[k]-ox,y=pos[k+1]-oy,z=pos[k+2]-oz;
   const p=rotate([x,y,z],a,b),n=rotate([norm[k],norm[k+1],norm[k+2]],a,b);
   pos[k]+=f*(p[0]-x);pos[k+1]+=f*(p[1]-y);pos[k+2]+=f*(p[2]-z);
   for(let d=0;d<3;d++)norm[k+d]+=f*(n[d]-norm[k+d]);
  }
 }
 const restFloor=mesh.pos.reduce((v,n,i)=>i%3===2?Math.min(n,v):v,Infinity);
 const floor=pos.reduce((v,n,i)=>i%3===2?Math.min(n,v):v,Infinity),lift=restFloor-floor;
 const map=new Map(joints.map(j=>[j[0],j]));
 function transform(point,parent){
  let p=[...point];
  while(parent){const [key,,o,next]=map.get(parent),r=angles[key]||[0,0];
   p=rotate(p.map((v,i)=>v-o[i]),...r.map(trig)).map((v,i)=>v+o[i]); parent=next;}
  p[2]+=lift;return p;
 }
 for(const [key,,p,parent] of joints)pivots[key]=transform(p,parent);
 const environment=mesh.environment.slice();
 for(let k=0;k<pos.length;k+=3){
  pos[k+2]+=lift;const l=Math.hypot(norm[k],norm[k+1],norm[k+2])||1;
  for(let d=0;d<3;d++)norm[k+d]/=l;
  const delta=55*(norm[k+2]-mesh.norm[k+2]),i=k/3*2;
  environment[i]=Math.max(0,Math.min(255,environment[i]+delta));
  environment[i+1]=Math.max(0,Math.min(255,environment[i+1]-delta));
 }
 return {...mesh,pos,norm,environment,pivots,face:transform([0,-.067,2.70],'head'),changed:active.length>0};
}
