import {deform,joints} from './pose.js';
import {backdrop,relight,indirectColor} from './light-rig.js';
const plates={figure:{name:'전신 인체',caption:'기본 자세의 회색 무광 전신 인체'}};
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
  const request=Promise.all(['set','lights','ambient'].map(ext=>fetch('./assets/sets/'+id+'.'+ext).then(r=>{if(!r.ok)throw Error();return r.arrayBuffer();}))).then(([geo,light,env])=>{
    const mesh=decodeSet(geo),length=mesh.color.length;
    if(env.byteLength!==mesh.spec.length*2)throw Error('Invalid environment data');
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
 const ctx=s.canvas.getContext('2d'),radius=6*w/(s.canvas.clientWidth||w);
 s.handles=joints.map(([key,label])=>{
  const [x,y,z]=s.mesh.pivots[key].map((v,i)=>v-setting.target[i]);
  const px=w/2+scale*(Math.cos(a)*x+Math.sin(a)*y);
  const py=h/2-scale*(-Math.sin(a)*Math.sin(e)*x+Math.cos(a)*Math.sin(e)*y+Math.cos(e)*z);
  ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fillStyle='#cdb5ff';ctx.fill();ctx.strokeStyle='#30243c';ctx.lineWidth=radius*.32;ctx.stroke();
  return {key,label,x:px/w,y:py/h};
 });
}
function draw(s,quick=false,exporting=false){
 if(!s.canvas.isConnected)return;
 const canvas=s.canvas,w=quick?520:960,h=Math.round(w*.66);
 canvas.width=w;canvas.height=h;
 if(s.pose&&s.lastAngles!==s.pose.angles){
  s.mesh=deform(s.original,s.pose.angles);s.lastAngles=s.pose.angles;
 }else if(!s.pose){s.mesh=s.original;s.lastAngles=null;}
 const setting={...s.settings,...s.settings.presets[s.light],bg:s.rig?backdrop(s.rig):'#888888'};
 if(s.zoom){setting.target=s.mesh.face||s.settings.faceTarget;setting.span=.77;}
 const base=s.manual?relight(s.mesh,s.rig):s.mesh.changed?presetColor(s.mesh,s.light,setting):s.mesh.colors[s.light];
 const mesh={...s.mesh,color:s.rig?indirectColor(s.mesh,base,s.rig,s.manual?null:s.light):base};
 const data=projectScene(mesh,setting,w,h,s.yaw,s.pitch,false,s.tone,s.manual?0:s.light==='cloud'?.08:1);
 canvas.getContext('2d').putImageData(new ImageData(data,w,h),0,0);
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
 function move(x,y){s.yaw=(s.yaw+x+360)%360;s.pitch=Math.min(82-s.settings.el,Math.max(-10-s.settings.el,s.pitch+y));}
 c.onpointerdown=e=>{if(e.button!==0)return;const bounds=c.getBoundingClientRect(),x=e.clientX-bounds.left,y=e.clientY-bounds.top;
 const near=s.pose?.editing?s.handles?.map(h=>({...h,dist:Math.hypot(h.x*bounds.width-x,h.y*bounds.height-y)})).sort((a,b)=>a.dist-b.dist)[0]:null;
 drag={x:e.clientX,y:e.clientY,handle:near?.dist<16?near:null};c.setPointerCapture(e.pointerId);};
 c.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
 if(drag.handle&&s.pose?.editing){const key=drag.handle.key,[a,b]=s.pose.angles[key]||[0,0];
 const cap=key==='body'||key==='head'?45:key.startsWith('arm')?135:95;
 const bound=v=>Math.max(-cap,Math.min(cap,v));
 s.pose.change(key,[bound(a+(key==='head'||key==='body'?-dx:dx)*.65),bound(b-dy*.65)]);}
 else move(-dx*.48,dy*.32);
 drag.x=e.clientX;drag.y=e.clientY;requestDraw(s,true);};
 c.onpointerup=c.onpointercancel=c.onlostpointercapture=()=>{if(drag){drag=null;requestDraw(s);}};
 c.onkeydown=e=>{
  const steps={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,8],ArrowDown:[0,-8]};
  if(!steps[e.key])return;e.preventDefault();move(...steps[e.key]);requestDraw(s);
 };
}
export function resetAngle(){if(view){view.yaw=0;view.pitch=0;requestDraw(view);}}
export function savePlate(){
 if(!view?.canvas.isConnected||view.ticket!==revision)return;
 draw(view,false,true);const a=document.createElement('a');a.download=plates[view.id].name+'-'+view.tone+'.png';a.href=view.canvas.toDataURL('image/png');a.click();requestDraw(view);
}
export async function displayPlate(id,tone,zoom,light='scene',rig=null,manual=false,pose=null){
 const ticket=++revision,gallery=document.getElementById('gallery');gallery.className='gallery model-set';
 if(!gallery.querySelector('.set-canvas'))gallery.innerHTML='<figure class="set-frame"><canvas tabindex="0" class="set-canvas" role="img"></canvas><figcaption>3D 모형을 불러오는 중…</figcaption></figure>';
 const canvas=gallery.querySelector('canvas');
 const [settings,mesh]=await Promise.all([getJson(),getMesh(id)]);
 if(ticket!==revision||!canvas.isConnected)return;
 if(!view||view.canvas!==canvas||view.id!==id){
  view={id,mesh,original:mesh,settings:settings[id],canvas,caption:gallery.querySelector('figcaption'),yaw:0,pitch:0};
  bind(view);
 }
 Object.assign(view,{tone,zoom,light,ticket,rig,manual,pose});requestDraw(view);
}
