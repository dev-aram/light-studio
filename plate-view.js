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
function draw(s,quick=false){
 if(!s.canvas.isConnected)return;
 const canvas=s.canvas,w=quick?520:960,h=Math.round(w*.66);
 canvas.width=w;canvas.height=h;
 const setting={...s.settings,...s.settings.presets[s.light],bg:s.rig?backdrop(s.rig):'#888888'};
 if(s.zoom){setting.target=s.settings.faceTarget;setting.span=.77;}
 const base=s.manual?relight(s.mesh,s.rig):s.mesh.colors[s.light];
 const mesh={...s.mesh,color:s.rig?indirectColor(s.mesh,base,s.rig,s.manual?null:s.light):base};
 const data=projectScene(mesh,setting,w,h,s.yaw,s.pitch,false,s.tone,s.manual?0:s.light==='cloud'?.08:1);
 canvas.getContext('2d').putImageData(new ImageData(data,w,h),0,0);
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
 c.onpointerdown=e=>{if(e.button!==0)return;drag=[e.clientX,e.clientY];c.setPointerCapture(e.pointerId);};
 c.onpointermove=e=>{if(!drag)return;move((drag[0]-e.clientX)*.48,(e.clientY-drag[1])*.32);drag=[e.clientX,e.clientY];requestDraw(s,true);};
 c.onpointerup=c.onpointercancel=c.onlostpointercapture=()=>{if(drag){drag=null;requestDraw(s);}};
 c.onkeydown=e=>{
  const steps={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,8],ArrowDown:[0,-8]};
  if(!steps[e.key])return;e.preventDefault();move(...steps[e.key]);requestDraw(s);
 };
}
export function resetAngle(){if(view){view.yaw=0;view.pitch=0;requestDraw(view);}}
export function savePlate(){
 if(!view?.canvas.isConnected||view.ticket!==revision)return;
 draw(view);const a=document.createElement('a');a.download=plates[view.id].name+'-'+view.tone+'.png';a.href=view.canvas.toDataURL('image/png');a.click();
}
export async function displayPlate(id,tone,zoom,light='scene',rig=null,manual=false){
 const ticket=++revision,gallery=document.getElementById('gallery');gallery.className='gallery model-set';
 if(!gallery.querySelector('.set-canvas'))gallery.innerHTML='<figure class="set-frame"><canvas tabindex="0" class="set-canvas" role="img"></canvas><figcaption>3D 모형을 불러오는 중…</figcaption></figure>';
 const canvas=gallery.querySelector('canvas');
 const [settings,mesh]=await Promise.all([getJson(),getMesh(id)]);
 if(ticket!==revision||!canvas.isConnected)return;
 if(!view||view.canvas!==canvas||view.id!==id){
  view={id,mesh,settings:settings[id],canvas,caption:gallery.querySelector('figcaption'),yaw:0,pitch:0};
  bind(view);
 }
 Object.assign(view,{tone,zoom,light,ticket,rig,manual});requestDraw(view);
}
