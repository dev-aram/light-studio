// Orthographic surface rasterization and light-space shadow maps.
// Coordinates use +X to the viewer's right, +Y upward and +Z toward the viewer.
const meshCache = new Map();
const surfaceCache = new Map();
const RAD = Math.PI / 180;
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = a => {const m=Math.hypot(...a);return a.map(v=>v/m);};
export function lightVector(az,el) {
  const e=el*RAD,a=az*RAD;
  return [Math.sin(a)*Math.cos(e), Math.sin(e), Math.cos(a)*Math.cos(e)];
}
export function angleError(a,b) {
  return Math.acos(Math.max(-1,Math.min(1,dot(lightVector(a.az,a.el),lightVector(b.az,b.el)))))/RAD;
}
async function loadMesh(name) {
  if(!meshCache.has(name)){
    const pending=fetch('./assets/'+name+'.mesh').then(async response=>{
      if(!response.ok)throw Error('참고 모형을 불러오지 못했어요.');
      const buffer=await response.arrayBuffer(), [verts,indices]=new Uint32Array(buffer,0,2);
      return {pos:new Float32Array(buffer,8,verts*3),norm:new Float32Array(buffer,8+verts*12,verts*3),idx:new Uint16Array(buffer,8+verts*24,indices)};
    }).catch(error=>{meshCache.delete(name);throw error;});
    meshCache.set(name,pending);
  }
  return meshCache.get(name);
}
function rotated(array,angle) {
  const a=angle*RAD,c=Math.cos(a),s=Math.sin(a),result=new Float32Array(array.length);
  for(let i=0;i<array.length;i+=3){
    result[i]=c*array[i]+s*array[i+2];result[i+1]=array[i+1];result[i+2]=-s*array[i]+c*array[i+2];
  }
  return result;
}
// Project all triangles onto either the study image or a light's depth buffer.
export function raster(coords,indices,w,h,normals) {
  const depth=new Float32Array(w*h).fill(-100);
  const normal=normals?new Float32Array(w*h*3):null;
  for(let f=0;f<indices.length;f+=3){
    const a=3*indices[f],b=3*indices[f+1],c=3*indices[f+2];
    const ax=coords[a],ay=coords[a+1],bx=coords[b],by=coords[b+1],cx=coords[c],cy=coords[c+1];
    const determinant=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    if(Math.abs(determinant)<.0001)continue;
    const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx))),x1=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)));
    const y0=Math.max(0,Math.ceil(Math.min(ay,by,cy))),y1=Math.min(h-1,Math.floor(Math.max(ay,by,cy)));
    const du=(by-cy)/determinant,dv=(cy-ay)/determinant;
    for(let y=y0;y<=y1;y++){
      let u=du*(x0-cx)+(cx-bx)*(y-cy)/determinant;
      let v=dv*(x0-cx)+(ax-cx)*(y-cy)/determinant;
      for(let x=x0;x<=x1;x++,u+=du,v+=dv){
        const t=1-u-v;
        if(u<-.00001||v<-.00001||t<-.00001)continue;
        const z=u*coords[a+2]+v*coords[b+2]+t*coords[c+2],i=y*w+x;
        if(z<=depth[i])continue;
        depth[i]=z;
        if(normal){
          const k=i*3;
          for(let d=0;d<3;d++)normal[k+d]=u*normals[a+d]+v*normals[b+d]+t*normals[c+d];
        }
      }
    }
  }
  return {depth,normal};
}
async function surface(scene,w,h){
  const key=[scene.model,scene.turn,w,h,scene.zoom||1].join('/');
  if(surfaceCache.has(key))return surfaceCache.get(key);
  const mesh=await loadMesh(scene.model);
  const pos=rotated(mesh.pos,scene.turn||0),norm=rotated(mesh.norm,scene.turn||0);
  const zoom=scene.zoom||1;
  const scale=Math.min(w*.5,h*.455)*zoom;
  const ox=w*.5,oy=h*.515+(zoom-1)*h*.29;
  const projected=new Float32Array(pos.length);
  for(let i=0;i<pos.length;i+=3){
    projected[i]=ox+scale*pos[i];projected[i+1]=oy-scale*pos[i+1];projected[i+2]=pos[i+2];
  }
  const geo={...raster(projected,mesh.idx,w,h,norm),pos,idx:mesh.idx,scale,ox,oy};
  if(surfaceCache.size>=6)surfaceCache.delete(surfaceCache.keys().next().value);
  surfaceCache.set(key,geo);
  return geo;
}
export function shadowMap(geo,L) {
  const right=unit(cross([0,1,0],L)),up=cross(L,right),size=340,scale=size*(geo.shadowScale??.34),mid=size*.5;
  const projection=new Float32Array(geo.pos.length),v=geo.pos;
  for(let i=0;i<v.length;i+=3){
    projection[i]=mid+scale*(v[i]*right[0]+v[i+1]*right[1]+v[i+2]*right[2]);
    projection[i+1]=mid-scale*(v[i]*up[0]+v[i+1]*up[1]+v[i+2]*up[2]);
    projection[i+2]=v[i]*L[0]+v[i+1]*L[1]+v[i+2]*L[2];
  }
  return {L,right,up,depth:raster(projection,geo.idx,size,size).depth,scale,mid,size};
}
export function visibility(s,x,y,z,cosine) {
  const {right,up,L,mid,scale,depth,size}=s;
  const sx=mid+scale*(x*right[0]+y*right[1]+z*right[2]);
  const sy=mid-scale*(x*up[0]+y*up[1]+z*up[2]);
  const ix=Math.floor(sx),iy=Math.floor(sy);
  if(ix<0||iy<0||ix>=size-1||iy>=size-1)return 1;
  const threshold=x*L[0]+y*L[1]+z*L[2]+.009+.009*(1-cosine);
  const index=iy*size+ix,fx=sx-ix,fy=sy-iy;
  const sample=value=>Math.max(0,Math.min(1,1-(value-threshold)*56));
  const top=sample(depth[index])*(1-fx)+sample(depth[index+1])*fx;
  const bottom=sample(depth[index+size])*(1-fx)+sample(depth[index+size+1])*fx;
  return top*(1-fy)+bottom*fy;
}
const sequence=new WeakMap();
export async function render(canvas,scene,exporting=false) {
  const token=(sequence.get(canvas)||0)+1;sequence.set(canvas,token);
  const w=canvas.width,h=canvas.height;
  const g=await surface(scene,w,h);
  if(sequence.get(canvas)!==token||(!canvas.isConnected&&!exporting))return;
  const ctx=canvas.getContext('2d');
  const bg=ctx.createRadialGradient(w*.45,h*.39,0,w*.5,h*.52,Math.max(w,h)*.78);
  bg.addColorStop(0,'#514958');bg.addColorStop(.6,'#38333e');bg.addColorStop(1,'#231f2b');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h),p=pixels.data;
  const spread=scene.size??12;
  const offsets=spread>16?Array.from({length:11},(_,i)=>{const a=i*2.39996,r=Math.sqrt((i+.5)/11);return [r*Math.cos(a),r*Math.sin(a)];}):spread>4?[[0,0],[-.83,-.31],[.48,-.7],[.73,.46],[-.36,.82]]:[[0,0]];
  const samples=offsets.map(([da,de])=>{
    const L=lightVector(scene.az+da*spread,Math.max(-86,Math.min(86,scene.el+de*spread)));
    return scene.cast===false?{L}:shadowMap(g,L);
  });
  const fill=scene.fill??.09;
  for(let j=0;j<h;j++){
    const y=(g.oy-j)/g.scale;
    for(let i=0;i<w;i++){
      const k=j*w+i,z=g.depth[k];if(z < -90)continue;
      const x=(i-g.ox)/g.scale;
      const n=k*3,nx=g.normal[n],ny=g.normal[n+1],nz=g.normal[n+2];
      let direct=0;
      for(const s of samples){
        const cos=Math.max(0,nx*s.L[0]+ny*s.L[1]+nz*s.L[2]);
        if(cos>0)direct+=cos*(s.depth?visibility(s,x,y,z,cos):1);
      }
      direct/=samples.length;
      // The lower reflecting surface lights downward-facing planes.
      const bounce=(scene.bounce||0)*Math.max(0,-ny);
      const base=fill*(.72+.28*(ny*.5+.5))+.018;
      let value=Math.min(1,(base+direct*.82+bounce)**.67);
      if(scene.tone==='three')value=value<.38?.20:value<.65?.5:.85;
      if(scene.tone==='gray'||scene.tone==='three'){
        p[k*4]=p[k*4+1]=p[k*4+2]=Math.round(14+value*230);
      }else{
        p[k*4]=29+value*218;
        p[k*4+1]=25+value*201;
        p[k*4+2]=40+value*178;
      }
    }
  }
  ctx.putImageData(pixels,0,0);
}
