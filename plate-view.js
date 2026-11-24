import {deform,joints,bones,reach} from './pose.js';
import {backdrop,relight,indirectColor} from './light-rig.js';
const plates={bodyF:{name:'전신',caption:'실사형 여성 전신'},bodySM:{name:'전신',caption:'데포르메 남성 전신'},bodySF:{name:'전신',caption:'데포르메 여성 전신'},body:{name:'전신',caption:'실사형 남성 전신'},head:{name:'얼굴',caption:'실사형 흉상'},planes:{name:'얼굴',caption:'면 분할 두상'},hand:{name:'손',caption:'독립 손 모형'},figure:{name:'전신 인체',caption:'회색 무광 전신 인체'}};
import {decodeSet,projectScene} from './set-render.js';

const meshCache=new Map();
export const lighting={scene:'사선광',cloud:'흐린 날',sun:'맑은 날 직사광',sunset:'노을 역광',night:'밤의 등불',spot:'스포트라이트',side:'측면광',below:'아래광'};
let settingsRequest,revision=0,view;
async function getJson(){
 if(!settingsRequest)settingsRequest=fetch('./assets/sets/settings.json').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{settingsRequest=null;throw e;});
 return settingsRequest;
}
async function getMesh(id){
 if(!meshCache.has(id)){
  const request=Promise.all(['set','lights','ambient','skin'].map(ext=>fetch('./assets/sets/'+id+'.'+ext).then(r=>{if(!r.ok)throw Error();return r.arrayBuffer();}))).then(([geo,light,env,skin])=>{
    const mesh=decodeSet(geo),length=mesh.color.length;
    if(env.byteLength!==mesh.spec.length*2)throw Error('Invalid environment data');
    if(skin.byteLength!==mesh.spec.length*8)throw Error("Invalid skin");mesh.skin=new Uint8Array(skin);
    mesh.environment=new Uint8Array(env);
    const keys=Object.keys(lighting).filter(k=>k!=='scene');
    if(light.byteLength!==length*keys.length)throw Error('Invalid lighting data');
    mesh.colors={scene:mesh.color};
    keys.forEach((key,i)=>{mesh.colors[key]=new Uint8Array(light,i*length,length);});
    return mesh;
  }).catch(e=>{meshCache.delete(id);throw e;});
  meshCache.set(id,request);
 }
 return meshCache.get(id);
}
const studyMeshes=new Map(), cameras=new Map();
export const studyBones=await fetch('./assets/study/rigs.json').then(r=>r.json());
async function studyMesh(id){
 if(!studyMeshes.has(id))studyMeshes.set(id,(async()=>{
  const response=await fetch('./assets/study/'+id+'.set');
  if(!response.ok)throw Error('model');
  const buf=await response.arrayBuffer(),header=new DataView(buf),count=header.getUint32(0,true),offset=buf.byteLength-count*8;
  const mesh=decodeSet(buf.slice(0,offset));mesh.skin=new Uint8Array(buf,offset);mesh.bones=studyBones[id];
  mesh.environment=new Uint8Array(count*2);
  for(let i=0;i<count;i++){
   const z=mesh.norm[i*3+2];mesh.environment[2*i]=105+75*z;mesh.environment[2*i+1]=75-65*z;
  }
  return mesh;
 })().catch(e=>{studyMeshes.delete(id);throw e;}));
 return studyMeshes.get(id);
}
export function magnify(factor){if(view){view.camera.scale=Math.max(.45,Math.min(4,view.camera.scale*factor));requestDraw(view);}}
export function panMode(value){if(view)view.pan=value;}
function presetColor(mesh,key,setting){
 const v=setting.light.slice();
 if(setting.point) v[2]-=1.6;
 const angle=Math.atan2(v[0],-v[1])*180/Math.PI,height=Math.atan2(v[2],Math.hypot(v[0],v[1]))*180/Math.PI;
 const rgb={scene:[1,1,1],sun:[1,.96,.87],cloud:[.92,.96,1],sunset:[1,.66,.43],night:[1,.78,.54],spot:[1,.98,.92],side:[1,1,1],below:[1,1,1]}[key];
 const rig={key:{angle,height,power:key==='cloud'?43:110},target:key==='spot'?'chest':'whole',fillOn:false};
 const out=relight(mesh,rig);
 for(let i=0;i<out.length;i+=3){
  const spill=key==='cloud'?42:0;
  const falloff=key==='night'?1/Math.max(.85,Math.hypot(...v.map((_,d)=>setting.light[d]-mesh.pos[i+d]))):1;
  for(let c=0;c<3;c++)out[i+c]=Math.min(255,(out[i+c]*falloff+spill)*rgb[c]);
 }
 return out;
}
function markJoints(s,setting,w,h){
 const a=(setting.az+s.yaw)*Math.PI/180,e=(setting.el+s.pitch)*Math.PI/180,scale=Math.min(h,w*.8)/setting.span;
 s.project=p=>{const [x,y,z]=p.map((v,i)=>v-setting.target[i]);return [.5+scale*(Math.cos(a)*x+Math.sin(a)*y)/w,.5-scale*(-Math.sin(a)*Math.sin(e)*x+Math.cos(a)*Math.sin(e)*y+Math.cos(e)*z)/h];};
 const ctx=s.canvas.getContext('2d'),radius=6*w/(s.canvas.clientWidth||w);
 s.handles=(s.original.bones?.map(b=>[b.key,b.label])||joints).filter(([key])=>!s.regions[s.zoom]||key===({face:"head",left:"wrist1",right:"wrist-1"})[s.zoom]).map(([key,label])=>{
  const [x,y,z]=s.mesh.pivots[key].map((v,i)=>v-setting.target[i]);
  const px=w/2+scale*(Math.cos(a)*x+Math.sin(a)*y);
  const py=h/2-scale*(-Math.sin(a)*Math.sin(e)*x+Math.cos(a)*Math.sin(e)*y+Math.cos(e)*z);
  ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fillStyle=key===s.pose.selected?'#ffe595':'#cdb5ff';ctx.fill();ctx.strokeStyle='#30243c';ctx.lineWidth=radius*.32;ctx.stroke();
  return {key,label,x:px/w,y:py/h};
 });
}
function lightGuide(s,setting,w,h){
 const ctx=s.canvas.getContext('2d'),factor=w/(s.canvas.clientWidth||w);
 const lamps=s.manual?[['키',s.rig.key],...(s.rig.fillOn?[['필',s.rig.fill]]:[])]:[['키',null]];
 const a=(setting.az+s.yaw)*Math.PI/180,e=(setting.el+s.pitch)*Math.PI/180;
 ctx.save();ctx.scale(factor,factor);
 lamps.forEach(([label,lamp],i)=>{
  let v=setting.light.slice();if(setting.point)v[2]-=1.6;
  if(lamp){const az=lamp.angle*Math.PI/180,el=lamp.height*Math.PI/180;v=[Math.sin(az)*Math.cos(el),-Math.cos(az)*Math.cos(el),Math.sin(el)];}
  const [x,y,z]=v.map(n=>n/Math.hypot(...v)),right=Math.cos(a)*x+Math.sin(a)*y,up=-Math.sin(a)*Math.sin(e)*x+Math.cos(a)*Math.sin(e)*y+Math.cos(e)*z;
  const depth=Math.sin(a)*Math.cos(e)*x-Math.cos(a)*Math.cos(e)*y+Math.sin(e)*z;
  const cx=32,cy=32+52*i,color=i?'#8ed9ff':'#ffdc91';
  ctx.fillStyle='rgba(28,26,34,.87)';ctx.fillRect(8,cy-22,133,44);
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;
  const px=cx+right*16,py=cy-up*16;
  ctx.beginPath();ctx.arc(px,py,3.5,0,2*Math.PI);ctx.fill();
  if(Math.hypot(right,up)>.1){
   const theta=Math.atan2(up,-right),ex=cx-right*8,ey=cy+up*8;
   ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(ex,ey);ctx.lineTo(ex-7*Math.cos(theta-.49),ey-7*Math.sin(theta-.49));ctx.moveTo(ex,ey);ctx.lineTo(ex-7*Math.cos(theta+.49),ey-7*Math.sin(theta+.49));ctx.stroke();
  }
  ctx.font='bold 13px sans-serif';ctx.fillText(label+' 라이트',60,cy-2);
  ctx.fillStyle='white';ctx.font='12px sans-serif';ctx.fillText(lamp?.power===0?'세기 0':s.light==='cloud'&&!s.manual?'확산 · 하늘':depth>.22?'화면 앞쪽':depth<-.22?'화면 뒤쪽':'화면 옆쪽',60,cy+14);
 });ctx.restore();
}
function framing(s,setting){
 const p=s.mesh.pos,center=s.mesh.center;
 const a=(setting.az+s.yaw)*Math.PI/180,e=(setting.el+s.pitch)*Math.PI/180;
 const ca=Math.cos(a),sa=Math.sin(a),ce=Math.cos(e),se=Math.sin(e);
 let span=.9;
 for(let i=0;i<p.length;i+=3){
  const x=p[i]-center[0],y=p[i+1]-center[1],z=p[i+2]-center[2];
  span=Math.max(span,2*Math.abs(ca*x+sa*y)*.66,2*Math.abs(-sa*se*x+ca*se*y+ce*z));
 }
 return span*1.13;
}
// Select triangles in the rest pose so the same anatomy stays visible after posing.
function anatomyRegions(mesh){
 const regions={};
 for(const key of ['face','left','right']){
  const side=key==='left'?1:-1;
  const wrist=bones.find(b=>b.key==='wrist'+side);
  const axis=wrist.end.map((v,i)=>v-wrist.p[i]);
  const length=Math.hypot(...axis);
  const distance=new Float32Array(mesh.spec.length);
  for(let i=0;i<distance.length;i++){
   const k=i*3,x=mesh.pos[k],y=mesh.pos[k+1],z=mesh.pos[k+2];
   const distal=((x-wrist.p[0])*axis[0]+(y-wrist.p[1])*axis[1]+(z-wrist.p[2])*axis[2])/length;
   distance[i]=key==='face'? z-2.525 : Math.min(side*x-.62,-y-.11,distal+.055);
  }
  const triangles=[],cuts=[],edges=new Map(),rim=[];
  function slice(i,j){
   const a=Math.min(i,j),b=Math.max(i,j),edge=a+':'+b;
   if(!edges.has(edge)){edges.set(edge,distance.length+cuts.length);cuts.push([a,b,distance[a]/(distance[a]-distance[b])]);}
   return edges.get(edge);
  }
  for(let i=0;i<mesh.indices.length;i+=3){
   const face=mesh.indices.subarray(i,i+3),polygon=[],ends=[];
   for(let k=0;k<3;k++){
    const a=face[k],b=face[(k+1)%3],inside=distance[a]>=0;
    if(inside)polygon.push(a);
    if(inside!==(distance[b]>=0)){const v=slice(a,b);polygon.push(v);ends.push(v);}
   }
   if(ends.length===2)rim.push(ends);
   for(let j=2;j<polygon.length;j++)triangles.push(polygon[0],polygon[j-1],polygon[j]);
  }
  const vertices=[...new Set(triangles)],cap=distance.length+cuts.length;
  for(const [a,b] of rim)triangles.push(a,b,cap);
  regions[key]={indices:new Uint32Array(triangles),vertices,cuts};
 }
 return regions;
}
function isolate(mesh,region,setting){
 const expanded={...mesh,indices:region.indices};
 for(const field of ['pos','norm','color','spec']){
  const source=mesh[field],stride=field==='spec'?1:3,offset=source.length;
  const values=new source.constructor(offset+(region.cuts.length+1)*stride);values.set(source);
  const total=new Float64Array(stride);
  region.cuts.forEach(([a,b,t],i)=>{for(let d=0;d<stride;d++){
   const value=source[a*stride+d]*(1-t)+source[b*stride+d]*t;
   values[offset+i*stride+d]=value;total[d]+=value;
  }});
  total.forEach((sum,d)=>values[values.length-stride+d]=sum/region.cuts.length);
  expanded[field]=values;
 }
 const min=[Infinity,Infinity,Infinity],max=min.map(()=>-Infinity);
 for(const v of region.vertices)for(let i=0;i<3;i++){const n=expanded.pos[v*3+i];min[i]=Math.min(min[i],n);max[i]=Math.max(max[i],n);}
 setting.target=min.map((n,i)=>(n+max[i])/2);
 setting.span=1.08*Math.hypot(...min.map((n,i)=>max[i]-n));
 return expanded;
}
function draw(s,quick=false,exporting=false){
 if(!s.canvas.isConnected)return;
 const canvas=s.canvas,w=quick?520:960,h=Math.round(w*.66);
 canvas.width=w;canvas.height=h;
 if(s.pose&&(s.lastAngles!==s.pose.angles||s.lastMirror!==s.pose.mirror)){
  s.mesh=deform(s.original,s.pose.angles);s.lastAngles=s.pose.angles;s.lastMirror=s.pose.mirror;
  if(s.pose.mirror){
   for(let k=0;k<s.mesh.pos.length;k+=3){s.mesh.pos[k]*=-1;s.mesh.norm[k]*=-1;}
   for(const p of Object.values(s.mesh.pivots))p[0]*=-1;s.mesh.center[0]*=-1;
  }
 }else if(!s.pose){s.mesh=s.original;s.lastAngles=null;}
 const setting={...s.settings,...s.settings.presets[s.light],bg:s.rig?backdrop(s.rig):'#888888'};
 if(s.pose){if(s.frameRevision!==s.pose.revision){s.frameRevision=s.pose.revision;s.center=s.mesh.center;s.span=framing(s,setting);}setting.target=s.center||s.mesh.center;setting.span=Math.max(s.span,framing(s,setting));}else{s.frameRevision=null;}
 const isolated=s.regions[s.zoom];
 const base=s.manual?relight(s.mesh,s.rig):s.original.bones||s.mesh.changed?presetColor(s.mesh,s.light,setting):s.mesh.colors[s.light];
 const mesh={...s.mesh,color:s.rig?indirectColor(s.mesh,base,s.rig,s.manual?null:s.light):base};
 const visible=isolated?isolate(mesh,isolated,setting):mesh;
 setting.span/=s.camera.scale;
 const az=(setting.az+s.yaw)*Math.PI/180,el=(setting.el+s.pitch)*Math.PI/180;
 const right=[Math.cos(az),Math.sin(az),0],up=[-Math.sin(az)*Math.sin(el),Math.cos(az)*Math.sin(el),Math.cos(el)];
 setting.target=setting.target.map((v,i)=>v+setting.span*(s.camera.x*right[i]+s.camera.y*up[i]));
 if(s.original.bones)for(let i=0;i<mesh.spec.length;i++){if(s.original.color[i*3]<100)for(let c=0;c<3;c++)mesh.color[i*3+c]*=.46;}
 const data=projectScene(visible,setting,w,h,s.yaw,s.pitch,false,s.tone,s.manual?0:s.light==='cloud'?.08:1);
 canvas.getContext('2d').putImageData(new ImageData(data,w,h),0,0);
 if(s.pose?.guides&&!exporting)lightGuide(s,setting,w,h);
 s.handles=[];if(s.pose?.editing&&!exporting)markJoints(s,setting,w,h);
 canvas.setAttribute('aria-label',plates[s.id].caption+' · '+s.tone);
 s.caption.textContent=plates[s.id].name+' · '+(s.manual?'직접 조명':lighting[s.light])+' · '+s.tone;
}
function requestDraw(s,quick=false){
 cancelAnimationFrame(s.frame);
 s.frame=requestAnimationFrame(()=>draw(s,quick));
}
function bind(s){
 const c=s.canvas;let drag;
 function move(x,y){s.yaw=(s.yaw+x+360)%360;s.pitch=Math.min(89-s.settings.el,Math.max(-89-s.settings.el,s.pitch+y));}
 c.onpointerdown=e=>{if(e.button!==0&&e.button!==2)return;const bounds=c.getBoundingClientRect(),x=e.clientX-bounds.left,y=e.clientY-bounds.top;
 const near=s.pose?.editing?s.handles?.map(h=>({...h,dist:Math.hypot(h.x*bounds.width-x,h.y*bounds.height-y)})).sort((a,b)=>a.dist-b.dist)[0]:null;
 drag={x:e.clientX,y:e.clientY,pan:s.pan||e.shiftKey||e.button===2,handle:near?.dist<16?near:null};if(drag.handle){s.pose.select(drag.handle.key);requestDraw(s);}c.setPointerCapture(e.pointerId);};
 c.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(drag.handle&&s.pose?.editing){const key=drag.handle.key,bone=(s.original.bones||bones).find(b=>b.key===key),r=c.getBoundingClientRect();
  if(s.id.startsWith('body')&&bone.parent&&!['body','root'].includes(bone.parent)){
   const target=[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];s.pose.update(reach(s.pose.angles,key,target,s.project,s.original.bones));
  }else{
   const v=[...(s.pose.angles[key]||[0,0,0])];v[0]=Math.max(bone.limits[0][0],Math.min(bone.limits[0][1],v[0]+dy*.5));const axis=key.startsWith("eye")||key==="neck"?2:1;v[axis]=Math.max(bone.limits[axis][0],Math.min(bone.limits[axis][1],v[axis]+dx*.5));s.pose.update({...s.pose.angles,[key]:v});
  }}
 else if(drag.pan){s.camera.x-=dx/c.clientHeight;s.camera.y+=dy/c.clientHeight;}
 else move(-dx*.48,dy*.32);
 drag.x=e.clientX;drag.y=e.clientY;requestDraw(s,true);};
 c.onpointerup=c.onpointercancel=c.onlostpointercapture=()=>{if(drag){drag=null;requestDraw(s);}};
 c.oncontextmenu=e=>e.preventDefault();c.onwheel=e=>{e.preventDefault();magnify(Math.exp(-Math.sign(e.deltaY)*.12));};
 c.onkeydown=e=>{
  const steps={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,8],ArrowDown:[0,-8]};
  if(!steps[e.key])return;e.preventDefault();move(...steps[e.key]);requestDraw(s);
 };
}
export function setView(yaw,elevation){if(view){view.yaw=yaw;view.pitch=elevation-view.settings.el;}}
export function resetAngle(){if(view){view.yaw=0;view.pitch=0;Object.assign(view.camera,{x:0,y:0,scale:1});requestDraw(view);}}
export function savePlate(){
 if(!view?.canvas.isConnected||view.ticket!==revision)return;
 draw(view,false,true);const a=document.createElement('a');a.download=({face:'얼굴',left:'왼손',right:'오른손'}[view.zoom]||plates[view.id].name)+'-'+view.tone+'.png';a.href=view.canvas.toDataURL('image/png');a.click();requestDraw(view);
}
export async function displayPlate(id,tone,zoom,light='scene',rig=null,manual=false,pose=null){
 const ticket=++revision,gallery=document.getElementById('gallery');gallery.className='gallery model-set';
 if(!gallery.querySelector('.set-canvas'))gallery.innerHTML='<figure class="set-frame"><canvas tabindex="0" class="set-canvas" role="img"></canvas><figcaption>3D 모형을 불러오는 중…</figcaption></figure>';
 const canvas=gallery.querySelector('canvas');
 const [settings,mesh]=await Promise.all([getJson(),id==='figure'?getMesh(id):studyMesh(id)]);
 if(ticket!==revision||!canvas.isConnected)return;
 if(!view||view.canvas!==canvas||view.id!==id){
  const cameraKey=id.startsWith('body')?'body':id;
  if(view)cameras.set(view.id.startsWith('body')?'body':view.id,{yaw:view.yaw,pitch:view.pitch,camera:view.camera,center:view.center,span:view.span,frameRevision:view.frameRevision});
  view={id,mesh,regions:id==='figure'?anatomyRegions(mesh):{},original:mesh,settings:settings.figure,canvas,caption:gallery.querySelector('figcaption'),yaw:0,pitch:0,camera:{x:0,y:0,scale:1},...cameras.get(cameraKey)};
  bind(view);
 }
 Object.assign(view,{tone,zoom,light,ticket,rig,manual,pose});requestDraw(view);
}
