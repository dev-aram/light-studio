import {raster} from './render.js';
const rad=Math.PI/180;

// Vertex records contain position, normal, lit diffuse color and specular strength.
export function decodeSet(buffer){
 const view=new DataView(buffer),count=view.getUint32(0,true),size=view.getUint32(4,true);
 if(buffer.byteLength!==8+13*count+size*4)throw Error('Invalid scene mesh');
 const pos=new Float32Array(count*3),norm=new Float32Array(count*3),color=new Uint8Array(count*3),spec=new Uint8Array(count);
 for(let i=0;i<count;i++){
  const base=8+i*13;
  for(let d=0;d<3;d++){pos[i*3+d]=view.getInt16(base+d*2,true)/4000;norm[i*3+d]=view.getInt8(base+6+d)/127;color[i*3+d]=view.getUint8(base+9+d);}
  spec[i]=view.getUint8(base+12);
 }
 const indices=new Uint32Array(size),start=8+count*13;
 for(let i=0;i<size;i++)indices[i]=view.getUint32(start+i*4,true);
 return {pos,norm,color,spec,indices};
}
const linear=Array.from({length:256},(_,i)=>{const x=i/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});
export function projectScene(mesh,setting,width,height,yaw,pitch,zoom,tone,specScale=1){
 const a=(setting.az+yaw)*rad,e=Math.max(-10,Math.min(82,setting.el+pitch))*rad;
 const ca=Math.cos(a),sa=Math.sin(a),ce=Math.cos(e),se=Math.sin(e);
 const vx=sa*ce,vy=-ca*ce,vz=se,scale=Math.min(height,width*.80)/setting.span*(zoom?1.35:1);
 const [tx,ty,tz]=setting.target,[lx,ly,lz]=setting.light;
 const {pos,norm,color,spec,indices}=mesh,coords=new Float32Array(pos.length),lit=new Float32Array(color.length);
 for(let i=0;i<spec.length;i++){
  const k=i*3,x=pos[k]-tx,y=pos[k+1]-ty,z=pos[k+2]-tz;
  coords[k]=width*.5+scale*(ca*x+sa*y);coords[k+1]=height*.5-scale*(-sa*se*x+ca*se*y+ce*z);coords[k+2]=vx*x+vy*y+vz*z;
  let highlight=0;
  if(spec[i]){
   const dx=setting.point?lx-pos[k]:lx,dy=setting.point?ly-pos[k+1]:ly,dz=setting.point?lz-pos[k+2]:lz;
   const length=Math.hypot(dx,dy,dz)||1,hx=dx/length+vx,hy=dy/length+vy,hz=dz/length+vz;
   const nh=(norm[k]*hx+norm[k+1]*hy+norm[k+2]*hz)/(Math.hypot(hx,hy,hz)||1);
   highlight=specScale*spec[i]*Math.pow(Math.max(0,Math.min(1,nh)),36)*.87;
  }
  for(let d=0;d<3;d++)lit[k+d]=Math.min(255,color[k+d]+highlight);
 }
 const {depth,normal:rgb}=raster(coords,indices,width,height,lit);
 const bg=[1,3,5].map(i=>parseInt(setting.bg.slice(i,i+2),16));
 const pixels=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<depth.length;i++){
  const k=i*3,j=i*4,empty=depth[i]<-90;
  let r=empty?bg[0]:rgb[k],g=empty?bg[1]:rgb[k+1],b=empty?bg[2]:rgb[k+2];
  if(!empty&&tone!=='컬러'){
   const l=.2126*linear[Math.round(r)]+.7152*linear[Math.round(g)]+.0722*linear[Math.round(b)];
   const gray=255*(l<=.0031308?12.92*l:1.055*l**(1/2.4)-.055);
   r=g=b=tone==='투톤'?(gray<105?50:217):gray;
  }
  pixels[j]=r;pixels[j+1]=g;pixels[j+2]=b;pixels[j+3]=255;
 }
 return pixels;
}
