import {bones,poses} from './skeleton.js';
export {poses,bones};
export const joints=bones.map(b=>[b.key,b.label]);
const rad=Math.PI/180;
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const conjugate=q=>[-q[0],-q[1],-q[2],q[3]];
function mul([x,y,z,w],[a,b,c,d]){
 return [w*a+x*d+y*c-z*b,w*b-x*c+y*d+z*a,w*c+x*b-y*a+z*d,w*d-x*a-y*b-z*c];
}
function rotate(q,p){return mul(mul(q,[...p,0]),conjugate(q)).slice(0,3);}
function rotation(angles){
 let q=[0,0,0,1];
 angles.forEach((v,i)=>{const a=v*rad/2,r=[0,0,0,Math.cos(a)];r[i]=Math.sin(a);q=mul(r,q);});
 return q;
}
function point(t,p){return add(rotate(t.q,p),t.offset);}
export function skeleton(angles){
 const result={};
 for(const b of bones){
  const parent=result[b.parent],pivot=parent?point(parent,b.p):b.p;
  const local=rotation(angles[b.key]||[0,0,0]),q=parent? mul(parent.q,local):local;
  const offset=sub(pivot,rotate(q,b.p));
  result[b.key]={q,pivot,offset,dual:mul([...offset,0],q).map(v=>v*.5)};
 }
 return result;
}
export function deform(mesh,angles){
 const transforms=skeleton(angles),ordered=bones.map(b=>transforms[b.key]),skin=mesh.skin;
 const pos=new Float32Array(mesh.pos.length),norm=new Float32Array(pos.length),environment=mesh.environment.slice();
 const min=[Infinity,Infinity,Infinity],max=min.map(v=>-v);
 for(let i=0;i<mesh.spec.length;i++){
  const k=i*3,j=i*8,ref=ordered[skin[j]].q,q=[0,0,0,0],d=[0,0,0,0];
  for(let h=0;h<4;h++){
   const t=ordered[skin[j+h]],w=skin[j+h+4]/255;if(!w)continue;
   const sign=t.q.reduce((v,n,c)=>v+n*ref[c],0)<0?-w:w;
   for(let c=0;c<4;c++){q[c]+=t.q[c]*sign;d[c]+=t.dual[c]*sign;}
  }
  const length=Math.hypot(...q);for(let c=0;c<4;c++){q[c]/=length;d[c]/=length;}
  const offset=mul(d,conjugate(q)),p=rotate(q,mesh.pos.subarray(k,k+3)),n=rotate(q,mesh.norm.subarray(k,k+3));
  for(let c=0;c<3;c++){pos[k+c]=p[c]+2*offset[c];norm[k+c]=n[c];min[c]=Math.min(min[c],pos[k+c]);max[c]=Math.max(max[c],pos[k+c]);}
  const delta=55*(n[2]-mesh.norm[k+2]);
  environment[i*2]=Math.max(0,Math.min(255,environment[i*2]+delta));environment[i*2+1]=Math.max(0,Math.min(255,environment[i*2+1]-delta));
 }
 const pivots=Object.fromEntries(bones.map(b=>[b.key,transforms[b.key].pivot]));
 const center=min.map((v,i)=>(v+max[i])/2);
 const face=point(transforms.head,[0,-.067,2.70]);
 return {...mesh,pos,norm,environment,pivots,face,center,focus:{face,chest:point(transforms.body,[0,-.09,2.1]),belly:point(transforms.body,[0,-.09,1.67])},changed:Object.values(angles).some(r=>r.some(Boolean))};
}
// Damped screen-space IK adjusts parent rotations while keeping the skeleton's lengths fixed.
export function reach(initial,key,target,project){
 const joint=bones.find(b=>b.key===key);let parent=joint.parent;
 const chain=[];
 while(parent&&parent!=='root'&&parent!=='body'&&chain.length<2){
  const bone=bones.find(b=>b.key===parent);chain.push(bone);parent=bone.parent;
 }
 if(!chain.length)return initial;
 const next={...initial};for(const b of chain)next[b.key]=[...(next[b.key]||[0,0,0])];
 const at=()=>project(skeleton(next)[key].pivot);
 for(let j=0;j<7;j++){
  const p=at(),dx=target[0]-p[0],dy=target[1]-p[1];if(Math.hypot(dx,dy)<.003)break;
  const columns=[];let xx=.00003,xy=0,yy=.00003;
  for(const b of chain)for(let axis=0;axis<3;axis++){
   const r=next[b.key];r[axis]+=.5;const v=at();r[axis]-=.5;
   const x=(v[0]-p[0])*2,y=(v[1]-p[1])*2;columns.push([b,axis,x,y]);xx+=x*x;xy+=x*y;yy+=y*y;
  }
  const det=xx*yy-xy*xy,u=(yy*dx-xy*dy)/det,v=(xx*dy-xy*dx)/det;
  for(const [b,i,x,y] of columns){const [lo,hi]=b.limits[i];next[b.key][i]=Math.max(lo,Math.min(hi,next[b.key][i]+Math.max(-7,Math.min(7,u*x+v*y))));}
 }
 return next;
}
