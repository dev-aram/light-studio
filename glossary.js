import {glossary} from './questions.js';

const references=[
 ['Form shadow','표시점은 구의 오른쪽 표면에 있어요. 같은 구 안에서도 광원을 등진 면은 직접광을 받지 못합니다.'],
 ['Cast shadow','구가 왼쪽 위에서 오는 빛을 가립니다. 표시점은 구 위가 아니라 그 뒤쪽 바닥에 놓여 있어요.'],
 ['Terminator','금색 곡선을 따라가 보세요. 구의 표면이 빛과 나란해져 직접광이 끝나는 자리입니다. 구 바깥의 실루엣과는 다른 선이에요.'],
 ['Penumbra','받는 면의 표시점에서 광원을 거꾸로 바라본 그림이에요. 금색 선은 광원까지 닿고 회색 선은 가림판에서 멈춥니다. 광원의 일부만 보이는 영역이 반그림자예요.'],
 ['Ambient occlusion','흰 고리와 바닥이 가까워지는 안쪽을 보세요. 좁은 틈에서는 바닥과 고리가 주변에서 들어오는 빛을 서로 가려 접점이 어두워집니다.'],
 ['Rim light','신랑의 머리 윗선과 신부의 얇은 베일 끝을 따라 밝은 테두리가 생겼습니다. 뒤에서 들어오는 빛이 두 사람의 윤곽을 배경에서 분리합니다.'],
 ['Value grouping','같은 인물 사진을 오른쪽에서는 어두움·중간·밝음 세 값으로 묶었어요. 눈 주위와 머리카락이 어디서 한 덩어리가 되는지 보세요.'],
 ['Halftone','표시점에는 아직 직접광이 닿아요. 왼쪽의 밝은 면에서 오른쪽의 그림자로 넘어가는 도중, 빛이 비스듬히 닿아 밝기가 줄어든 구간입니다.'],
 ['Local color','양쪽 구에는 같은 청색 재료를 썼어요. 오른쪽은 조명색만 따뜻하게 바꾸었습니다. 재료에 지정한 색과 실제 눈에 보이는 색을 구분해 보세요.'],
 ['Value','같은 사진을 오른쪽에서는 흑백으로 바꿨어요. 색상 정보가 사라져도 이마·눈 주위·머리카락 사이의 밝기 차이는 남습니다.'],
 ['Key light','화면 오른쪽의 주광이 얼굴의 큰 명암을 만듭니다. 촬영자는 화면 왼쪽에 절반 세기의 보조광을 두어 반대편 볼에도 피부와 수염의 결이 남게 했습니다.'],
 ['Fill light','두 예시의 왼쪽 주광은 같아요. 오른쪽 예시에서만 반대편 보조광을 켜니, 구의 어두운 쪽이 밝아지고 양쪽의 대비가 줄어듭니다.'],
 ['Diffuse reflection','금색 화살표는 한 지점으로 들어오는 빛, 푸른 화살표는 그 지점에서 여러 방향으로 나가는 빛이에요. 무광 표면이 여러 시점에서 보이는 이유입니다.'],
 ['Bounce light','왼쪽에서는 그림자 속 물체가 매우 어둡습니다. 오른쪽에서는 벽과 바닥에서 빛이 되돌아와 상자 옆면이 밝아지고 뒤쪽 벽에 붉고 초록빛인 기운이 번집니다.',['직접광만','면 사이의 반사광 포함']],
 ['Umbra','받는 면의 표시점에서 광원의 위·가운데·아래로 향하는 모든 경로가 가림판에 막혀요. 이 광원의 어느 부분도 직접 볼 수 없는 영역이 본그림자입니다.'],
 ['Specular highlight','앞쪽 노란 구의 왼쪽 위에 있는 작고 밝은 흰 점을 보세요. 구 전체에 넓게 퍼진 노란 밝기와 달리, 광원이 표면에 반사되어 생긴 반짝임입니다.'],
 ['Ambient light','두 그림 모두 왼쪽 위에서 같은 주광을 비췄습니다. 오른쪽에서 여러 방향의 환경광을 늘리면 구의 어두운 면까지 전반적으로 밝아집니다.']
];
const credits={"4": ["Philip Rideout", "Ambient Occlusion.PNG", "https://commons.wikimedia.org/wiki/File:Ambient_Occlusion.PNG", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/", "WebP 변환"], "5": ["David Ball", "Backlight-wedding.jpg", "https://commons.wikimedia.org/wiki/File:Backlight-wedding.jpg", "Attribution", "https://commons.wikimedia.org/wiki/File:Backlight-wedding.jpg#Licensing", "WebP 변환"], "10": ["Robert Judge", "Portrait with simple three-point lighting, by Robert Judge.jpg", "https://commons.wikimedia.org/wiki/File:Portrait_with_simple_three-point_lighting,_by_Robert_Judge.jpg", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0/", "WebP 변환"], "13": ["Paul Johnston", "Cornell Box With and Without Radiosity Enabled.gif", "https://commons.wikimedia.org/wiki/File:Cornell_Box_With_and_Without_Radiosity_Enabled.gif", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/", "두 프레임 발췌·병치, WebP 변환"], "15": ["Reedbeta", "Specular highlight.jpg", "https://commons.wikimedia.org/wiki/File:Specular_highlight.jpg", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/", "WebP 변환"], "6": ["NASA", "Eileen Collins", "https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut", "Public domain", "https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut", "얼굴 부분 발췌 · 명도 비교용 변환"], "9": ["NASA", "Eileen Collins", "https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut", "Public domain", "https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut", "얼굴 부분 발췌 · 명도 비교용 변환"]};
function credit(i){
 const info=credits[i];
 if(!info)return '<p class="diagram-credit">작업실 제작 · 원리 도해</p>';
 const [author,work,url,license,terms,changes]=info;
 return '<p class="diagram-credit">'+author+' · <a href="'+url+'" target="_blank" rel="noopener">'+work+'</a> · <a href="'+terms+'" target="_blank" rel="noopener">'+license+'</a> · '+changes+'</p>';
}
const eclipse='<details class="extra-reference"><summary>실제 적용 도해 · 일식의 그림자</summary><img src="./assets/glossary/eclipse.webp" alt="광원과 가림 물체 뒤의 Umbra 및 Penumbra 영역을 나타낸 천문 도해"><p>Umbra는 광원이 모두 가려지는 중심 영역, Penumbra는 일부만 가려지는 주변 영역입니다.</p><p class="diagram-credit">Qarnos · <a target="_blank" rel="noopener" href="https://commons.wikimedia.org/wiki/File:Diagram_of_umbra,_penumbra_%26_antumbra.png">원본 도해</a> · Public domain · WebP 변환</p></details>';
let selected=0;
export function renderGlossary(root){
 const [name,definition]=glossary[selected], [english,caption,labels=[]]=references[selected];
 const title=name.split(' · ')[0];
 root.innerHTML='<aside class="term-index" aria-label="용어 선택">'+glossary.map(([t],i)=>'<button aria-pressed="'+(i===selected)+'" data-term="'+i+'">'+t.split(' · ')[0]+'</button>').join('')+'</aside><article class="term-article"><p class="tiny">'+english+'</p><h2>'+title+'</h2><p class="term-definition">'+definition+'</p><figure><div class="term-image '+(labels.length?'pair-image':'')+'"><img src="./assets/glossary/'+selected+'.webp" alt="'+caption+'">'+'</div>'+(labels.length?'<div class="term-labels"><span>'+labels[0]+'</span><span>'+labels[1]+'</span></div>':'')+'<figcaption>'+caption+'</figcaption></figure>'+credit(selected)+([3,14].includes(selected)?eclipse:'')+'</article>';
 root.querySelectorAll('[data-term]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.term);renderGlossary(root);root.querySelector('[data-term="'+selected+'"]').focus({preventScroll:true});});
}
