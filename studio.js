import {poses} from './pose.js';
import {renderGlossary} from './glossary.js';
import {newRig,targets} from './light-rig.js';
import {displayPlate,resetAngle,savePlate,lighting} from './plate-view.js';
import {deck} from './questions.js';

const $=id=>document.getElementById(id);
const observations={
 scene:'이마에서 관자놀이로, 가슴에서 옆구리로 넘어가며 밝기가 달라지는 곳을 살펴보세요.',
 cloud:'광대와 볼 사이의 완만한 명도 차이를 보고, 턱 바로 밑의 좁은 어둠과 비교하세요.',
 sun:'얼굴을 확대해 코 자체의 어두운 면과 코가 볼 위에 드리운 그림자를 나누어 보세요.',
 sunset:'귀와 어깨의 외곽을 따라가며 빛이 이어지는 곳과 끊기는 곳을 비교하세요.',
 night:'몸 앞쪽 낮은 위치에 작은 등불이 있어요. 가까운 배와 먼 이마의 밝기를 비교하세요.',
 spot:'가슴과 배를 가로질러 빛의 범위를 따라가 보세요. 그 안에서도 면마다 밝기가 달라요.',
 side:'가슴 중앙에서 양쪽 겨드랑이로 시선을 옮겨 양쪽 가슴근의 명암을 비교하세요.',
 below:'콧방울 밑과 턱 아래를 먼저 보세요. 사선광으로 바꾸면 어느 면이 밝아지는지 비교할 수 있어요.'
};
let mode=location.hash==='#glossary'?'terms':location.hash==='#quiz'?'quiz':'lab';
let rig=newRig(),manual=true;
let questions=deck(),index=0,answers=[],labLight='scene',tone='컬러',face=false,revision=0;
let poseIndex=0, angles={}, editing=false;
const poseState={get angles(){return angles;},get editing(){return editing;},change(key,value){angles={...angles,[key]:value}; $('poseStatus').textContent='수정한 자세';}};
const current=()=>questions[index];
function paint(){
 const ticket=++revision;
 const light=mode==='quiz'&&current()?current().light:labLight;
 displayPlate('figure',tone,face,light,mode==='lab'?rig:null,mode==='lab'&&manual,mode==='lab'?poseState:null).catch(()=>{
  if(ticket!==revision)return;
  $('gallery').innerHTML='<div class="failed">인체 모형을 불러오지 못했어요. <button class="small" id="retry">다시 불러오기</button></div>';
  $('retry').onclick=paint;
 });
}
function render(){
 const terms=mode==='terms';
 $('termsTab').setAttribute('aria-pressed',String(terms));
 $('termsPage').hidden=!terms;document.querySelector('.workspace').hidden=terms;
 if(terms){
  $('quizTab').setAttribute('aria-pressed','false');$('labTab').setAttribute('aria-pressed','false');
  $('kicker').textContent='3D 인체 레퍼런스';$('heading').textContent='빛과 그림자 용어집';
  $('lead').textContent='용어를 선택해 인체에서 빛이 어떻게 보이는지 비교하세요.';
  renderGlossary($('termsPage'));return;
 }
 const lab=mode==='lab';
 $('quizTab').setAttribute('aria-pressed',String(!lab));
 $('labTab').setAttribute('aria-pressed',String(lab));
 $('kicker').textContent=lab?'3D 인체 관찰':'인체 드로잉 연습';
 $('heading').innerHTML=lab?'인체의 <em>빛과 그림자</em>':'인체 <em>명암 퀴즈</em>';
 $('lead').textContent=lab?'자세와 조명을 바꾸며 인체의 명암을 관찰하세요.':'빛을 받는 면과 빛이 가려진 곳을 살펴보세요.';
 $('sceneTitle').textContent=face?'얼굴':'전신';
 $('sceneMeta').textContent='회색 무광 인체';
 $('stageFoot').innerHTML='<div class="seg">'+['컬러','흑백','투톤'].map(t=>'<button data-tone="'+t+'" aria-pressed="'+(tone===t)+'">'+t+'</button>').join('')+'</div><button id="zoom" aria-pressed="'+face+'">'+(face?'전신 보기':'얼굴 확대')+'</button><button id="reset">정면 보기</button><span class="orbit-help">드래그로 시점 회전</span>';
 document.querySelectorAll('[data-tone]').forEach(b=>b.onclick=()=>{tone=b.dataset.tone;render();});
 $('zoom').onclick=()=>{face=!face;render();};
 $('reset').onclick=resetAngle;
 if(lab){
  const bar=document.createElement('div');bar.className='pose-bar';
  bar.innerHTML='<label>인체 자세 <select id="poseChoice">'+poses.map(([label],i)=>'<option value="'+i+'">'+label+'</option>').join('')+'</select></label><button id="poseEdit" aria-pressed="'+editing+'">관절 드래그</button><button id="poseReset">자세 복원</button><span id="poseStatus">'+(angles!==poses[poseIndex][1]&&Object.keys(angles).length?'수정한 자세':'')+'</span>';
  $('stageFoot').prepend(bar);$('poseChoice').value=poseIndex;
  $('poseChoice').onchange=e=>{poseIndex=Number(e.target.value);angles=poses[poseIndex][1];render();};
  $('poseReset').onclick=()=>{angles=poses[poseIndex][1];render();};
  $('poseEdit').onclick=()=>{editing=!editing;render();};
  if(editing)document.querySelector('.orbit-help').textContent='관절점을 좌우로 끌어 옆으로, 위아래로 끌어 앞뒤로 굽혀요. 빈 곳은 시점 회전.';
 }
 if(lab)renderLab();else renderQuiz();
 paint();
}
function renderLab(){
 const panel=$('panel');
 const selector='<div class="seg rig-mode"><button id="manualMode" aria-pressed="'+manual+'">직접 조절</button><button id="presetMode" aria-pressed="'+(!manual)+'">조명 프리셋</button></div>';
 const slider=(id,label,value,min,max,unit)=>'<label class="rig-slider"><span>'+label+'</span><output for="'+id+'">'+value+unit+'</output><input class="slider" type="range" id="'+id+'" min="'+min+'" max="'+max+'" value="'+value+'"></label>';
 const lamp=(prefix)=>slider(prefix+'Angle','좌우 각도',rig[prefix].angle,-180,180,'°')+slider(prefix+'Height','상하 각도',rig[prefix].height,-85,85,'°')+slider(prefix+'Power','세기',rig[prefix].power,0,200,'%');
 const aim='<label class="rig-target">주광 집중 부위<select id="target">'+Object.entries(targets).map(([id,[label]])=>'<option value="'+id+'" '+(id===rig.target?'selected':'')+'>'+label+'</option>').join('')+'</select></label>';
 const controls=manual?'<section class="rig-group"><h3>주광 · 키 라이트</h3>'+lamp('key')+aim+'<p class="hint">정면을 기준으로 좌우 0°는 앞, +90°는 오른쪽입니다. 상하 각도를 낮추면 빛이 아래에서 올라옵니다.</p></section><section class="rig-group"><label class="rig-toggle"><input type="checkbox" id="fillOn" '+(rig.fillOn?'checked':'')+'> 보조광 · 필 라이트</label><fieldset id="fillFields" '+(rig.fillOn?'':'disabled')+'>'+lamp('fill')+'</fieldset></section>':'<div class="seg">'+Object.entries(lighting).map(([key,label])=>'<button data-light="'+key+'" aria-pressed="'+(labLight===key)+'">'+label+'</button>').join('')+'</div><p class="lab-note">'+observations[labLight]+'</p>';
 panel.innerHTML='<h2>조명 설정</h2>'+selector+controls+'<section class="rig-group"><h3>배경과 환경광</h3><label class="rig-color">배경색<input type="color" id="bg" value="'+rig.bg+'"></label>'+slider('brightness','배경 밝기',rig.brightness,0,200,'%')+'<p class="hint">배경색이 주변에서 들어오는 빛과 바닥에서 되비치는 빛에 반영돼요. 턱 밑과 팔 안쪽을 비교해 보세요.</p></section><div class="actions"><button class="action" id="quiz">명암 퀴즈 풀기</button><button class="small" id="save">PNG 저장</button><button class="small" id="rigReset">설정 초기화</button></div>';
 $('manualMode').onclick=()=>{manual=true;render();};$('presetMode').onclick=()=>{manual=false;render();};
 document.querySelectorAll('[data-light]').forEach(b=>b.onclick=()=>{labLight=b.dataset.light;render();});
 function bindSlider(id,state,property,unit){
  const input=$(id);
  input.oninput=()=>{state[property]=Number(input.value);input.previousElementSibling.value=input.value+unit;paint();};
 }
 if(manual){
  for(const prefix of ['key','fill']){
   for(const [suffix,property,unit] of [['Angle','angle','°'],['Height','height','°'],['Power','power','%']])bindSlider(prefix+suffix,rig[prefix],property,unit);
  }
  $('fillOn').onchange=e=>{rig.fillOn=e.target.checked;$('fillFields').disabled=!rig.fillOn;paint();};
  $('target').onchange=e=>{rig.target=e.target.value;paint();};
 }
 $('bg').oninput=e=>{rig.bg=e.target.value;paint();};
 bindSlider('brightness',rig,'brightness','%');
 $('rigReset').onclick=()=>{rig=newRig();labLight='scene';render();};
 $('save').onclick=savePlate;$('quiz').onclick=()=>changeMode('quiz');
}
function renderQuiz(){
 const q=current();
 if(!q){
  const score=questions.filter((q,i)=>answers[i]===q.answer).length;
  $('panel').innerHTML='<h2>연습 결과</h2><p class="grade">'+score+' / '+questions.length+'</p><div class="actions"><button id="again" class="action">새 문제 풀기</button></div>';
  $('again').onclick=()=>{questions=deck();index=0;answers=[];resetAngle();render();};return;
 }
 const chosen=answers[index];
 $('panel').innerHTML='<div class="meta"><span>'+q.type+'</span><span>'+(index+1)+' / '+questions.length+'</span></div><div class="progress">'+questions.map((item,i)=>'<i class="'+(answers[i]?(answers[i]===item.answer?'ok':'miss'):i===index?'active':'')+'"></i>').join('')+'</div><h2>'+q.title+'</h2><div class="choices">'+q.choices.map((choice,i)=>'<button class="choice '+(chosen?(choice===q.answer?'correct':chosen===choice?'wrong':''):'')+'" data-pick="'+i+'" '+(chosen?'disabled':'')+'><b>'+(i+1)+'</b>'+choice+'</button>').join('')+'</div>'+(chosen?'<div class="feedback" aria-live="polite"><strong>'+(chosen===q.answer?'정답이에요':'정답 · '+q.answer)+'</strong><p>'+q.why+'</p></div><div class="actions"><button class="action" id="next">'+(index+1===questions.length?'결과 보기':'다음 문제')+'</button><button class="small" id="compare">같은 인물로 조명 비교</button></div>':'');
 document.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{answers[index]=q.choices[Number(b.dataset.pick)];renderQuiz();});
 if(chosen){
  $('next').onclick=()=>{index++;face=false;tone='컬러';resetAngle();render();};
  $('compare').onclick=()=>{labLight=q.light;manual=false;changeMode('lab');};
 }
}
function changeMode(next){
 mode=next;history.replaceState(null,'',next==='terms'?'#glossary':next==='quiz'?'#quiz':'#figure');render();
}
$('quizTab').onclick=()=>changeMode('quiz');$('labTab').onclick=()=>changeMode('lab');
$('termsTab').onclick=()=>changeMode('terms');
window.addEventListener('pageshow',e=>{if(e.persisted){questions=deck();answers=[];index=0;render();}});
render();
