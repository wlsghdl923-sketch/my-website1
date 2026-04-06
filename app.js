/* ══ 비밀번호 게이트 ══ */
// ── 비밀번호 설정 ──
// 비밀번호를 바꾸려면 아래 함수를 브라우저 콘솔에서 실행하세요:
//   sha256('새비밀번호').then(h => console.log(h))
// 출력된 해시값을 PW_HASH에 붙여넣으면 됩니다.
const PW_HASH = '6052b7bf03f917d9c650e6db43da12ec04d7751a2394e8d00c184a8605bac1c9';

async function sha256(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function checkPassword(){
  const input = document.getElementById('pwInput').value;
  if(!input){document.getElementById('pwError').textContent='비밀번호를 입력해주세요.';document.getElementById('pwInput').classList.add('error');return;}
  
  // 공유 비밀번호 모드 — 공유 비밀번호만 허용, 기본 비밀번호 차단
  if(window._sharePassword){
    if(input === window._sharePassword){
      sessionStorage.setItem('pw_auth','1');
      unlockPage();
      return;
    }
    // 기본 비밀번호는 차단 (공유 비밀번호 전용 모드)
    document.getElementById('pwError').textContent='비밀번호가 틀렸습니다.';
    document.getElementById('pwInput').classList.add('error');
    document.getElementById('pwInput').value='';
    document.getElementById('pwInput').focus();
    setTimeout(()=>document.getElementById('pwInput').classList.remove('error'),400);
    return;
  }
  
  // 일반 모드 — 기본 비밀번호 체크
  const hash = await sha256(input);
  if(hash === PW_HASH){
    sessionStorage.setItem('pw_auth','1');
    unlockPage();
  } else {
    document.getElementById('pwError').textContent='비밀번호가 틀렸습니다.';
    document.getElementById('pwInput').classList.add('error');
    document.getElementById('pwInput').value='';
    document.getElementById('pwInput').focus();
    setTimeout(()=>document.getElementById('pwInput').classList.remove('error'),400);
  }
}

function unlockPage(){
  document.body.classList.remove('locked');
  document.getElementById('passwordGate').classList.add('hidden');
}

function togglePwVisibility(){
  const inp=document.getElementById('pwInput');
  inp.type = inp.type==='password'?'text':'password';
  document.getElementById('pwToggle').textContent = inp.type==='password'?'👁':'🙈';
}

// Enter 키 지원
document.getElementById('pwInput').addEventListener('keydown',e=>{if(e.key==='Enter')checkPassword();});
// 입력 시 에러 초기화
document.getElementById('pwInput').addEventListener('input',()=>{document.getElementById('pwError').textContent='';document.getElementById('pwInput').classList.remove('error');});

// 세션 내 이미 인증된 경우 바로 통과
if(sessionStorage.getItem('pw_auth')==='1'){unlockPage();}
else{
  // 공유 링크: open=1이면 비밀번호 없이 바로 통과
  const _urlP = new URLSearchParams(window.location.search);
  if(_urlP.get('open')==='1' && _urlP.get('share')==='1'){
    unlockPage();
  }
  // 공유 링크: spw 파라미터가 있으면 별도 비밀번호 모드
  else if(_urlP.get('spw') && _urlP.get('share')==='1'){
    window._sharePassword = _urlP.get('spw');
    document.getElementById('pwSub').textContent = '이 문서는 공유 비밀번호로 보호되어 있습니다.';
    document.getElementById('pwInput').focus();
  }
  else{
    document.getElementById('pwInput').focus();
  }
}

/* ══════════════════════════════════════════
   SUPABASE 설정 — 아래 두 값을 본인 것으로 교체
   ══════════════════════════════════════════ */
const SUPABASE_URL = 'https://pvhydrnhxebvmeoicgno.supabase.co';       // 예: https://abcdefgh.supabase.co
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2aHlkcm5oeGVidm1lb2ljZ25vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTc1NjEsImV4cCI6MjA4OTA3MzU2MX0.FuxaqFgv489aFHgir-KmywsJ3WsZsxLnLp3EXeUvc6E';  // 예: eyJhbGci...

/* ══ SUPABASE 순수 REST API (SDK 없음, DataCloneError 없음) ══ */
async function _sbFetch(method, path, body){
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': method==='POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal'
  };
  const opts = { method, headers };
  if(body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(SUPABASE_URL + path, opts);
  if(!r.ok){
    const t = await r.text().catch(()=>'');
    throw new Error('HTTP ' + r.status + (t ? ': '+t.slice(0,120) : ''));
  }
  const ct = r.headers.get('content-type')||'';
  if(ct.includes('application/json') && r.status !== 204){
    return r.json();
  }
  return null;
}

const _sbRest = {
  async select(table){
    const rows = await _sbFetch('GET', '/rest/v1/'+table+'?select=key,value&order=key');
    return rows || [];
  },
  async upsert(table, row){
    await _sbFetch('POST', '/rest/v1/'+table, row);
  },
  async delete(table, key){
    await _sbFetch('DELETE', '/rest/v1/'+table+'?key=eq.'+encodeURIComponent(key));
  },
  async selectOne(table, key){
    const rows = await _sbFetch('GET', '/rest/v1/'+table+'?key=eq.'+encodeURIComponent(key)+'&select=value&limit=1');
    return (rows && rows.length > 0) ? rows[0] : null;
  },
  storage: {
    async upload(bucket, path, blob){
      const r = await fetch(SUPABASE_URL+'/storage/v1/object/'+bucket+'/'+path, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'x-upsert': 'true'
        },
        body: blob
      });
      if(!r.ok){ const t=await r.text().catch(()=>''); throw new Error('Storage HTTP '+r.status+(t?': '+t.slice(0,80):'')); }
      return {error:null};
    },
    getPublicUrl(bucket, path){
      return {data:{publicUrl: SUPABASE_URL+'/storage/v1/object/public/'+bucket+'/'+path}};
    }
  }
};

/* ══ 유틸리티 ══ */
function uid(){return '_'+Math.random().toString(36).slice(2,9);}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}

/* ══ localStorage 완전 비사용 — Supabase 단일 소스 ══ */
function ls(k,d){return d;}  // 로컬 읽기 비활성화 — 항상 기본값 반환
function ss(k,v){}           // 로컬 쓰기 비활성화 — no-op

/* ══ 기본값 ══ */
const DEF_TABS={
  docs:[{id:'이론',name:'이론'},{id:'데이터',name:'데이터'},{id:'작품',name:'작품'},{id:'자료',name:'자료'}],
  webtoon:[{id:'개인작품',name:'개인 작품'},{id:'팀작품',name:'팀 작품'}]
};
const DEF_CARDS={
  'docs-이론':[],'docs-데이터':[],'docs-작품':[],'docs-자료':[],
  'webtoon-개인작품':[
    {id:'royal',name:'왕의 힘으로 회귀하다',desc:'회귀 판타지',image:'',emoji:'👑'},
    {id:'ragnarok',name:'라그나로크',desc:'액션 웹툰',image:'',emoji:'⚡'},
    {id:'lodoss',name:'로도스도 전기',desc:'중세 판타지',image:'',emoji:'🗡'},
    {id:'demon',name:'마신강림',desc:'다크 판타지',image:'',emoji:'🌑'}
  ],
  'webtoon-팀작품':[]
};
const DEF_CFG={
  logo:'Lee Jih Ho',
  heroTitle:'작업물과 자료를<br><em>한 곳에서</em> 관리합니다',
  heroSub:'웹툰 기획, 문서, 일정을 하나의 허브에서 정리하고 공유하세요.',
  sections:{docs:{ko:'문서',en:'Documents'},webtoon:{ko:'웹툰 작품',en:'Webtoon'}}
};
const DEF_COLORS={logo:'#191F28',heroBg1:'#ffffff',heroBg2:'#FFF0F2',heroTitle:'#191F28',heroEm:'#D91F3E',heroSub:'#4E5968'};

/* ══ 실시간 데이터 (초기값: 기본값, 로드 후 Supabase 데이터로 교체) ══ */
let TABS     = ls('hub_tabs',    DEF_TABS);
let CARDS    = ls('hub_cards',   DEF_CARDS);
let CARD_DOCS= ls('hub_cdocs',   {});
let EVENTS   = ls('hub_events',  []);
let SPECIALS = ls('hub_specials',[]);
let PRESETS  = ls('hub_presets', []);
let CAL_NAME = ls('hub_cal_name','캘린더');
let ACTIVE   = ls('hub_active',  {docs:'이론',webtoon:'개인작품'});
let CFG      = ls('hub_cfg',     DEF_CFG);
let COLORS   = ls('hub_colors',  DEF_COLORS);
let CAL_DOC_CFG = {}; // Supabase에서 로드됨
let CAL_CFG = {defaultView:'m',todayColor:'#2E9E50',holidayColor:'#E84060',defaultColor:'#D91F3E'};
const DEF_PROCESSES_DEFAULT=['스토리기획','콘티','선화','채색','교정','식자편집','로컬','납품','연재','런칭프로모션','연참 및 팝업배너'];
let PROCESSES = [...DEF_PROCESSES_DEFAULT]; // Supabase 로드 후 교체됨
let ASSIGNEE_SETS = []; // Supabase 로드 후 채워짐
let CAL_DISPLAY = {labelMode:'task'}; // Supabase 로드 후 채워짐
let PD_ORDER = {}; // {docs:['PD이름1','PD이름2',...], webtoon:[...]} Supabase 로드 후 채워짐

/* ══ Supabase에 데이터 저장 ══ */
/* ══ Supabase 저장 상태 관리 ══ */
let _sbFailCount=0;
let _sbPendingRetry=null;
function _setSbStatus(state,msg){
  const badge=document.getElementById('sbStatusBadge');
  const text=document.getElementById('sbStatusText');
  if(!badge||!text)return;
  badge.className='sb-status '+state;
  text.textContent=msg;
  badge.title=state==='error'?'클릭하여 재저장 시도':'Supabase 서버 저장 상태';
}
function handleSbStatusClick(){
  const badge=document.getElementById('sbStatusBadge');
  if(badge&&badge.classList.contains('error')){
    toast('Supabase 재저장 시도 중...');
    saveAll();
  }
}

async function _sbSet(key, value){
  _localSave(key, value);
  try{
    await _sbRest.upsert('site_data', {key, value, updated_at: new Date().toISOString()});
    return {ok:true};
  }catch(e){
    console.error('Supabase 저장 실패 ['+key+']: '+((e&&e.message)||String(e)));
    _sbFailCount++;
    return {ok:false, error:(e&&e.message)||'저장 오류'};
  }
}

/* ══ Supabase Storage 이미지 업로드 (직접 REST fetch) ══ */
async function _uploadImgToStorage(dataUrl, pathHint){
  try{
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const filePath = pathHint || 'uploads/'+uid()+'_'+Date.now()+'.'+ext;
    await _sbRest.storage.upload('images', filePath, blob);
    const {data} = _sbRest.storage.getPublicUrl('images', filePath);
    return data.publicUrl;
  }catch(e){
    console.error('Storage 업로드 실패: '+((e&&e.message)||String(e)));
    return dataUrl;
  }
}

/* localStorage 비사용 — Supabase 단일 소스 */
function _localSave(key, value){} // no-op

/* ══ 전체 저장 ══ */
let _lastSaveTs=0;

async function saveAll(){
  _lastSaveTs=Date.now();
  _sbFailCount=0;
  _setSbStatus('saving','저장 중...');

  // 모든 변수가 최상단에 선언되므로 undefined 체크 불필요
  const saves=[
    _sbSet('hub_tabs',        TABS),
    _sbSet('hub_cards',       CARDS),
    _sbSet('hub_cdocs',       CARD_DOCS),
    _sbSet('hub_events',      EVENTS),
    _sbSet('hub_specials',    SPECIALS),
    _sbSet('hub_presets',     PRESETS),
    _sbSet('hub_cal_name',    CAL_NAME),
    _sbSet('hub_active',      ACTIVE),
    _sbSet('hub_cfg',         CFG),
    _sbSet('hub_colors',      COLORS),
    _sbSet('hub_processes',   PROCESSES),
    _sbSet('hub_assignee_sets', ASSIGNEE_SETS),
    _sbSet('hub_cal_display', CAL_DISPLAY),
    _sbSet('hub_cal_cfg',     CAL_CFG),
    _sbSet('hub_cal_doc_cfg', CAL_DOC_CFG),
    _sbSet('hub_pd_order',    PD_ORDER),
  ];

  const results = await Promise.allSettled(saves);
  const failedResults = results.filter(r=>r.status==='rejected'||(r.value&&!r.value.ok));
  const failed = failedResults.length + _sbFailCount;

  if(failed>0){
    _setSbStatus('error',`저장 실패 (클릭 재시도)`);
    console.warn(`Supabase 저장 실패 ${failed}건 — 로컬에 임시 저장됨`);
  }else{
    _setSbStatus('saved','서버 저장 완료');
    // 3초 후 상태 메시지 축약
    setTimeout(()=>{
      const b=document.getElementById('sbStatusBadge');
      if(b&&b.classList.contains('saved')){
        document.getElementById('sbStatusText').textContent='저장됨';
      }
    },3000);
  }
}

/* ══ Supabase에서 모든 데이터 불러오기 ══ */
function _applyMap(map){
  if(map['hub_tabs'])        { TABS=map['hub_tabs'];               ss('hub_tabs',TABS); }
  if(map['hub_cards'])       { CARDS=map['hub_cards'];             ss('hub_cards',CARDS); }
  if(map['hub_cdocs'])       { CARD_DOCS=map['hub_cdocs'];         ss('hub_cdocs',CARD_DOCS); }
  if(map['hub_events'])      { EVENTS=map['hub_events'];           ss('hub_events',EVENTS); }
  if(map['hub_specials'])    { SPECIALS=map['hub_specials'];        ss('hub_specials',SPECIALS); }
  if(map['hub_presets'])     { PRESETS=map['hub_presets'];         ss('hub_presets',PRESETS); }
  if(map['hub_cal_name'])    { CAL_NAME=map['hub_cal_name'];       ss('hub_cal_name',CAL_NAME); }
  if(map['hub_active'])      { ACTIVE=map['hub_active'];           ss('hub_active',ACTIVE); }
  if(map['hub_cfg'])         { CFG=map['hub_cfg'];                 ss('hub_cfg',CFG); }
  if(map['hub_colors'])      { COLORS=map['hub_colors'];           ss('hub_colors',COLORS); }
  if(map['hub_cal_cfg'])     { CAL_CFG=map['hub_cal_cfg'];         ss('hub_cal_cfg',CAL_CFG); }
  if(map['hub_cal_doc_cfg']) { CAL_DOC_CFG=map['hub_cal_doc_cfg']; ss('hub_cal_doc_cfg',CAL_DOC_CFG); }
  if(map['hub_processes'])   { PROCESSES=map['hub_processes'];      ss('hub_processes',PROCESSES); }
  if(map['hub_assignee_sets']){ ASSIGNEE_SETS=map['hub_assignee_sets']; ss('hub_assignee_sets',ASSIGNEE_SETS); }
  if(map['hub_cal_display'])  { CAL_DISPLAY=map['hub_cal_display'];   ss('hub_cal_display',CAL_DISPLAY); }
  if(map['hub_pd_order'])     { PD_ORDER=map['hub_pd_order'];         ss('hub_pd_order',PD_ORDER); }
  // hub_doc_* 개별 문서 콘텐츠 복원 (HTML/richtext/calendar=문자열, gallery/refdoc=객체)
  Object.keys(map).forEach(k=>{
    if(k.startsWith('hub_doc_')){
      const v=map[k];
      _localSave(k, v);  // 문자열은 raw, 객체는 JSON.stringify
    }
  });
}

/* 로컬 캐시가 있으면 즉시 반환 (로딩 화면 없음)
   없으면 Supabase 대기 후 반환 */
async function initData(){
  // localStorage 완전 비사용 — 매 접속마다 Supabase에서 로드
  const overlay = document.getElementById('loadingOverlay');
  if(overlay) overlay.style.display='flex';
  _setSbStatus('saving','서버에서 불러오는 중...');
  try{
    const rows = await _sbRest.select('site_data');
    if(rows && rows.length > 0){
      const map={};
      rows.forEach(row=>map[row.key]=row.value);
      _applyMap(map);
      // 코드 하단에서 선언되던 변수들도 여기서 명시적으로 복원
      if(map['hub_cal_cfg'])     { CAL_CFG=map['hub_cal_cfg'];         applyCalCfg(); }
      if(map['hub_cal_doc_cfg']) { CAL_DOC_CFG=map['hub_cal_doc_cfg']; }
      if(map['hub_processes'])   { PROCESSES=map['hub_processes']; }
      if(map['hub_assignee_sets']){ ASSIGNEE_SETS=map['hub_assignee_sets']; }
      if(map['hub_cal_display']) { CAL_DISPLAY=map['hub_cal_display']; }
      if(map['hub_pd_order'])    { PD_ORDER=map['hub_pd_order']; }
      if(typeof applyColors==='function') applyColors();
      if(typeof applyConfig==='function') applyConfig();
    }
    _setSbStatus('saved','저장됨');
  }catch(e){
    _setSbStatus('error','서버 연결 오류 (클릭 재시도)');
    console.warn('초기 로드 실패: '+((e&&e.message)||String(e)));
  }
  if(overlay) overlay.style.display='none';
}

/* ══ 공유 모드 ══ */
const IS_SHARE = new URLSearchParams(window.location.search).get('share') === '1';
if(IS_SHARE){
  document.getElementById('mainSite').style.display='none';
  document.getElementById('dvBack').style.display='none';
  document.querySelectorAll('.dv-back,.cdv-nav .dv-back').forEach(b=>b.style.display='none');
}

let _shareBaseUrl = ''; // 공유 팝업에서 사용할 기본 URL

function shareCurrentUrl(){
  // 현재 페이지 URL 기반 공유 팝업
  const url=new URL(window.location.href);
  url.searchParams.set('share','1');
  _shareBaseUrl = url.toString();
  _openSharePop();
}
function copyFb(text){const t=document.createElement('input');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);toast('공유 링크가 복사되었습니다.');}

/* ══ COLORS ══ */
function applyColors(){
  const c=COLORS, r=document.documentElement.style;
  r.setProperty('--logo-color',   c.logo);
  r.setProperty('--hero-bg1',     c.heroBg1);
  r.setProperty('--hero-bg2',     c.heroBg2);
  r.setProperty('--hero-title-color', c.heroTitle);
  r.setProperty('--hero-em-color',c.heroEm);
  r.setProperty('--hero-sub-color',c.heroSub);
}
function syncClrText(pickerId,textId){document.getElementById(textId).value=document.getElementById(pickerId).value;}
function syncClrPicker(textId,pickerId){const v=document.getElementById(textId).value;if(/^#[0-9A-Fa-f]{6}$/.test(v))document.getElementById(pickerId).value=v;}
function resetColors(){COLORS={...DEF_COLORS};applyColors();loadColorFields();toast('색상이 초기화되었습니다.');}
function saveColors(){
  COLORS={
    logo:document.getElementById('clrLogo').value,
    heroBg1:document.getElementById('clrHBg1').value,
    heroBg2:document.getElementById('clrHBg2').value,
    heroTitle:document.getElementById('clrHTitle').value,
    heroEm:document.getElementById('clrHEm').value,
    heroSub:document.getElementById('clrHSub').value
  };
  saveAll();applyColors();toast('색상이 저장되었습니다.');
}
function loadColorFields(){
  [['clrLogo','clrLogoTxt','logo'],['clrHBg1','clrHBg1Txt','heroBg1'],['clrHBg2','clrHBg2Txt','heroBg2'],
   ['clrHTitle','clrHTitleTxt','heroTitle'],['clrHEm','clrHEmTxt','heroEm'],['clrHSub','clrHSubTxt','heroSub']]
  .forEach(([pId,tId,key])=>{document.getElementById(pId).value=COLORS[key];document.getElementById(tId).value=COLORS[key];});
}

/* ══ CONFIG ══ */
function applyConfig(){
  document.getElementById('navLogo').textContent=CFG.logo;
  document.getElementById('footerLogo').textContent=CFG.logo;
  document.getElementById('heroTitle').innerHTML=CFG.heroTitle;
  document.getElementById('heroSub').textContent=CFG.heroSub;
  document.title=CFG.logo;
  ['docs','webtoon'].forEach(g=>{
    const s=CFG.sections[g];
    document.getElementById(`${g}ST`).textContent=s.ko;
    const badge=document.getElementById(`${g}SB`);
    badge.textContent=s.en;badge.style.display=s.en?'':'none';
    document.getElementById(`nav${g.charAt(0).toUpperCase()+g.slice(1)}`).textContent=s.ko;
  });
}

/* ══ SITE SETTINGS MODAL ══ */
function openSiteSettings(){
  document.getElementById('cfgLogo').value=CFG.logo;
  document.getElementById('cfgTitle').value=CFG.heroTitle;
  document.getElementById('cfgSub').value=CFG.heroSub;
  loadColorFields();siteTab('general');
  document.getElementById('siteSettingsOverlay').classList.add('open');
}
function closeSiteSettings(){document.getElementById('siteSettingsOverlay').classList.remove('open');}
function siteTab(id){
  document.querySelectorAll('#siteSettingsOverlay .m-stab').forEach((b,i)=>b.classList.toggle('active',['general','colors','backup'][i]===id));
  document.querySelectorAll('#siteSettingsOverlay .m-sp').forEach(p=>p.classList.toggle('active',p.id===`sts-${id}`));
}

/* ════════════════════════════════════════════════════════
   자동저장 (Auto-Save)
   - 기존 문서(_reEditDocId 있을 때)만 활성화
   - 편집 후 2초 debounce → Supabase upsert
   - 상태: 대기 / 변경됨 / 저장중... / 저장됨✓ / 실패
════════════════════════════════════════════════════════ */
let _asTimer = null;
let _asActive = false;
let _asLastSaveTime = null;
let _asPendingTime = null;
let _asCountdownTimer = null;

function _asSetUI(state) {
  const el  = document.getElementById('autoSaveStatus');
  const txt = document.getElementById('autoSaveText');
  if (!el) return;
  el.className = '';
  clearInterval(_asCountdownTimer);
  switch(state) {
    case 'idle':
      el.classList.add('as-idle');
      if(txt) txt.textContent = '대기';
      el.title = _asLastSaveTime
        ? `마지막 저장: ${_asLastSaveTime.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`
        : '자동저장 대기 중';
      break;
    case 'pending':
      el.classList.add('as-pending');
      _asPendingTime = Date.now();
      if(txt) txt.textContent = '2초 후 저장';
      el.title = '내용 변경 감지 — 2초 후 자동저장됩니다';
      // 카운트다운 표시
      _asCountdownTimer = setInterval(() => {
        const remain = Math.max(0, 2000 - (Date.now() - _asPendingTime));
        if (remain <= 0) { clearInterval(_asCountdownTimer); return; }
        if(txt) txt.textContent = `${(remain/1000).toFixed(1)}초 후 저장`;
      }, 100);
      break;
    case 'saving':
      el.classList.add('as-saving');
      if(txt) txt.textContent = '저장중...';
      el.title = '서버에 저장하는 중...';
      break;
    case 'saved':
      el.classList.add('as-saved');
      _asLastSaveTime = new Date();
      if(txt) txt.textContent = '저장완료';
      el.title = `저장 완료: ${_asLastSaveTime.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
      setTimeout(() => _asSetUI('idle'), 3000);
      break;
    case 'error':
      el.classList.add('as-error');
      if(txt) txt.textContent = '저장실패';
      el.title = '저장에 실패했습니다. 클릭하여 재시도';
      break;
  }
}

// 자동저장 상태 클릭 시 정보 표시 / 에러 시 재시도
document.addEventListener('click', e => {
  const el = e.target.closest('#autoSaveStatus');
  if (!el) return;
  if (el.classList.contains('as-error')) {
    // 에러 상태면 재시도
    _asSchedule();
    toast('저장을 재시도합니다...');
  } else {
    const msg = _asLastSaveTime
      ? `마지막 저장: ${_asLastSaveTime.toLocaleTimeString('ko-KR')}` + (_asActive ? '\n자동저장 활성화됨 (2초 간격)' : '')
      : '아직 저장된 적 없습니다.' + (_asActive ? '\n내용을 입력하면 2초 후 자동저장됩니다.' : '\n새 문서는 저장 버튼을 눌러주세요.');
    toast(msg);
  }
});

function _asSchedule() {
  if (!_asActive || !_reEditDocId) return;
  clearTimeout(_asTimer);
  _asSetUI('pending');
  _asTimer = setTimeout(async () => {
    const title   = document.getElementById('reTitle')?.value?.trim();
    const content = document.getElementById('reEditor')?.innerHTML;
    if (!title || !content) return;
    _asSetUI('saving');
    try {
      const d = (CARD_DOCS[_curCard] || []).find(x => x.id === _reEditDocId);
      if (d) d.title = title;
      await _sbRest.upsert('site_data', {
        key: `hub_doc_${_reEditDocId}`,
        value: content,
        updated_at: new Date().toISOString()
      });
      _asSetUI('saved');
      _reDirty = false;
    } catch(e) {
      console.warn('자동저장 실패:', e);
      _asSetUI('error');
    }
  }, 2000);
}

/* ════════════════════════════════════════════════════════
   패널 토글
════════════════════════════════════════════════════════ */
let _rePanelsOn = false;

function reTogglePanels() {
  _rePanelsOn = !_rePanelsOn;
  const lp  = document.getElementById('reMarkerPanel');
  const rp  = document.getElementById('reMemoPanel');
  const btn = document.getElementById('btnTogglePanels');
  const lh  = document.getElementById('reResizeLeft');
  const rh  = document.getElementById('reResizeRight');
  if (lp)  lp.style.display  = _rePanelsOn ? 'block' : 'none';
  if (rp)  rp.style.display  = _rePanelsOn ? 'block' : 'none';
  if (lh)  lh.style.display  = _rePanelsOn ? 'block' : 'none';
  if (rh)  rh.style.display  = _rePanelsOn ? 'block' : 'none';
  if (btn) btn.classList.toggle('panels-on', _rePanelsOn);
  if (_rePanelsOn) refreshMemoPanel();
}

/* ── 패널 리사이즈 드래그 ── */
let _reResizeSide = null;
let _reResizeStartX = 0;
let _reResizeStartW = 0;

function reStartResize(e, side) {
  e.preventDefault();
  _reResizeSide = side;
  _reResizeStartX = e.clientX;
  const panel = side === 'left'
    ? document.getElementById('reMarkerPanel')
    : document.getElementById('reMemoPanel');
  if (!panel) return;
  _reResizeStartW = panel.offsetWidth;
  document.getElementById(side === 'left' ? 'reResizeLeft' : 'reResizeRight')?.classList.add('active');
  document.addEventListener('mousemove', _reOnResizeMove);
  document.addEventListener('mouseup', _reOnResizeEnd);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}
function _reOnResizeMove(e) {
  if (!_reResizeSide) return;
  const dx = e.clientX - _reResizeStartX;
  const panel = _reResizeSide === 'left'
    ? document.getElementById('reMarkerPanel')
    : document.getElementById('reMemoPanel');
  if (!panel) return;
  const newW = _reResizeSide === 'left'
    ? _reResizeStartW + dx
    : _reResizeStartW - dx;
  const min = parseInt(panel.style.minWidth) || 100;
  const max = parseInt(panel.style.maxWidth) || 450;
  panel.style.width = Math.max(min, Math.min(max, newW)) + 'px';
}
function _reOnResizeEnd() {
  document.getElementById('reResizeLeft')?.classList.remove('active');
  document.getElementById('reResizeRight')?.classList.remove('active');
  document.removeEventListener('mousemove', _reOnResizeMove);
  document.removeEventListener('mouseup', _reOnResizeEnd);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  _reResizeSide = null;
}

/* ════════════════════════════════════════════════════════
   메모 시스템
════════════════════════════════════════════════════════ */
const MEMO_COLORS = [
  '#F44336','#E91E63','#FF9800','#FFC107','#FFEB3B',
  '#8BC34A','#4CAF50','#009688','#00BCD4','#2196F3',
  '#3F51B5','#9C27B0','#795548','#607D8B','#000000',
  '#FF5722','#FF4081','#FFAB00','#69F0AE','#40C4FF',
  '#536DFE','#E040FB','#BCAAA4','#90A4AE','#BDBDBD',
  '#B71C1C','#880E4F','#E65100','#33691E','#006064',
  '#1A237E','#4A148C','#3E2723','#263238','#424242',
];

let _memos          = [];
let _markerPresets  = [];   // {color, name}
let _contentPresets = [];   // string[]
let _memoCtxRange   = null;
let _memoEditId     = null;
let _ctxMenuBound   = false;

/* Supabase 프리셋 로드/저장 */
async function _loadMemoPresets() {
  try {
    const r1 = await _sbRest.selectOne('site_data','hub_memo_markers');
    if (r1?.value) {
      let v = r1.value;
      if (typeof v === 'string') try { v = JSON.parse(v); } catch(e) {}
      if (Array.isArray(v)) _markerPresets = v;
    }
    const r2 = await _sbRest.selectOne('site_data','hub_memo_contents');
    if (r2?.value) {
      let v = r2.value;
      if (typeof v === 'string') try { v = JSON.parse(v); } catch(e) {}
      if (Array.isArray(v)) _contentPresets = v;
    }
  } catch(e) { console.warn('메모 프리셋 로드 실패:', e); }
}

async function _saveMemoPresets() {
  try {
    await _sbRest.upsert('site_data',{key:'hub_memo_markers',  value:_markerPresets,  updated_at:new Date().toISOString()});
    await _sbRest.upsert('site_data',{key:'hub_memo_contents', value:_contentPresets, updated_at:new Date().toISOString()});
  } catch(e) { console.warn('프리셋 저장 실패:', e); }
}

/* 우클릭 컨텍스트 메뉴 */
function _bindCtxMenu() {
  if (_ctxMenuBound) return;
  _ctxMenuBound = true;

  const editor = document.getElementById('reEditor');
  if (!editor) return;

  /* 에디터 우클릭 → 표 안이면 표 메뉴, 아니면 메모 메뉴 */
  editor.addEventListener('contextmenu', function(e) {
    _hideCtxMenu();
    const tblMenu = document.getElementById('tblCtxMenu');
    if(tblMenu) tblMenu.style.display = 'none';

    const td = e.target.closest('td,th');
    if (td && td.closest('.re-editor')) {
      // 표 셀 우클릭 → 표 전용 메뉴
      e.preventDefault();
      _lastCtxTd = td;
      // 선택된 텍스트가 있으면 메모용 range 저장
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        _memoCtxRange = sel.getRangeAt(0).cloneRange();
      }
      if(tblMenu) {
        tblMenu.style.display = 'block';
        tblMenu.style.left = Math.min(e.clientX, window.innerWidth - 195) + 'px';
        tblMenu.style.top = Math.min(e.clientY, window.innerHeight - 340) + 'px';
      }
      return;
    }

    // 일반 텍스트 우클릭 → 메모 메뉴
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      return;
    }
    e.preventDefault();
    _memoCtxRange = sel.getRangeAt(0).cloneRange();
    const menu = document.getElementById('memoCtxMenu');
    if (!menu) return;
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 155) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 55) + 'px';
  });

  /* 어디든 클릭 → 메뉴 닫기 */
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#memoCtxMenu')) _hideCtxMenu();
    if (!e.target.closest('#tblCtxMenu')) {
      const m = document.getElementById('tblCtxMenu');
      if (m) m.style.display = 'none';
    }
  });
}

function _hideCtxMenu() {
  const m = document.getElementById('memoCtxMenu');
  if (m) m.style.display = 'none';
}

/* 표 내 메모 추가 */
function tblCtxMemo() {
  const menu = document.getElementById('tblCtxMenu');
  if (menu) menu.style.display = 'none';
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.toString().trim()) {
    _memoCtxRange = sel.getRangeAt(0).cloneRange();
    memoCtxOpen();
    return;
  }
  // 선택 텍스트 없으면 현재 셀 내용 전체를 선택
  if (_lastCtxTd && _lastCtxTd.textContent.trim()) {
    const range = document.createRange();
    range.selectNodeContents(_lastCtxTd);
    _memoCtxRange = range;
    memoCtxOpen();
    return;
  }
  toast('메모를 추가하려면 셀에 텍스트가 있어야 합니다.');
}

function memoCtxOpen() {
  _hideCtxMenu();
  if (!_memoCtxRange) return;
  const text = _memoCtxRange.toString().trim();
  if (!text) { toast('텍스트를 먼저 드래그하여 선택하세요.'); return; }
  openMemoInput(text, null);
}

/* 메모 입력 팝업 열기 */
async function openMemoInput(selectedText, editId) {
  // 마커 프리셋 자동 로드
  if (!_markerPresets.length && !_contentPresets.length) {
    await _loadMemoPresets();
  }
  _memoEditId = editId || null;
  const existing = editId ? _memos.find(m => m.id === editId) : null;

  document.getElementById('memoInputTitle').textContent = editId ? '📝 메모 수정' : '📝 메모 추가';
  const qel = document.getElementById('memoInputQuote');
  if (qel) qel.textContent = selectedText ? `"${selectedText.slice(0,60)}"` : '';

  document.getElementById('memoMarkerNameInput').value = existing?.markerName || '';

  const selColor = existing?.color || MEMO_COLORS[0];
  const cpEl = document.getElementById('memoColorPicker');
  if (cpEl) {
    cpEl.innerHTML = MEMO_COLORS.map(c => {
      const light = ['#FFEB3B','#BDBDBD','#BCAAA4'].includes(c);
      return `<div class="mc-dot${c===selColor?' sel':''}" style="background:${c};${light?'border-color:#aaa!important;':''}" data-c="${c}" onclick="memoPickColor(this)"></div>`;
    }).join('');
  }

  _renderMemoMarkerChips();
  document.getElementById('memoContentInput').value = existing?.content || '';
  _renderMemoContentChips();

  document.getElementById('memoInputOverlay').style.display = 'block';
  setTimeout(() => document.getElementById('memoMarkerNameInput')?.focus(), 100);
}

function closeMemoInput() {
  document.getElementById('memoInputOverlay').style.display = 'none';
  _memoEditId = null;
}

function memoPickColor(el) {
  document.querySelectorAll('#memoColorPicker .mc-dot').forEach(d => d.classList.remove('sel'));
  el.classList.add('sel');
}
function _getMemoColor() {
  const s = document.querySelector('#memoColorPicker .mc-dot.sel');
  return s ? s.dataset.c : MEMO_COLORS[0];
}

function _renderMemoMarkerChips() {
  const el = document.getElementById('memoMarkerChips'); if (!el) return;
  el.innerHTML = _markerPresets.map(p =>
    `<span class="memo-chip" onclick="memoApplyMarker('${p.color}','${encodeURIComponent(p.name)}')">`+
    `<span class="memo-chip-dot" style="background:${p.color};"></span>${p.name}</span>`
  ).join('');
}
function memoApplyMarker(color, enc) {
  const name = decodeURIComponent(enc);
  document.querySelectorAll('#memoColorPicker .mc-dot').forEach(d => d.classList.toggle('sel', d.dataset.c === color));
  document.getElementById('memoMarkerNameInput').value = name;
}
function _renderMemoContentChips() {
  const el = document.getElementById('memoContentChips'); if (!el) return;
  el.innerHTML = _contentPresets.map(c =>
    `<span class="memo-chip" onclick="document.getElementById('memoContentInput').value=unescape('${escape(c)}')">${c.slice(0,14)}</span>`
  ).join('');
}

/* 저장 */
function saveMemoInput() {
  const color      = _getMemoColor();
  const markerName = document.getElementById('memoMarkerNameInput')?.value?.trim() || '';
  const content    = document.getElementById('memoContentInput')?.value?.trim()    || '';

  /* 수정 모드 */
  if (_memoEditId) {
    const m = _memos.find(x => x.id === _memoEditId);
    if (m) {
      m.color = color; m.markerName = markerName; m.content = content;
      if (m.spanEl) {
        m.spanEl.style.background      = _hexA(color, .38);
        m.spanEl.style.borderBottomColor = color;
      }
    }
    closeMemoInput(); refreshMemoPanel(); return;
  }

  /* 신규 삽입 */
  if (!_memoCtxRange) { closeMemoInput(); return; }
  const text = _memoCtxRange.toString().trim();
  if (!text) { toast('선택한 텍스트가 없습니다.'); closeMemoInput(); return; }

  const id      = 'm' + Date.now();
  const now     = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  try {
    /* 선택 영역의 모든 텍스트 노드를 수집 */
    const _getTextNodesInRange = (range) => {
      const nodes = [];
      const walk = document.createTreeWalker(
        range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT, null
      );
      let node;
      while (node = walk.nextNode()) {
        if (range.intersectsNode(node) && node.textContent.trim()) nodes.push(node);
      }
      return nodes;
    };

    const textNodes = _getTextNodesInRange(_memoCtxRange);
    const spans = [];

    textNodes.forEach((tn, i) => {
      const sp = document.createElement('span');
      sp.className = 're-memo-mark';
      sp.dataset.memoId = id;
      sp.contentEditable = 'false';
      sp.style.cssText = `background:${_hexA(color,.38)};border-bottom:2px solid ${color};border-radius:2px;cursor:pointer;display:inline;`;
      if (i === 0) sp.title = (markerName || '메모') + (content ? ' — ' + content.slice(0,30) : '');
      sp.onclick = e => { e.stopPropagation(); _focusMemo(id); };

      /* 첫/마지막 노드는 range 경계에 맞춰 분할 */
      let target = tn;
      if (tn === _memoCtxRange.startContainer && _memoCtxRange.startOffset > 0) {
        target = tn.splitText(_memoCtxRange.startOffset);
      }
      if (tn === _memoCtxRange.endContainer || target === _memoCtxRange.endContainer) {
        const endNode = (target === _memoCtxRange.endContainer) ? target : tn;
        const offset = (target === _memoCtxRange.endContainer) ? _memoCtxRange.endOffset - (tn !== target ? _memoCtxRange.startOffset : 0) : _memoCtxRange.endOffset;
        if (offset > 0 && offset < endNode.length) endNode.splitText(offset);
        if (endNode !== target) { target = endNode; }
      }

      target.parentNode.insertBefore(sp, target);
      sp.appendChild(target);
      spans.push(sp);
    });

    const mainSpan = spans[0] || null;
    if (mainSpan) {
      const r = document.createRange();
      r.setStartAfter(spans[spans.length - 1]); r.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(r);
    }

    _memos.push({ id, text, color, markerName, content, resolved:false, date:dateStr, spanEl:mainSpan, spanEls:spans });
  } catch(err) {
    console.warn('메모 span 삽입 실패:', err);
    _memos.push({ id, text, color, markerName, content, resolved:false, date:dateStr, spanEl:null });
    toast('텍스트 하이라이트는 단일 블록 내에서 가능합니다. 메모는 패널에 추가됩니다.');
  }

  closeMemoInput(); refreshMemoPanel();
}

function _hexA(hex, a) {
  try {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  } catch { return `rgba(255,213,79,${a})`; }
}

function _focusMemo(id) {
  document.querySelectorAll('.re-memo-mark').forEach(s => s.classList.remove('memo-focus'));
  document.querySelectorAll('.memo-card').forEach(c => c.classList.remove('memo-focus'));
  const sp = document.querySelector(`[data-memo-id="${id}"]`);
  if (sp) { sp.classList.add('memo-focus'); sp.scrollIntoView({behavior:'smooth',block:'center'}); }
  const cd = document.getElementById('mc_' + id);
  if (cd) { cd.classList.add('memo-focus'); cd.scrollIntoView({behavior:'smooth',block:'nearest'}); }
}

/* 패널 갱신 */
function refreshMemoPanel() { _renderMarkerPanel(); _renderMemoPanelList(); }

function _renderMarkerPanel() {
  const tot  = document.getElementById('reMarkerTotal');
  const list = document.getElementById('reMarkerList');
  const stat = document.getElementById('reMarkerStat');
  if (!list) return;

  const total = _memos.length;
  const done  = _memos.filter(m => m.resolved).length;
  if (tot) tot.textContent = `전체 ${total}개`;

  const groups = {};
  _memos.forEach(m => {
    const k = m.color + '|' + (m.markerName || '미분류');
    if (!groups[k]) groups[k] = { color:m.color, name:m.markerName||'미분류', count:0 };
    groups[k].count++;
  });
  list.innerHTML = Object.values(groups).map(g =>
    `<div class="marker-row" onclick="_filterMarker('${g.color}')">
       <div class="marker-row-dot" style="background:${g.color};"></div>
       <div class="marker-row-name">${g.name}</div>
       <div class="marker-row-badge">${g.count}</div>
     </div>`
  ).join('') || '<div style="font-size:.71rem;color:#8B95A1;text-align:center;padding:4px 0;">메모 없음</div>';

  if (stat) stat.innerHTML =
    `<div style="display:flex;justify-content:space-between;"><span>완료</span><span style="color:#2E9E50;font-weight:700;">${done}</span></div>` +
    `<div style="display:flex;justify-content:space-between;"><span>미완료</span><span style="color:#E53935;font-weight:700;">${total-done}</span></div>`;
}

function _filterMarker(color) {
  const first = _memos.find(m => m.color === color && m.spanEl);
  if (first?.spanEl) first.spanEl.scrollIntoView({behavior:'smooth',block:'center'});
}

function _renderMemoPanelList() {
  const el = document.getElementById('reMemoList'); if (!el) return;
  if (!_memos.length) {
    el.innerHTML = '<div style="font-size:.77rem;color:#8B95A1;text-align:center;padding:14px 0;">텍스트를 드래그 후<br>우클릭 → 메모 추가</div>';
    return;
  }
  el.innerHTML = _memos.map(m =>
    `<div class="memo-card${m.resolved?' memo-resolved':''}" id="mc_${m.id}" style="border-left-color:${m.color};" onclick="_focusMemo('${m.id}')">
       <div class="memo-card-date">${m.date||''}</div>
       <div class="memo-card-marker" style="color:${m.color};">
         <div class="memo-card-dot" style="background:${m.color};"></div>
         <span>${m.markerName||'메모'}${m.resolved?' ✓':''}</span>
       </div>
       <div class="memo-card-quote">"${(m.text||'').slice(0,50)}"</div>
       ${m.content ? `<div class="memo-card-content">${m.content}</div>` : ''}
       <div class="memo-card-btns">
         <button class="btn-done" onclick="event.stopPropagation();toggleMemoDone('${m.id}')">✓</button>
         <button onclick="event.stopPropagation();editMemo('${m.id}')">수정</button>
         <button class="btn-del" onclick="event.stopPropagation();deleteMemo('${m.id}')">삭제</button>
       </div>
     </div>`
  ).join('');
}

function toggleMemoDone(id) {
  const m = _memos.find(x => x.id === id); if (!m) return;
  m.resolved = !m.resolved;
  const allSpans = m.spanEls || (m.spanEl ? [m.spanEl] : []);
  allSpans.forEach(sp => sp.style.opacity = m.resolved ? '0.55' : '1');
  refreshMemoPanel();
}
function editMemo(id) {
  const m = _memos.find(x => x.id === id); if (!m) return;
  _memoCtxRange = null;
  openMemoInput(m.text, id);
}
function deleteMemo(id) {
  const idx = _memos.findIndex(x => x.id === id); if (idx < 0) return;
  const m = _memos[idx];
  const allSpans = m.spanEls || (m.spanEl ? [m.spanEl] : []);
  allSpans.forEach(sp => {
    const p = sp.parentNode;
    if (p) {
      while (sp.firstChild) p.insertBefore(sp.firstChild, sp);
      p.removeChild(sp);
    }
  });
  _memos.splice(idx, 1);
  refreshMemoPanel(); toast('메모 삭제됨');
}

/* 메모 관리 팝업 */
let _mmTab = 1;
async function openMemoManager() {
  await _loadMemoPresets();
  mmSwitchTab(1);
  document.getElementById('memoManagerOverlay').style.display = 'block';
  setTimeout(() => document.getElementById('mmMarkerInput')?.focus(), 100);
}
function closeMemoManager() { document.getElementById('memoManagerOverlay').style.display = 'none'; }

function mmSwitchTab(n) {
  _mmTab = n;
  const s1=document.getElementById('mmSec1'), s2=document.getElementById('mmSec2');
  const t1=document.getElementById('mmTab1'), t2=document.getElementById('mmTab2');
  if(s1){s1.style.display=n===1?'flex':'none'; s1.style.flexDirection='column';}
  if(s2){s2.style.display=n===2?'flex':'none'; s2.style.flexDirection='column';}
  if(t1)t1.className=n===1?'mbtn-s':'mbtn-c';
  if(t2)t2.className=n===2?'mbtn-s':'mbtn-c';
  if(n===1){_renderMmColorPicker();_renderMmMarkerList();}
  else{_renderMmContentList();}
}
function _renderMmColorPicker(){
  const el=document.getElementById('mmColorPicker'); if(!el||el._init)return; el._init=true;
  el.innerHTML=MEMO_COLORS.map(c=>{
    const light=['#FFEB3B','#BDBDBD','#BCAAA4'].includes(c);
    return `<div class="md-dot" style="background:${c};${light?'border-color:#aaa!important;':''}" data-c="${c}" onclick="mmPickColor(this)"></div>`;
  }).join('');
}
let _mmSelColor=MEMO_COLORS[0];
function mmPickColor(el){
  document.querySelectorAll('#mmColorPicker .md-dot').forEach(d=>d.classList.remove('sel'));
  el.classList.add('sel'); _mmSelColor=el.dataset.c;
}
async function mmAddMarker(){
  const name=document.getElementById('mmMarkerInput')?.value?.trim();
  if(!_mmSelColor){toast('색상을 선택하세요.');return;}
  if(!name){toast('마커명을 입력하세요.');return;}
  if(_markerPresets.some(p=>p.name===name&&p.color===_mmSelColor)){toast('이미 있습니다.');return;}
  _markerPresets.push({color:_mmSelColor,name});
  await _saveMemoPresets(); _renderMmMarkerList();
  document.getElementById('mmMarkerInput').value=''; toast('마커 추가됨');
}
function _renderMmMarkerList(){
  const el=document.getElementById('mmMarkerList'); if(!el)return;
  if(!_markerPresets.length){el.innerHTML='<div style="font-size:.77rem;color:#8B95A1;text-align:center;padding:6px 0;">저장된 마커 없음</div>';return;}
  el.innerHTML=_markerPresets.map((p,i)=>
    `<div style="display:flex;align-items:center;gap:8px;padding:6px 9px;background:#F8F9FA;border-radius:7px;border:1px solid #E5E8EB;">
       <div style="width:10px;height:10px;border-radius:50%;background:${p.color};flex-shrink:0;"></div>
       <div style="flex:1;font-size:.83rem;font-weight:600;">${p.name}</div>
       <button onclick="mmDeleteMarker(${i})" style="font-size:.7rem;padding:2px 7px;border:1px solid #FFCDD2;border-radius:5px;background:#FFF3F5;cursor:pointer;color:#E53935;font-family:inherit;">삭제</button>
     </div>`
  ).join('');
}
async function mmDeleteMarker(i){_markerPresets.splice(i,1);await _saveMemoPresets();_renderMmMarkerList();toast('삭제됨');}

async function mmAddContent(){
  const val=document.getElementById('mmContentInput')?.value?.trim();
  if(!val){toast('내용을 입력하세요.');return;}
  if(_contentPresets.includes(val)){toast('이미 있습니다.');return;}
  _contentPresets.push(val);
  await _saveMemoPresets(); _renderMmContentList();
  document.getElementById('mmContentInput').value=''; toast('추가됨');
}
function _renderMmContentList(){
  const el=document.getElementById('mmContentList'); if(!el)return;
  if(!_contentPresets.length){el.innerHTML='<div style="font-size:.77rem;color:#8B95A1;text-align:center;padding:6px 0;">저장된 내용 없음</div>';return;}
  el.innerHTML=_contentPresets.map((c,i)=>
    `<div style="display:flex;align-items:center;gap:8px;padding:6px 9px;background:#F8F9FA;border-radius:7px;border:1px solid #E5E8EB;">
       <div style="flex:1;font-size:.83rem;">${c}</div>
       <button onclick="mmDeleteContent(${i})" style="font-size:.7rem;padding:2px 7px;border:1px solid #FFCDD2;border-radius:5px;background:#FFF3F5;cursor:pointer;color:#E53935;font-family:inherit;">삭제</button>
     </div>`
  ).join('');
}
async function mmDeleteContent(i){_contentPresets.splice(i,1);await _saveMemoPresets();_renderMmContentList();toast('삭제됨');}

/* ════════════════════════════════════════════════════════
   표 기능 (우클릭 메뉴, 셀 편집)
════════════════════════════════════════════════════════ */
let _lastCtxTd = null;

function _bindTableCtxMenu() {
  // 이제 _bindCtxMenu에 통합됨
}

function tblCmd(cmd) {
  const td = _lastCtxTd;
  const menu = document.getElementById('tblCtxMenu');
  if (menu) menu.style.display = 'none';
  if (!td) return;

  const table = td.closest('table');
  const tr    = td.closest('tr');
  if (!table || !tr) return;

  const rows  = Array.from(table.querySelectorAll('tr'));
  const ri    = rows.indexOf(tr);
  const cells = Array.from(tr.querySelectorAll('td,th'));
  const ci    = cells.indexOf(td);
  const cols  = rows[0] ? rows[0].querySelectorAll('td,th').length : 1;

  const mkTd = (isH) => {
    const el = document.createElement(isH ? 'th' : 'td');
    el.style.cssText = `padding:8px 12px;border:1px solid #E5E8EB;${isH?'background:#F5F6FA;font-weight:700;':''}`;
    return el;
  };

  if (cmd === 'addRowAbove' || cmd === 'addRowBelow') {
    const nr = document.createElement('tr');
    for (let i = 0; i < cols; i++) nr.appendChild(mkTd(false));
    cmd === 'addRowAbove' ? tr.before(nr) : tr.after(nr);
  } else if (cmd === 'addColLeft' || cmd === 'addColRight') {
    rows.forEach((row, rIdx) => {
      const c = Array.from(row.querySelectorAll('td,th'))[ci];
      const nc = mkTd(rIdx === 0);
      if (c) cmd === 'addColLeft' ? c.before(nc) : c.after(nc);
    });
  } else if (cmd === 'delRow') {
    if (rows.length > 1) tr.remove(); else toast('행이 1개뿐이라 삭제할 수 없습니다.');
  } else if (cmd === 'delCol') {
    if (cols > 1) rows.forEach(row => { const c = Array.from(row.querySelectorAll('td,th'))[ci]; if(c)c.remove(); });
    else toast('열이 1개뿐이라 삭제할 수 없습니다.');
  } else if (cmd === 'delTable') {
    table.remove();
  } else if (cmd === 'mergeRight') {
    _tblMergeAdjacent(td, 'right');
  } else if (cmd === 'mergeLeft') {
    _tblMergeAdjacent(td, 'left');
  } else if (cmd === 'mergeDown') {
    _tblMergeAdjacent(td, 'down');
  } else if (cmd === 'splitH') {
    _tblSplitHorizontal(td);
  } else if (cmd === 'splitV') {
    _tblSplitVertical(td);
  }
  _lastCtxTd = null;
  // 리사이즈 핸들 갱신
  setTimeout(()=>_tblRefreshHandles(table),50);
}

/* ── 인접 셀 병합 (오른쪽/왼쪽/아래) ── */
function _tblMergeAdjacent(td, direction) {
  const tr = td.closest('tr');
  const table = td.closest('table');
  if (!tr || !table) return;
  const cells = Array.from(tr.querySelectorAll('td,th'));
  const ci = cells.indexOf(td);
  const rows = Array.from(table.querySelectorAll('tr'));
  const ri = rows.indexOf(tr);

  if (direction === 'right') {
    const next = cells[ci + 1];
    if (!next) { toast('오른쪽에 셀이 없습니다.'); return; }
    td.colSpan = (parseInt(td.colSpan)||1) + (parseInt(next.colSpan)||1);
    if (next.textContent.trim()) td.innerHTML += ' ' + next.textContent.trim();
    next.remove();
    toast('오른쪽 셀과 병합되었습니다.');
  } else if (direction === 'left') {
    const prev = cells[ci - 1];
    if (!prev) { toast('왼쪽에 셀이 없습니다.'); return; }
    prev.colSpan = (parseInt(prev.colSpan)||1) + (parseInt(td.colSpan)||1);
    if (td.textContent.trim()) prev.innerHTML += ' ' + td.textContent.trim();
    td.remove();
    toast('왼쪽 셀과 병합되었습니다.');
  } else if (direction === 'down') {
    const nextRow = rows[ri + (parseInt(td.rowSpan)||1)];
    if (!nextRow) { toast('아래에 행이 없습니다.'); return; }
    // 같은 열 위치의 셀 찾기
    const nextCells = Array.from(nextRow.querySelectorAll('td,th'));
    let visualCol = 0;
    for (let i = 0; i < ci; i++) visualCol += (parseInt(cells[i].colSpan)||1);
    let targetCell = null, runCol = 0;
    for (const c of nextCells) {
      if (runCol === visualCol) { targetCell = c; break; }
      runCol += (parseInt(c.colSpan)||1);
    }
    if (!targetCell) { toast('아래에 대응하는 셀이 없습니다.'); return; }
    td.rowSpan = (parseInt(td.rowSpan)||1) + (parseInt(targetCell.rowSpan)||1);
    if (targetCell.textContent.trim()) td.innerHTML += ' ' + targetCell.textContent.trim();
    targetCell.remove();
    toast('아래 셀과 병합되었습니다.');
  }
}

/* ── 셀 가로 분리 (1셀 → 좌/우 2셀) ── */
function _tblSplitHorizontal(td) {
  const cs = parseInt(td.colSpan) || 1;
  if (cs >= 2) {
    // colspan이 2 이상이면 colspan 줄이기
    const half = Math.floor(cs / 2);
    td.colSpan = half;
    const nc = document.createElement(td.tagName.toLowerCase());
    nc.colSpan = cs - half;
    nc.style.cssText = 'padding:8px 12px;border:1px solid #E5E8EB;';
    td.after(nc);
  } else {
    // colspan 1이면: 같은 행에 새 셀 추가 + 모든 다른 행에도 1열 추가
    const table = td.closest('table');
    const rows = Array.from(table.querySelectorAll('tr'));
    const tr = td.closest('tr');
    const ci = Array.from(tr.querySelectorAll('td,th')).indexOf(td);
    // 현재 행에 새 셀 삽입
    const nc = document.createElement(td.tagName.toLowerCase());
    nc.style.cssText = 'padding:8px 12px;border:1px solid #E5E8EB;';
    td.after(nc);
    // 다른 행에도 같은 열 위치에 셀 추가
    rows.forEach(row => {
      if (row === tr) return;
      const rcells = Array.from(row.querySelectorAll('td,th'));
      const target = rcells[ci];
      if (target) {
        // colspan 있으면 증가, 없으면 새 셀 삽입
        if ((parseInt(target.colSpan)||1) > 1) {
          target.colSpan = (parseInt(target.colSpan)||1) + 1;
        } else {
          const nc2 = document.createElement(target.tagName.toLowerCase());
          nc2.style.cssText = 'padding:8px 12px;border:1px solid #E5E8EB;';
          target.after(nc2);
        }
      }
    });
  }
  toast('셀이 가로로 분리되었습니다.');
}

/* ── 셀 세로 분리 (1셀 → 위/아래 2셀) ── */
function _tblSplitVertical(td) {
  const rs = parseInt(td.rowSpan) || 1;
  const table = td.closest('table');
  const rows = Array.from(table.querySelectorAll('tr'));
  const tr = td.closest('tr');
  const ri = rows.indexOf(tr);

  if (rs >= 2) {
    // rowspan 2 이상이면 줄이기
    const half = Math.floor(rs / 2);
    td.rowSpan = half;
    const targetRow = rows[ri + half];
    if (targetRow) {
      const nc = document.createElement('td');
      nc.rowSpan = rs - half;
      nc.colSpan = parseInt(td.colSpan) || 1;
      nc.style.cssText = 'padding:8px 12px;border:1px solid #E5E8EB;';
      // 올바른 위치에 삽입
      const ci = Array.from(tr.querySelectorAll('td,th')).indexOf(td);
      const rcells = Array.from(targetRow.querySelectorAll('td,th'));
      if (rcells[ci]) rcells[ci].before(nc);
      else targetRow.appendChild(nc);
    }
  } else {
    // rowspan 1이면: 아래에 새 행 추가
    const cells = Array.from(tr.querySelectorAll('td,th'));
    const ci = cells.indexOf(td);
    const numCols = cells.reduce((s, c) => s + (parseInt(c.colSpan)||1), 0);
    const newRow = document.createElement('tr');
    let filled = 0;
    cells.forEach((c, i) => {
      const cspan = parseInt(c.colSpan)||1;
      if (i === ci) {
        // 분리 대상 셀 → 새 행에 빈 셀 추가
        const nc = document.createElement('td');
        nc.colSpan = cspan;
        nc.style.cssText = 'padding:8px 12px;border:1px solid #E5E8EB;';
        newRow.appendChild(nc);
      } else {
        // 다른 셀은 rowspan 증가
        c.rowSpan = (parseInt(c.rowSpan)||1) + 1;
      }
      filled += cspan;
    });
    tr.after(newRow);
  }
  toast('셀이 세로로 분리되었습니다.');
}

/* ── 표 리사이즈 + 활성 표시 + 체크박스 이벤트 위임 ── */
function _bindTblResize(editor) {
  if (editor._tblResizeBound) return;
  editor._tblResizeBound = true;

  // ★ 체크박스: mousedown 이벤트 위임 (contenteditable 내부에서 가장 신뢰성 높음)
  editor.addEventListener('mousedown', e => {
    const box = e.target.closest('.re-check-box');
    if (box) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      reToggleCheck(box);
      return false;
    }
  }, true); // capture phase로 가장 먼저 잡기

  // ★ 표 활성 표시
  editor.addEventListener('mousedown', e => {
    // 콜아웃 아이콘 클릭 → 수정 팝업 열기
    const icon = e.target.closest('.re-callout-icon');
    if (icon) {
      e.preventDefault();
      e.stopPropagation();
      const callout = icon.closest('.re-callout');
      if (callout) openCalloutPop(callout);
      return;
    }
    editor.querySelectorAll('table.tbl-active').forEach(t => t.classList.remove('tbl-active'));
    const td = e.target.closest('td,th');
    if (td) {
      const tbl = td.closest('table');
      if (tbl) tbl.classList.add('tbl-active');
    }
  });

  // ★ 표 세로/가로선 리사이즈
  let _resizing = false, _resizeType = '', _resizeCol = -1, _resizeTable = null;
  let _resizeStartX = 0, _resizeStartY = 0;
  let _resizeWidths = [], _resizeHeights = [];
  let _resizeRowIdx = -1;
  let _resizeTblOrigW = 0; // 표 전체 너비 리사이즈용

  editor.addEventListener('mousedown', e => {
    const td = e.target.closest('td,th');
    if (!td) return;
    const table = td.closest('table');
    if (!table) return;
    const rect = td.getBoundingClientRect();
    const tr = td.closest('tr');
    const cells = Array.from(tr.querySelectorAll('td,th'));
    const ci = cells.indexOf(td);
    const rows = Array.from(table.querySelectorAll('tr'));
    const ri = rows.indexOf(tr);

    // 오른쪽 경계 7px 이내 → 마지막 열이면 표 전체 너비, 아니면 개별 열 리사이즈
    if (Math.abs(e.clientX - rect.right) < 7 && ci < cells.length) {
      e.preventDefault();
      e.stopPropagation();
      _resizing = true;
      _resizeTable = table;
      _resizeStartX = e.clientX;
      if(ci === cells.length - 1){
        // 마지막 열 → 표 전체 너비 조절
        _resizeType = 'tbl-width';
        _resizeTblOrigW = table.offsetWidth;
        table.style.tableLayout = 'auto';
      }else{
        _resizeType = 'col';
        _resizeCol = ci;
        _resizeWidths = [];
        rows.forEach(row => {
          const c = Array.from(row.querySelectorAll('td,th'))[ci];
          if (c) _resizeWidths.push(c.offsetWidth);
        });
      }
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      return;
    }

    // 하단 경계 7px 이내 → 마지막 행이면 표 전체 높이, 아니면 개별 행 리사이즈
    if (Math.abs(e.clientY - rect.bottom) < 7) {
      e.preventDefault();
      e.stopPropagation();
      _resizing = true;
      _resizeTable = table;
      _resizeStartY = e.clientY;
      // 마지막 행 판별
      if(ri === rows.length - 1){
        _resizeType = 'tbl-height';
        _resizeHeights = rows.map(r=>r.offsetHeight);
      }else{
        _resizeType = 'row';
        _resizeRowIdx = ri;
        _resizeHeights = [tr.offsetHeight];
      }
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      return;
    }
  });

  const onMove = e => {
    if (!_resizing || !_resizeTable) return;
    e.preventDefault();
    if (_resizeType === 'col') {
      const dx = e.clientX - _resizeStartX;
      const rows = Array.from(_resizeTable.querySelectorAll('tr'));
      rows.forEach((row, i) => {
        const c = Array.from(row.querySelectorAll('td,th'))[_resizeCol];
        if (c) {
          const origW = _resizeWidths[i] || 60;
          const newW = Math.max(30, origW + dx);
          c.style.width = newW + 'px';
          c.style.minWidth = newW + 'px';
        }
      });
    } else if (_resizeType === 'tbl-width') {
      const dx = e.clientX - _resizeStartX;
      const newW = Math.max(200, _resizeTblOrigW + dx);
      _resizeTable.style.width = newW + 'px';
      _resizeTable.style.maxWidth = newW + 'px';
    } else if (_resizeType === 'row') {
      const dy = e.clientY - _resizeStartY;
      const rows = Array.from(_resizeTable.querySelectorAll('tr'));
      const tr = rows[_resizeRowIdx];
      if (tr) {
        const origH = _resizeHeights[0] || 30;
        tr.style.height = Math.max(20, origH + dy) + 'px';
      }
    } else if (_resizeType === 'tbl-height') {
      const dy = e.clientY - _resizeStartY;
      const rows = Array.from(_resizeTable.querySelectorAll('tr'));
      const totalOrigH = _resizeHeights.reduce((a,b)=>a+b,0);
      const scale = Math.max(0.3, (totalOrigH + dy) / totalOrigH);
      rows.forEach((row, i) => {
        const origH = _resizeHeights[i] || 30;
        row.style.height = Math.max(16, Math.round(origH * scale)) + 'px';
      });
    }
  };

  const onUp = () => {
    if (_resizing) {
      _resizing = false;
      _resizeTable = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  // 커서 모양
  editor.addEventListener('mousemove', e => {
    if (_resizing) return;
    const td = e.target.closest('td,th');
    if (!td) return;
    const rect = td.getBoundingClientRect();
    const table = td.closest('table');
    const tr = td.closest('tr');
    if (Math.abs(e.clientX - rect.right) < 7) {
      // 마지막 열이면 ew-resize (전체 너비 조절 힌트)
      const cells2 = Array.from(td.closest('tr').querySelectorAll('td,th'));
      td.style.cursor = (cells2.indexOf(td) === cells2.length - 1) ? 'ew-resize' : 'col-resize';
    } else if (Math.abs(e.clientY - rect.bottom) < 7) {
      // 마지막 행이면 ns-resize (전체 높이 조절 힌트)
      const rows = table ? Array.from(table.querySelectorAll('tr')) : [];
      td.style.cursor = (tr && rows.indexOf(tr) === rows.length - 1) ? 'ns-resize' : 'row-resize';
    } else {
      td.style.cursor = '';
    }
  });
}

function _tblRefreshHandles(table) {
  // 마우스 기반 리사이즈 — 별도 핸들 불필요
}

/* ══ 표 드래그 이동 ══ */
let _tblDragHandle=null, _tblDropLine=null, _tblDragTarget=null, _tblDragging=false;
let _tblDragStartY=0, _tblHoverTimer=null;

function _initTblDrag(editor){
  if(editor._tblDragBound)return;
  editor._tblDragBound=true;

  // 드래그 핸들 생성 (에디터 스크롤 영역에 1개만)
  const scrollArea=document.getElementById('reEditorScroll');
  if(!scrollArea)return;
  if(!_tblDragHandle){
    _tblDragHandle=document.createElement('div');
    _tblDragHandle.className='re-tbl-drag-handle';
    _tblDragHandle.innerHTML='⠿';
    _tblDragHandle.title='드래그하여 표 이동';
    scrollArea.appendChild(_tblDragHandle);
  }
  if(!_tblDropLine){
    _tblDropLine=document.createElement('div');
    _tblDropLine.className='re-tbl-drop-line';
    scrollArea.appendChild(_tblDropLine);
  }

  // 표 호버 → 드래그 핸들 표시
  editor.addEventListener('mouseover',e=>{
    if(_tblDragging||_reViewMode)return;
    const tbl=e.target.closest('table.re-tbl');
    if(tbl){
      clearTimeout(_tblHoverTimer);
      _showTblDragHandle(tbl,scrollArea);
    }
  });
  editor.addEventListener('mouseleave',()=>{
    if(_tblDragging)return;
    _tblHoverTimer=setTimeout(()=>_hideTblDragHandle(),200);
  });
  _tblDragHandle.addEventListener('mouseenter',()=>clearTimeout(_tblHoverTimer));
  _tblDragHandle.addEventListener('mouseleave',()=>{
    if(_tblDragging)return;
    _tblHoverTimer=setTimeout(()=>_hideTblDragHandle(),200);
  });

  // 드래그 시작
  _tblDragHandle.addEventListener('mousedown',e=>{
    e.preventDefault();e.stopPropagation();
    if(!_tblDragTarget)return;
    _tblDragging=true;
    _tblDragStartY=e.clientY;
    _tblDragTarget.classList.add('tbl-dragging');
    _tblDragHandle.style.cursor='grabbing';
    document.body.style.cursor='grabbing';
    document.body.style.userSelect='none';
  });

  // 드래그 중 → 드롭 위치 표시
  document.addEventListener('mousemove',e=>{
    if(!_tblDragging||!_tblDragTarget)return;
    e.preventDefault();
    const edRect=editor.getBoundingClientRect();
    const scrollRect=scrollArea.getBoundingClientRect();
    // 에디터의 직계 자식 블록들 사이에서 드롭 위치 결정
    const blocks=_getTblDropTargets(editor);
    let bestY=null, bestRef=null, bestPos='before';
    let minDist=Infinity;
    for(const bl of blocks){
      if(bl===_tblDragTarget)continue;
      const r=bl.getBoundingClientRect();
      // 블록 위쪽
      const topD=Math.abs(e.clientY-r.top);
      if(topD<minDist){minDist=topD;bestY=r.top-scrollRect.top+scrollArea.scrollTop;bestRef=bl;bestPos='before';}
      // 블록 아래쪽
      const botD=Math.abs(e.clientY-r.bottom);
      if(botD<minDist){minDist=botD;bestY=r.bottom-scrollRect.top+scrollArea.scrollTop;bestRef=bl;bestPos='after';}
    }
    if(bestY!==null&&_tblDropLine){
      _tblDropLine.style.display='block';
      _tblDropLine.style.top=bestY+'px';
      _tblDropLine.style.left=(edRect.left-scrollRect.left)+'px';
      _tblDropLine.style.width=edRect.width+'px';
      _tblDropLine._ref=bestRef;
      _tblDropLine._pos=bestPos;
    }
  });

  // 드롭
  document.addEventListener('mouseup',()=>{
    if(!_tblDragging)return;
    _tblDragging=false;
    document.body.style.cursor='';
    document.body.style.userSelect='';
    _tblDragHandle.style.cursor='grab';
    if(_tblDragTarget)_tblDragTarget.classList.remove('tbl-dragging');
    if(_tblDropLine&&_tblDropLine._ref&&_tblDragTarget){
      const ref=_tblDropLine._ref;
      const pos=_tblDropLine._pos;
      // 표 뒤에 빈 p가 있으면 같이 이동
      const nextP=_tblDragTarget.nextElementSibling;
      const hasTrailingP=nextP&&nextP.tagName==='P'&&(!nextP.textContent.trim()||nextP.innerHTML==='<br>');
      if(pos==='before'){
        ref.before(_tblDragTarget);
        if(hasTrailingP)ref.before(nextP);
      }else{
        if(hasTrailingP)ref.after(nextP);
        ref.after(_tblDragTarget);
      }
      // 이동 후 표 뒤에 빈 p가 없으면 추가
      if(!_tblDragTarget.nextElementSibling||_tblDragTarget.nextElementSibling.tagName!=='P'){
        const p=document.createElement('p');p.innerHTML='<br>';
        _tblDragTarget.after(p);
      }
    }
    if(_tblDropLine){_tblDropLine.style.display='none';_tblDropLine._ref=null;}
    _hideTblDragHandle();
    _reDirty=true;_asSchedule();
  });

  // 터치 지원
  _tblDragHandle.addEventListener('touchstart',e=>{
    e.preventDefault();
    if(!_tblDragTarget)return;
    _tblDragging=true;
    _tblDragTarget.classList.add('tbl-dragging');
  },{passive:false});
  document.addEventListener('touchmove',e=>{
    if(!_tblDragging||!_tblDragTarget)return;
    e.preventDefault();
    const touch=e.touches[0];
    const ev={clientY:touch.clientY,clientX:touch.clientX,preventDefault(){}};
    // 동일 로직 재사용 — mousemove 핸들러 트리거
    const scrollRect=scrollArea.getBoundingClientRect();
    const edRect=editor.getBoundingClientRect();
    const blocks=_getTblDropTargets(editor);
    let bestY=null,bestRef=null,bestPos='before',minDist=Infinity;
    for(const bl of blocks){
      if(bl===_tblDragTarget)continue;
      const r=bl.getBoundingClientRect();
      const topD=Math.abs(touch.clientY-r.top);
      if(topD<minDist){minDist=topD;bestY=r.top-scrollRect.top+scrollArea.scrollTop;bestRef=bl;bestPos='before';}
      const botD=Math.abs(touch.clientY-r.bottom);
      if(botD<minDist){minDist=botD;bestY=r.bottom-scrollRect.top+scrollArea.scrollTop;bestRef=bl;bestPos='after';}
    }
    if(bestY!==null&&_tblDropLine){
      _tblDropLine.style.display='block';
      _tblDropLine.style.top=bestY+'px';
      _tblDropLine.style.left=(edRect.left-scrollRect.left)+'px';
      _tblDropLine.style.width=edRect.width+'px';
      _tblDropLine._ref=bestRef;_tblDropLine._pos=bestPos;
    }
  },{passive:false});
  document.addEventListener('touchend',()=>{
    if(!_tblDragging)return;
    // mouseup과 동일 로직
    _tblDragging=false;
    if(_tblDragTarget)_tblDragTarget.classList.remove('tbl-dragging');
    if(_tblDropLine&&_tblDropLine._ref&&_tblDragTarget){
      const ref=_tblDropLine._ref;const pos=_tblDropLine._pos;
      const nextP=_tblDragTarget.nextElementSibling;
      const hasTrailingP=nextP&&nextP.tagName==='P'&&(!nextP.textContent.trim()||nextP.innerHTML==='<br>');
      if(pos==='before'){ref.before(_tblDragTarget);if(hasTrailingP)ref.before(nextP);}
      else{if(hasTrailingP)ref.after(nextP);ref.after(_tblDragTarget);}
      if(!_tblDragTarget.nextElementSibling||_tblDragTarget.nextElementSibling.tagName!=='P'){
        const p=document.createElement('p');p.innerHTML='<br>';_tblDragTarget.after(p);
      }
    }
    if(_tblDropLine){_tblDropLine.style.display='none';_tblDropLine._ref=null;}
    _hideTblDragHandle();
    _reDirty=true;_asSchedule();
  });
}

function _showTblDragHandle(table,scrollArea){
  if(!_tblDragHandle||!scrollArea)return;
  _tblDragTarget=table;
  const tblRect=table.getBoundingClientRect();
  const scrollRect=scrollArea.getBoundingClientRect();
  _tblDragHandle.style.top=(tblRect.top-scrollRect.top+scrollArea.scrollTop-14)+'px';
  _tblDragHandle.style.left=(tblRect.left-scrollRect.left-34)+'px';
  _tblDragHandle.classList.add('visible');
}
function _hideTblDragHandle(){
  if(_tblDragHandle)_tblDragHandle.classList.remove('visible');
  _tblDragTarget=null;
}
function _getTblDropTargets(editor){
  // 에디터의 직계 자식 블록 요소들
  return Array.from(editor.children).filter(el=>
    el.nodeType===1&&!el.classList.contains('re-tbl-drag-handle')&&!el.classList.contains('re-tbl-drop-line')
  );
}

/* ── 컨텍스트 메뉴: 표 위로/아래로 이동 ── */
function tblMoveUp(){
  const menu=document.getElementById('tblCtxMenu');if(menu)menu.style.display='none';
  if(!_lastCtxTd)return;
  const table=_lastCtxTd.closest('table');if(!table)return;
  const prev=table.previousElementSibling;
  if(!prev){toast('이미 맨 위에 있습니다.');return;}
  prev.before(table);
  // 표 뒤에 빈 p 유지
  if(!table.nextElementSibling||table.nextElementSibling.tagName!=='P'){
    const p=document.createElement('p');p.innerHTML='<br>';table.after(p);
  }
  _lastCtxTd=null;_reDirty=true;_asSchedule();
  toast('표를 위로 이동했습니다.');
}
function tblMoveDown(){
  const menu=document.getElementById('tblCtxMenu');if(menu)menu.style.display='none';
  if(!_lastCtxTd)return;
  const table=_lastCtxTd.closest('table');if(!table)return;
  // 표 바로 뒤의 빈 p 건너뛰기
  let next=table.nextElementSibling;
  if(next&&next.tagName==='P'&&(!next.textContent.trim()||next.innerHTML==='<br>'))next=next.nextElementSibling;
  if(!next){toast('이미 맨 아래에 있습니다.');return;}
  next.after(table);
  if(!table.nextElementSibling||table.nextElementSibling.tagName!=='P'){
    const p=document.createElement('p');p.innerHTML='<br>';table.after(p);
  }
  _lastCtxTd=null;_reDirty=true;_asSchedule();
  toast('표를 아래로 이동했습니다.');
}

/* 셀 배경색 */
const CELL_COLORS = [
  '#FFFFFF','#F8F9FA','#FFF3E0','#FFFDE7','#F3E5F5','#E8EAF6',
  '#E3F2FD','#E0F7FA','#E8F5E9','#FCE4EC','#FBE9E7','#EFEBE9',
  '#FFD54F','#FFB74D','#FF8A65','#F06292','#CE93D8','#90CAF9',
  '#80DEEA','#A5D6A7','#FFCC80','#EF9A9A','#B39DDB','#80CBC4',
];
let _selCellColor = '';

function openCellColorPicker() {
  const menu = document.getElementById('tblCtxMenu');
  if (menu) menu.style.display = 'none';
  const grid = document.getElementById('cellColorGrid');
  if (grid) {
    grid.innerHTML = CELL_COLORS.map(c =>
      `<div class="cell-color-dot" style="background:${c};${c==='#FFFFFF'?'border:1px solid #ddd;':''}" onclick="applyCellColor('${c}')"></div>`
    ).join('');
  }
  document.getElementById('cellColorOverlay').style.display = 'block';
}
function closeCellColorPicker() { document.getElementById('cellColorOverlay').style.display = 'none'; }
function applyCellColor(color) {
  if (_lastCtxTd) _lastCtxTd.style.background = color;
  closeCellColorPicker(); _lastCtxTd = null;
}

function saveSiteGeneral(){
  CFG.logo=document.getElementById('cfgLogo').value.trim()||CFG.logo;
  CFG.heroTitle=document.getElementById('cfgTitle').value||CFG.heroTitle;
  CFG.heroSub=document.getElementById('cfgSub').value||CFG.heroSub;
  saveAll();applyConfig();toast('저장되었습니다.');
}

/* ══ 백업 내보내기 ══ */
async function exportBackup(){
  toast('백업 데이터를 수집 중...');
  try{
    // Supabase에서 모든 데이터 행을 가져옴 (문서 내용 포함)
    const rows = await _sbRest.select('site_data');
    if(!rows || rows.length === 0){ toast('백업할 데이터가 없습니다.'); return; }
    const backupObj = {
      _backup_version: 1,
      _backup_date: new Date().toISOString(),
      data: {}
    };
    rows.forEach(row => { backupObj.data[row.key] = row.value; });
    const json = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0,16).replace('T','_').replace(':','-');
    a.href = url;
    a.download = `backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`백업 완료 — ${rows.length}개 항목이 저장되었습니다.`);
  } catch(e){
    toast('백업 실패: ' + ((e&&e.message)||'오류'));
    console.error('exportBackup error:', e);
  }
}

/* ══ 백업 복원 ══ */
async function importBackup(event){
  const file = event.target.files[0];
  event.target.value = ''; // 같은 파일 재선택 가능하도록 초기화
  if(!file) return;
  if(!file.name.endsWith('.json')){ toast('JSON 파일만 선택할 수 있습니다.'); return; }
  if(!confirm(`⚠ 정말로 복원하시겠습니까?\n\n파일명: ${file.name}\n\n현재 서버의 모든 데이터가 이 백업 파일 내용으로 덮어씌워집니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
  toast('복원 중...');
  try{
    const text = await file.text();
    const backupObj = JSON.parse(text);
    if(!backupObj.data || typeof backupObj.data !== 'object'){
      toast('올바른 백업 파일이 아닙니다.'); return;
    }
    const entries = Object.entries(backupObj.data);
    let done = 0;
    for(const [key, value] of entries){
      await _sbRest.upsert('site_data', {key, value, updated_at: new Date().toISOString()});
      done++;
    }
    // 복원 후 데이터 재로드 및 화면 갱신
    _applyMap(backupObj.data);
    applyColors(); applyConfig(); applyCalCfg();
    renderSection('docs'); renderSection('webtoon');
    renderLegend(); renderTagFilter();
    document.getElementById('calNameText').textContent = CAL_NAME;
    renderMonthly();
    closeSiteSettings();
    toast(`복원 완료 — ${done}개 항목이 복원되었습니다.`);
  } catch(e){
    toast('복원 실패: ' + ((e&&e.message)||'파일을 읽을 수 없습니다.'));
    console.error('importBackup error:', e);
  }
}

/* ══ SECTION RENDERING ══ */
function renderSection(g){
  const bar=document.getElementById(`${g}-tab-bar`);
  const panels=document.getElementById(`${g}-panels`);
  bar.innerHTML='';panels.innerHTML='';
  const tabs=TABS[g]||[];const act=ACTIVE[g]||tabs[0]?.id;
  tabs.forEach(tab=>{
    const btn=document.createElement('button');
    btn.className='tab-btn'+(tab.id===act?' active':'');
    btn.textContent=tab.name;btn.onclick=()=>switchTab(g,tab.id);bar.appendChild(btn);
    const panel=document.createElement('div');
    panel.className='tab-panel'+(tab.id===act?' active':'');
    panel.id=`panel-${g}-${tab.id}`;
    panel.innerHTML=`<div class="card-grid" id="grid-${g}-${tab.id}"></div>`;
    panels.appendChild(panel);
    renderCards(g,tab.id);
  });
}

/* ── PD별 뷰 ── */
const _sectionView={docs:'normal',webtoon:'normal'};
function setSectionView(g,mode){
  _sectionView[g]=mode;
  const normal=document.getElementById(`${g}-panels`);
  const pdView=document.getElementById(`${g}-pd-view`);
  const bar=document.getElementById(`${g}-tab-bar`);
  const btnNormal=document.getElementById(`${g}-view-normal`);
  const btnPD=document.getElementById(`${g}-view-pd`);
  if(mode==='normal'){
    normal.style.display='';bar.style.display='';
    if(pdView)pdView.style.display='none';
    if(btnNormal)btnNormal.classList.add('active');
    if(btnPD)btnPD.classList.remove('active');
  }else{
    normal.style.display='none';bar.style.display='none';
    if(pdView)pdView.style.display='';
    if(btnNormal)btnNormal.classList.remove('active');
    if(btnPD)btnPD.classList.add('active');
    renderPDView(g);
  }
}

function renderPDView(g){
  const pdView=document.getElementById(`${g}-pd-view`);
  if(!pdView)return;
  // 모든 탭에서 카드 수집
  const allCards=Object.entries(CARDS)
    .filter(([key])=>key.startsWith(g+'-'))
    .flatMap(([key,cards])=>cards.map(c=>({...c,_key:key,_tabId:key.split(/-(.+)/)[1]})));
  // PD별 그룹화
  const groups={};
  allCards.forEach(card=>{
    const pdName=card.pd||'(PD 미지정)';
    if(!groups[pdName])groups[pdName]=[];
    groups[pdName].push(card);
  });
  const PMAP={naver:{bg:'#03C75A',fg:'#fff',label:'N'},kakao:{bg:'#F9E000',fg:'#1A1300',label:'K'},ridi:{bg:'#1A6DFF',fg:'#fff',label:'R'},lezhin:{bg:'#E61E2B',fg:'#fff',label:'L'},piccoma:{bg:'#1A1A1A',fg:'#FFDC2D',label:'ピ'},linemanga:{bg:'#06C755',fg:'#fff',label:'LM'},etc:{bg:'#607D8B',fg:'#fff',label:'기타'}};
  pdView.innerHTML='';
  // 커스텀 순서 적용
  const customOrder=PD_ORDER[g]||[];
  const allPDs=Object.keys(groups);
  // 커스텀 순서에 있는 PD → 순서대로, 없는 PD → 가나다순 뒤에, 미지정 → 맨 마지막
  const ordered=[];
  customOrder.forEach(name=>{if(allPDs.includes(name))ordered.push(name);});
  allPDs.forEach(name=>{if(!ordered.includes(name)&&name!=='(PD 미지정)')ordered.push(name);});
  if(allPDs.includes('(PD 미지정)'))ordered.push('(PD 미지정)');
  // 커스텀 순서 동기화 (삭제된 PD 정리, 새 PD 추가)
  PD_ORDER[g]=ordered.filter(n=>n!=='(PD 미지정)');

  ordered.forEach((pdName,idx)=>{
    const cards=groups[pdName];
    const grpEl=document.createElement('div');grpEl.className='pd-group';
    const isFirst=idx===0;
    const isLast=idx===ordered.length-1||(idx===ordered.length-2&&ordered[ordered.length-1]==='(PD 미지정)');
    const isUnassigned=pdName==='(PD 미지정)';
    const moveBtns=isUnassigned?'':`<button class="pd-move-btn" onclick="event.stopPropagation();pdMove('${g}','${pdName.replace(/'/g,"\\'")}','up')" title="위로" ${isFirst?'disabled':''}>▲</button><button class="pd-move-btn" onclick="event.stopPropagation();pdMove('${g}','${pdName.replace(/'/g,"\\'")}','down')" title="아래로" ${isLast?'disabled':''}>▼</button>`;
    grpEl.innerHTML=`<div class="pd-group-hd"><span class="pd-group-name">👤 ${pdName}</span><span class="pd-group-count">${cards.length}개</span><span class="pd-move-wrap">${moveBtns}</span></div>`;
    const grid=document.createElement('div');grid.className='card-grid';
    cards.forEach(card=>{
      const el=document.createElement('div');el.className='card';
      el.onclick=()=>openCardDetail(card.id,g,card._tabId);
      const thumb=card.image?`<div class="card-thumb"><img src="${card.image}" alt=""></div>`:`<div class="card-thumb"><span class="card-thumb-icon">${card.emoji||'📄'}</span></div>`;
      const platforms=card.platforms||[];
      const platformHTML=platforms.length?`<div class="card-platforms">${platforms.map(pid=>{const p=PMAP[pid]||{bg:'#888',fg:'#fff',label:'?'};return`<div class="platform-icon" style="background:${p.bg};color:${p.fg}">${p.label}</div>`;}).join('')}</div>`:'';
      const tabLabel=TABS[g]?.find(t=>t.id===card._tabId)?.name||card._tabId;
      el.innerHTML=`${thumb}<div class="card-body">${platformHTML}<div class="card-name">${card.name}</div><div style="font-size:.68rem;color:var(--t3);margin-top:2px;">📁 ${tabLabel}</div><div class="card-desc">${card.desc||''}</div><div class="card-arrow">열기 →</div></div>`;
      grid.appendChild(el);
    });
    grpEl.appendChild(grid);pdView.appendChild(grpEl);
  });
  if(!allCards.length)pdView.innerHTML='<div class="doc-empty">카드가 없습니다.</div>';
}

function pdMove(g,pdName,dir){
  const order=PD_ORDER[g]||[];
  const idx=order.indexOf(pdName);
  if(idx===-1)return;
  if(dir==='up'&&idx>0){
    [order[idx-1],order[idx]]=[order[idx],order[idx-1]];
  }else if(dir==='down'&&idx<order.length-1){
    [order[idx],order[idx+1]]=[order[idx+1],order[idx]];
  }
  PD_ORDER[g]=order;
  saveAll();
  renderPDView(g);
}
function renderCards(g,tabId){
  const key=`${g}-${tabId}`;const grid=document.getElementById(`grid-${g}-${tabId}`);if(!grid)return;
  grid.innerHTML='';
  (CARDS[key]||[]).forEach(card=>{
    const el=document.createElement('div');
    el.className='card';
    el.onclick=()=>openCardDetail(card.id,g,tabId);
    const thumb=card.image
      ?`<div class="card-thumb"><img src="${card.image}" alt=""></div>`
      :`<div class="card-thumb"><span class="card-thumb-icon">${card.emoji||'📄'}</span></div>`;
    const platforms=card.platforms||[];
    const PMAP={naver:{bg:'#03C75A',fg:'#fff',label:'N'},kakao:{bg:'#F9E000',fg:'#1A1300',label:'K'},ridi:{bg:'#1A6DFF',fg:'#fff',label:'R'},lezhin:{bg:'#E61E2B',fg:'#fff',label:'L'},piccoma:{bg:'#1A1A1A',fg:'#FFDC2D',label:'ピ'},linemanga:{bg:'#06C755',fg:'#fff',label:'LM'},etc:{bg:'#607D8B',fg:'#fff',label:'기타'}};
    const platformHTML=platforms.length?`<div class="card-platforms">${platforms.map(pid=>{const p=PMAP[pid]||{bg:'#888',fg:'#fff',label:'?'};return`<div class="platform-icon" style="background:${p.bg};color:${p.fg}" title="${pid}">${p.label}</div>`;}).join('')}</div>`:'';
    const pdHTML=card.pd?`<div style="font-size:.68rem;color:var(--t3);font-weight:600;margin-bottom:3px;">PD ${card.pd}</div>`:'';
    el.innerHTML=`${thumb}<div class="card-body">${platformHTML}<div class="card-name">${card.name}</div>${pdHTML}<div class="card-desc">${card.desc||''}</div><div class="card-arrow">열기 →</div></div>`;
    grid.appendChild(el);
  });

  const addBtn=document.createElement('button');
  addBtn.className='card card-add';
  addBtn.innerHTML='<span style="font-size:1.4rem;opacity:.4">＋</span>카드 추가';
  addBtn.onclick=()=>{_addCardTarget={g,tabId};openAddCardModal();};
  grid.appendChild(addBtn);
}
function switchTab(g,tabId){
  ACTIVE[g]=tabId;saveAll();
  document.querySelectorAll(`#${g}-tab-bar .tab-btn`).forEach((b,i)=>b.classList.toggle('active',TABS[g][i]?.id===tabId));
  document.querySelectorAll(`#${g}-panels .tab-panel`).forEach(p=>p.classList.toggle('active',p.id===`panel-${g}-${tabId}`));
}

/* ══ SECTION SETTINGS ══ */
let _secGroup='';
function openSecSettings(g){
  _secGroup=g;
  document.getElementById('secSettingsTitle').textContent=g==='docs'?'문서 섹션 설정':'웹툰 작품 섹션 설정';
  document.getElementById('secKo').value=CFG.sections[g].ko;
  document.getElementById('secEn').value=CFG.sections[g].en;
  renderTabSList();renderCardTabSelector();renderCardSList();
  secTab('info');document.getElementById('secSettingsOverlay').classList.add('open');
}
function closeSecSettings(){document.getElementById('secSettingsOverlay').classList.remove('open');}
function secTab(id){
  document.querySelectorAll('#secSettingsOverlay .m-stab').forEach((b,i)=>b.classList.toggle('active',['info','tabs','cards'][i]===id));
  document.querySelectorAll('#secSettingsOverlay .m-sp').forEach(p=>p.classList.toggle('active',p.id===`sp-${id}`));
}
function saveSecInfo(){const ko=document.getElementById('secKo').value.trim();const en=document.getElementById('secEn').value.trim();if(!ko)return;CFG.sections[_secGroup]={ko,en};saveAll();applyConfig();toast('저장되었습니다.');}
function renderTabSList(){
  const tabs=TABS[_secGroup]||[];
  document.getElementById('tabSList').innerHTML=tabs.map((t,i)=>`
    <div class="sitem" id="tabsitem-${t.id}">
      <span class="sitem-name">${t.name}</span>
      <div class="sitem-btns">
        <button class="sitem-btn" title="위로" onclick="moveTab('${t.id}',-1)" ${i===0?'disabled style="opacity:.3"':''}>↑</button>
        <button class="sitem-btn" title="아래로" onclick="moveTab('${t.id}',1)" ${i===tabs.length-1?'disabled style="opacity:.3"':''}>↓</button>
        <button class="sitem-btn del" onclick="deleteTab('${t.id}')">삭제</button>
      </div>
    </div>`).join('');
}
function moveTab(tabId,dir){
  const tabs=TABS[_secGroup];const idx=tabs.findIndex(t=>t.id===tabId);
  const ni=idx+dir;if(ni<0||ni>=tabs.length)return;
  [tabs[idx],tabs[ni]]=[tabs[ni],tabs[idx]];
  saveAll();renderSection(_secGroup);renderTabSList();renderCardTabSelector();
}
function deleteTab(tabId){if(!confirm(`"${tabId}" 탭 삭제? 카드도 삭제됩니다.`))return;TABS[_secGroup]=TABS[_secGroup].filter(t=>t.id!==tabId);delete CARDS[`${_secGroup}-${tabId}`];if(ACTIVE[_secGroup]===tabId)ACTIVE[_secGroup]=TABS[_secGroup][0]?.id||'';saveAll();renderSection(_secGroup);renderTabSList();renderCardTabSelector();}
function addTab(){const name=document.getElementById('newTabIn').value.trim();if(!name)return;if(TABS[_secGroup].find(t=>t.id===name)){toast('이미 있는 이름입니다.');return;}TABS[_secGroup].push({id:name,name});if(!CARDS[`${_secGroup}-${name}`])CARDS[`${_secGroup}-${name}`]=[];saveAll();renderSection(_secGroup);renderTabSList();renderCardTabSelector();document.getElementById('newTabIn').value='';}
function renderCardTabSelector(){const sel=document.getElementById('cardTabSel');sel.innerHTML=(TABS[_secGroup]||[]).map(t=>`<option value="${t.id}">${t.name}</option>`).join('');}
function renderCardSList(){
  const tabId=document.getElementById('cardTabSel').value;
  const key=`${_secGroup}-${tabId}`;const cards=CARDS[key]||[];
  if(!cards.length){
    document.getElementById('cardSList').innerHTML='<div style="color:var(--t3);font-size:.84rem;padding:8px 0;font-weight:500;">카드가 없습니다.</div>';
    return;
  }
  document.getElementById('cardSList').innerHTML=cards.map(c=>{
    const thumbEl=c.image
      ?`<img src="${c.image}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:1px solid var(--bd);cursor:pointer;flex-shrink:0;" onclick="openCardThumbPicker('${c.id}','${key}')" title="썸네일 변경">`
      :`<div onclick="openCardThumbPicker('${c.id}','${key}')" title="썸네일 추가" style="width:36px;height:36px;border-radius:6px;border:2px dashed var(--bd2);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:1.1rem;">${c.emoji||'📄'}</div>`;
    return`<div class="sitem" style="gap:8px;">
      ${thumbEl}
      <span class="sitem-name" style="flex:1;">${c.name}</span>
      <div class="sitem-btns">
        <button class="sitem-btn" onclick="openCardEdit('${c.id}','${key}')">수정</button>
        <button class="sitem-btn del" onclick="deleteCard('${c.id}','${key}')">삭제</button>
      </div>
    </div>`;
  }).join('');
}

let _thumbCardId='',_thumbCardKey='';
function openCardThumbPicker(cardId,key){
  _thumbCardId=cardId;_thumbCardKey=key;
  const inp=document.getElementById('cardThumbFileIn');
  if(!inp){
    const el=document.createElement('input');
    el.type='file';el.id='cardThumbFileIn';el.accept='image/*';el.style.display='none';
    el.onchange=handleCardThumbImg;
    document.body.appendChild(el);
  }
  document.getElementById('cardThumbFileIn').click();
}
function handleCardThumbImg(e){
  const f=e.target.files[0];if(!f)return;
  openCropper(f,d=>{
    const[g,tabId]=_thumbCardKey.split(/-(.+)/);
    const card=(CARDS[_thumbCardKey]||[]).find(c=>c.id===_thumbCardId);
    if(card){card.image=d;saveAll();renderCards(g,tabId);renderCardSList();}
  });
  e.target.value='';
}
function deleteCard(cardId,key){const card=CARDS[key]?.find(c=>c.id===cardId);if(!confirm(`"${card?.name}" 삭제?`))return;CARDS[key]=CARDS[key].filter(c=>c.id!==cardId);delete CARD_DOCS[cardId];const[g,tabId]=key.split(/-(.+)/);saveAll();renderCards(g,tabId);renderCardSList();}
function openAddCardFromSettings(){const tabId=document.getElementById('cardTabSel').value;_addCardTarget={g:_secGroup,tabId};closeSecSettings();openAddCardModal();}

/* ══ CARD EDIT ══ */
let _editCardId='',_editCardKey='',_ceImg='';
function openCardEdit(cardId,key){
  const card=CARDS[key]?.find(c=>c.id===cardId);if(!card)return;
  _editCardId=cardId;_editCardKey=key;_ceImg=card.image||'';
  document.getElementById('ceCardName').value=card.name;
  document.getElementById('ceCardDesc').value=card.desc||'';
  if(document.getElementById('cePD'))document.getElementById('cePD').value=card.pd||'';
  const prev=document.getElementById('ceImgPrev'),up=document.getElementById('ceImgUp');
  if(card.image){prev.src=card.image;prev.style.display='block';up.style.display='none';}
  else{prev.style.display='none';up.style.display='flex';}
  // 플랫폼 그리드 동적 생성
  const ceWrap=document.getElementById('cePlatformGridWrap');
  if(ceWrap){ceWrap.innerHTML=buildPlatformGridHTML('cePlatformGrid');setPlatformsToGrid('cePlatformGrid',card.platforms||[]);}
  // 플랫폼 체크 초기화 (하위호환)
  const curPlatforms=card.platforms||[];
  document.querySelectorAll('#cePlatformGrid .platform-sel-item').forEach(item=>{
    item.classList.toggle('active', curPlatforms.includes(item.dataset.pid));
  });
  const g=key.split('-')[0];const currentTab=key.split(/-(.+)/)[1];
  const sel=document.getElementById('ceMoveTabSel');
  sel.innerHTML=(TABS[g]||[]).map(t=>`<option value="${t.id}"${t.id===currentTab?' selected':''}>${t.name}</option>`).join('');
  document.getElementById('cardEditOverlay').classList.add('open');
}
function closeCardEdit(){document.getElementById('cardEditOverlay').classList.remove('open');}
function handleCeImg(e){const f=e.target.files[0];if(!f)return;openCropper(f,d=>{_ceImg=d;const p=document.getElementById('ceImgPrev');p.src=d;p.style.display='block';document.getElementById('ceImgUp').style.display='none';});}
function saveCardEdit(){
  const name=document.getElementById('ceCardName').value.trim();if(!name){toast('이름을 입력해주세요.');return;}
  const desc=document.getElementById('ceCardDesc').value.trim();
  const targetTabId=document.getElementById('ceMoveTabSel').value;
  const g=_editCardKey.split('-')[0];const srcTabId=_editCardKey.split(/-(.+)/)[1];
  const card=CARDS[_editCardKey]?.find(c=>c.id===_editCardId);if(!card)return;
  card.name=name;card.desc=desc;if(_ceImg)card.image=_ceImg;
  card.pd=document.getElementById('cePD')?.value.trim()||card.pd||'';
  // 플랫폼 저장
  card.platforms=getPlatformsFromGrid('cePlatformGrid');
  if(targetTabId!==srcTabId){
    CARDS[_editCardKey]=CARDS[_editCardKey].filter(c=>c.id!==_editCardId);
    const destKey=`${g}-${targetTabId}`;if(!CARDS[destKey])CARDS[destKey]=[];CARDS[destKey].push(card);
    renderCards(g,srcTabId);renderCards(g,targetTabId);
  }else{renderCards(g,srcTabId);}
  saveAll();renderCardSList();closeCardEdit();toast('카드가 수정되었습니다.');
}
function togglePlatform(el){el.classList.toggle('active');}

/* 공통 플랫폼 그리드 HTML */
function buildPlatformGridHTML(gridId){
  return`<div class="platform-sel-grid" id="${gridId}">
    <div class="platform-sel-item" data-pid="naver" onclick="togglePlatform(this)">
      <div class="platform-sel-icon" style="background:#03C75A">N</div>
      <span class="platform-sel-lbl">네이버</span>
    </div>
    <div class="platform-sel-item" data-pid="kakao" onclick="togglePlatform(this)">
      <div class="platform-sel-icon" style="background:#F9E000;color:#1A1300">K</div>
      <span class="platform-sel-lbl">카카오</span>
    </div>
    <div class="platform-sel-item" data-pid="ridi" onclick="togglePlatform(this)">
      <div class="platform-sel-icon" style="background:#1A6DFF">R</div>
      <span class="platform-sel-lbl">리디</span>
    </div>
    <div class="platform-sel-item" data-pid="lezhin" onclick="togglePlatform(this)">
      <div class="platform-sel-icon" style="background:#E61E2B">L</div>
      <span class="platform-sel-lbl">레진</span>
    </div>
    <div class="platform-sel-item" data-pid="piccoma" onclick="togglePlatform(this)">
      <div class="platform-sel-icon" style="background:#1A1A1A;color:#FFDC2D">ピ</div>
      <span class="platform-sel-lbl">픽코마</span>
    </div>
    <div class="platform-sel-item" data-pid="linemanga" onclick="togglePlatform(this)">
      <div class="platform-sel-icon" style="background:#06C755">LM</div>
      <span class="platform-sel-lbl">라인망가</span>
    </div>
    <div class="platform-sel-item" data-pid="etc" onclick="togglePlatform(this)">
      <div class="platform-sel-icon" style="background:#607D8B">기타</div>
      <span class="platform-sel-lbl">기타</span>
    </div>
  </div>`;
}

function getPlatformsFromGrid(gridId){
  return [...document.querySelectorAll(`#${gridId} .platform-sel-item.active`)].map(el=>el.dataset.pid);
}

function setPlatformsToGrid(gridId, platforms){
  document.querySelectorAll(`#${gridId} .platform-sel-item`).forEach(item=>{
    item.classList.toggle('active', (platforms||[]).includes(item.dataset.pid));
  });
}

/* ══ ADD CARD ══ */
let _addCardTarget={g:'',tabId:''},_ncImg='';
function openAddCardModal(){
  _ncImg='';
  document.getElementById('ncName').value='';document.getElementById('ncDesc').value='';
  if(document.getElementById('ncPD'))document.getElementById('ncPD').value='';
  // 플랫폼 그리드 동적 생성
  const ncWrap=document.getElementById('ncPlatformGridWrap');
  if(ncWrap)ncWrap.innerHTML=buildPlatformGridHTML('ncPlatformGrid');
  document.getElementById('ncImgPrev').style.display='none';document.getElementById('ncImgUp').style.display='flex';
  document.getElementById('ncFileIn').value='';document.getElementById('addCardOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('ncName').focus(),180);
}
function closeAddCard(){document.getElementById('addCardOverlay').classList.remove('open');}
function handleNcImg(e){const f=e.target.files[0];if(!f)return;openCropper(f,d=>{_ncImg=d;const p=document.getElementById('ncImgPrev');p.src=d;p.style.display='block';document.getElementById('ncImgUp').style.display='none';});}
function saveNewCard(){
  const name=document.getElementById('ncName').value.trim();if(!name){toast('이름을 입력해주세요.');return;}
  const desc=document.getElementById('ncDesc').value.trim();
  const pd=document.getElementById('ncPD')?.value.trim()||'';
  const platforms=getPlatformsFromGrid('ncPlatformGrid');
  const key=`${_addCardTarget.g}-${_addCardTarget.tabId}`;
  if(!CARDS[key])CARDS[key]=[];
  CARDS[key].push({id:uid(),name,desc,image:_ncImg,emoji:'📄',pd,platforms});
  saveAll();renderCards(_addCardTarget.g,_addCardTarget.tabId);closeAddCard();toast('카드가 추가되었습니다.');
}

/* ══ CARD DETAIL ══ */
let _curCard='',_curCardG='',_curCardTab='';
function openCardDetail(cardId,g,tabId){
  const key=`${g}-${tabId}`;const card=CARDS[key]?.find(c=>c.id===cardId);if(!card)return;
  _curCard=cardId;_curCardG=g;_curCardTab=tabId;
  document.getElementById('cdvTitle').textContent=card.name;
  document.getElementById('cdvName').textContent=card.name;
  document.getElementById('cdvDesc').textContent=card.desc||'';
  const banner=document.getElementById('cdvBanner');
  banner.innerHTML=card.image?`<img src="${card.image}" alt="">`:(card.emoji||'📄');
  renderDocList();
  document.getElementById('cardDetailView').style.display='block';
  document.getElementById('mainSite').style.display='none';
  const url=new URL(window.location);url.searchParams.set('card',cardId);url.searchParams.delete('doc');history.pushState({},'',url);
  window.scrollTo(0,0);
}
function closeCardDetail(){
  document.getElementById('cardDetailView').style.display='none';
  document.getElementById('mainSite').style.display='block';
  const url=new URL(window.location);url.searchParams.delete('card');url.searchParams.delete('doc');url.searchParams.delete('share');history.pushState({},'',url);
}

/* ══ DOC TREE ══ */
let _dragDocIdx=null;
let _openFolders={};
function getFolderOpen(fid){if(!_openFolders[_curCard])_openFolders[_curCard]=new Set();return _openFolders[_curCard].has(fid);}
function toggleFolderOpen(fid){if(!_openFolders[_curCard])_openFolders[_curCard]=new Set();if(_openFolders[_curCard].has(fid))_openFolders[_curCard].delete(fid);else _openFolders[_curCard].add(fid);renderDocList();}

let _allExpanded=false;
function toggleAllFolders(){
  const docs=CARD_DOCS[_curCard]||[];
  const folders=docs.filter(d=>d.type==='folder');
  if(!folders.length)return;
  _allExpanded=!_allExpanded;
  if(!_openFolders[_curCard])_openFolders[_curCard]=new Set();
  if(_allExpanded){
    folders.forEach(f=>_openFolders[_curCard].add(f.id));
  }else{
    _openFolders[_curCard].clear();
  }
  const btn=document.getElementById('treeToggleBtn');
  if(btn)btn.textContent=_allExpanded?'✕':'☰';
  renderDocList();
}
function getDepth(docs,item){let d=0,cur=item;while(cur.parentId){const p=docs.find(x=>x.id===cur.parentId);if(!p)break;d++;cur=p;}return d;}

function renderDocList(){
  const docs=CARD_DOCS[_curCard]||[];
  const list=document.getElementById('docList');
  if(!docs.length){list.innerHTML='<div class="doc-empty">문서를 추가하면 여기에 표시됩니다.</div>';return;}
  list.innerHTML='<div class="doc-tree">'+buildTreeHTML(docs,null,0)+'</div>';
}

function buildTreeHTML(docs,parentId,depth){
  const items=docs.filter(d=>(d.parentId||null)===parentId);
  if(!items.length)return'';
  let html='';
  items.forEach(item=>{
    const globalIdx=docs.indexOf(item);
    if(item.type==='folder'){
      const isOpen=getFolderOpen(item.id);
      html+=`<div class="tree-folder depth-${depth}" id="tf-${item.id}">
        <div class="tree-folder-hd" onclick="event.stopPropagation();toggleFolderOpen('${item.id}')">
          <span class="tree-folder-toggle${isOpen?' open':''}">▶</span>
          <span style="font-size:.9rem">📁</span>
          <span class="tree-folder-name">${item.title}</span>
          <div class="tree-folder-actions">
            <button class="doc-act-btn" title="위로" onclick="event.stopPropagation();moveDocOrder('${item.id}',-1)">▲</button>
            <button class="doc-act-btn" title="아래로" onclick="event.stopPropagation();moveDocOrder('${item.id}',1)">▼</button>
            ${depth<2?`<button class="doc-act-btn" title="하위 폴더 추가" onclick="event.stopPropagation();openSubFolderModal('${item.id}',${depth+1})">📁+</button>`:''}
            <button class="doc-act-btn" title="폴더명 수정" onclick="event.stopPropagation();openFolderRename('${item.id}')">✎</button>
            <button class="doc-act-btn" title="문서 추가" onclick="event.stopPropagation();openDocTypeModalIn('${item.id}')">＋</button>
            <button class="doc-act-btn del" title="폴더 삭제" onclick="event.stopPropagation();deleteFolder('${item.id}')">✕</button>
          </div>
        </div>`;
      if(isOpen){
        const childrenHTML=buildTreeHTML(docs,item.id,depth+1);
        html+=`<div class="tree-folder-body depth${depth}">`+(childrenHTML||'<div style="padding:6px 4px;font-size:.78rem;color:var(--t3);font-weight:500;">빈 폴더입니다. 문서를 여기에 드래그하거나 ＋ 버튼으로 추가하세요.</div>')+`</div>`;
      }
      html+=`</div>`;
    }else{
      const clickFn = item.type==='richtext' ? `openRichViewer('${item.id}')` : `openDocViewer('${item.id}')`;
      const emojiHtml=item.docEmoji?(item.docEmoji.startsWith('http')||item.docEmoji.startsWith('data:')?`<img src="${item.docEmoji}" class="doc-emoji-img">`:`<span class="doc-emoji-txt">${item.docEmoji}</span>`):'';
      html+=`<div class="tree-doc-item" data-idx="${globalIdx}"
        onclick="${clickFn}">
        <div class="tree-doc-title">${emojiHtml}${item.title}</div>
        <div class="tree-doc-actions">
          <button class="doc-act-btn" onclick="event.stopPropagation();moveDocOrder('${item.id}',-1)" title="위로">▲</button>
          <button class="doc-act-btn" onclick="event.stopPropagation();moveDocOrder('${item.id}',1)" title="아래로">▼</button>
          <button class="doc-act-btn" onclick="event.stopPropagation();openDocEmojiPicker('${item.id}')" title="이모지 관리">😀</button>
          ${(item.type!=='calendar')?`<button class="doc-act-btn" onclick="event.stopPropagation();editDoc('${item.id}')" title="편집">✎</button>`:''}
          <button class="doc-act-btn" onclick="event.stopPropagation();openMoveDocModal('${item.id}')" title="폴더 이동">📁</button>
          <button class="doc-act-btn del" onclick="event.stopPropagation();deleteDoc('${item.id}')" title="삭제">✕</button>
          <button class="doc-act-btn" onclick="event.stopPropagation();shareDocLink('${item.id}')" title="공유 링크 복사">🔗</button>
        </div>
      </div>`;
    }
  });
  return html;
}

/* 드래그 기능 비활성화 — ▲/▼ 버튼으로 대체 */
function docDragStart(){}function docDragOver(){}function docDragLeave(){}
function docDrop(){}function docDragOverFolder(){}function docDropIntoFolder(){}

/* 폴더 드래그 비활성화 */
let _dragFolderId=null;
function folderDragStart(){}function folderDragOver(){}
function folderDragEnd(){}function folderDrop(){}
let _confirmDelCallback = null;

/* ── 문서 순서 변경 (▲/▼ 버튼) ── */
function moveDocOrder(docId,dir){
  const docs=CARD_DOCS[_curCard]||[];
  const doc=docs.find(d=>d.id===docId);if(!doc)return;
  // 같은 부모 아래의 형제 문서만 추출
  const parentId=doc.parentId||null;
  const siblings=docs.filter(d=>(d.parentId||null)===parentId);
  const si=siblings.indexOf(doc);
  if(si<0)return;
  const ti=si+dir;
  if(ti<0||ti>=siblings.length)return;
  const target=siblings[ti];
  // docs 배열에서 위치 교환
  const fromIdx=docs.indexOf(doc);
  const toIdx=docs.indexOf(target);
  docs[fromIdx]=target;
  docs[toIdx]=doc;
  CARD_DOCS[_curCard]=docs;
  saveAll();renderDocList();
}
function deleteDoc(docId){
  const docs=CARD_DOCS[_curCard]||[];const d=docs.find(x=>x.id===docId);
  openConfirmDel(`"${d?.title||'문서'}"를 삭제하시겠습니까?`, () => {
    CARD_DOCS[_curCard]=docs.filter(x=>x.id!==docId);
    _sbRest.delete('site_data','hub_doc_'+docId).catch(function(){});
    saveAll();renderDocList();toast('삭제되었습니다.');
  });
}
function deleteFolder(folderId){
  const docs=CARD_DOCS[_curCard]||[];const f=docs.find(x=>x.id===folderId);
  openConfirmDel(`"${f?.title||'폴더'}" 폴더와 포함된 모든 항목을 삭제하시겠습니까?`, () => {
    const toDelete=new Set();
    function collect(id){toDelete.add(id);docs.filter(x=>x.parentId===id).forEach(x=>collect(x.id));}
    collect(folderId);
    CARD_DOCS[_curCard]=docs.filter(x=>!toDelete.has(x.id));
    toDelete.forEach(id=>{
      _sbRest.delete('site_data','hub_doc_'+id).catch(function(){});
    });
    saveAll();renderDocList();toast('삭제되었습니다.');
  });
}
function openConfirmDel(msg, callback) {
  document.getElementById('confirmDelMsg').textContent = msg;
  _confirmDelCallback = callback;
  document.getElementById('confirmDelOverlay').style.display = 'block';
}
function closeConfirmDel() {
  document.getElementById('confirmDelOverlay').style.display = 'none';
  _confirmDelCallback = null;
}
function execConfirmDel() {
  if (_confirmDelCallback) _confirmDelCallback();
  closeConfirmDel();
}

/* ══ MOVE DOC MODAL ══ */
let _moveDocId='';
function openMoveDocModal(docId){
  _moveDocId=docId;
  const docs=CARD_DOCS[_curCard]||[];
  const doc=docs.find(x=>x.id===docId);
  if(!doc)return;
  const nameEl=document.getElementById('moveDocDocName');
  if(nameEl)nameEl.textContent=`"${doc.title}" 이동`;
  // 이동 가능한 위치: 최상위 + 자신이 아닌 모든 폴더 (자신의 하위 폴더는 제외)
  function isDescendant(folderId,ofId){
    // ofId의 하위인지 확인
    let cur=docs.find(x=>x.id===folderId);
    while(cur&&cur.parentId){
      if(cur.parentId===ofId)return true;
      cur=docs.find(x=>x.id===cur.parentId);
    }
    return false;
  }
  const folders=docs.filter(d=>d.type==='folder'&&d.id!==docId&&!isDescendant(d.id,docId));
  const currentParent=doc.parentId||'';
  const sel=document.getElementById('moveDocTargetSel');
  sel.innerHTML=[
    {id:'',name:'📂 최상위 (폴더 없음)'},
    ...folders.map(f=>({id:f.id,name:'📁 '+f.title}))
  ].map(o=>`<option value="${o.id}"${o.id===currentParent?' selected':''}>${o.name}</option>`).join('');
  document.getElementById('moveDocOverlay').classList.add('open');
}
function closeMoveDocModal(){document.getElementById('moveDocOverlay').classList.remove('open');}
function saveMoveDoc(){
  const docs=CARD_DOCS[_curCard]||[];
  const doc=docs.find(x=>x.id===_moveDocId);
  if(!doc){closeMoveDocModal();return;}
  const targetId=document.getElementById('moveDocTargetSel').value;
  doc.parentId=targetId||null;
  // 이동한 폴더가 있으면 열어두기
  if(targetId){
    if(!_openFolders[_curCard])_openFolders[_curCard]=new Set();
    _openFolders[_curCard].add(targetId);
  }
  saveAll();renderDocList();closeMoveDocModal();toast('문서가 이동되었습니다.');
}

/* ══ FOLDER MODAL ══ */
let _folderTargetParent=null;
let _folderRenameId=null;
function openFolderModal(parentId=null,depth=0){
  _folderTargetParent=parentId;_folderRenameId=null;
  document.getElementById('folderModalTitle').textContent='폴더 추가';
  document.getElementById('folderSaveBtn').textContent='추가';
  document.getElementById('folderNameIn').value='';
  document.getElementById('folderParentField').style.display='';
  const docs=CARD_DOCS[_curCard]||[];
  const folderOpts=[{id:'',name:'(최상위)'},...docs.filter(d=>d.type==='folder'&&getDepth(docs,d)<2).map(d=>({id:d.id,name:d.title}))];
  document.getElementById('folderParentSel').innerHTML=folderOpts.map(o=>`<option value="${o.id}"${o.id===(parentId||'')?' selected':''}>${o.name}</option>`).join('');
  document.getElementById('folderOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('folderNameIn').focus(),180);
}
function openSubFolderModal(parentId,depth){openFolderModal(parentId,depth);}
function openFolderRename(folderId){
  _folderRenameId=folderId;_folderTargetParent=null;
  const docs=CARD_DOCS[_curCard]||[];
  const f=docs.find(d=>d.id===folderId);if(!f)return;
  document.getElementById('folderModalTitle').textContent='폴더 이름 수정';
  document.getElementById('folderSaveBtn').textContent='저장';
  document.getElementById('folderNameIn').value=f.title;
  document.getElementById('folderParentField').style.display='none';
  document.getElementById('folderOverlay').classList.add('open');
  setTimeout(()=>{const el=document.getElementById('folderNameIn');el.focus();el.select();},180);
}
function closeFolderModal(){document.getElementById('folderOverlay').classList.remove('open');_folderRenameId=null;}
function saveFolderModal(){
  const name=document.getElementById('folderNameIn').value.trim();if(!name){toast('폴더 이름을 입력해주세요.');return;}
  const docs=CARD_DOCS[_curCard]||[];
  if(_folderRenameId){
    // 이름 변경 모드
    const f=docs.find(d=>d.id===_folderRenameId);
    if(f)f.title=name;
    saveAll();renderDocList();closeFolderModal();toast('폴더 이름이 변경되었습니다.');
  }else{
    const parentId=document.getElementById('folderParentSel').value||null;
    if(!CARD_DOCS[_curCard])CARD_DOCS[_curCard]=[];
    CARD_DOCS[_curCard].push({id:uid(),title:name,type:'folder',parentId});
    saveAll();renderDocList();closeFolderModal();
  }
}

/* ══ DOC TYPE MODAL ══ */
let _docTargetFolder=null;
function openDocTypeModalIn(folderId){_docTargetFolder=folderId;openDocTypeModal();}
function openDocTypeModal(){document.getElementById('docTypeOverlay').classList.add('open');}
function closeDocTypeModal(){document.getElementById('docTypeOverlay').classList.remove('open');}

/* ══ DOC EMOJI PICKER ══ */
const DOC_EMOJIS=['📌','🔥','⭐','💡','✅','❌','📝','💬','🎯','🚀','📢','💰','🔒','❓','❗','💎','🎨','🔧','📊','📚','🧩','🏆','🎉','👀','💪','⚡','🌟','♻️','🔔','💻'];
let _docEmojiTargetId='';
let _docCustomImgs=[];
// Supabase에서 커스텀 이미지 이모지 불러오기
(async function(){try{const row=await _sbRest.selectOne('site_data','hub_doc_custom_emojis');if(row){const v=typeof row==='object'&&row.value!==undefined?row.value:row;_docCustomImgs=typeof v==='string'?JSON.parse(v):v;if(!Array.isArray(_docCustomImgs))_docCustomImgs=[];}}catch{}})();

function openDocEmojiPicker(docId){
  _docEmojiTargetId=docId;
  const docs=CARD_DOCS[_curCard]||[];
  const doc=docs.find(d=>d.id===docId);
  const curEmoji=doc?.docEmoji||'';
  _renderDocEmojiGrid(curEmoji);
  document.getElementById('docEmojiOverlay').classList.add('open');
}
function closeDocEmojiPicker(){document.getElementById('docEmojiOverlay').classList.remove('open');_docEmojiTargetId='';}

function _renderDocEmojiGrid(curEmoji){
  const grid=document.getElementById('docEmojiGrid');if(!grid)return;
  // 이모지 없음 버튼
  let html='<div class="de-emoji-btn'+(curEmoji===''?' sel':'')+'" onclick="pickDocEmoji(this,\'\')" data-emoji="" title="이모지 제거">✖</div>';
  html+=DOC_EMOJIS.map(e=>{
    const isSel=e===curEmoji;
    return'<div class="de-emoji-btn'+(isSel?' sel':'')+'" onclick="pickDocEmoji(this,\''+e+'\')" data-emoji="'+e+'">'+e+'</div>';
  }).join('');
  // 커스텀 이미지 이모지 (삭제 버튼 포함)
  html+=_docCustomImgs.map(ci=>{
    const isSel=ci.dataUrl===curEmoji;
    return'<div class="de-emoji-btn de-custom'+(isSel?' sel':'')+'" onclick="pickDocImgEmoji(this,\''+ci.id+'\')" data-imgid="'+ci.id+'">'
      +'<img src="'+ci.dataUrl+'" style="width:22px;height:22px;object-fit:contain;border-radius:3px;">'
      +'<button class="de-emoji-del" onclick="event.stopPropagation();deleteDocCustomEmoji(\''+ci.id+'\')" title="이모지 삭제">−</button>'
      +'</div>';
  }).join('');
  grid.innerHTML=html;
}

function deleteDocCustomEmoji(imgId){
  const ci=_docCustomImgs.find(x=>x.id===imgId);
  if(!ci)return;
  // 사용 중인 문서 목록 확인
  const usingDocs=[];
  Object.entries(CARD_DOCS).forEach(([key,docs])=>{
    (docs||[]).forEach(d=>{if(d.docEmoji===ci.dataUrl)usingDocs.push(d.title||'제목 없음');});
  });
  let msg='이 커스텀 이모지를 삭제하시겠습니까?';
  if(usingDocs.length>0){
    msg='이 이모지를 사용 중인 문서가 '+usingDocs.length+'개 있습니다:\n\n'
      +usingDocs.map(t=>'• '+t).join('\n')
      +'\n\n삭제하면 해당 문서의 이모지도 함께 제거됩니다.\n정말 삭제하시겠습니까?';
  }
  if(!confirm(msg))return;
  _docCustomImgs=_docCustomImgs.filter(x=>x.id!==imgId);
  _sbSet('hub_doc_custom_emojis',_docCustomImgs);
  Object.values(CARD_DOCS).forEach(docs=>{
    (docs||[]).forEach(d=>{if(d.docEmoji===ci.dataUrl)d.docEmoji='';});
  });
  saveAll();renderDocList();
  const docs=CARD_DOCS[_curCard]||[];
  const doc=_docEmojiTargetId?docs.find(d=>d.id===_docEmojiTargetId):null;
  _renderDocEmojiGrid(doc?.docEmoji||'');
  toast('커스텀 이모지가 삭제되었습니다.');
}

function pickDocEmoji(el,emoji){
  if(!_docEmojiTargetId)return;
  const docs=CARD_DOCS[_curCard]||[];
  const doc=docs.find(d=>d.id===_docEmojiTargetId);
  if(doc){doc.docEmoji=emoji;saveAll();renderDocList();}
  closeDocEmojiPicker();
  toast(emoji?'이모지가 설정되었습니다.':'이모지가 제거되었습니다.');
}
function pickDocImgEmoji(el,imgId){
  const ci=_docCustomImgs.find(x=>x.id===imgId);
  if(!ci||!_docEmojiTargetId)return;
  const docs=CARD_DOCS[_curCard]||[];
  const doc=docs.find(d=>d.id===_docEmojiTargetId);
  if(doc){doc.docEmoji=ci.dataUrl;saveAll();renderDocList();}
  closeDocEmojiPicker();
  toast('이모지가 설정되었습니다.');
}
function uploadDocEmojiImg(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    const img=new Image();img.onload=async()=>{
      const c=document.createElement('canvas');
      const sz=64;c.width=sz;c.height=sz;
      const sc=Math.min(sz/img.width,sz/img.height);
      const w=img.width*sc,h=img.height*sc;
      c.getContext('2d').drawImage(img,(sz-w)/2,(sz-h)/2,w,h);
      const dataUrl=c.toDataURL('image/png');
      const url=await _uploadImgToStorage(dataUrl);
      _docCustomImgs.push({id:uid(),dataUrl:url});
      _sbSet('hub_doc_custom_emojis',_docCustomImgs);
      // 현재 doc에 바로 적용
      if(_docEmojiTargetId){
        const docs=CARD_DOCS[_curCard]||[];
        const doc=docs.find(d=>d.id===_docEmojiTargetId);
        if(doc){doc.docEmoji=url;saveAll();renderDocList();}
      }
      _renderDocEmojiGrid(url);
      toast('이미지 이모지가 추가되었습니다.');
    };img.src=ev.target.result;
  };reader.readAsDataURL(file);
  e.target.value='';
}

/* ══ DOC VIEWER ══ */
let _curDocId='';
async function openDocViewer(docId){
  const docs=CARD_DOCS[_curCard]||[];const d=docs.find(x=>x.id===docId);if(!d)return;
  _curDocId=docId;
  document.getElementById('dvTitle').textContent=d.title;
  let content='';
  let raw=null;

  // 캘린더 타입: 항상 buildInteractiveCal()로 재생성
  // Supabase에 저장된 구버전 HTML은 사용하지 않음
  if(d.type==='calendar'){
    let calMeta=d.calMeta||(CAL_DOC_CFG[docId]&&CAL_DOC_CFG[docId].meta)||null;
    // calMeta 없으면 Supabase에서 메타만 추출
    if(!calMeta){
      try{
        const row=await _sbRest.selectOne('site_data','hub_doc_'+docId);
        if(row){
          const v=typeof row==='object'&&row.value!==undefined?row.value:row;
          const rawStr=typeof v==='string'?v:JSON.stringify(v);
          const mM=rawStr.match(/const MONTHS=(\[[^\]]*\])/);
          const yM=rawStr.match(/const BASE_YEAR=(\d+)/);
          if(mM&&yM){
            calMeta={baseYear:parseInt(yM[1]),months:JSON.parse(mM[1]),title:d.title};
            d.calMeta=calMeta;
            if(!CAL_DOC_CFG[docId])CAL_DOC_CFG[docId]={};
            CAL_DOC_CFG[docId].meta=calMeta;
            // 구버전 HTML 삭제 (더 이상 불필요)
            _sbRest.delete('site_data','hub_doc_'+docId).catch(()=>{});
            saveAll();
          }
        }
      }catch(ex){console.warn('calMeta 추출 실패:',ex&&ex.message);}
    }
    const cfg=CAL_DOC_CFG[docId]||{};
    if(calMeta){
      content=buildInteractiveCal(calMeta.baseYear,calMeta.months,calMeta.title||d.title,cfg);
    }else{
      content='<div style="font-family:sans-serif;padding:40px;text-align:center;color:#666">'
        +'<p style="font-size:1.1rem;margin-bottom:16px">📅 캘린더를 불러올 수 없습니다.</p>'
        +'<p>이 문서를 <b>삭제</b>하고 <b>문서 추가 → 캘린더 만들기</b>로 다시 만들어주세요.</p>'
        +'</div>';
    }
    // 캘린더는 여기서 바로 렌더링
    document.getElementById('docViewerView').style.display='block';
    document.getElementById('cardDetailView').style.display='none';
    const dvBackEl=document.getElementById('dvBack');if(dvBackEl)dvBackEl.style.display=IS_SHARE?'none':'';
    const dvCalBtns=document.getElementById('dvCalBtns');if(dvCalBtns)dvCalBtns.style.display=IS_SHARE?'none':'flex';
    const dvExportBtn=document.getElementById('dvExportBtn');if(dvExportBtn)dvExportBtn.style.display='none';
    window._curDocContent=content;window._curDocTitle=d.title;
    // srcdoc 강제 초기화 후 설정 (이전 캐시 방지)
    const frame=document.getElementById('docFrame');
    frame.srcdoc='';
    setTimeout(()=>{ frame.srcdoc=content; },10);
    const url=new URL(window.location);url.searchParams.set('doc',docId);history.pushState({},'',url);
    window.scrollTo(0,0);
    return; // 여기서 종료
  }

  // 캘린더 외 타입: Supabase에서 raw 읽기
  try{
    const row=await _sbRest.selectOne('site_data','hub_doc_'+docId);
    if(row){
      const v=typeof row==='object'&&row.value!==undefined?row.value:row;
      raw=typeof v==='string'?v:JSON.stringify(v);
    }
  }catch(e){console.warn('Supabase doc 불러오기 실패: '+((e&&e.message)||String(e)));}
  if(raw&&raw.startsWith('"')&&raw.endsWith('"')){
    try{const decoded=JSON.parse(raw);if(typeof decoded==='string')raw=decoded;}catch{}
  }

  if(d.type==='gallery'){
    let stored={images:[]};try{stored=JSON.parse(raw)||stored;}catch{}
    const imgs=stored.images||[];
    const imgRows=imgs.map((img,i)=>`<div class="wt-img-wrap"><img src="${img.data}" alt="이미지 ${i+1}" loading="lazy" decoding="async"></div>`).join('');
    content=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=5.0">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#1C1C1C;color:#fff;font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;-webkit-font-smoothing:antialiased;}
.wt-header{position:sticky;top:0;z-index:10;background:rgba(20,20,20,.97);backdrop-filter:blur(8px);padding:10px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.07);}
.wt-title{font-size:.88rem;font-weight:700;color:#F0F0F0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:72%;}
.wt-meta{font-size:.72rem;color:#777;white-space:nowrap;}
.wt-container{max-width:800px;margin:0 auto;background:#111;}
.wt-img-wrap{width:100%;display:block;line-height:0;font-size:0;}
.wt-img-wrap img{
  width:100%;
  height:auto;
  display:block;
  opacity:0;
  transition:opacity .25s ease;
  background:#111;
}
.wt-img-wrap img.visible{opacity:1;}
.wt-end{text-align:center;padding:48px 20px 60px;color:#555;font-size:.84rem;background:#111;}
.wt-end .wt-end-icon{font-size:2rem;margin-bottom:10px;}
.wt-end .wt-end-text{color:#444;}
.wt-progress{position:fixed;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,.06);z-index:20;pointer-events:none;}
.wt-progress-bar{height:100%;background:#D91F3E;will-change:width;}
</style></head>
<body>
<div class="wt-header">
  <span class="wt-title">${d.title}</span>
  <span class="wt-meta">${imgs.length}컷</span>
</div>
<div class="wt-container">
  ${imgRows||'<div class="wt-end"><div class="wt-end-icon">📜</div><div class="wt-end-text">이미지가 없습니다.</div></div>'}
  ${imgs.length?'<div class="wt-end"><div class="wt-end-icon">✓</div><div class="wt-end-text">완독했습니다.</div></div>':''}
</div>
<div class="wt-progress"><div class="wt-progress-bar" id="progBar" style="width:0"></div></div>
<script>
// 이미지 로드 시 페이드인
const imgs=document.querySelectorAll('.wt-img-wrap img');
imgs.forEach(img=>{
  if(img.complete&&img.naturalWidth){img.classList.add('visible');}
  else{
    img.addEventListener('load',()=>img.classList.add('visible'),{once:true});
    img.addEventListener('error',()=>{img.style.minHeight='40px';img.classList.add('visible');},{once:true});
  }
});
// 스크롤 진행바 (rAF 최적화)
const bar=document.getElementById('progBar');
let ticking=false;
window.addEventListener('scroll',()=>{
  if(!ticking){requestAnimationFrame(()=>{
    const h=document.documentElement;
    const max=h.scrollHeight-h.clientHeight;
    bar.style.width=(max>0?Math.min(h.scrollTop/max*100,100):100)+'%';
    ticking=false;
  });ticking=true;}
},{passive:true});
<\/script>
</body></html>`;
  }else if(d.type==='refdoc'){    let stored={leftColumns:[],markers:[],pages:[],splitRatio:70};try{stored=JSON.parse(raw)||stored;}catch{}
    // 구버전 호환
    if(stored.images&&!stored.pages){
      stored={leftColumns:[{id:'c1',name:'페이지'}],markers:[],splitRatio:70,
        pages:stored.images.map((img,i)=>({id:img.id||'p'+i,leftValues:[String(i+1)],images:[{data:img.data}],opinion:img.text||'',tags:[]}))};
    } else if(stored.columns&&!stored.leftColumns){
      // v2 형식
      stored.leftColumns=[{id:'c1',name:'페이지'}];
      stored.pages=(stored.pages||[]).map((p,i)=>({id:p.id||'p'+i,leftValues:[p.name||String(i+1)],images:(p.images||[]).map(img=>({data:img.data||''})),opinion:p.opinion||'',tags:p.tags||[]}));
    }
    const lCols=stored.leftColumns||[{id:'c1',name:'페이지'}];
    const markers=stored.markers||[];
    const maxImgCols=Math.max(1,...(stored.pages||[]).map(p=>(p.images||[]).length));
    const lcHeaders=lCols.map(c=>`<th class="rv-th">${(c.name||'').replace(/</g,'&lt;')}</th>`).join('');
    const imgHeaders=Array.from({length:maxImgCols},(_,i)=>`<th class="rv-th">이미지 ${i+1}</th>`).join('');
    const rowsHtml=(stored.pages||[]).map(page=>{
      const lcCells=(page.leftValues||[]).map(v=>`<td class="rv-td rv-pg-td">${(v||'').replace(/</g,'&lt;')}</td>`).join('');
      const imgCells=Array.from({length:maxImgCols},(_, ci)=>{
        const img=(page.images||[])[ci];
        if(!img||!img.data)return`<td class="rv-td rv-img-td"><span class="rv-no-img">${ci<(page.images||[]).length?'이미지 없음':''}</span></td>`;
        const lblHtml=img.label?`<div class="rv-img-name">${img.label.replace(/</g,'&lt;')}</div>`:'';
        return`<td class="rv-td rv-img-td">${lblHtml}<img src="${img.data}" alt=""></td>`;
      }).join('');
      const pageTags=(page.tags||[]).map(tid=>{const m=markers.find(x=>x.id===tid);return m?`<span class="rv-tag" style="background:${m.color}">${m.name.replace(/</g,'&lt;')}</span>`:''}).join('');
      const opinionHtml=page.opinion||'<span style="color:#8B95A1">내용 없음</span>';
      return`<tr>${lcCells}${imgCells}
        <td class="rv-td rv-op-td"><div class="rv-tags">${pageTags}</div><div class="rv-opinion">${opinionHtml}</div></td>
      </tr>`;
    }).join('');
    content=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#F5F6FA;color:#191F28;}
h1{font-size:1.25rem;font-weight:800;padding:16px 24px;border-bottom:1px solid #E5E8EB;background:#fff;position:sticky;top:0;z-index:10;}
.rv-table{width:100%;border-collapse:collapse;background:#fff;}
.rv-th{padding:10px 14px;background:#F7F8FA;border:1px solid #E5E8EB;font-size:.78rem;font-weight:700;text-align:center;white-space:nowrap;position:sticky;top:52px;z-index:5;}
.rv-td{padding:12px;border:1px solid #E5E8EB;vertical-align:top;}
.rv-pg-td{width:60px;text-align:center;font-weight:800;font-size:1rem;background:#FAFBFC;}
.rv-img-td{text-align:center;background:#ECEEF2;min-width:160px;}
.rv-img-td img{max-width:100%;max-height:400px;object-fit:contain;border-radius:6px;}
.rv-img-name{font-size:.72rem;font-weight:700;color:#4E5968;margin-bottom:6px;padding:3px 6px;background:#fff;border-radius:4px;display:inline-block;}
.rv-no-img{font-size:.78rem;color:#8B95A1;}
.rv-op-td{min-width:200px;line-height:1.8;font-size:.88rem;}
.rv-opinion h1{font-size:1.3rem;margin:8px 0 4px;}.rv-opinion h2{font-size:1.1rem;margin:6px 0 3px;}.rv-opinion h3{font-size:.95rem;margin:4px 0 2px;}
.rv-opinion blockquote{border-left:3px solid #ccc;padding-left:10px;color:#555;margin:4px 0;}
.rv-opinion ul,.rv-opinion ol{padding-left:20px;margin:4px 0;}
.rv-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;}
.rv-tag{display:inline-block;padding:2px 8px;border-radius:12px;color:#fff;font-size:.68rem;font-weight:700;}
@media(max-width:640px){.rv-img-td{min-width:100px;} .rv-op-td{min-width:120px;}}
</style></head>
<body><h1>${d.title}</h1>
<table class="rv-table"><thead><tr>${lcHeaders}${imgHeaders}<th class="rv-th">의견</th></tr></thead>
<tbody>${rowsHtml||'<tr><td colspan="99" style="padding:24px;color:#8B95A1;text-align:center;">페이지가 없습니다.</td></tr>'}</tbody></table>
</body></html>`;
  // calendar 타입은 위에서 early return으로 처리됨
  }else if(d.type==='richtext'){
    openRichViewer(docId);
    return;
  }else{
    content=wrapHtml(raw||'');
  }

  document.getElementById('docViewerView').style.display='block';
  document.getElementById('cardDetailView').style.display='none';
  // IS_SHARE가 아닐 때만 dvBack 표시
  const dvBackEl=document.getElementById('dvBack');
  if(dvBackEl) dvBackEl.style.display=IS_SHARE?'none':'';
  // 캘린더 문서 버튼 표시
  const dvCalBtns=document.getElementById('dvCalBtns');
  if(dvCalBtns) dvCalBtns.style.display=(d.type==='calendar'&&!IS_SHARE)?'flex':'none';
  // HTML 내보내기 버튼: html 타입에만 표시
  const dvExportBtn=document.getElementById('dvExportBtn');
  if(dvExportBtn) dvExportBtn.style.display=(d.type==='html'&&!IS_SHARE)?'inline-flex':'none';
  // 현재 문서 타입 저장 (내보내기용)
  window._curDocContent=content;window._curDocTitle=d.title;
  // 모든 타입에 srcdoc 사용 (가장 안정적)
  // href="#" 클릭이 부모 페이지로 전달되는 것을 차단하는 스크립트 주입
  const injectScript = `<script>
    document.addEventListener('click',function(e){
      var a=e.target.closest('a');
      if(a&&a.getAttribute('href')==='#'){e.preventDefault();return false;}
    });
    // scrollTo 패치
    window._scrollToTop=function(){window.scrollTo({top:0,behavior:'smooth'});};
  <\/script>`;
  const fixedContent = content.includes('</body>') ? content.replace('</body>', injectScript+'</body>') : content + injectScript;
  document.getElementById('docFrame').srcdoc=fixedContent;
  const url=new URL(window.location);url.searchParams.set('doc',docId);history.pushState({},'',url);
  window.scrollTo(0,0);
}
function closeDocViewer(){
  document.getElementById('docViewerView').style.display='none';
  document.getElementById('cardDetailView').style.display='block';
  const url=new URL(window.location);url.searchParams.delete('doc');history.pushState({},'',url);
  window.scrollTo(0,0);
}
function exportCurrentDoc(){
  const content=window._curDocContent||'';
  const title=window._curDocTitle||'document';
  const blob=new Blob([content],{type:'text/html;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`${title}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('HTML 파일이 저장됩니다.');
}
function shareDocLink(docId){
  const url=new URL(window.location);
  url.searchParams.set('card',_curCard);
  url.searchParams.set('doc',docId);
  url.searchParams.set('share','1');
  _shareBaseUrl = url.toString();
  _openSharePop();
}

/* ══ REF DOC (이미지 의견 문서 작성) ══ */
let _rdData={leftColumns:[{id:'_lc0',name:'페이지'}],markers:[],pages:[],splitRatio:70};
let _editRefDocId='';
let _rdUploadTarget=null;
let _rdResizing=false;
let _rdColorPickerPi=-1;
const RD_COLORS=['#E53935','#D81B60','#C2185B','#AB47BC','#7B1FA2','#5C6BC0','#3F51B5','#1E88E5','#039BE5','#0097A7','#00897B','#2E9E50','#43A047','#689F38','#9E9D24','#F9A825','#FFB300','#FF8F00','#FF7A00','#FF5722','#8D6E63','#795548','#6D4C41','#78909C','#607D8B','#455A64','#263238','#E91E63','#00BCD4','#191F28'];

function _rdSync(){
  _rdData.pages.forEach((p,pi)=>{
    (p.leftValues||[]).forEach((_,li)=>{const inp=document.getElementById('rdLV-'+pi+'-'+li);if(inp)p.leftValues[li]=inp.value;});
    p.images.forEach((img,ci)=>{const lbl=document.getElementById('rdImgLbl-'+pi+'-'+ci);if(lbl)img.label=lbl.value;});
    const opEl=document.getElementById('rdOpinion-'+pi);if(opEl)p.opinion=opEl.innerHTML;
  });
  _rdData.leftColumns.forEach((col,li)=>{const inp=document.getElementById('rdLCName-'+li);if(inp)col.name=inp.value;});
}

async function openRefDocModal(docId=''){
  _editRefDocId=docId;closeDocTypeModal();
  document.getElementById('rdTitle').value='';
  _rdData={leftColumns:[{id:'_lc0',name:'페이지'}],markers:[],pages:[{id:'_p0',leftValues:['1'],images:[{data:'',label:''}],opinion:'',tags:[]}],splitRatio:70};
  if(docId){
    const d=(CARD_DOCS[_curCard]||[]).find(x=>x.id===docId);
    document.getElementById('rdTitle').value=d?.title||'';
    const stored=await _readDocObjAsync(docId);
    if(stored&&typeof stored==='object'){
      if(stored.leftColumns){_rdData=stored;_rdData.pages.forEach(p=>(p.images||[]).forEach(img=>{if(!img.label)img.label='';}));}
      else if(stored.columns&&stored.pages){_rdData.leftColumns=[{id:uid(),name:'페이지'}];_rdData.markers=stored.markers||[];_rdData.splitRatio=stored.splitRatio||70;_rdData.pages=stored.pages.map((p,i)=>({id:p.id||uid(),leftValues:[p.name||String(i+1)],images:(p.images||[]).map(img=>({data:img.data||'',label:img.label||img.name||''})),opinion:p.opinion||'',tags:p.tags||[]}));}
      else if(stored.images){_rdData.leftColumns=[{id:uid(),name:'페이지'}];_rdData.markers=[];_rdData.splitRatio=70;_rdData.pages=stored.images.map((img,i)=>({id:img.id||uid(),leftValues:[String(i+1)],images:[{data:img.data||'',label:''}],opinion:img.text||'',tags:[]}));}
    }
  }
  document.getElementById('refDocOverlay').classList.add('open');renderRdEditor();
  setTimeout(()=>document.getElementById('rdTitle').focus(),180);
}
function closeRefDocModal(){document.getElementById('refDocOverlay').classList.remove('open');_rdCloseColorPicker();}

function rdAddLeftCol(){_rdSync();if(_rdData.leftColumns.length>=3){toast('왼쪽 영역은 최대 3개까지 가능합니다.');return;}_rdData.leftColumns.push({id:uid(),name:'항목'+(_rdData.leftColumns.length+1)});_rdData.pages.forEach(p=>{if(!p.leftValues)p.leftValues=[];p.leftValues.push('');});renderRdEditor();}
function rdDelLeftCol(li){_rdSync();if(_rdData.leftColumns.length<=1){toast('최소 1개의 왼쪽 영역이 필요합니다.');return;}_rdData.leftColumns.splice(li,1);_rdData.pages.forEach(p=>{if(p.leftValues)p.leftValues.splice(li,1);});renderRdEditor();}
function rdAddImgCol(pi){_rdSync();if(_rdData.pages[pi].images.length>=3){toast('이미지는 페이지당 최대 3개입니다.');return;}_rdData.pages[pi].images.push({data:'',label:''});renderRdEditor();}
function rdDelImgCol(pi,ci){_rdSync();if(_rdData.pages[pi].images.length<=1){toast('최소 1개의 이미지가 필요합니다.');return;}_rdData.pages[pi].images.splice(ci,1);renderRdEditor();}
function rdAddPage(){_rdSync();const lv=_rdData.leftColumns.map(()=>'');lv[0]=String(_rdData.pages.length+1);_rdData.pages.push({id:uid(),leftValues:lv,images:[{data:'',label:''}],opinion:'',tags:[]});renderRdEditor();const ct=document.querySelector('#refDocOverlay .modal > div:last-child');if(ct)setTimeout(()=>ct.scrollTop=ct.scrollHeight,100);}
function rdDelPage(pi){_rdSync();if(!confirm('이 페이지를 삭제하시겠습니까?'))return;_rdData.pages.splice(pi,1);renderRdEditor();}

function rdClickImgSlot(pi,ci){_rdUploadTarget={pageIdx:pi,colIdx:ci};document.getElementById('rdFileIn').click();}
async function _rdUploadAndSet(dataUrl,pi,ci){toast('이미지 업로드 중...');const url=await _uploadImgToStorage(dataUrl);if(_rdData.pages[pi]&&_rdData.pages[pi].images[ci]){_rdData.pages[pi].images[ci].data=url;renderRdEditor();toast('업로드 완료');}}
function handleRdImageSlotNew(e){const file=e.target.files[0];if(!file||!_rdUploadTarget)return;const{pageIdx,colIdx}=_rdUploadTarget;_rdSync();const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=async()=>{const c=document.createElement('canvas');const MAX=1200;const sc=Math.min(MAX/img.width,MAX/img.height,1);c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);await _rdUploadAndSet(c.toDataURL('image/jpeg',.85),pageIdx,colIdx);};img.src=ev.target.result;};reader.readAsDataURL(file);e.target.value='';_rdUploadTarget=null;}
function rdHandlePaste(e,pi,ci){const items=(e.clipboardData||e.originalEvent.clipboardData).items;for(const item of items){if(item.type.indexOf('image')!==-1){e.preventDefault();const blob=item.getAsFile();const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=async()=>{_rdSync();const c=document.createElement('canvas');const MAX=1200;const sc=Math.min(MAX/img.width,MAX/img.height,1);c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);await _rdUploadAndSet(c.toDataURL('image/jpeg',.85),pi,ci);};img.src=ev.target.result;};reader.readAsDataURL(blob);return;}}}

/* ── 마커 편집 ── */
function openRdMarkerEditor(){_rdSync();renderRdMarkerList();document.getElementById('rdMarkerOverlay').classList.add('open');}
function closeRdMarkerEditor(){document.getElementById('rdMarkerOverlay').classList.remove('open');renderRdEditor();}
let _rdNewMarkerColor=RD_COLORS[0];
function rdPickNewColor(c){_rdNewMarkerColor=c;document.querySelectorAll('.rd2-mk-pick').forEach(el=>el.classList.toggle('sel',el.dataset.c===c));}
function rdAddMarker(){const name=document.getElementById('rdNewMarkerName').value.trim();if(!name){toast('마커 이름을 입력해주세요.');return;}_rdData.markers.push({id:uid(),name,color:_rdNewMarkerColor});document.getElementById('rdNewMarkerName').value='';renderRdMarkerList();}
function rdDelMarker(mi){const m=_rdData.markers[mi];_rdData.pages.forEach(p=>{p.tags=(p.tags||[]).filter(t=>t!==m.id);});_rdData.markers.splice(mi,1);renderRdMarkerList();}
function rdEditMarkerName(mi,v){_rdData.markers[mi].name=v;}
function rdPickMarkerColor(mi,c){_rdData.markers[mi].color=c;renderRdMarkerList();}
function rdToggleMarkerPalette(mi){const el=document.getElementById('rdMkPal-'+mi);if(el)el.style.display=el.style.display==='none'?'flex':'none';}
function renderRdMarkerList(){
  const list=document.getElementById('rdMarkerList');
  const palette='<div class="rd2-mk-palette">'+RD_COLORS.map(c=>'<span class="rd2-mk-pick'+(_rdNewMarkerColor===c?' sel':'')+'" data-c="'+c+'" style="background:'+c+'" onclick="rdPickNewColor(\''+c+'\')"></span>').join('')+'</div>';
  const addArea='<div class="rd2-mk-add-row"><span class="rd2-mk-preview" style="background:'+_rdNewMarkerColor+'"></span><input type="text" id="rdNewMarkerName" placeholder="마커 이름 입력" class="rd2-mk-name-in"><button class="mbtn-s" onclick="rdAddMarker()">추가</button></div>';
  const tagsHtml=_rdData.markers.length?'<div class="rd2-mk-tag-list">'+_rdData.markers.map((m,mi)=>'<div class="rd2-mk-tag-item"><span class="rd2-mk-tag-dot" style="background:'+m.color+'"></span><input class="rd2-mk-tag-name" value="'+m.name+'" oninput="rdEditMarkerName('+mi+',this.value)"><button class="rd2-mk-tag-color" onclick="rdToggleMarkerPalette('+mi+')" title="색상 변경" style="color:'+m.color+'">●</button><button class="rd2-mk-tag-del" onclick="rdDelMarker('+mi+')" title="삭제">✕</button><div class="rd2-mk-tag-palette" id="rdMkPal-'+mi+'" style="display:none;">'+RD_COLORS.map(c=>'<span class="rd2-mk-pick'+(m.color===c?' sel':'')+'" style="background:'+c+'" onclick="rdPickMarkerColor('+mi+',\''+c+'\')"></span>').join('')+'</div></div>').join('')+'</div>':'<p style="font-size:.8rem;color:var(--t3);padding:4px 0;">등록된 마커가 없습니다.</p>';
  list.innerHTML=palette+addArea+'<div style="margin-top:12px;border-top:1px solid var(--bd);padding-top:10px;"><div style="font-size:.76rem;font-weight:700;color:var(--t2);margin-bottom:6px;">등록된 마커</div>'+tagsHtml+'</div>';
}

function rdToggleTag(pi,markerId){_rdSync();const p=_rdData.pages[pi];if(!p.tags)p.tags=[];const idx=p.tags.indexOf(markerId);if(idx===-1)p.tags.push(markerId);else p.tags.splice(idx,1);renderRdEditor();}

function rdStartResize(e){e.preventDefault();_rdResizing=true;const modal=document.querySelector('#refDocOverlay .modal');const lcEl=document.querySelector('.rd2-header-row .rd2-left-zone');const lcWpx=lcEl?lcEl.getBoundingClientRect().width:70;const onMove=ev=>{if(!_rdResizing)return;const rect=modal.getBoundingClientRect();const clientX=ev.touches?ev.touches[0].clientX:ev.clientX;const availW=rect.width-lcWpx-12;const imgW=clientX-rect.left-lcWpx;const pct=(imgW/availW)*100;_rdData.splitRatio=Math.max(25,Math.min(85,pct));document.querySelectorAll('.rd2-img-zone').forEach(el=>el.style.width=_rdData.splitRatio+'%');document.querySelectorAll('.rd2-txt-zone').forEach(el=>el.style.width=(100-_rdData.splitRatio)+'%');};const onUp=()=>{_rdResizing=false;document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);document.removeEventListener('touchmove',onMove);document.removeEventListener('touchend',onUp);};document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);document.addEventListener('touchmove',onMove,{passive:false});document.addEventListener('touchend',onUp);}

/* ── 글자색 팝업 ── */
function rdOpenColorPicker(pi){_rdCloseColorPicker();_rdColorPickerPi=pi;const el=document.getElementById('rdColorPop-'+pi);if(el)el.style.display='flex';}
function _rdCloseColorPicker(){document.querySelectorAll('.rd2-color-pop').forEach(el=>el.style.display='none');_rdColorPickerPi=-1;}
function rdApplyColor(pi,c){const el=document.getElementById('rdOpinion-'+pi);if(el)el.focus();rdExec('foreColor',c);_rdCloseColorPicker();}

function rdExec(cmd,val){document.execCommand(cmd,false,val||null);}
function rdFmt(pi,cmd,val){const el=document.getElementById('rdOpinion-'+pi);if(el)el.focus();rdExec(cmd,val);}

/* ── 마크다운: keydown에서 Space/Enter로 트리거 ── */
function rdHandleOpinionKeydown(e,pi){
  const opEl=document.getElementById('rdOpinion-'+pi);if(!opEl)return;
  if(e.ctrlKey||e.metaKey){if(e.key==='b'){e.preventDefault();rdExec('bold');return;}if(e.key==='i'){e.preventDefault();rdExec('italic');return;}if(e.key==='u'){e.preventDefault();rdExec('underline');return;}if(e.key==='d'){e.preventDefault();rdExec('strikeThrough');return;}}
  if(e.key==='Tab'){e.preventDefault();rdExec('insertText','    ');return;}
  if(e.key===' '||e.key==='Spacebar'){
    const sel=window.getSelection();if(!sel.rangeCount)return;
    const range=sel.getRangeAt(0);const nd=range.startContainer;
    const beforeCaret=nd.nodeType===3?nd.textContent.substring(0,range.startOffset):'';
    let mdMatch=null;
    if(beforeCaret==='###') mdMatch={tag:'h3'};
    else if(beforeCaret==='##') mdMatch={tag:'h2'};
    else if(beforeCaret==='#') mdMatch={tag:'h1'};
    else if(beforeCaret==='-'||beforeCaret==='*') mdMatch={cmd:'insertUnorderedList'};
    else if(beforeCaret==='1.') mdMatch={cmd:'insertOrderedList'};
    else if(beforeCaret==='>') mdMatch={tag:'blockquote'};
    if(mdMatch){e.preventDefault();if(nd.nodeType===3){nd.textContent=nd.textContent.substring(range.startOffset);}if(mdMatch.cmd)rdExec(mdMatch.cmd);else if(mdMatch.tag)rdExec('formatBlock','<'+mdMatch.tag+'>');return;}
  }
  if(e.key==='Enter'&&!e.shiftKey){
    const sel=window.getSelection();if(!sel.rangeCount)return;let nd=sel.getRangeAt(0).startContainer;if(nd.nodeType===3)nd=nd.parentNode;const txt=(nd.textContent||'').trim();
    if(txt==='---'){e.preventDefault();nd.textContent='';rdExec('insertHorizontalRule');return;}
    const bq=nd.closest&&nd.closest('blockquote');if(bq&&!txt){e.preventDefault();const p=document.createElement('p');p.innerHTML='<br>';bq.parentNode.insertBefore(p,bq.nextSibling);_rdPlaceCaret(p);return;}
  }
}
function rdHandleOpinionInput(e,pi){
  const sel=window.getSelection();if(!sel.rangeCount)return;let nd=sel.getRangeAt(0).startContainer;if(nd.nodeType===3)nd=nd.parentNode;
  const block=nd.closest?nd.closest('div,p,li,h1,h2,h3,blockquote,span'):nd;
  if(!block||block===document.getElementById('rdOpinion-'+pi))return;
  const html=block.innerHTML||'';let changed=false,nw=html;
  if(/\*\*(.+?)\*\*/.test(nw)){nw=nw.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');changed=true;}
  else if(/(?<!\*)\*([^*]+?)\*(?!\*)/.test(nw)){nw=nw.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g,'<i>$1</i>');changed=true;}
  else if(/~~(.+?)~~/.test(nw)){nw=nw.replace(/~~(.+?)~~/g,'<s>$1</s>');changed=true;}
  else if(/`([^`]+?)`/.test(nw)){nw=nw.replace(/`([^`]+?)`/g,'<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:.88em">$1</code>');changed=true;}
  if(changed){block.innerHTML=nw;_rdPlaceCaret(block);}
}
function _rdPlaceCaret(el){const r=document.createRange();const s=window.getSelection();r.selectNodeContents(el);r.collapse(false);s.removeAllRanges();s.addRange(r);}

/* ══ 메인 렌더 ══ */
function renderRdEditor(){
  const lc=_rdData.leftColumns,split=_rdData.splitRatio||70,txtW=100-split;
  // 헤더: 왼쪽 컬럼 가로 나란히
  const lcHdr=lc.map((col,li)=>'<div class="rd2-lc-hdr-cell"><input class="rd2-lc-name-in" id="rdLCName-'+li+'" value="'+(col.name||'')+'" placeholder="항목명">'+(lc.length>1?'<button class="rd2-lc-del" onclick="rdDelLeftCol('+li+')" title="삭제">✕</button>':'')+'</div>').join('');
  document.getElementById('rdColHeader').innerHTML='<div class="rd2-header-row"><div class="rd2-left-zone">'+lcHdr+(lc.length<3?'<button class="rd2-lc-add-btn" onclick="rdAddLeftCol()" title="＋">＋</button>':'')+'</div><div class="rd2-img-zone" style="width:'+split+'%"><span class="rd2-hdr-label">이미지</span></div><div class="rd2-resize-gutter" onmousedown="rdStartResize(event)" ontouchstart="rdStartResize(event)"><div class="rd2-resize-line"></div></div><div class="rd2-txt-zone" style="width:'+txtW+'%"><span class="rd2-hdr-label">의견</span></div></div>';

  const pagesHtml=_rdData.pages.map((page,pi)=>{
    if(!page.leftValues)page.leftValues=lc.map(()=>'');while(page.leftValues.length<lc.length)page.leftValues.push('');
    const lcCells=lc.map((col,li)=>'<div class="rd2-lc-val-cell"><input class="rd2-lc-val-in" id="rdLV-'+pi+'-'+li+'" value="'+(page.leftValues[li]||'')+'" placeholder="'+(col.name||'')+'"></div>').join('');
    const imgsHtml=page.images.map((img,ci)=>{
      const ic=img.data?'<img src="'+img.data+'" alt="">':'<div class="rd2-img-placeholder" onclick="rdClickImgSlot('+pi+','+ci+')">＋ 이미지<br><span style="font-size:.62rem;font-weight:400;color:var(--t3)">클릭 또는 Ctrl+V</span></div>';
      return'<div class="rd2-img-cell"><input class="rd2-img-lbl-in" id="rdImgLbl-'+pi+'-'+ci+'" value="'+(img.label||'')+'" placeholder="이미지명"><div class="rd2-img-box" '+(img.data?'onclick="rdClickImgSlot('+pi+','+ci+')"':'')+' onpaste="rdHandlePaste(event,'+pi+','+ci+')" tabindex="0">'+ic+'</div>'+(page.images.length>1?'<button class="rd2-img-del" onclick="rdDelImgCol('+pi+','+ci+')" title="삭제">✕</button>':'')+'</div>';
    }).join('');
    const addBtn=page.images.length<3?'<button class="rd2-img-add-btn" onclick="rdAddImgCol('+pi+')" title="이미지 추가">＋</button>':'';
    const mBtns=_rdData.markers.map(m=>{const act=(page.tags||[]).indexOf(m.id)!==-1;return'<button class="rd2-tag-btn'+(act?' active':'')+'" style="--mc:'+m.color+'" onclick="rdToggleTag('+pi+',\''+m.id+'\')"><span class="rd2-tag-dot" style="background:'+m.color+'"></span> '+m.name+'</button>';}).join('');
    const mArea=_rdData.markers.length?'<div class="rd2-tag-area">'+mBtns+'</div>':'';
    const cPop='<div class="rd2-color-pop" id="rdColorPop-'+pi+'">'+RD_COLORS.map(c=>'<span class="rd2-cp-swatch" style="background:'+c+'" onclick="rdApplyColor('+pi+',\''+c+'\')"></span>').join('')+'</div>';
    const tb='<div class="rd2-op-toolbar"><button onmousedown="event.preventDefault()" onclick="rdFmt('+pi+',\'bold\')" title="굵게"><b>B</b></button><button onmousedown="event.preventDefault()" onclick="rdFmt('+pi+',\'italic\')" title="기울임"><i>I</i></button><button onmousedown="event.preventDefault()" onclick="rdFmt('+pi+',\'underline\')" title="밑줄"><u>U</u></button><button onmousedown="event.preventDefault()" onclick="rdFmt('+pi+',\'strikeThrough\')" title="취소선"><s>S</s></button><span class="rd2-tb-sep"></span><button onmousedown="event.preventDefault()" onclick="rdFmt('+pi+',\'formatBlock\',\'<h2>\')" title="제목">H</button><button onmousedown="event.preventDefault()" onclick="rdFmt('+pi+',\'formatBlock\',\'<p>\')" title="본문">P</button><button onmousedown="event.preventDefault()" onclick="rdFmt('+pi+',\'insertUnorderedList\')" title="목록">•</button><button onmousedown="event.preventDefault()" onclick="rdFmt('+pi+',\'insertOrderedList\')" title="번호">1.</button><button onmousedown="event.preventDefault()" onclick="rdFmt('+pi+',\'formatBlock\',\'<blockquote>\')" title="인용">❝</button><span class="rd2-tb-sep"></span><button class="rd2-tb-color-btn" onmousedown="event.preventDefault();event.stopPropagation();" onclick="rdOpenColorPicker('+pi+')" title="글자색"><span class="rd2-tb-color-icon">A</span></button>'+cPop+'</div>';
    return'<div class="rd2-page-row" id="rdPageRow-'+pi+'"><div class="rd2-left-zone">'+lcCells+'<button class="rd2-pg-del" onclick="rdDelPage('+pi+')" title="삭제">✕</button></div><div class="rd2-img-zone" style="width:'+split+'%;display:flex;align-items:stretch;">'+imgsHtml+addBtn+'</div><div class="rd2-resize-gutter rd2-rg-passive"><div class="rd2-resize-line"></div></div><div class="rd2-txt-zone" style="width:'+txtW+'%;">'+mArea+tb+'<div class="rd2-opinion-area" id="rdOpinion-'+pi+'" contenteditable="true" oninput="rdHandleOpinionInput(event,'+pi+')" onkeydown="rdHandleOpinionKeydown(event,'+pi+')" data-placeholder="의견을 작성하세요.  #제목  -목록  >인용  **굵게**">'+(page.opinion||'')+'</div></div></div>';
  }).join('');
  document.getElementById('rdPageList').innerHTML=pagesHtml;
}

function saveRefDoc(){const title=document.getElementById('rdTitle').value.trim();if(!title){toast('제목을 입력해주세요.');return;}_rdSync();const stored={type:'refdoc',leftColumns:_rdData.leftColumns,markers:_rdData.markers,pages:_rdData.pages,splitRatio:_rdData.splitRatio};if(!CARD_DOCS[_curCard])CARD_DOCS[_curCard]=[];if(_editRefDocId){const d=CARD_DOCS[_curCard].find(x=>x.id===_editRefDocId);if(d)d.title=title;_localSave('hub_doc_'+_editRefDocId,stored);_sbSet('hub_doc_'+_editRefDocId,stored);}else{const id=uid();CARD_DOCS[_curCard].push({id,title,type:'refdoc',parentId:_docTargetFolder||null});_localSave('hub_doc_'+id,stored);_sbSet('hub_doc_'+id,stored);_docTargetFolder=null;}saveAll();renderDocList();closeRefDocModal();toast('이미지 의견 문서가 저장되었습니다.');}
/* ══ HTML EDITOR ══ */
let _editDocId='',_prevTimer=null;
async function _readDocRaw(docId){
  // Supabase에서 문서 내용 읽기
  let raw='';
  try{
    const row=await _sbRest.selectOne('site_data','hub_doc_'+docId);
    if(row&&row.value!=null){
      raw=typeof row.value==='string'?row.value:JSON.stringify(row.value);
    }
  }catch(e){console.warn('문서 로드 실패 ['+docId+']:',e&&e.message);}
  // 구버전 이중 인코딩 복구: '"<html>..."' → '<html>...'
  if(raw.startsWith('"')&&raw.endsWith('"')){
    try{const d=JSON.parse(raw);if(typeof d==='string')raw=d;}catch{}
  }
  return raw;
}
async function openHtmlEditor(docId=''){
  _editDocId=docId;closeDocTypeModal();
  document.getElementById('docEditorOverlay').classList.add('open');
  if(docId){
    const d=(CARD_DOCS[_curCard]||[]).find(x=>x.id===docId);
    document.getElementById('deTitle').value=d?.title||'';
    document.getElementById('deContent').value='불러오는 중...';
    updatePreview();
    const raw=await _readDocRaw(docId);
    document.getElementById('deContent').value=raw;
  }else{
    document.getElementById('deTitle').value='';
    document.getElementById('deContent').value='';
  }
  updatePreview();setTimeout(()=>document.getElementById('deTitle').focus(),200);
}
function editDoc(docId){
  const d=(CARD_DOCS[_curCard]||[]).find(x=>x.id===docId);if(!d)return;
  if(d.type==='refdoc')openRefDocModal(docId);
  else if(d.type==='gallery')openImgGallery(docId);
  else if(d.type==='richtext'){_reViewMode=false;openRichEditor(docId);}
  else if(d.type==='calendar')toast('캘린더 문서 설정은 문서를 열고 상단 ⚙ 설정 버튼을 이용하세요.');
  else openHtmlEditor(docId);
}

/* ══ RICH EDITOR (글쓰기 문서) ══ */
let _reEditDocId='';
let _reMemoObserver=null;
let _reViewMode=false; // 뷰어 모드 여부

/* 뷰어 모드로 열기 (목록에서 문서 클릭 시) */
function openRichViewer(docId){
  _reViewMode=true;
  openRichEditor(docId);
}

/* 편집 모드로 전환 */
function switchToEditMode(){
  if(IS_SHARE) return; // 공유 링크에서는 편집 불가
  _reViewMode=false;
  _applyReMode();
}

/* 뷰어/편집 모드 UI 전환 */
function _applyReMode(){
  const editor=document.getElementById('reEditor');
  const toolbar=document.getElementById('reToolbar');
  const titleIn=document.getElementById('reTitle');
  const viewTitle=document.getElementById('reViewTitle');
  const saveBtn=document.getElementById('reSaveBtn');
  const editBtn=document.getElementById('reEditBtn');
  const shareBtn=document.getElementById('reShareBtn');
  const viewPanelBtn=document.getElementById('reViewPanelBtn');
  const closeBtn=document.getElementById('reCloseBtn');

  if(_reViewMode){
    // 뷰어 모드 — 편집 완전 차단
    editor.contentEditable='false';
    editor.style.cursor='default';
    editor.style.userSelect='text';
    editor.setAttribute('data-view-mode','true');
    if(toolbar) toolbar.style.display='none';
    if(titleIn){ if(viewTitle) viewTitle.textContent=titleIn.value; titleIn.style.display='none'; }
    if(viewTitle) viewTitle.style.display='block';
    if(saveBtn) saveBtn.style.display='none';
    if(viewPanelBtn) viewPanelBtn.style.display='inline-flex';

    if(IS_SHARE){
      // 공유 링크로 진입 → 편집 버튼, 닫기 버튼 숨김
      if(editBtn) editBtn.style.display='none';
      if(closeBtn) closeBtn.style.display='none';
      if(shareBtn) shareBtn.style.display='none';
    }else{
      // 일반 뷰어 → 편집/링크복사/닫기 표시
      if(editBtn) editBtn.style.display='inline-flex';
      if(shareBtn) shareBtn.style.display='inline-flex';
      if(closeBtn) closeBtn.style.display='inline-flex';
    }
  }else{
    // 편집 모드
    editor.contentEditable='true';
    editor.style.cursor='';
    editor.style.userSelect='';
    editor.removeAttribute('data-view-mode');
    if(toolbar) toolbar.style.display='flex';
    if(titleIn) titleIn.style.display='block';
    if(viewTitle) viewTitle.style.display='none';
    if(saveBtn) saveBtn.style.display='inline-flex';
    if(editBtn) editBtn.style.display='none';
    if(shareBtn) shareBtn.style.display='none';
    if(viewPanelBtn) viewPanelBtn.style.display='none';
    if(closeBtn) closeBtn.style.display='inline-flex';
    _asActive=!!_reEditDocId;
  }
}

/* 뷰어 모드 링크 복사 — 팝업으로 옵션 선택 */
function shareRichDocLink(){
  const url = new URL(window.location.href);
  url.searchParams.set('card', _curCard);
  url.searchParams.set('doc', _reEditDocId);
  url.searchParams.set('share', '1');
  _shareBaseUrl = url.toString();
  _openSharePop();
}

/* 통합 공유 팝업 열기 */
function _openSharePop(){
  document.getElementById('shareNoPassword').checked = false;
  document.getElementById('shareCustomPw').checked = false;
  document.getElementById('shareCustomPwField').style.display = 'none';
  document.getElementById('shareCustomPwInput').value = '';
  updateSharePreview();
  document.getElementById('shareLinkOverlay').style.display = 'block';
}
function closeShareLinkPop(){
  document.getElementById('shareLinkOverlay').style.display = 'none';
}
function toggleSharePwField(){
  const checked = document.getElementById('shareCustomPw').checked;
  document.getElementById('shareCustomPwField').style.display = checked ? 'block' : 'none';
  if(checked){
    document.getElementById('shareNoPassword').checked = false;
  }
  updateSharePreview();
}
function updateSharePreview(){
  const url = _buildShareUrl();
  document.getElementById('shareLinkPreview').textContent = url;
}
function _buildShareUrl(){
  const url = new URL(_shareBaseUrl || window.location.href);
  // share=1은 이미 base에 포함
  if(!url.searchParams.has('share')) url.searchParams.set('share','1');
  const noPw = document.getElementById('shareNoPassword').checked;
  const customPw = document.getElementById('shareCustomPw').checked;
  const customPwVal = document.getElementById('shareCustomPwInput')?.value?.trim();
  if(noPw){
    url.searchParams.set('open', '1');
  }else{
    url.searchParams.delete('open');
  }
  if(customPw && customPwVal){
    url.searchParams.set('spw', customPwVal);
    url.searchParams.delete('open');
  }else{
    url.searchParams.delete('spw');
  }
  return url.toString();
}
async function execShareLink(){
  const url = _buildShareUrl();
  try{
    await navigator.clipboard.writeText(url);
    toast('공유 링크가 복사되었습니다.');
  }catch{
    copyFb(url);
  }
  closeShareLinkPop();
}

async function openRichEditor(docId=''){
  _reEditDocId=docId;
  closeDocTypeModal();
  const editor=document.getElementById('reEditor');
  const titleIn=document.getElementById('reTitle');
  document.getElementById('richEditorOverlay').classList.add('open');
  // 초기화
  _memos=[]; _rePanelsOn=false;
  ['reMarkerPanel','reMemoPanel','reResizeLeft','reResizeRight'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const pb=document.getElementById('btnTogglePanels');if(pb)pb.classList.remove('panels-on');
  _asActive=false; _asSetUI('idle'); _asLastSaveTime=null; _reDirty=false;
  // 모드 적용
  _applyReMode();
  // 이벤트 바인딩 (한 번만)
  setTimeout(()=>{ _bindCtxMenu(); _bindTableCtxMenu(); _bindMemoSync(editor); _bindTblResize(editor); _initTblDrag(editor); }, 200);

  if(docId){
    const d=(CARD_DOCS[_curCard]||[]).find(x=>x.id===docId);
    titleIn.value=d?.title||'';
    editor.innerHTML='<p style="color:#8B95A1;font-size:.88rem;text-align:center;padding:32px 0;">불러오는 중...</p>';
    try{
      const row=await _sbRest.selectOne('site_data',`hub_doc_${docId}`);
      if(row&&row.value!=null){
        let raw=row.value;
        if(typeof raw==='string'){
          if(raw.startsWith('"')&&raw.endsWith('"')){try{const d2=JSON.parse(raw);if(typeof d2==='string')raw=d2;}catch{}}
        }else if(typeof raw==='object'){raw='';}
        editor.innerHTML=raw||'';
      }else{editor.innerHTML='';}
    }catch(err){
      console.warn('문서 로드 실패:',err);
      editor.innerHTML='';
      toast('문서를 불러오는 데 실패했습니다.');
    }
    // 저장된 메모 span 복원
    _reScanMemoSpans(editor);
    // 항상 패널 표시
    if (!_rePanelsOn) {
      reTogglePanels();
    }
    // 편집 모드일 때만 자동저장 활성화
    if(!_reViewMode) _asActive=true;
    // 뷰어 모드 재적용 (패널 토글 후)
    _applyReMode();
  }else{
    _reViewMode=false; // 새 문서는 항상 편집 모드
    _applyReMode();
    titleIn.value='';
    editor.innerHTML='';
  }
  reUpdateToolbar();
  setTimeout(()=>{
    if(!_reViewMode && !docId) titleIn.focus();
    else if(!_reViewMode) editor.focus();
  },200);
}

/* ── 메모 span 복원 (문서 로드 시) ── */
function _reScanMemoSpans(editor){
  _memos=[];
  editor.querySelectorAll('.re-memo-mark').forEach(span=>{
    const id=span.dataset.memoId||('m'+Date.now()+'_'+Math.random().toString(36).substr(2,5));
    span.dataset.memoId=id;
    span.onclick=e=>{e.stopPropagation();_focusMemo(id);};
    const bg=span.style.background||'';
    const colorMatch=bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    let color='#F44336';
    if(colorMatch){
      const r=parseInt(colorMatch[1]),g=parseInt(colorMatch[2]),b=parseInt(colorMatch[3]);
      color='#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
    }
    _memos.push({
      id, text:span.textContent, color,
      markerName:span.title?.split(' — ')[0]||'메모',
      content:span.title?.split(' — ')[1]||'',
      resolved:parseFloat(span.style.opacity||'1')<0.8,
      date:'', spanEl:span
    });
  });
  refreshMemoPanel();
}

/* ── 메모 복사/붙여넣기 동기화 & 고아 메모 제거 ── */
function _bindMemoSync(editor){
  if(editor._memoSyncBound)return;
  editor._memoSyncBound=true;

  // 붙여넣기 후 새 메모 span 감지
  editor.addEventListener('paste',()=>{
    setTimeout(()=>{
      editor.querySelectorAll('.re-memo-mark').forEach(span=>{
        const oid=span.dataset.memoId;
        if(_memos.some(m=>m.spanEl===span))return; // 이미 존재
        // 복제된 span → 새 ID 부여
        const newId='m'+Date.now()+'_'+Math.random().toString(36).substr(2,5);
        span.dataset.memoId=newId;
        span.onclick=e=>{e.stopPropagation();_focusMemo(newId);};
        // 원본 메모에서 속성 복사
        const orig=_memos.find(m=>m.id===oid);
        _memos.push({
          id:newId, text:span.textContent,
          color:orig?.color||'#F44336',
          markerName:orig?.markerName||span.title?.split(' — ')[0]||'메모',
          content:orig?.content||span.title?.split(' — ')[1]||'',
          resolved:false, date:new Date().toLocaleString('ko-KR',{dateStyle:'short',timeStyle:'short'}),
          spanEl:span
        });
      });
      refreshMemoPanel();
    },100);
  });

  // MutationObserver: span 삭제 감지 → 고아 메모 제거
  if(_reMemoObserver)_reMemoObserver.disconnect();
  _reMemoObserver=new MutationObserver(()=>{
    const livingSpans=new Set(editor.querySelectorAll('.re-memo-mark'));
    let changed=false;
    _memos=_memos.filter(m=>{
      if(!m.spanEl)return true; // spanEl 없는 메모는 유지
      if(livingSpans.has(m.spanEl))return true;
      changed=true;
      return false;
    });
    if(changed)refreshMemoPanel();
  });
  _reMemoObserver.observe(editor,{childList:true,subtree:true});
}
let _reDirty = false; // 미저장 변경 추적

function closeRichEditor(){
  if (!_reViewMode && _reDirty) {
    openConfirmDel('아직 저장되지 않은 변경사항이 있습니다.\n정말 나가시겠습니까?', () => {
      _forceCloseRichEditor();
    });
    const btn = document.getElementById('confirmDelBtn');
    if (btn) { btn.textContent = '나가기'; btn.style.background = '#FF9800'; }
    return;
  }
  _forceCloseRichEditor();
}
function _forceCloseRichEditor(){
  _reDirty = false;
  _reViewMode = false;
  if(_reMemoObserver){_reMemoObserver.disconnect();_reMemoObserver=null;}
  clearTimeout(_asTimer);clearInterval(_asCountdownTimer);
  document.getElementById('richEditorOverlay').classList.remove('open');
  renderDocList();
}
function saveRichDoc(){
  const title=document.getElementById('reTitle').value.trim();
  if(!title){toast('제목을 입력해주세요.');return;}
  const content=document.getElementById('reEditor').innerHTML;
  if(!CARD_DOCS[_curCard])CARD_DOCS[_curCard]=[];
  if(_reEditDocId){
    const d=CARD_DOCS[_curCard].find(x=>x.id===_reEditDocId);
    if(d)d.title=title;
    _sbSet(`hub_doc_${_reEditDocId}`,content);
  }else{
    const id=uid();
    CARD_DOCS[_curCard].push({id,title,type:'richtext',parentId:_docTargetFolder||null});
    _sbSet(`hub_doc_${id}`,content);
    _reEditDocId=id;
    _asActive=true;
    _docTargetFolder=null;
  }
  saveAll();
  _reDirty = false;
  _asSetUI('saved');
  toast('문서가 저장되었습니다.');
}
function reExec(cmd,val=null){
  document.getElementById('reEditor').focus();
  document.execCommand(cmd,false,val);
  reUpdateToolbar();
}
function reSetBlock(tag){
  document.getElementById('reEditor').focus();
  if(tag==='pre'){
    const sel=window.getSelection();
    const txt=sel.toString()||'코드를 입력하세요';
    document.execCommand('insertHTML',false,`<pre><code>${txt}</code></pre><p><br></p>`);
  }else if(tag==='blockquote'){
    document.execCommand('formatBlock',false,'blockquote');
  }else{
    document.execCommand('formatBlock',false,tag);
  }
  reUpdateToolbar();
}
function reInsertLink(){
  const url=prompt('링크 URL을 입력하세요:','https://');
  if(!url)return;
  const text=window.getSelection().toString()||url;
  reExec('insertHTML',`<a href="${url}" target="_blank">${text}</a>`);
}
function reInsertImage(){
  document.getElementById('reImgFileIn').click();
}
async function reHandleImg(e){
  const files=Array.from(e.target.files);if(!files.length)return;
  e.target.value='';
  toast(`이미지 ${files.length}개 업로드 중...`);
  for(let i=0;i<files.length;i++){
    const dataUrl=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(files[i]);});
    const url=await _uploadImgToStorage(dataUrl, `richtext/${uid()}_${Date.now()}.jpg`);
    reExec('insertHTML',`<img src="${url}" style="max-width:100%;border-radius:8px;margin:.5em 0;" alt="이미지"><p><br></p>`);
    if(files.length>1) toast(`이미지 업로드 중... (${i+1}/${files.length})`);
  }
  toast(`이미지 ${files.length}개 삽입 완료`);
}
function reInsertTable(){
  // 팝업 열기
  document.getElementById('tblRowsIn').value = '3';
  document.getElementById('tblColsIn').value = '3';
  _updateTblPreview();
  document.getElementById('tblInsertOverlay').style.display = 'block';
}
function _updateTblPreview() {
  const rows = parseInt(document.getElementById('tblRowsIn')?.value) || 3;
  const cols = parseInt(document.getElementById('tblColsIn')?.value) || 3;
  const grid = document.getElementById('tblPreviewGrid');
  if (!grid) return;
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = `repeat(${Math.min(cols,10)}, 1fr)`;
  let html = '';
  for (let r = 0; r < Math.min(rows, 8); r++) {
    for (let c = 0; c < Math.min(cols, 10); c++) {
      html += `<div class="tbl-preview-cell${r===0?' header':''}"></div>`;
    }
  }
  grid.innerHTML = html;
}
function closeTblInsert() {
  document.getElementById('tblInsertOverlay').style.display = 'none';
}
function execTblInsert() {
  const rows = parseInt(document.getElementById('tblRowsIn')?.value) || 3;
  const cols = parseInt(document.getElementById('tblColsIn')?.value) || 3;
  closeTblInsert();
  document.getElementById('reEditor').focus();
  let html = '<table style="border-collapse:collapse;width:100%;table-layout:fixed;margin:.8em 0" class="re-tbl"><tbody>';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const tag = r === 0 ? 'th' : 'td';
      html += `<${tag} style="padding:8px 12px;border:1px solid #E5E8EB;${r === 0 ? 'background:#F5F6FA;font-weight:700;' : ''}">${r === 0 ? `열 ${c + 1}` : ''}</${tag}>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table><p><br></p>';
  reExec('insertHTML', html);
}
// 표 삽입 미리보기 실시간 업데이트
document.addEventListener('input', e => {
  if (e.target.id === 'tblRowsIn' || e.target.id === 'tblColsIn') _updateTblPreview();
});

/* ══ 30색 컬러 팔레트 ══ */
const RE_COLORS_30 = [
  '#191F28','#4E5968','#8B95A1','#B0B8C1','#D1D6DB',
  '#D91F3E','#E53935','#FF5722','#FF7A00','#FF9800',
  '#FFC107','#FFEB3B','#CDDC39','#8BC34A','#4CAF50',
  '#2E9E50','#009688','#00BCD4','#03A9F4','#2196F3',
  '#0064FF','#3F51B5','#5C6BC0','#7C4DFF','#9C27B0',
  '#E040FB','#EC407A','#F06292','#795548','#607D8B'
];
const RE_BG_COLORS_30 = [
  'transparent','#FFEBEE','#FCE4EC','#FFF3E0','#FFF8E1',
  '#FFFDE7','#F1F8E9','#E8F5E9','#E0F7FA','#E1F5FE',
  '#E3F2FD','#EDE7F6','#F3E5F5','#FBE9E7','#EFEBE9',
  '#FAFAFA','#FFD6D6','#FFE0B2','#FFF9C4','#DCEDC8',
  '#B2DFDB','#B3E5FC','#BBDEFB','#D1C4E9','#F8BBD0',
  '#FFCCBC','#D7CCC8','#CFD8DC','#E8EAF6','#F0F4C3'
];

let _reColorPopOpen = '';

function toggleColorPop(type) {
  const pop = document.getElementById(type === 'fg' ? 'reFgColorPop' : 'reBgColorPop');
  const otherPop = document.getElementById(type === 'fg' ? 'reBgColorPop' : 'reFgColorPop');
  // 선택 영역 저장
  _reSaveSelection();
  if (otherPop) otherPop.classList.remove('open');
  if (pop.classList.contains('open')) {
    pop.classList.remove('open');
    _reColorPopOpen = '';
    return;
  }
  // 팝업 내용 생성
  const colors = type === 'fg' ? RE_COLORS_30 : RE_BG_COLORS_30;
  const label = type === 'fg' ? '글자 색상' : '배경색 (하이라이트)';
  let html = `<div class="re-cp-label">${label}</div><div class="re-cp-grid">`;
  colors.forEach(c => {
    const bg = c === 'transparent' ? '#fff' : c;
    const border = c === 'transparent' ? '1px dashed #ccc' : 'none';
    const title = c === 'transparent' ? '없음' : c;
    html += `<div class="re-cp-dot" style="background:${bg};border:${border}" title="${title}" onclick="reApplyColor('${type}','${c}')"></div>`;
  });
  html += '</div>';
  html += `<button class="re-cp-reset" onclick="reApplyColor('${type}','${type === 'fg' ? '#191F28' : 'transparent'}')">${type === 'fg' ? '기본색으로 초기화' : '배경색 제거'}</button>`;
  pop.innerHTML = html;
  pop.classList.add('open');
  _reColorPopOpen = type;
}

let _reSavedRange = null;
function _reSaveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) _reSavedRange = sel.getRangeAt(0).cloneRange();
}
function _reRestoreSelection() {
  if (!_reSavedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(_reSavedRange);
}

function reApplyColor(type, color) {
  _reRestoreSelection();
  document.getElementById('reEditor').focus();
  if (type === 'fg') {
    document.execCommand('foreColor', false, color);
    const bar = document.getElementById('reFgColorBar');
    if (bar) bar.style.background = color;
  } else {
    if (color === 'transparent') {
      document.execCommand('hiliteColor', false, 'transparent');
      // fallback
      document.execCommand('backColor', false, 'transparent');
    } else {
      document.execCommand('hiliteColor', false, color);
    }
    const bar = document.getElementById('reBgColorBar');
    if (bar) bar.style.background = color === 'transparent' ? '#FFEB3B' : color;
  }
  // 팝업 닫기
  document.getElementById('reFgColorPop')?.classList.remove('open');
  document.getElementById('reBgColorPop')?.classList.remove('open');
  _reColorPopOpen = '';
  reUpdateToolbar();
}

// 에디터 클릭시 컬러 팝업 닫기
document.addEventListener('click', e => {
  if (_reColorPopOpen && !e.target.closest('.re-color-wrap')) {
    document.getElementById('reFgColorPop')?.classList.remove('open');
    document.getElementById('reBgColorPop')?.classList.remove('open');
    _reColorPopOpen = '';
  }
});

/* ══ 구분선 삽입 (팝업) ══ */
const DIVIDER_STYLES = [
  { cls:'dv-solid', label:'실선', preview:'border-top:2px solid #C4C9D0' },
  { cls:'dv-dashed', label:'대시', preview:'border-top:2px dashed #C4C9D0' },
  { cls:'dv-dotted', label:'점선', preview:'border-top:3px dotted #C4C9D0' },
  { cls:'dv-double', label:'이중선', preview:'border-top:4px double #C4C9D0' },
  { cls:'dv-gradient', label:'그라데이션', preview:'height:3px;background:linear-gradient(90deg,transparent,#D91F3E,transparent)' },
  { cls:'dv-fade', label:'페이드', preview:'height:1px;background:linear-gradient(90deg,transparent 5%,#C4C9D0 50%,transparent 95%)' },
  { cls:'dv-stars', label:'✦ 별 ✦', preview:'text-align:center;font-size:.8rem;color:#C4C9D0;letter-spacing:4px' },
];

function reInsertDivider() {
  _reSaveSelection();
  const container = document.getElementById('dividerStyles');
  if (container) {
    container.innerHTML = DIVIDER_STYLES.map((s, i) =>
      `<div class="dv-pick-item" onclick="execDividerInsert(${i})">
        <div class="dv-pick-label">${s.label}</div>
        <div class="dv-pick-preview" style="${s.preview};${s.cls === 'dv-stars' ? '' : 'border-radius:0;'}">
          ${s.cls === 'dv-stars' ? '✦ &nbsp; ✦ &nbsp; ✦' : ''}
        </div>
      </div>`
    ).join('');
  }
  document.getElementById('dividerOverlay').style.display = 'block';
}
function closeDividerPop() {
  document.getElementById('dividerOverlay').style.display = 'none';
}
function execDividerInsert(idx) {
  closeDividerPop();
  _reRestoreSelection();
  const style = DIVIDER_STYLES[idx] || DIVIDER_STYLES[0];
  document.getElementById('reEditor').focus();
  reExec('insertHTML', `<hr class="re-divider ${style.cls}"><p><br></p>`);
}

/* ══ 체크박스 삽입 (이모지 기반 — contenteditable 완벽 호환) ══ */
function reInsertCheckbox() {
  const editor = document.getElementById('reEditor');
  editor.focus();
  const html = '<div class="re-check-item"><span class="re-check-box">☐</span><span class="re-check-text">할 일 항목</span></div>';
  reExec('insertHTML', html);
}
function reToggleCheck(boxEl) {
  const item = boxEl.closest('.re-check-item');
  if (!item) return;
  const textEl = item.querySelector('.re-check-text');
  if (boxEl.textContent.trim() === '☐') {
    boxEl.textContent = '☑';
    item.classList.add('checked');
    if (textEl) { textEl.style.textDecoration = 'line-through'; textEl.style.color = '#8B95A1'; }
  } else {
    boxEl.textContent = '☐';
    item.classList.remove('checked');
    if (textEl) { textEl.style.textDecoration = ''; textEl.style.color = ''; }
  }
}

/* ══ PDF 내보내기 (메모/마커 포함) ══ */
function reExportPDF() {
  const title = document.getElementById('reTitle')?.value?.trim() || '문서';
  const content = document.getElementById('reEditor')?.innerHTML || '';

  // 마커 통계 생성
  let markerHTML = '';
  if (_memos.length > 0) {
    const groups = {};
    _memos.forEach(m => {
      const k = m.color + '|' + (m.markerName || '미분류');
      if (!groups[k]) groups[k] = { color:m.color, name:m.markerName||'미분류', count:0 };
      groups[k].count++;
    });
    const total = _memos.length;
    const done = _memos.filter(m => m.resolved).length;
    markerHTML = `
    <div class="pdf-section">
      <div class="pdf-section-title">🏷 마커 요약</div>
      <div class="pdf-stat">전체 ${total}개 | 완료 <span style="color:#2E9E50">${done}</span> | 미완료 <span style="color:#E53935">${total-done}</span></div>
      <div class="pdf-markers">
        ${Object.values(groups).map(g =>
          `<span class="pdf-marker"><span class="pdf-marker-dot" style="background:${g.color}"></span>${g.name} (${g.count})</span>`
        ).join('')}
      </div>
    </div>`;
  }

  // 메모 목록 생성
  let memoHTML = '';
  if (_memos.length > 0) {
    memoHTML = `
    <div class="pdf-section">
      <div class="pdf-section-title">📝 메모 목록</div>
      ${_memos.map((m, i) =>
        `<div class="pdf-memo">
          <div class="pdf-memo-hd">
            <span class="pdf-memo-dot" style="background:${m.color}"></span>
            <span class="pdf-memo-marker">${m.markerName||'메모'}${m.resolved?' ✓ 완료':''}</span>
            <span class="pdf-memo-date">${m.date||''}</span>
          </div>
          <div class="pdf-memo-quote">"${(m.text||'').slice(0,100)}"</div>
          ${m.content ? `<div class="pdf-memo-content">${m.content}</div>` : ''}
        </div>`
      ).join('')}
    </div>`;
  }

  const printWin = window.open('', '_blank');
  if (!printWin) { toast('팝업 차단을 해제해주세요.'); return; }
  printWin.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page{margin:20mm 18mm;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;font-size:14px;line-height:1.9;color:#191F28;padding:0;max-width:100%;}
h1{font-size:1.8rem;font-weight:800;margin:1.2em 0 .5em;letter-spacing:-.03em;}
h2{font-size:1.4rem;font-weight:800;margin:1em 0 .4em;}
h3{font-size:1.1rem;font-weight:700;margin:.8em 0 .3em;}
h4{font-size:1rem;font-weight:700;margin:.7em 0 .3em;}
p{margin:.4em 0;}
ul,ol{padding-left:1.5em;margin:.4em 0;}
li{margin:.2em 0;}
blockquote{border-left:4px solid #D91F3E;padding:.5em 1em;background:#FFF3F5;border-radius:0 8px 8px 0;color:#4E5968;font-style:italic;margin:.6em 0;}
pre{background:#1A1B2E;color:#CDD6F4;padding:1em;border-radius:8px;font-family:monospace;font-size:.82rem;line-height:1.6;overflow:hidden;margin:.6em 0;}
code{background:#F0F2F5;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:.85em;color:#C7254E;}
pre code{background:transparent;padding:0;color:inherit;}
a{color:#D91F3E;text-decoration:underline;}
hr{border:none;border-top:2px solid #E5E8EB;margin:1.2em 0;}
.re-divider{border:none;margin:1.2em 0;}
.dv-solid{border-top:2px solid #E5E8EB;}
.dv-dashed{border-top:2px dashed #C4C9D0;}
.dv-dotted{border-top:3px dotted #C4C9D0;}
.dv-double{border-top:4px double #C4C9D0;}
.dv-gradient{height:3px;background:linear-gradient(90deg,transparent,#D91F3E,transparent);}
.dv-fade{height:1px;background:linear-gradient(90deg,transparent 5%,#C4C9D0 50%,transparent 95%);}
.dv-stars{text-align:center;}.dv-stars::before{content:'✦  ✦  ✦';color:#C4C9D0;letter-spacing:4px;}
img{max-width:100%;border-radius:6px;margin:.4em 0;}
table{border-collapse:collapse;width:100%;margin:.6em 0;}
td,th{padding:6px 10px;border:1px solid #E5E8EB;}
th{background:#F5F6FA;font-weight:700;}
.re-check-item{display:flex;align-items:flex-start;gap:4px;margin:.3em 0;line-height:1.8;}
.re-check-box{font-size:1.15rem;flex-shrink:0;}
.re-check-text{flex:1;}
.re-check-item.checked .re-check-text{text-decoration:line-through;color:#8B95A1;}
.re-callout{border-left:4px solid #2196F3;background:#F0F7FF;border-radius:0 10px 10px 0;padding:14px 18px;margin:.8em 0;display:flex;gap:10px;align-items:flex-start;line-height:1.7;}
.re-callout-icon{font-size:1.3rem;flex-shrink:0;}
.re-callout-body{flex:1;}
.re-memo-mark{border-radius:2px;}
.pdf-title{font-size:1.6rem;font-weight:800;border-bottom:3px solid #D91F3E;padding-bottom:12px;margin-bottom:20px;}
.pdf-section{margin-top:32px;padding-top:20px;border-top:2px solid #E5E8EB;page-break-inside:avoid;}
.pdf-section-title{font-size:1.1rem;font-weight:800;margin-bottom:12px;color:#191F28;}
.pdf-stat{font-size:.85rem;color:#4E5968;margin-bottom:10px;font-weight:600;}
.pdf-markers{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;}
.pdf-marker{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:6px;background:#F5F6FA;border:1px solid #E5E8EB;font-size:.82rem;font-weight:700;}
.pdf-marker-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.pdf-memo{padding:10px 14px;margin-bottom:8px;border:1px solid #E5E8EB;border-radius:8px;page-break-inside:avoid;}
.pdf-memo-hd{display:flex;align-items:center;gap:6px;margin-bottom:4px;}
.pdf-memo-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.pdf-memo-marker{font-size:.85rem;font-weight:700;}
.pdf-memo-date{font-size:.72rem;color:#8B95A1;margin-left:auto;}
.pdf-memo-quote{font-size:.82rem;color:#4E5968;border-left:2px solid #E5E8EB;padding-left:8px;margin-bottom:4px;font-style:italic;}
.pdf-memo-content{font-size:.85rem;color:#191F28;line-height:1.6;}
.tbl-sel{outline:none!important;background:inherit!important;}
</style></head><body>
<div class="pdf-title">${title}</div>
${content}
${markerHTML}
${memoHTML}
<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script>
</body></html>`);
  printWin.document.close();
}

/* ══ 마크다운 가이드 ══ */
function openMdGuide() {
  document.getElementById('mdGuideOverlay').style.display = 'block';
}
function closeMdGuide() {
  document.getElementById('mdGuideOverlay').style.display = 'none';
}

/* ══ 콜아웃 박스 ══ */
let _calloutEmojis = [
  '💡','⚠️','📌','✅','❌','🔥','📝','💬','🎯','⭐',
  '🚀','📢','💰','🔒','🔑','❓','❗','💎','🎨','🔧',
  '📊','📈','📉','🗂','📋','✏️','🖊','📎','🔍','💻',
  '🌐','🏆','🎉','👍','👎','👀','💪','🤔','📚','🧩',
  '⏰','📅','🗓','🔔','💌','🧪','🛡','⚡','🌟','♻️'
];
let _calloutCustomImgs = []; // {id, dataUrl}
let _calloutSelEmoji = '💡';
let _calloutSelColor = '#2196F3';
let _calloutEditTarget = null; // 수정 모드일 때 대상 콜아웃 요소

function openCalloutPop(editTarget) {
  _calloutEditTarget = editTarget || null;
  if (editTarget) {
    // 기존 콜아웃 수정 모드
    const iconEl = editTarget.querySelector('.re-callout-icon');
    if (iconEl) {
      const img = iconEl.querySelector('img');
      _calloutSelEmoji = img ? img.src : iconEl.textContent.trim();
    }
    const borderColor = editTarget.style.borderLeftColor || '#2196F3';
    // rgb → hex 변환
    const m = borderColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    _calloutSelColor = m ? '#'+[m[1],m[2],m[3]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join('') : borderColor;
  } else {
    _reSaveSelection();
  }
  _renderCalloutEmojis();
  _renderCalloutColors();
  _renderCalloutPreview();
  document.getElementById('calloutOverlay').style.display = 'block';
}
function closeCalloutPop() {
  document.getElementById('calloutOverlay').style.display = 'none';
  _calloutEditTarget = null;
}
function _renderCalloutEmojis() {
  const grid = document.getElementById('calloutEmojiGrid');
  if (!grid) return;
  let html = _calloutEmojis.map(e => {
    const isSel = e === _calloutSelEmoji;
    return `<div class="co-emoji-btn${isSel?' sel':''}" onclick="pickCalloutEmoji(this)" data-emoji="${e}">${e}</div>`;
  }).join('');
  // 커스텀 이미지 이모지
  html += _calloutCustomImgs.map(ci => {
    const isSel = ci.dataUrl === _calloutSelEmoji;
    return `<div class="co-emoji-btn${isSel?' sel':''}" onclick="pickCalloutImgEmoji(this,'${ci.id}')" data-imgid="${ci.id}"><img src="${ci.dataUrl}" style="width:22px;height:22px;object-fit:contain;border-radius:3px;"></div>`;
  }).join('');
  grid.innerHTML = html;
}
function pickCalloutEmoji(el) {
  _calloutSelEmoji = el.dataset.emoji;
  document.querySelectorAll('#calloutEmojiGrid .co-emoji-btn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  _renderCalloutPreview();
}
function pickCalloutImgEmoji(el, imgId) {
  const ci = _calloutCustomImgs.find(x => x.id === imgId);
  if (ci) _calloutSelEmoji = ci.dataUrl;
  document.querySelectorAll('#calloutEmojiGrid .co-emoji-btn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  _renderCalloutPreview();
}
function addCalloutEmoji() {
  const v = document.getElementById('calloutEmojiIn')?.value?.trim();
  if (!v) { toast('이모지를 입력하세요.'); return; }
  if (_calloutEmojis.includes(v)) { toast('이미 있습니다.'); return; }
  _calloutEmojis.push(v);
  _calloutSelEmoji = v;
  document.getElementById('calloutEmojiIn').value = '';
  _renderCalloutEmojis();
  _renderCalloutPreview();
  toast('이모지가 추가되었습니다.');
}
function removeCalloutEmoji() {
  // 선택된 이모지 삭제
  const selBtn = document.querySelector('#calloutEmojiGrid .co-emoji-btn.sel');
  if (!selBtn) { toast('삭제할 이모지를 선택하세요.'); return; }
  const emoji = selBtn.dataset.emoji;
  const imgId = selBtn.dataset.imgid;
  if (imgId) {
    _calloutCustomImgs = _calloutCustomImgs.filter(x => x.id !== imgId);
  } else if (emoji) {
    const idx = _calloutEmojis.indexOf(emoji);
    if (idx >= 0) _calloutEmojis.splice(idx, 1);
  }
  _calloutSelEmoji = _calloutEmojis[0] || '💡';
  _renderCalloutEmojis();
  _renderCalloutPreview();
  toast('이모지가 삭제되었습니다.');
}
// 이미지 업로드로 이모지 추가
function addCalloutImgEmoji() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const id = 'cimg_' + Date.now();
      _calloutCustomImgs.push({ id, dataUrl: ev.target.result });
      _calloutSelEmoji = ev.target.result;
      _renderCalloutEmojis();
      _renderCalloutPreview();
      toast('이미지 이모지가 추가되었습니다.');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
function _renderCalloutColors() {
  const grid = document.getElementById('calloutColorGrid');
  if (!grid) return;
  grid.innerHTML = RE_COLORS_30.map(c =>
    `<div class="re-cp-dot${c===_calloutSelColor?' sel':''}" style="background:${c}" onclick="pickCalloutColor(this,'${c}')"></div>`
  ).join('');
}
function pickCalloutColor(el, color) {
  _calloutSelColor = color;
  document.querySelectorAll('#calloutColorGrid .re-cp-dot').forEach(d => d.classList.remove('sel'));
  el.classList.add('sel');
  _renderCalloutPreview();
}
function _renderCalloutPreview() {
  const el = document.getElementById('calloutPreview');
  if (!el) return;
  const bgColor = _hexA(_calloutSelColor, 0.08);
  const isImg = _calloutSelEmoji && _calloutSelEmoji.startsWith('data:');
  const iconHtml = isImg
    ? `<img src="${_calloutSelEmoji}" style="width:24px;height:24px;object-fit:contain;border-radius:3px;">`
    : _calloutSelEmoji;
  el.innerHTML = `<div style="border-left:4px solid ${_calloutSelColor};background:${bgColor};border-radius:0 10px 10px 0;padding:14px 18px;display:flex;gap:10px;align-items:flex-start;line-height:1.7;">
    <span style="font-size:1.3rem;min-width:24px;text-align:center;">${iconHtml}</span>
    <span style="flex:1;color:#4E5968;font-size:.88rem;">여기에 콜아웃 내용이 표시됩니다.</span>
  </div>`;
}
function execCalloutInsert() {
  const bgColor = _hexA(_calloutSelColor, 0.08);
  const isImg = _calloutSelEmoji && _calloutSelEmoji.startsWith('data:');
  const iconHtml = isImg
    ? `<img src="${_calloutSelEmoji}" style="width:24px;height:24px;object-fit:contain;border-radius:3px;">`
    : _calloutSelEmoji;

  if (_calloutEditTarget) {
    // 수정 모드: 기존 콜아웃 업데이트
    _calloutEditTarget.style.borderLeftColor = _calloutSelColor;
    _calloutEditTarget.style.background = bgColor;
    const iconEl = _calloutEditTarget.querySelector('.re-callout-icon');
    if (iconEl) iconEl.innerHTML = iconHtml;
    closeCalloutPop();
    toast('콜아웃이 수정되었습니다.');
    return;
  }

  // 신규 삽입
  closeCalloutPop();
  _reRestoreSelection();
  const editor = document.getElementById('reEditor');
  editor.focus();
  const html = `<div class="re-callout" contenteditable="false" style="border-left-color:${_calloutSelColor};background:${bgColor};">
    <span class="re-callout-icon" contenteditable="false">${iconHtml}</span>
    <span class="re-callout-body" contenteditable="true">내용을 입력하세요...</span>
  </div><p><br></p>`;
  reExec('insertHTML', html);
}

function reUpdateToolbar(){
  // 활성 포맷 상태 업데이트
  ['Bold','Italic','Underline','StrikeThrough'].forEach(cmd=>{
    const btn=document.getElementById(`re${cmd}`);
    if(btn)btn.classList.toggle('active',document.queryCommandState(cmd));
  });
  // 블록 타입 감지
  const tag=(document.queryCommandValue('formatBlock')||'p').toLowerCase();
  const sel=document.getElementById('reBlockSel');
  if(sel){
    const map={div:'p','':' p'};
    const mapped=map[tag]||tag;
    const opt=[...sel.options].find(o=>o.value===mapped);
    if(opt)sel.value=mapped;
    else sel.value='p';
  }
}
function reOnInput(){
  const editor=document.getElementById('reEditor');
  if(!editor.innerHTML||editor.innerHTML==='<br>'){
    editor.innerHTML='';
  }
  _reDirty = true;
  // 인라인 마크다운: **bold**, *italic*, ~~strike~~, `code`
  _reInlineMarkdown();
  _asSchedule();
}
function reOnKeydown(e){
  // Ctrl+S → 즉시 저장
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){
    e.preventDefault();
    if(_asActive&&_reEditDocId){
      clearTimeout(_asTimer);
      _asSetUI('saving');
      const title=document.getElementById('reTitle')?.value?.trim();
      const content=document.getElementById('reEditor')?.innerHTML;
      if(title&&content){
        const d=(CARD_DOCS[_curCard]||[]).find(x=>x.id===_reEditDocId);
        if(d)d.title=title;
        _sbRest.upsert('site_data',{key:`hub_doc_${_reEditDocId}`,value:content,updated_at:new Date().toISOString()})
          .then(()=>{_asSetUI('saved');_reDirty=false;}).catch(()=>_asSetUI('error'));
      }
    }
    return;
  }
  if(e.key==='Tab'){
    e.preventDefault();
    if(e.shiftKey){
      // Shift+Tab: 내어쓰기 (outdent)
      document.execCommand('outdent',false,null);
    } else {
      // Tab 키: 목록 안이면 들여쓰기, 아니면 공백 삽입
      const sel=window.getSelection();
      const node=sel?.anchorNode;
      const li=(node?.nodeType===3?node.parentElement:node)?.closest?.('li');
      if(li){
        document.execCommand('indent',false,null);
      } else {
        reExec('insertHTML','&nbsp;&nbsp;&nbsp;&nbsp;');
      }
    }
    return;
  }
  if(e.key===' '){
    // 마크다운 줄 시작 기호 감지
    if(_reCheckLineMarkdown()){e.preventDefault();return;}
  }
  if(e.key==='Enter'){
    // 메모 span 안에 커서가 있으면 span 밖으로 탈출
    const sel=window.getSelection();
    if(sel&&sel.rangeCount>0){
      const node=sel.getRangeAt(0).startContainer;
      const memoSpan=(node.nodeType===3?node.parentElement:node)?.closest?.('.re-memo-mark');
      if(memoSpan){
        e.preventDefault();
        const r=document.createRange();
        r.setStartAfter(memoSpan);r.collapse(true);
        sel.removeAllRanges();sel.addRange(r);
        reExec('insertParagraph');
        return;
      }
    }
    const tag=(document.queryCommandValue('formatBlock')||'').toLowerCase();
    if(tag==='pre'){
      // 코드블록 안에서 빈 줄 + Enter → 코드블록 탈출
      const ancN2=sel?.anchorNode;
      const preEl=(ancN2?.nodeType===3?ancN2.parentElement:ancN2)?.closest?.('pre');
      if(preEl){
        const txt=ancN2?.textContent||'';
        const off=sel.getRangeAt(0).startOffset;
        // 커서 앞 마지막 문자가 \n이고 그 앞도 \n이면 (빈 줄 두 번 = 탈출)
        const before=txt.substring(0,off);
        if(before.endsWith('\n\n')||before.endsWith('\n')&&!txt.substring(off).trim()){
          // 마지막 빈 줄 제거 후 탈출
          if(before.endsWith('\n')){
            ancN2.textContent=txt.substring(0,off-1)+txt.substring(off);
          }
          e.preventDefault();
          const p=document.createElement('p');p.innerHTML='<br>';
          preEl.after(p);
          const r2=document.createRange();r2.setStart(p,0);r2.collapse(true);
          sel.removeAllRanges();sel.addRange(r2);
          // 빈 코드블록이면 삭제
          if(!preEl.textContent.trim())preEl.remove();
          return;
        }
      }
      e.preventDefault();reExec('insertHTML','\n');
      return;
    }

    // 제목(h1-h6) 끝에서 Enter → 새 줄은 본문(p)으로
    if(/^h[1-6]$/.test(tag)){
      const ancN2=sel?.anchorNode;
      const headEl=(ancN2?.nodeType===3?ancN2.parentElement:ancN2)?.closest?.('h1,h2,h3,h4,h5,h6');
      if(headEl){
        const range2=sel.getRangeAt(0);
        // 제목이 비어있으면 → 본문 전환
        if(!headEl.textContent.trim()){
          e.preventDefault();
          document.execCommand('formatBlock',false,'p');
          return;
        }
        // 커서가 제목 끝에 있을 때 → Enter 후 본문 전환
        const isAtEnd=_reIsCursorAtBlockEnd(headEl,range2);
        if(isAtEnd){
          e.preventDefault();
          const p=document.createElement('p');p.innerHTML='<br>';
          headEl.after(p);
          const r2=document.createRange();r2.setStart(p,0);r2.collapse(true);
          sel.removeAllRanges();sel.addRange(r2);
          return;
        }
      }
    }

    // 빈 blockquote에서 Enter → 인용문 탈출
    if(tag==='blockquote'){
      const ancN2=sel?.anchorNode;
      const bqEl=(ancN2?.nodeType===3?ancN2.parentElement:ancN2)?.closest?.('blockquote');
      if(bqEl&&!bqEl.textContent.trim()){
        e.preventDefault();
        const p=document.createElement('p');p.innerHTML='<br>';
        bqEl.after(p);
        bqEl.remove();
        const r2=document.createRange();r2.setStart(p,0);r2.collapse(true);
        sel.removeAllRanges();sel.addRange(r2);
        return;
      }
    }

    // 빈 리스트 아이템에서 Enter → 리스트 탈출
    const ancN=sel?.anchorNode;
    const liEl=(ancN?.nodeType===3?ancN.parentElement:ancN)?.closest?.('li');
    if(liEl&&!liEl.textContent.trim()){
      e.preventDefault();
      const listEl=liEl.closest('ul,ol');
      const p=document.createElement('p');p.innerHTML='<br>';
      if(listEl){
        // 마지막 li면 리스트 뒤에, 아니면 리스트 분할
        if(liEl===listEl.lastElementChild){
          listEl.after(p);
          liEl.remove();
          if(!listEl.children.length)listEl.remove();
        }else{
          // 중간 li → 리스트 분할
          const newList=document.createElement(listEl.tagName);
          let next=liEl.nextElementSibling;
          while(next){const tmp=next.nextElementSibling;newList.appendChild(next);next=tmp;}
          listEl.after(newList);listEl.after(p);
          liEl.remove();
          if(!listEl.children.length)listEl.remove();
        }
      }else{
        liEl.after(p);liEl.remove();
      }
      const r2=document.createRange();r2.setStart(p,0);r2.collapse(true);
      sel.removeAllRanges();sel.addRange(r2);
      return;
    }

    // 체크리스트 엔터 처리 (이모지 기반)
    const chkItem=(ancN?.nodeType===3?ancN.parentElement:ancN)?.closest?.('.re-check-item');
    if(chkItem){
      const textSpan=chkItem.querySelector('.re-check-text');
      if(!textSpan||!textSpan.textContent.trim()){
        // 빈 체크 아이템이면 체크리스트 종료 → 일반 p로
        e.preventDefault();
        const p=document.createElement('p');p.innerHTML='<br>';
        chkItem.after(p);
        chkItem.remove();
        const r2=document.createRange();r2.setStart(p,0);r2.collapse(true);
        sel.removeAllRanges();sel.addRange(r2);
        return;
      }
      // 새 체크 아이템 추가
      e.preventDefault();
      const newItem=document.createElement('div');
      newItem.className='re-check-item';
      newItem.innerHTML='<span class="re-check-box">☐</span><span class="re-check-text"></span>';
      chkItem.after(newItem);
      const r2=document.createRange();
      r2.setStart(newItem.querySelector('.re-check-text'),0);r2.collapse(true);
      sel.removeAllRanges();sel.addRange(r2);
    }
  }
  // Backspace — 노션 스타일 블록 해제
  if(e.key==='Backspace'){
    const sel=window.getSelection();
    if(sel&&sel.rangeCount>0&&sel.isCollapsed){
      const r=sel.getRangeAt(0);
      const node=r.startContainer;
      const editor=document.getElementById('reEditor');

      // 커서 위치가 블록의 맨 앞(offset 0)인지 확인
      const elem=node.nodeType===3?node.parentElement:node;

      // ① 구분선(hr) 삭제 (기존 유지)
      const block=elem?.closest?.('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre');
      if(block&&_reIsCursorAtBlockStart(block,r)){
        let prev=block.previousElementSibling;
        if(prev&&(prev.tagName==='HR'||prev.classList?.contains('re-divider'))){
          e.preventDefault();
          prev.remove();
          return;
        }
      }

      // ② 제목(h1-h6) → 본문(p) 전환
      const headEl=elem?.closest?.('h1,h2,h3,h4,h5,h6');
      if(headEl&&editor.contains(headEl)&&_reIsCursorAtBlockStart(headEl,r)){
        e.preventDefault();
        document.execCommand('formatBlock',false,'p');
        return;
      }

      // ③ 인용문(blockquote) → 본문(p) 전환
      const bqEl=elem?.closest?.('blockquote');
      if(bqEl&&editor.contains(bqEl)&&_reIsCursorAtBlockStart(bqEl,r)){
        e.preventDefault();
        document.execCommand('formatBlock',false,'p');
        return;
      }

      // ④ 리스트 아이템(li) → 목록 해제
      const liEl=elem?.closest?.('li');
      if(liEl&&editor.contains(liEl)&&_reIsCursorAtBlockStart(liEl,r)){
        e.preventDefault();
        const listEl=liEl.closest('ul,ol');
        const isOl=listEl?.tagName==='OL';
        // 중첩 리스트면 outdent, 최상위면 본문 전환
        const parentLi=listEl?.parentElement?.closest?.('li');
        if(parentLi){
          document.execCommand('outdent',false,null);
        }else{
          // 최상위 리스트 → li를 p로 변환
          const p=document.createElement('p');
          p.innerHTML=liEl.innerHTML||'<br>';
          if(listEl){
            if(liEl===listEl.firstElementChild){
              listEl.before(p);
              liEl.remove();
              if(!listEl.children.length)listEl.remove();
            }else if(liEl===listEl.lastElementChild){
              listEl.after(p);
              liEl.remove();
              if(!listEl.children.length)listEl.remove();
            }else{
              // 중간 항목 → 리스트 분할
              const newList=document.createElement(listEl.tagName);
              let next=liEl.nextElementSibling;
              while(next){const tmp=next.nextElementSibling;newList.appendChild(next);next=tmp;}
              listEl.after(newList);listEl.after(p);
              liEl.remove();
              if(!listEl.children.length)listEl.remove();
            }
          }else{
            liEl.after(p);liEl.remove();
          }
          const r2=document.createRange();r2.setStart(p,0);r2.collapse(true);
          sel.removeAllRanges();sel.addRange(r2);
        }
        return;
      }

      // ⑤ 코드블록(pre) → 본문(p) 전환
      const preEl=elem?.closest?.('pre');
      if(preEl&&editor.contains(preEl)&&_reIsCursorAtBlockStart(preEl,r)){
        e.preventDefault();
        const p=document.createElement('p');
        p.innerHTML=preEl.textContent||'<br>';
        preEl.after(p);preEl.remove();
        const r2=document.createRange();r2.setStart(p,0);r2.collapse(true);
        sel.removeAllRanges();sel.addRange(r2);
        return;
      }

      // ⑥ 체크박스 아이템 → 본문(p) 전환
      const chkEl=elem?.closest?.('.re-check-item');
      if(chkEl&&editor.contains(chkEl)){
        const textSpan=chkEl.querySelector('.re-check-text');
        if(textSpan&&_reIsCursorAtBlockStart(textSpan,r)){
          e.preventDefault();
          const p=document.createElement('p');
          p.innerHTML=textSpan.innerHTML||'<br>';
          chkEl.after(p);chkEl.remove();
          const r2=document.createRange();r2.setStart(p,0);r2.collapse(true);
          sel.removeAllRanges();sel.addRange(r2);
          return;
        }
      }

      // ⑦ 콜아웃 → 본문(p) 전환
      const coEl=elem?.closest?.('.re-callout');
      if(coEl&&editor.contains(coEl)){
        const bodyEl=coEl.querySelector('.re-callout-body');
        if(bodyEl&&_reIsCursorAtBlockStart(bodyEl,r)){
          e.preventDefault();
          const p=document.createElement('p');
          p.innerHTML=bodyEl.innerHTML||'<br>';
          coEl.after(p);coEl.remove();
          const r2=document.createRange();r2.setStart(p,0);r2.collapse(true);
          sel.removeAllRanges();sel.addRange(r2);
          return;
        }
      }
    }
  }
}

/* ── 커서가 블록 시작/끝에 있는지 판별 유틸 ── */
function _reIsCursorAtBlockStart(block,range){
  // range의 startContainer/startOffset이 block의 첫 커서 위치인지
  const node=range.startContainer;
  const off=range.startOffset;
  // 텍스트 노드의 경우 offset이 0이어야 함
  if(node.nodeType===3&&off!==0)return false;
  // 엘리먼트 노드의 경우 offset이 0이어야 함
  if(node.nodeType===1&&off!==0)return false;
  // node가 block 자체거나 block의 첫 자손인지 확인
  if(node===block)return true;
  // block → node 경로에서 모든 조상이 첫 자식인지
  let cur=node;
  while(cur&&cur!==block){
    const parent=cur.parentNode;
    if(!parent)return false;
    // 앞에 텍스트가 있는 노드가 있으면 시작 아님
    let sib=parent.firstChild;
    while(sib&&sib!==cur){
      if(sib.nodeType===3&&sib.textContent.length>0)return false;
      if(sib.nodeType===1)return false;
      sib=sib.nextSibling;
    }
    cur=parent;
  }
  return true;
}
function _reIsCursorAtBlockEnd(block,range){
  const node=range.startContainer;
  const off=range.startOffset;
  // 텍스트 노드: offset이 텍스트 길이와 같아야 함
  if(node.nodeType===3&&off!==node.textContent.length)return false;
  // 엘리먼트 노드: offset이 자식 수와 같아야 함
  if(node.nodeType===1&&off!==node.childNodes.length){
    // br만 남은 경우 허용
    if(node.childNodes.length===off+1&&node.childNodes[off].nodeName==='BR'){}
    else return false;
  }
  if(node===block)return true;
  let cur=node;
  while(cur&&cur!==block){
    const parent=cur.parentNode;
    if(!parent)return false;
    let sib=cur.nextSibling;
    while(sib){
      if(sib.nodeType===3&&sib.textContent.length>0)return false;
      if(sib.nodeType===1&&sib.nodeName!=='BR')return false;
      sib=sib.nextSibling;
    }
    cur=parent;
  }
  return true;
}

/* ── 마크다운 줄 시작 변환 (스페이스 키 트리거) ── */
function _reCheckLineMarkdown(){
  const sel=window.getSelection();
  if(!sel||!sel.rangeCount||!sel.isCollapsed)return false;
  const range=sel.getRangeAt(0);
  const node=range.startContainer;
  if(node.nodeType!==3)return false;
  const text=node.textContent.substring(0,range.startOffset);
  // 줄 시작 텍스트만 검사 (이전에 다른 텍스트 없어야 함)
  const block=(node.parentElement)?.closest?.('p,div');
  if(!block)return false;
  // 블록 내 첫 번째 텍스트 노드인지 확인
  const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
  const firstTextNode=walker.nextNode();
  if(firstTextNode!==node)return false;

  const editor=document.getElementById('reEditor');

  // # 제목
  const headingMatch=text.match(/^(#{1,4})$/);
  if(headingMatch){
    const level=headingMatch[1].length;
    node.textContent=node.textContent.substring(headingMatch[0].length);
    document.execCommand('formatBlock',false,'h'+level);
    return true;
  }
  // - * + 불릿 목록
  if(/^[-*+]$/.test(text)){
    node.textContent=node.textContent.substring(1);
    document.execCommand('insertUnorderedList',false,null);
    return true;
  }
  // 1. 번호 목록
  if(/^1\.$/.test(text)){
    node.textContent=node.textContent.substring(2);
    document.execCommand('insertOrderedList',false,null);
    return true;
  }
  // > 인용문
  if(text==='>'){
    node.textContent=node.textContent.substring(1);
    document.execCommand('formatBlock',false,'blockquote');
    return true;
  }
  // --- 구분선
  if(text==='---'||text==='***'||text==='___'){
    node.textContent='';
    block.innerHTML='';
    const hr=document.createElement('hr');
    hr.className='re-divider dv-solid';
    block.before(hr);
    block.innerHTML='<br>';
    const r2=document.createRange();r2.setStart(block,0);r2.collapse(true);
    sel.removeAllRanges();sel.addRange(r2);
    return true;
  }
  // ``` 코드블록
  if(text==='```'){
    node.textContent='';
    document.execCommand('formatBlock',false,'pre');
    return true;
  }
  // [ ] 또는 [] 체크박스 (이모지 기반)
  if(text==='[]'||text==='[ ]'){
    node.textContent='';
    block.innerHTML='';
    const item=document.createElement('div');
    item.className='re-check-item';
    item.innerHTML='<span class="re-check-box">☐</span><span class="re-check-text"></span>';
    block.before(item);
    block.remove();
    const r2=document.createRange();
    r2.setStart(item.querySelector('.re-check-text'),0);r2.collapse(true);
    sel.removeAllRanges();sel.addRange(r2);
    return true;
  }
  return false;
}

/* ── 인라인 마크다운 변환 ── */
function _reInlineMarkdown(){
  const sel=window.getSelection();
  if(!sel||!sel.rangeCount||!sel.isCollapsed)return;
  const node=sel.anchorNode;
  if(!node||node.nodeType!==3)return;
  const text=node.textContent;
  const offset=sel.anchorOffset;

  // **bold**
  const boldMatch=text.match(/\*\*(.+?)\*\*/);
  if(boldMatch){
    const idx=text.indexOf(boldMatch[0]);
    const before=text.substring(0,idx);
    const inner=boldMatch[1];
    const after=text.substring(idx+boldMatch[0].length);
    const parent=node.parentNode;
    const frag=document.createDocumentFragment();
    if(before)frag.appendChild(document.createTextNode(before));
    const b=document.createElement('b');b.textContent=inner;
    frag.appendChild(b);
    const afterNode=document.createTextNode(after||'\u200B');
    frag.appendChild(afterNode);
    parent.replaceChild(frag,node);
    const r=document.createRange();r.setStart(afterNode,afterNode.length);r.collapse(true);
    sel.removeAllRanges();sel.addRange(r);
    return;
  }
  // *italic* (not **)
  const italicMatch=text.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
  if(italicMatch){
    const idx=text.indexOf(italicMatch[0]);
    const before=text.substring(0,idx);
    const inner=italicMatch[1];
    const after=text.substring(idx+italicMatch[0].length);
    const parent=node.parentNode;
    const frag=document.createDocumentFragment();
    if(before)frag.appendChild(document.createTextNode(before));
    const i=document.createElement('i');i.textContent=inner;
    frag.appendChild(i);
    const afterNode=document.createTextNode(after||'\u200B');
    frag.appendChild(afterNode);
    parent.replaceChild(frag,node);
    const r=document.createRange();r.setStart(afterNode,afterNode.length);r.collapse(true);
    sel.removeAllRanges();sel.addRange(r);
    return;
  }
  // ~~strikethrough~~
  const strikeMatch=text.match(/~~(.+?)~~/);
  if(strikeMatch){
    const idx=text.indexOf(strikeMatch[0]);
    const before=text.substring(0,idx);
    const inner=strikeMatch[1];
    const after=text.substring(idx+strikeMatch[0].length);
    const parent=node.parentNode;
    const frag=document.createDocumentFragment();
    if(before)frag.appendChild(document.createTextNode(before));
    const s=document.createElement('s');s.textContent=inner;
    frag.appendChild(s);
    const afterNode=document.createTextNode(after||'\u200B');
    frag.appendChild(afterNode);
    parent.replaceChild(frag,node);
    const r=document.createRange();r.setStart(afterNode,afterNode.length);r.collapse(true);
    sel.removeAllRanges();sel.addRange(r);
    return;
  }
  // `inline code`
  const codeMatch=text.match(/`(.+?)`/);
  if(codeMatch){
    const idx=text.indexOf(codeMatch[0]);
    const before=text.substring(0,idx);
    const inner=codeMatch[1];
    const after=text.substring(idx+codeMatch[0].length);
    const parent=node.parentNode;
    const frag=document.createDocumentFragment();
    if(before)frag.appendChild(document.createTextNode(before));
    const code=document.createElement('code');code.textContent=inner;
    frag.appendChild(code);
    const afterNode=document.createTextNode(after||'\u200B');
    frag.appendChild(afterNode);
    parent.replaceChild(frag,node);
    const r=document.createRange();r.setStart(afterNode,afterNode.length);r.collapse(true);
    sel.removeAllRanges();sel.addRange(r);
    return;
  }
  // [text](url) 링크
  const linkMatch=text.match(/\[(.+?)\]\((.+?)\)/);
  if(linkMatch){
    const idx=text.indexOf(linkMatch[0]);
    const before=text.substring(0,idx);
    const linkText=linkMatch[1];
    const linkUrl=linkMatch[2];
    const after=text.substring(idx+linkMatch[0].length);
    const parent=node.parentNode;
    const frag=document.createDocumentFragment();
    if(before)frag.appendChild(document.createTextNode(before));
    const a=document.createElement('a');a.href=linkUrl;a.target='_blank';a.textContent=linkText;
    frag.appendChild(a);
    const afterNode=document.createTextNode(after||'\u200B');
    frag.appendChild(afterNode);
    parent.replaceChild(frag,node);
    const r=document.createRange();r.setStart(afterNode,afterNode.length);r.collapse(true);
    sel.removeAllRanges();sel.addRange(r);
    return;
  }
}

/* ══ IMG GALLERY ══ */
let _igImages=[],_editGalleryId='';
async function _readDocObjAsync(docId){
  // gallery/refdoc 등 JSON 객체로 저장된 문서를 Supabase에서 읽기
  try{
    const row=await _sbRest.selectOne('site_data','hub_doc_'+docId);
    if(!row) return null;
    const v=typeof row==='object'&&row.value!==undefined?row.value:row;
    if(typeof v==='object') return v; // 이미 파싱된 객체
    let str=typeof v==='string'?v:JSON.stringify(v);
    // 이중 인코딩 복구
    if(str.startsWith('"')&&str.endsWith('"')){try{const d=JSON.parse(str);if(typeof d==='string')str=d;}catch{}}
    return JSON.parse(str);
  }catch(e){console.warn('_readDocObjAsync 실패:',e&&e.message);return null;}
}
function _readDocObj(docId){
  // 동기 버전 — 항상 null 반환 (하위 호환용, 실제로는 _readDocObjAsync 사용 권장)
  return null;
}
async function openImgGallery(docId=''){
  _igImages=[];_editGalleryId=docId;
  closeDocTypeModal();
  document.getElementById('igTitle').value='';
  if(docId){
    const d=(CARD_DOCS[_curCard]||[]).find(x=>x.id===docId);
    if(d)document.getElementById('igTitle').value=d.title||'';
    const stored=await _readDocObjAsync(docId);
    if(stored&&stored.images)_igImages=[...stored.images];
  }
  renderIgGrid();
  document.getElementById('imgGalleryOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('igTitle').focus(),180);
}
function closeImgGallery(){document.getElementById('imgGalleryOverlay').classList.remove('open');}
function handleGalleryImages(e){
  const files=Array.from(e.target.files);
  if(!files.length)return;
  const startIdx=_igImages.length;
  files.forEach((_,i)=>_igImages.push(null));
  let done=0;
  files.forEach((file,i)=>{
    const reader=new FileReader();
    reader.onload=async ev=>{
      const url=await _uploadImgToStorage(ev.target.result, `gallery/${uid()}_${Date.now()}.jpg`);
      _igImages[startIdx+i]={id:uid(),data:url};
      done++;
      if(done===files.length){
        while(_igImages.includes(null))_igImages.splice(_igImages.indexOf(null),1);
        renderIgGrid();
      }
    };
    reader.readAsDataURL(file);
  });
  e.target.value='';
}
function renderIgGrid(){
  const grid=document.getElementById('igGrid');
  grid.innerHTML=_igImages.map((img,i)=>`
    <div class="ig-thumb">
      <span class="ig-thumb-num">${i+1}</span>
      <img src="${img.data}" alt="이미지 ${i+1}">
      <button class="ig-thumb-del" onclick="igDelImg(${i})" title="삭제">✕</button>
    </div>`).join('')+`<div class="ig-add" onclick="document.getElementById('igFileIn').click()"><span style="font-size:1.4rem">📜</span><span>이미지 추가 (다중 선택 가능)</span></div>`;
}
function igDelImg(i){_igImages.splice(i,1);renderIgGrid();}
function saveImgGallery(){
  const title=document.getElementById('igTitle').value.trim();if(!title){toast('제목을 입력해주세요.');return;}
  const stored={type:'gallery',images:_igImages};
  if(!CARD_DOCS[_curCard])CARD_DOCS[_curCard]=[];
  if(_editGalleryId){
    const d=CARD_DOCS[_curCard].find(x=>x.id===_editGalleryId);if(d)d.title=title;
    _localSave(`hub_doc_${_editGalleryId}`,stored);
    _sbSet(`hub_doc_${_editGalleryId}`,stored);
  }else{
    const id=uid();CARD_DOCS[_curCard].push({id,title,type:'gallery',parentId:_docTargetFolder||null});
    _localSave(`hub_doc_${id}`,stored);
    _sbSet(`hub_doc_${id}`,stored);
    _docTargetFolder=null;
  }
  saveAll();renderDocList();closeImgGallery();toast('갤러리가 저장되었습니다.');
}

/* ══ CAL DOC RENAME ══ */
function openCalDocRename(){
  const docs=CARD_DOCS[_curCard]||[];const d=docs.find(x=>x.id===_curDocId);if(!d)return;
  document.getElementById('calDocRenameIn').value=d.title||'';
  document.getElementById('calDocRenameOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('calDocRenameIn').select(),180);
}
function closeCalDocRename(){document.getElementById('calDocRenameOverlay').classList.remove('open');}
function saveCalDocRename(){
  const v=document.getElementById('calDocRenameIn').value.trim();if(!v)return;
  const docs=CARD_DOCS[_curCard]||[];const d=docs.find(x=>x.id===_curDocId);
  if(!d)return;
  d.title=v;
  // 저장된 HTML의 title 태그도 업데이트
  const raw=null;
  if(raw){
    const updated=raw.replace(/<title>[^<]*<\/title>/,'<title>'+v+'</title>').replace(/<h1>[^<]*<\/h1>/,'<h1>'+v+'</h1>');
    /* localStorage 비사용 */
    _sbSet(`hub_doc_${_curDocId}`,updated);
  }
  saveAll();renderDocList();
  document.getElementById('dvTitle').textContent=v;
  closeCalDocRename();toast('이름이 변경되었습니다.');
}

/* ══ CAL DOC SETTINGS (태그 필터 다중 선택 + 재생성) ══ */
let _calDocSelectedTag=null;

function openCalDocSettings(){
  const docs=CARD_DOCS[_curCard]||[];const d=docs.find(x=>x.id===_curDocId);if(!d)return;
  const cfg=CAL_DOC_CFG[_curDocId]||{};
  const vis=cfg.visibleTags;  // null = 전체, array = 선택된 태그
  const allTags=[...new Set(EVENTS.flatMap(ev=>ev.tags||[]))];
  const el=document.getElementById('calDocTagCheckList');
  if(!el)return;
  if(!allTags.length){
    el.innerHTML='<div style="font-size:.82rem;color:var(--t3);font-weight:500;padding:8px 0;">등록된 업무 태그가 없습니다.<br>일정 추가 시 태그를 입력하면 나타납니다.</div>';
  }else{
    el.innerHTML=allTags.map(t=>{
      const checked=(!vis||vis.includes(t));
      return`<label class="tag-check-item">
        <input type="checkbox" class="cd-tag-cb" value="${t}" ${checked?'checked':''}>
        <span class="tag-check-name">${t}</span>
      </label>`;
    }).join('');
  }
  document.getElementById('calDocSettingsOverlay').classList.add('open');
}
function closeCalDocSettings(){document.getElementById('calDocSettingsOverlay').classList.remove('open');}
function cdTagSelectAll(checked){
  document.querySelectorAll('#calDocTagCheckList .cd-tag-cb').forEach(cb=>cb.checked=checked);
}
function calDocTagCheckAll(){}   // deprecated
function calDocTagToggle(){}     // deprecated
function calDocSetTab(id){
  document.querySelectorAll('#calDocSettingsOverlay .m-stab').forEach(b=>b.classList.toggle('active',true));
  document.querySelectorAll('#calDocSettingsOverlay .m-sp').forEach(p=>p.classList.toggle('active',p.id===`cdst-${id}`));
}
async function saveCalDocSettings(){
  const docs=CARD_DOCS[_curCard]||[];const d=docs.find(x=>x.id===_curDocId);if(!d)return;
  if(!CAL_DOC_CFG[_curDocId])CAL_DOC_CFG[_curDocId]={};
  const cbs=[...document.querySelectorAll('#calDocTagCheckList .cd-tag-cb')];
  const allTags=[...new Set(EVENTS.flatMap(ev=>ev.tags||[]))];
  const checked=cbs.filter(cb=>cb.checked).map(cb=>cb.value);
  CAL_DOC_CFG[_curDocId].visibleTags=(checked.length===allTags.length||!cbs.length)?null:checked;
  // calMeta: d.calMeta(문서 객체) 또는 CAL_DOC_CFG.meta 순으로 참조
  const calMeta=d.calMeta||(CAL_DOC_CFG[_curDocId]?.meta)||null;
  if(calMeta){
    const html=buildInteractiveCal(calMeta.baseYear,calMeta.months,calMeta.title||d.title,CAL_DOC_CFG[_curDocId]);
    document.getElementById('docFrame').srcdoc=html;
    toast('설정이 적용되었습니다.');
  }else{
    toast('설정이 저장되었습니다.');
  }
  saveAll();
  closeCalDocSettings();
}
function closeDocEditor(){document.getElementById('docEditorOverlay').classList.remove('open');}
function debouncePreview(){clearTimeout(_prevTimer);_prevTimer=setTimeout(updatePreview,600);}
function _injectIframePatches(html){
  // <a href="#"> 클릭 시 맨위로 스크롤 (부모 페이지 이동 방지)
  const patch=`<script>
(function(){
  document.addEventListener('click',function(e){
    var a=e.target.closest('a');
    if(!a)return;
    var href=a.getAttribute('href')||'';
    if(href==='#'||href==='#top'||href.startsWith('#')){
      e.preventDefault();
      if(href==='#'||href==='#top'){window.scrollTo({top:0,behavior:'smooth'});}
      else{var el=document.querySelector(href);if(el)el.scrollIntoView({behavior:'smooth'});}
    }
  },true);
  // toolbar button: prevent default form submission escaping
  document.addEventListener('submit',function(e){e.preventDefault();},true);
})();
<\/script>`;
  // </body> 직전에 삽입
  if(/<\/body>/i.test(html))return html.replace(/<\/body>/i,patch+'</body>');
  return html+patch;
}
function wrapHtml(content){
  if(/^<!DOCTYPE/i.test(content.trim())||/^<html/i.test(content.trim()))return _injectIframePatches(content);
  const wrapped=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet"><style>body{font-family:'Noto Sans KR',sans-serif;padding:32px;max-width:720px;margin:0 auto;line-height:1.8;color:#191F28;font-size:15px;}h1,h2,h3{font-weight:800;letter-spacing:-.02em;margin:1.2em 0 .5em;}h1{font-size:1.8rem;}h2{font-size:1.4rem;}h3{font-size:1.1rem;}p{margin:.6em 0;}img{max-width:100%;border-radius:8px;}hr{border:none;border-top:1px solid #E5E8EB;margin:1.5em 0;}table{border-collapse:collapse;width:100%;}td,th{padding:8px 12px;border:1px solid #E5E8EB;}th{background:#F5F6FA;font-weight:700;}</style></head><body>${content}</body></html>`;
  return _injectIframePatches(wrapped);
}
function updatePreview(){document.getElementById('dePreview').srcdoc=wrapHtml(document.getElementById('deContent').value);}
function saveDoc(){
  const title=document.getElementById('deTitle').value.trim();if(!title){toast('제목을 입력해주세요.');return;}
  const content=document.getElementById('deContent').value;
  if(!CARD_DOCS[_curCard])CARD_DOCS[_curCard]=[];
  if(_editDocId){
    const d=CARD_DOCS[_curCard].find(x=>x.id===_editDocId);if(d)d.title=title;
    /* localStorage 비사용 */
    _sbSet(`hub_doc_${_editDocId}`,content);
  }else{
    const id=uid();CARD_DOCS[_curCard].push({id,title,type:'html',parentId:_docTargetFolder||null});
    /* localStorage 비사용 */
    _sbSet(`hub_doc_${id}`,content);
    _docTargetFolder=null;
  }
  saveAll();renderDocList();closeDocEditor();toast('문서가 저장되었습니다.');
}

/* ══ PDF 내보내기 ══ */
let _pdfOrient='portrait';
let _pdfPreviewTimer=null;

function _setPdfOrient(o){
  _pdfOrient=o;
  document.getElementById('pdfOrientP').classList.toggle('active',o==='portrait');
  document.getElementById('pdfOrientL').classList.toggle('active',o==='landscape');
  _pdfPreviewUpdate();
}
function openPdfModal(){
  const content=document.getElementById('deContent').value;
  if(!content.trim()){toast('내보낼 내용이 없습니다.');return;}
  document.getElementById('pdfProgress').style.display='none';
  document.getElementById('pdfExportBtn').disabled=false;
  document.getElementById('pdfExportOverlay').classList.add('open');
  setTimeout(()=>_pdfPreviewUpdate(),100);
}
function closePdfModal(){
  document.getElementById('pdfExportOverlay').classList.remove('open');
  document.getElementById('pdfPreviewPages').innerHTML='';
}

function _pdfPreviewUpdate(){
  clearTimeout(_pdfPreviewTimer);
  _pdfPreviewTimer=setTimeout(_pdfPreviewRender,250);
}

/* ── PDF 공통: 완전한 HTML 문서 생성 ── */
function _pdfBuildFullHtml(content,contentWidth,extraStyle){
  let bodyHtml=content, styleStr='';
  if(/^<!DOCTYPE/i.test(content.trim())||/^<html/i.test(content.trim())){
    const m=content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    bodyHtml=m?m[1]:content;
    const sm=[...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
    styleStr=sm.map(s=>s[1]).join('\n');
  }
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;}
body{font-family:'Noto Sans KR',sans-serif;padding:32px;line-height:1.8;color:#191F28;font-size:15px;margin:0;word-break:break-word;width:${contentWidth}px;background:#fff;}
h1,h2,h3{font-weight:800;letter-spacing:-.02em;margin:1.2em 0 .5em;}
h1{font-size:1.8rem;}h2{font-size:1.4rem;}h3{font-size:1.1rem;}
p{margin:.6em 0;}img{max-width:100%;border-radius:8px;}
hr{border:none;border-top:1px solid #E5E8EB;margin:1.5em 0;}
table{border-collapse:collapse;width:100%;}
td,th{padding:8px 12px;border:1px solid #E5E8EB;}
th{background:#F5F6FA;font-weight:700;}
${styleStr}
${extraStyle||''}
</style></head><body>${bodyHtml}</body></html>`;
}

/* ── 미리보기 렌더링 (iframe + body offset 방식) ── */
function _pdfPreviewRender(){
  const content=document.getElementById('deContent')?.value;
  if(!content||!content.trim())return;

  const pageSize=document.getElementById('pdfPageSize').value;
  const orient=_pdfOrient;
  const contentWidth=parseInt(document.getElementById('pdfContentWidth').value)||800;
  const margin=parseInt(document.getElementById('pdfMargin').value)||15;

  const sizes={a4:[210,297],a3:[297,420],letter:[215.9,279.4],legal:[215.9,355.6]};
  let [pwMm,phMm]=sizes[pageSize]||sizes.a4;
  if(orient==='landscape')[pwMm,phMm]=[phMm,pwMm];

  const scrollEl=document.getElementById('pdfPreviewScroll');
  const previewW=Math.min(400,(scrollEl?.clientWidth||440)-40);
  const previewH=Math.round(previewW*(phMm/pwMm));
  const marginRatio=margin/pwMm;
  const contentAreaW=previewW*(1-marginRatio*2);
  const contentAreaH=previewH*(1-marginRatio*2);
  const marginPx=previewW*marginRatio;
  const scale=contentAreaW/contentWidth;
  const pageBodyH=contentAreaH/scale;

  // 높이 측정용 iframe
  const measurer=document.createElement('iframe');
  measurer.style.cssText='position:fixed;left:-9999px;top:0;width:'+contentWidth+'px;height:100px;border:none;visibility:hidden;';
  document.body.appendChild(measurer);
  const measureHtml=_pdfBuildFullHtml(content,contentWidth,'html,body{overflow:hidden;}');
  measurer.srcdoc=measureHtml;
  measurer.onload=function(){
    var totalH=100;
    try{totalH=measurer.contentDocument.body.scrollHeight;}catch(e){}
    document.body.removeChild(measurer);
    var pageCount=Math.max(1,Math.ceil(totalH/pageBodyH));
    var container=document.getElementById('pdfPreviewPages');
    container.innerHTML='';
    var info=document.getElementById('pdfPageInfo');
    if(info) info.textContent=pageCount+'페이지 · '+Math.round(pwMm)+'×'+Math.round(phMm)+'mm';
    for(var p=0;p<pageCount;p++){
      var page=document.createElement('div');
      page.className='pdf-preview-page';
      page.style.width=previewW+'px';
      page.style.height=previewH+'px';
      page.style.padding=marginPx+'px';
      var clipper=document.createElement('div');
      clipper.style.cssText='width:'+contentAreaW+'px;height:'+contentAreaH+'px;overflow:hidden;';
      var offsetPx=p*pageBodyH;
      var pageHtml=_pdfBuildFullHtml(content,contentWidth,
        'html{overflow:hidden;height:'+pageBodyH+'px;}body{margin-top:'+(-offsetPx)+'px;overflow:hidden;}'
      );
      var frame=document.createElement('iframe');
      frame.style.cssText='width:'+contentWidth+'px;height:'+pageBodyH+'px;border:none;transform:scale('+scale+');transform-origin:top left;display:block;';
      frame.srcdoc=pageHtml;
      clipper.appendChild(frame);
      var numEl=document.createElement('div');
      numEl.className='pdf-preview-page-num';
      numEl.textContent=(p+1)+' / '+pageCount;
      page.appendChild(clipper);
      page.appendChild(numEl);
      container.appendChild(page);
    }
  };
}


/* ── PDF 생성 (브라우저 인쇄 엔진 사용) ── */
function execPdfExport(){
  const content=document.getElementById('deContent').value;
  const title=document.getElementById('deTitle').value.trim()||'문서';
  if(!content.trim()){toast('내보낼 내용이 없습니다.');return;}
  const pageSize=document.getElementById('pdfPageSize').value;
  const orient=_pdfOrient;
  const contentWidth=parseInt(document.getElementById('pdfContentWidth').value)||800;
  const margin=parseInt(document.getElementById('pdfMargin').value)||15;
  const scalePct=parseInt(document.getElementById('pdfScale').value)||100;

  const sizeMap={a4:'210mm 297mm',a3:'297mm 420mm',letter:'8.5in 11in',legal:'8.5in 14in'};
  const sz=orient==='landscape'?sizeMap[pageSize].split(' ').reverse().join(' '):sizeMap[pageSize];
  const zoomFactor=scalePct/100;

  // 사용자 HTML에서 body와 style 추출
  let bodyHtml=content, styleStr='';
  if(/^<!DOCTYPE/i.test(content.trim())||/^<html/i.test(content.trim())){
    const m=content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    bodyHtml=m?m[1]:content;
    const sm=[...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
    styleStr=sm.map(s=>s[1]).join('\n');
  }

  // 인쇄 전용 HTML — 사용자 스타일 뒤에 강제 오버라이드 배치
  const printHtml=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;}
body{font-family:'Noto Sans KR',sans-serif;padding:32px;line-height:1.8;color:#191F28;font-size:15px;margin:0;word-break:break-word;background:#fff;}
h1,h2,h3{font-weight:800;letter-spacing:-.02em;margin:1.2em 0 .5em;}
h1{font-size:1.8rem;}h2{font-size:1.4rem;}h3{font-size:1.1rem;}
p{margin:.6em 0;}img{max-width:100%;border-radius:8px;}
hr{border:none;border-top:1px solid #E5E8EB;margin:1.5em 0;}
table{border-collapse:collapse;width:100%;}
td,th{padding:8px 12px;border:1px solid #E5E8EB;}
th{background:#F5F6FA;font-weight:700;}
${styleStr}
/* ▼▼▼ 인쇄 강제 오버라이드 — 사용자 CSS 뒤에 배치하여 최우선 적용 ▼▼▼ */
@page{size:${sz};margin:${margin}mm;}
html,body,div,section,article,main,aside,header,footer,nav,
.wrap,.wrapper,.container,.content,.page,.inner,.outer,
[class*="wrap"],[class*="container"],[class*="page"],[class*="content"]{
  height:auto !important;
  max-height:none !important;
  min-height:0 !important;
  overflow:visible !important;
  position:static !important;
}
html{display:block !important;}
body{
  width:auto !important;
  max-width:100% !important;
  padding:0 !important;
  margin:0 !important;
  font-size:${(15*zoomFactor).toFixed(1)}px !important;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
  display:block !important;
}
img{page-break-inside:avoid;}
table{page-break-inside:auto;}
tr{page-break-inside:avoid;}
h1,h2,h3{page-break-after:avoid;}
</style>
<title>${title}</title>
</head><body>${bodyHtml}</body></html>`;

  const w=window.open('','_blank','width=900,height=700');
  if(!w){toast('팝업이 차단되었습니다. 팝업을 허용 후 다시 시도해주세요.');return;}
  w.document.open();
  w.document.write(printHtml);
  w.document.close();
  w.document.title=title;

  w.onload=function(){
    // 추가 안전장치: JS로도 모든 요소의 height/overflow 강제 해제
    try{
      var allEls=w.document.querySelectorAll('*');
      allEls.forEach(function(el){
        var s=w.getComputedStyle(el);
        if(s.height&&s.height!=='auto'&&s.height.indexOf('px')!==-1){
          var h=parseFloat(s.height);
          if(h>0&&el.scrollHeight>h+10) el.style.setProperty('height','auto','important');
        }
        if(s.overflow==='hidden'||s.overflowY==='hidden'){
          el.style.setProperty('overflow','visible','important');
          el.style.setProperty('overflow-y','visible','important');
        }
        if(s.maxHeight&&s.maxHeight!=='none'){
          el.style.setProperty('max-height','none','important');
        }
        if(s.position==='fixed'){
          el.style.setProperty('position','static','important');
        }
      });
    }catch(e){}

    var imgs=w.document.querySelectorAll('img');
    var promises=[];
    imgs.forEach(function(img){
      if(!img.complete) promises.push(new Promise(function(r){img.onload=r;img.onerror=r;}));
    });
    Promise.allSettled(promises).then(function(){
      (w.document.fonts?w.document.fonts.ready:Promise.resolve()).then(function(){
        setTimeout(function(){
          w.focus();
          w.print();
          w.onafterprint=function(){w.close();};
        },400);
      });
    });
  };

  toast('인쇄 대화상자에서 "PDF로 저장"을 선택하세요.');
  closePdfModal();
}
/* ══ CAL MAKER ══ */
let _cmType='single';
function setCmType(t){
  _cmType=t;
  document.getElementById('cmSingleField').style.display=t==='single'?'block':'none';
  document.getElementById('cmRangeFields').style.display=t==='range'?'block':'none';
  document.getElementById('cmTypeSingle').style.cssText=t==='single'?'flex:1;background:var(--PL);border-color:var(--P);color:var(--P)':'flex:1';
  document.getElementById('cmTypeRange').style.cssText=t==='range'?'flex:1;background:var(--PL);border-color:var(--P);color:var(--P)':'flex:1';
}
function openCalMaker(){closeDocTypeModal();document.getElementById('cmTitle').value='';document.getElementById('cmYear').value='2026';setCmType('single');document.getElementById('calMakerOverlay').classList.add('open');}
function closeCalMaker(){document.getElementById('calMakerOverlay').classList.remove('open');}
function saveCalDoc(){
  const title=document.getElementById('cmTitle').value.trim()||'캘린더';
  const y=parseInt(document.getElementById('cmYear').value)||2026;
  let months=[];
  if(_cmType==='single'){months=[parseInt(document.getElementById('cmMonth').value)];}
  else{const from=parseInt(document.getElementById('cmMonthFrom').value);const to=parseInt(document.getElementById('cmMonthTo').value);for(let m=Math.min(from,to);m<=Math.max(from,to);m++)months.push(m);}
  const id=uid();
  // 메타를 문서 객체 안에 직접 저장 (CAL_DOC_CFG 의존성 제거)
  const docObj={id,title,type:'calendar',parentId:_docTargetFolder||null,
    calMeta:{baseYear:y,months,title}};
  if(!CARD_DOCS[_curCard])CARD_DOCS[_curCard]=[];
  CARD_DOCS[_curCard].push(docObj);
  // CAL_DOC_CFG에도 백업 저장 (필터 설정용)
  if(!CAL_DOC_CFG[id])CAL_DOC_CFG[id]={};
  CAL_DOC_CFG[id].meta={baseYear:y,months,title};
  _docTargetFolder=null;
  saveAll();renderDocList();closeCalMaker();toast('캘린더 문서가 생성되었습니다.');
}

function buildInteractiveCal(baseYear,months,title,settings={}){
  const evtsJSON=JSON.stringify(EVENTS);
  const spsJSON=JSON.stringify(SPECIALS);
  const procsJSON=JSON.stringify(PROCESSES);
  const calName=CAL_NAME;
  const MN_DATA=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const isMulti=months.length>1;

  return`<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=DM+Mono:wght@400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--P:#D91F3E;--PL:#FFF3F5;--bg:#F5F6FA;--sf:#fff;--bd:#E5E8EB;--t:#191F28;--t2:#4E5968;--t3:#8B95A1;--TD:#2E9E50;--HL:#E84060;}
body{font-family:'Noto Sans KR',sans-serif;background:var(--bg);color:var(--t);font-size:14px;-webkit-font-smoothing:antialiased;}
.wrap{max-width:960px;margin:0 auto;padding:32px 24px 64px;}
h1{font-size:1.4rem;font-weight:800;letter-spacing:-.02em;margin-bottom:6px;}
.sub{font-size:.82rem;color:var(--t2);margin-bottom:20px;}
.top-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;}
.vtgl{display:flex;background:#ECEEF2;border-radius:8px;padding:3px;}
.vb{padding:5px 14px;border-radius:6px;font-size:.78rem;font-weight:600;border:none;background:transparent;cursor:pointer;font-family:'Noto Sans KR',sans-serif;color:var(--t2);transition:all .15s;}
.vb.active{background:#fff;color:var(--P);box-shadow:0 1px 3px rgba(0,0,0,.08);}
.mnav{display:flex;align-items:center;gap:8px;}
.mnav-lbl{font-size:1rem;font-weight:800;min-width:120px;text-align:center;}
.mnav-btn{width:28px;height:28px;border-radius:7px;border:1px solid var(--bd);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.9rem;color:var(--t2);transition:all .15s;}
.mnav-btn:hover{border-color:var(--P);color:var(--P);}
.legend{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;padding:9px 13px;background:var(--sf);border:1px solid var(--bd);border-radius:8px;min-height:38px;}
.leg-item{display:flex;align-items:center;gap:4px;font-size:.72rem;font-weight:600;color:var(--t2);padding:2px 7px 2px 5px;border-radius:6px;background:var(--bg);border:1px solid var(--bd);}
.leg-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0;}
.tag-bar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center;}
.tag-chip{padding:5px 13px;border-radius:20px;border:1.5px solid var(--bd);background:var(--bg);font-size:.78rem;font-weight:700;color:var(--t2);cursor:pointer;transition:all .15s;}
.tag-chip:hover{border-color:var(--P);color:var(--P);}
.tag-chip.active{background:var(--P);border-color:var(--P);color:#fff;}
.tag-label{font-size:.72rem;font-weight:700;color:var(--t3);}
.cal-box{background:var(--sf);border:1px solid var(--bd);border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);}
.wds{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--bd);background:#FAFBFC;}
.wd{padding:7px 0;text-align:center;font-size:.68rem;font-weight:700;color:var(--t3);}
.wd:first-child{color:#E84060;}.wd:last-child{color:#5B8DEF;}
.weeks{display:flex;flex-direction:column;}
.week-row{border-bottom:1px solid var(--bd);min-height:72px;}
.week-row:last-child{border-bottom:none;}
.dnums{display:grid;grid-template-columns:repeat(7,1fr);padding:4px 0 2px;}
.dc{padding:3px 6px;text-align:right;font-size:.78rem;font-weight:600;color:var(--t2);}
.dc.out{color:#C8CDD4;font-weight:400;}
.dc.today .dni{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--TD);color:#fff;font-size:.72rem;font-weight:800;}
.dc.holiday .dni,.dc.leave .dni{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--HL);color:#fff;font-size:.72rem;font-weight:800;}
.dni{display:inline-block;}
.ev-lanes{display:flex;flex-direction:column;gap:2px;padding:0 2px 4px;}
.ev-lane{display:grid;grid-template-columns:repeat(7,1fr);height:17px;}
.ev-bar{height:17px;border-radius:3px;display:flex;align-items:center;padding:0 5px;font-size:.62rem;font-weight:700;color:#fff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin:0 1px;}
.ev-bar.alone{border-radius:3px;margin:0 2px;}
.ev-bar.start{border-radius:3px 0 0 3px;margin-left:2px;margin-right:0;}
.ev-bar.end{border-radius:0 3px 3px 0;margin-right:2px;margin-left:0;}
.ev-bar.mid{border-radius:0;margin:0;}
.yr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
.mini-m{background:var(--sf);border:1px solid var(--bd);border-radius:8px;padding:10px;cursor:pointer;transition:border-color .15s;}
.mini-m:hover{border-color:var(--P);}
.mini-mt{font-size:.76rem;font-weight:700;text-align:center;margin-bottom:5px;}
.mini-wds{display:grid;grid-template-columns:repeat(7,1fr);}
.mini-wd{font-size:.48rem;text-align:center;font-weight:600;color:var(--t3);}
.mini-wd:first-child{color:#E84060;}.mini-wd:last-child{color:#5B8DEF;}
.mini-wk{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:1px;}
.mini-d{aspect-ratio:1;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:.46rem;font-weight:600;color:var(--t2);position:relative;}
.mini-d.out{color:#D1D5DA;}
.mini-d.today,.mini-d.holiday,.mini-d.leave{border-radius:50%;}
.mini-d.today{background:var(--TD);color:#fff;}
.mini-d.holiday,.mini-d.leave{background:var(--HL);color:#fff;}
.mini-d.has-ev::after{content:'';position:absolute;bottom:1px;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:var(--P);}
.mini-d.today::after,.mini-d.holiday::after,.mini-d.leave::after{display:none;}
.month-tabs{display:flex;gap:0;border-bottom:2px solid var(--bd);margin-bottom:16px;overflow-x:auto;-webkit-overflow-scrolling:touch;}
.mtab{padding:8px 18px;font-size:.82rem;font-weight:700;color:var(--t3);background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;font-family:'Noto Sans KR',sans-serif;margin-bottom:-2px;transition:color .15s,border-color .15s;flex-shrink:0;}
.mtab:hover{color:var(--t);}
.mtab.active{color:var(--P);border-bottom-color:var(--P);}
/* ── GANTT ── */
.gantt-year-nav{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.gantt-year-label{font-size:1rem;font-weight:800;}
.gantt-outer{overflow-x:auto;border:1px solid var(--bd);border-radius:10px;background:var(--sf);box-shadow:0 2px 8px rgba(0,0,0,.06);}
.add-ev-btn{padding:7px 14px;border-radius:8px;font-size:.82rem;font-weight:700;border:none;cursor:pointer;background:var(--P);color:#fff;font-family:'Noto Sans KR',sans-serif;transition:all .15s;}
.add-ev-btn:hover{opacity:.88;}
.gantt-table{border-collapse:collapse;table-layout:fixed;}
.gantt-table thead th{position:sticky;top:0;z-index:3;}
.g-th-lbl{background:#1C2230;color:#fff;font-size:.78rem;font-weight:700;text-align:left;padding:8px 12px;white-space:nowrap;position:sticky!important;left:0;z-index:5!important;}
.g-th-q{background:#1C2230;color:#fff;text-align:center;font-size:.76rem;font-weight:800;padding:6px 0;border-left:1px solid rgba(255,255,255,.15);}
.g-th-m{background:#2E3A50;color:#E0E4EC;text-align:center;font-size:.7rem;font-weight:700;padding:4px 0;border-left:1px solid rgba(255,255,255,.1);}
.g-th-d{background:#F0F2F6;color:var(--t2);text-align:center;font-size:.58rem;font-weight:600;padding:4px 0;border-left:1px solid var(--bd);line-height:1.2;}
.g-th-d.today-col{background:#E8F5E9;color:#2E9E50;font-weight:800;}
.g-th-d.weekend-col{background:#FFF0F2;color:#E84060;}
.g-lbl{background:var(--sf);font-size:.78rem;font-weight:700;padding:0 12px;white-space:nowrap;position:sticky;left:0;z-index:2;border-right:2px solid var(--bd);border-bottom:1px solid var(--bd);color:var(--t);}
.g-bars-td{padding:0;border-bottom:1px solid var(--bd);}
.g-bars-inner{position:relative;height:44px;}
.g-bar{position:absolute;top:7px;height:28px;border-radius:5px;display:flex;align-items:center;padding:0 8px;font-size:.68rem;font-weight:700;color:#fff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer;transition:opacity .15s;z-index:1;}
.g-bar:hover{opacity:.8;z-index:2;}
.g-today-line{position:absolute;top:0;bottom:0;width:2px;background:rgba(46,158,80,.5);z-index:3;pointer-events:none;}
.g-proc-row:hover .g-lbl{background:var(--PL);}
.g-proc-row:hover .g-bars-td{background:#FAFBFF;}
.gantt-yr-nav-btn{width:26px;height:26px;border-radius:7px;border:1px solid var(--bd);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.85rem;color:var(--t2);transition:all .15s;}
.gantt-yr-nav-btn:hover{border-color:var(--P);color:var(--P);}
#viewM,#viewY,#viewQ{width:100%;}
@media(max-width:700px){.yr-grid{grid-template-columns:repeat(2,1fr);}.mnav-lbl{min-width:80px;}}
</style></head><body>
<div class="wrap">
<h1>${title}</h1>
<p class="sub">${baseYear}년${months.length>1?' · '+MN_DATA[months[0]]+' – '+MN_DATA[months[months.length-1]]:''}  ·  ${calName}</p>
<div class="top-bar">
  <div class="mnav" id="mnavWrap">
    <button class="mnav-btn" onclick="chMonth(-1)">‹</button>
    <span class="mnav-lbl" id="mnavLbl"></span>
    <button class="mnav-btn" onclick="chMonth(1)">›</button>
  </div>
  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
    <div class="vtgl">
      <button class="vb active" id="btnM" onclick="setV('m')">월별</button>
      <button class="vb" id="btnY" onclick="setV('y')">연간</button>
      <button class="vb" id="btnQ" onclick="setV('q')">분기</button>
    </div>
    <button class="add-ev-btn" onclick="openAddEvModal()">＋ 일정 추가</button>
    <button class="add-ev-btn" style="background:#fff;color:var(--t2);border:1px solid var(--bd);" onclick="openHolidayModal()">🗓 공휴일</button>
  </div>
</div>
<!-- 일정 추가 모달 -->
<div id="addEvOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100;display:none;align-items:center;justify-content:center;padding:16px">
  <div style="background:#fff;border-radius:14px;padding:24px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.25)">
    <div style="font-size:1rem;font-weight:800;margin-bottom:16px;" id="addEvTitle">일정 추가</div>
    <div style="margin-bottom:10px"><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">프로젝트</label><input id="iev_project" type="text" placeholder="예: 로도스도 전기" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box"></div>
    <div style="margin-bottom:10px"><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">공정</label><select id="iev_process" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;background:#F5F6FA;box-sizing:border-box"><option value="">-- 공정 선택 --</option></select></div>
    <div style="margin-bottom:10px"><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">작업</label><input id="iev_task" type="text" placeholder="예: 글콘티 검수" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box"></div>
    <div style="margin-bottom:10px"><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">회차수</label><input id="iev_episode" type="text" placeholder="예: 19화" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box"></div>
    <div style="margin-bottom:10px"><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">메모</label><textarea id="iev_note" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;resize:vertical;min-height:50px;box-sizing:border-box"></textarea></div>
    <div style="margin-bottom:10px"><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">색상</label><div id="iev_colors" style="display:flex;gap:6px;flex-wrap:wrap;"></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">시작일</label><input id="iev_start" type="date" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box"></div>
      <div><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">종료일</label><input id="iev_end" type="date" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">시작 시간</label><input id="iev_startTime" type="time" value="10:00" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box"></div>
      <div><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">종료 시간</label><input id="iev_endTime" type="time" value="19:00" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box"></div>
    </div>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:16px"><input type="checkbox" id="iev_excl" style="width:15px;height:15px;accent-color:#D91F3E"><span style="font-size:.84rem;font-weight:600;color:#4E5968">주말 제외하고 표시</span></label>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <button id="iev_del" onclick="deleteIframEv()" style="display:none;padding:8px 16px;border-radius:8px;border:1px solid #E84060;background:#FFF3F5;color:#E84060;cursor:pointer;font-size:.82rem;font-weight:700;font-family:inherit">삭제</button>
      <div style="display:flex;gap:8px;margin-left:auto">
        <button onclick="closeAddEvModal()" style="padding:8px 16px;border-radius:8px;border:1px solid #E5E8EB;background:#fff;cursor:pointer;font-size:.82rem;font-weight:700;font-family:inherit">취소</button>
        <button onclick="saveIframeEv()" style="padding:8px 16px;border-radius:8px;border:none;background:#D91F3E;color:#fff;cursor:pointer;font-size:.82rem;font-weight:700;font-family:inherit">저장</button>
      </div>
    </div>
  </div>
</div>
<!-- 공휴일 모달 -->
<div id="hlOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100;align-items:center;justify-content:center;padding:16px">
  <div style="background:#fff;border-radius:14px;padding:24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25)">
    <div style="font-size:1rem;font-weight:800;margin-bottom:16px">공휴일 / 연차 지정</div>
    <div style="margin-bottom:10px"><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">날짜</label><input id="ihl_date" type="date" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box"></div>
    <div style="margin-bottom:10px;display:flex;gap:8px"><button id="ihl_h" onclick="selIHlType('holiday')" style="flex:1;padding:10px;border-radius:8px;border:1px solid #E5E8EB;background:#FFF3F5;color:#E84060;cursor:pointer;font-weight:700;font-family:inherit">🔴 공휴일</button><button id="ihl_l" onclick="selIHlType('leave')" style="flex:1;padding:10px;border-radius:8px;border:1px solid #E5E8EB;background:#fff;cursor:pointer;font-weight:700;font-family:inherit">🔵 연차</button></div>
    <div style="margin-bottom:16px"><label style="font-size:.8rem;font-weight:700;color:#4E5968;display:block;margin-bottom:4px">메모</label><input id="ihl_note" type="text" style="width:100%;padding:9px 12px;border:1px solid #E5E8EB;border-radius:8px;font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button onclick="closeHolidayModal()" style="padding:8px 16px;border-radius:8px;border:1px solid #E5E8EB;background:#fff;cursor:pointer;font-size:.82rem;font-weight:700;font-family:inherit">취소</button><button onclick="saveIframeHl()" style="padding:8px 16px;border-radius:8px;border:none;background:#D91F3E;color:#fff;cursor:pointer;font-size:.82rem;font-weight:700;font-family:inherit">저장</button></div>
  </div>
</div>
${isMulti?`<div class="month-tabs" id="monthTabs"></div>`:''}
<div class="tag-bar" id="tagBar" style="display:none"><span class="tag-label">업무 태그:</span></div>
<div class="legend" id="legend"></div>
<div id="viewM"></div>
<div id="viewY" style="display:none"></div>
<div id="viewQ" style="display:none">
  <div class="gantt-year-nav">
    <button class="gantt-yr-nav-btn" onclick="chGY(-1)">‹</button>
    <span class="gantt-year-label" id="gYearLbl"></span>
    <button class="gantt-yr-nav-btn" onclick="chGY(1)">›</button>
  </div>
  <div id="ganttView"></div>
</div>
</div>
<script>
// getEvLabel: 모든 함수보다 먼저 정의되어야 함
function getEvLabel(ev){var task=ev.task||ev.name||'';var proj=ev.project||'';var ep=ev.episode||'';return task||ep||proj;}
const EVENTS=${evtsJSON};const SPECIALS=${spsJSON};
const ALL_EVENTS_ORIG=[...EVENTS];
const MONTHS=${JSON.stringify(months)};const BASE_YEAR=${baseYear};
const PROCESSES=${procsJSON};
const MN=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const IS_MULTI=${isMulti};
const TODAY=new Date();TODAY.setHours(0,0,0,0);
let curM=MONTHS[0],curY=BASE_YEAR,gY=BASE_YEAR;
function pd(s){const[y,m,d]=s.split('-').map(Number);const dt=new Date(y,m-1,d);dt.setHours(0,0,0,0);return dt;}
function ds(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function isTD(d){return d.getTime()===TODAY.getTime();}
function getSP(str){return SPECIALS.find(s=>s.date===str)||null;}
function getWks(y,m){const fd=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate();const wks=[],total=Math.ceil((fd+dim)/7)*7;for(let w=0;w<total/7;w++){const wk=[];for(let d=0;d<7;d++){const dn=w*7+d-fd+1;const dt=new Date(y,m,dn);dt.setHours(0,0,0,0);wk.push({date:dt,inM:dn>=1&&dn<=dim});}wks.push(wk);}return wks;}
function getEC(ev,wk){const es=pd(ev.start),ee=pd(ev.end);let sc=-1,ec=-1;for(let i=0;i<7;i++){const d=wk[i].date;if(d>=es&&d<=ee){if(sc===-1)sc=i;ec=i;}}return{sc,ec};}
function assignL(evts,wk){const items=evts.map(e=>{const{sc,ec}=getEC(e,wk);return{e,sc,ec,lane:-1};}).filter(i=>i.sc!==-1);items.sort((a,b)=>a.sc-b.sc);const ends=[];items.forEach(item=>{let p=false;for(let l=0;l<ends.length;l++){if(ends[l]<item.sc){item.lane=l;ends[l]=item.ec;p=true;break;}}if(!p){item.lane=ends.length;ends.push(item.ec);}});return items;}
function getCls(ev,wk){const es=pd(ev.start),ee=pd(ev.end),wS=wk[0].date,wE=wk[6].date;const sh=es>=wS&&es<=wE,eh=ee>=wS&&ee<=wE;if(sh&&eh)return'alone';if(sh)return'start';if(eh)return'end';return'mid';}
function renderLegend(){const el=document.getElementById('legend');if(!EVENTS.length){el.innerHTML='<span style="font-size:.76rem;color:#8B95A1">등록된 일정 없음</span>';return;}el.innerHTML=EVENTS.map(ev=>'<div class="leg-item"><div class="leg-dot" style="background:'+ev.color+'"></div><span>'+getEvLabel(ev)+'</span></div>').join('');}
function buildMonthHTML(y,m){const wks=getWks(y,m);const mS=new Date(y,m,1),mE=new Date(y,m+1,0);const wEvtsAll=EVENTS.filter(ev=>{const es=pd(ev.start),ee=pd(ev.end);return es<=mE&&ee>=mS;});let html='<div class="cal-box"><div class="wds"><div class="wd">일</div><div class="wd">월</div><div class="wd">화</div><div class="wd">수</div><div class="wd">목</div><div class="wd">금</div><div class="wd">토</div></div><div class="weeks">';wks.forEach(wk=>{const wEvts=wEvtsAll.filter(ev=>{const es=pd(ev.start),ee=pd(ev.end);return es<=wk[6].date&&ee>=wk[0].date;});const laned=assignL(wEvts,wk);const numL=laned.length?Math.max(...laned.map(i=>i.lane))+1:0;html+='<div class="week-row"><div class="dnums">';wk.forEach(day=>{const str=ds(day.date);const sp=getSP(str);let cls='dc'+(!day.inM?' out':'')+(isTD(day.date)?' today':'');if(day.inM&&sp)cls+=' '+(sp.type==='holiday'?'holiday':'leave');html+='<div class="'+cls+'" title="'+(sp?(sp.type==='holiday'?'공휴일':'연차')+(sp.note?': '+sp.note:''):'')+'"><span class="dni">'+day.date.getDate()+'</span></div>';});html+='</div>';if(numL>0){html+='<div class="ev-lanes">';for(let l=0;l<numL;l++){html+='<div class="ev-lane">';laned.filter(i=>i.lane===l).forEach(item=>{const cls=getCls(item.e,wk);if(item.e.excludeWeekend){let segHtml='',inSeg=false,segSc=-1;const es2=pd(item.e.start),ee2=pd(item.e.end);for(let ci=0;ci<7;ci++){const d=wk[ci].date,dow=d.getDay();const inRange=d>=es2&&d<=ee2;const isWE=dow===0||dow===6;if(inRange&&!isWE){if(!inSeg){segSc=ci;inSeg=true;}}else{if(inSeg){const eidx=EVENTS.indexOf(item.e);const evidxAttr=eidx>=0?' data-evidx="'+eidx+'"':'';segHtml+='<div class="ev-bar '+getCls(item.e,wk)+'"'+evidxAttr+' style="background:'+item.e.color+';grid-column:'+(segSc+1)+'/'+(ci+1)+'">'+((pd(item.e.start)>=wk[0].date&&segSc===0)?getEvLabel(item.e):'')+'</div>';inSeg=false;segSc=-1;}}if(ci===6&&inSeg){segHtml+='<div class="ev-bar '+getCls(item.e,wk)+'"'+evidxAttr+' style="background:'+item.e.color+';grid-column:'+(segSc+1)+'/8">'+((pd(item.e.start)>=wk[0].date&&segSc===0)?getEvLabel(item.e):'')+'</div>';}}html+=segHtml;}else{const eidxN=EVENTS.indexOf(item.e);const evidxAttrN=eidxN>=0?' data-evidx="'+eidxN+'"':'';html+='<div class="ev-bar '+cls+'"'+evidxAttrN+' style="background:'+item.e.color+';grid-column:'+(item.sc+1)+'/'+(item.ec+2)+'">'+((pd(item.e.start)>=wk[0].date&&pd(item.e.start)<=wk[6].date)?getEvLabel(item.e):'')+'</div>';}});html+='</div>';}html+='</div>';}html+='</div>';});html+='</div></div>';return html;}
function renderMonthly(){const lbl=document.getElementById('mnavLbl');if(lbl)lbl.textContent=curY+'년 '+MN[curM];if(IS_MULTI){document.querySelectorAll('.mtab').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.m)===curM));const at=document.querySelector('.mtab.active');if(at)at.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}document.getElementById('viewM').innerHTML=buildMonthHTML(curY,curM);}
function renderYearly(){let html='<div class="yr-grid">';for(let m=0;m<12;m++){const wks=getWks(curY,m);html+='<div class="mini-m" onclick="switchToMonth('+m+')"><div class="mini-mt">'+MN[m]+'</div><div class="mini-wds">'+['일','월','화','수','목','금','토'].map(d=>'<div class="mini-wd">'+d+'</div>').join('')+'</div>';wks.forEach(wk=>{html+='<div class="mini-wk">';wk.forEach(day=>{const str=ds(day.date);const sp=getSP(str);let cls='mini-d'+(!day.inM?' out':'')+(isTD(day.date)?' today':'');if(day.inM&&sp)cls+=' '+(sp.type==='holiday'?'holiday':'leave');const hasEv=day.inM&&EVENTS.some(ev=>{const es=pd(ev.start),ee=pd(ev.end);return day.date>=es&&day.date<=ee;});if(hasEv&&!sp&&!isTD(day.date))cls+=' has-ev';html+='<div class="'+cls+'">'+(day.inM?day.date.getDate():'')+'</div>';});html+='</div>';});html+='</div>';}html+='</div>';document.getElementById('viewY').innerHTML=html;}
function renderQuarterly(){
  const year=gY;
  document.getElementById('gYearLbl').textContent=year+'년';
  const COL_W=14,LBL_W=140;
  const cols=[];const tmp=new Date(year,0,1);
  while(tmp.getFullYear()===year){cols.push(new Date(tmp));tmp.setDate(tmp.getDate()+1);}
  const N=cols.length;
  function getCI(dt){const start=new Date(year,0,1);return Math.max(0,Math.min(N-1,Math.round((dt.getTime()-start.getTime())/86400000)));}
  function getBarPos(es,ee){if(ee<new Date(year,0,1)||es>new Date(year,11,31))return null;const sc=getCI(es),ec=getCI(ee);return{left:sc*COL_W+1,width:(ec-sc+1)*COL_W-2};}
  const qDays=[0,0,0,0];const mDays=Array(12).fill(0);
  cols.forEach(c=>{const m=c.getMonth();qDays[Math.floor(m/3)]++;mDays[m]++;});
  const todayIdx=TODAY.getFullYear()===year?getCI(TODAY):-1;
  let html='<div class="gantt-outer"><table class="gantt-table" style="min-width:'+(LBL_W+N*COL_W)+'px"><colgroup><col style="width:'+LBL_W+'px">';
  cols.forEach(()=>html+='<col style="width:'+COL_W+'px">');
  html+='</colgroup><thead><tr><th class="g-th-lbl g-th-q" rowspan="3" style="font-size:.74rem">공정</th>';
  ['Q1','Q2','Q3','Q4'].forEach((q,qi)=>{if(qDays[qi]>0)html+='<th class="g-th-q" colspan="'+qDays[qi]+'">'+q+'</th>';});
  html+='</tr><tr>';
  mDays.forEach((cnt,mi)=>{if(cnt>0)html+='<th class="g-th-m" colspan="'+cnt+'">'+(mi+1)+'月</th>';});
  html+='</tr><tr>';
  cols.forEach((c,i)=>{
    const day=c.getDate(),dow=c.getDay(),isWE=dow===0||dow===6;
    const cls='g-th-d'+(i===todayIdx?' today-col':isWE?' weekend-col':'');
    html+='<th class="'+cls+'" title="'+(c.getMonth()+1)+'/'+day+'">'+day+'</th>';
  });
  html+='</tr></thead><tbody>';
  function buildRow(lbl,evts){
    let r='<tr class="g-proc-row"><td class="g-lbl">'+lbl+'</td><td colspan="'+N+'" class="g-bars-td"><div class="g-bars-inner" style="width:'+(N*COL_W)+'px">';
    cols.forEach((c,i)=>{if(c.getDay()===0||c.getDay()===6)r+='<div style="position:absolute;top:0;bottom:0;left:'+(i*COL_W)+'px;width:'+COL_W+'px;background:rgba(232,64,96,.07);pointer-events:none;z-index:0"></div>';});
    if(todayIdx>=0)r+='<div class="g-today-line" style="left:'+(todayIdx*COL_W+COL_W/2)+'px"></div>';
    evts.forEach(ev=>{const pos=getBarPos(pd(ev.start),pd(ev.end));if(!pos)return;const lbl2=getEvLabel(ev);r+='<div class="g-bar" style="left:'+pos.left+'px;width:'+pos.width+'px;background:'+ev.color+'" title="'+ev.name+(ev.episode?' ['+ev.episode+']':'')+'">'+lbl2+'</div>';});
    return r+'</div></td></tr>';
  }
  PROCESSES.forEach(proc=>{
    const pevts=EVENTS.filter(ev=>(ev.process||'')===proc);
    html+=buildRow(proc,pevts);
  });
  const unassigned=EVENTS.filter(ev=>!ev.process||!PROCESSES.includes(ev.process));
  if(unassigned.length) html+=buildRow('<span style="color:#8B95A1;font-size:.74rem">미분류</span>',unassigned);
  html+='</tbody></table></div>';
  document.getElementById('ganttView').innerHTML=html;
}
function switchToMonth(m){curM=m;setV('m');}
function chGY(d){gY+=d;renderQuarterly();}
function setV(v){
  document.getElementById('viewM').style.display=v==='m'?'block':'none';
  document.getElementById('viewY').style.display=v==='y'?'block':'none';
  document.getElementById('viewQ').style.display=v==='q'?'block':'none';
  document.getElementById('btnM').className='vb'+(v==='m'?' active':'');
  document.getElementById('btnY').className='vb'+(v==='y'?' active':'');
  document.getElementById('btnQ').className='vb'+(v==='q'?' active':'');
  const nw=document.getElementById('mnavWrap');if(nw)nw.style.display=v==='m'?'flex':'none';
  const mt=document.getElementById('monthTabs');if(mt)mt.style.display=v==='m'?'flex':'none';
  if(v==='m')renderMonthly();else if(v==='y')renderYearly();else renderQuarterly();
}
function chMonth(d){if(IS_MULTI){const idx=MONTHS.indexOf(curM);const ni=idx+d;if(ni>=0&&ni<MONTHS.length)curM=MONTHS[ni];else return;}else{curM+=d;if(curM<0){curM=11;curY--;}if(curM>11){curM=0;curY++;}}renderMonthly();}
renderLegend();
if(IS_MULTI){const tb=document.getElementById('monthTabs');MONTHS.forEach(m=>{const b=document.createElement('button');b.className='mtab'+(m===curM?' active':'');b.textContent=MN[m];b.dataset.m=m;b.onclick=()=>{curM=m;renderMonthly();};tb.appendChild(b);});}
(function initTagBar(){
  const allTags=[...new Set(ALL_EVENTS_ORIG.flatMap(ev=>ev.tags||[]))];
  const bar=document.getElementById('tagBar');
  if(!allTags.length||!bar)return;
  bar.style.display='flex';
  const VIS=${JSON.stringify(settings.visibleTags||null)};
  function applyFilter(tags){
    EVENTS.length=0;
    const src=tags?ALL_EVENTS_ORIG.filter(ev=>(ev.tags||[]).some(t=>tags.includes(t))||(ev.tags||[]).length===0):ALL_EVENTS_ORIG;
    src.forEach(e=>EVENTS.push(e));
  }
  if(VIS&&VIS.length){applyFilter(VIS);renderLegend();renderMonthly();}
  let activeTags=VIS?[...VIS]:null;
  const renderChips=()=>{
    const allIsActive=!activeTags;
    bar.innerHTML='<span class="tag-label">업무 태그:</span>';
    const allChip=document.createElement('span');
    allChip.className='tag-chip'+(allIsActive?' active':'');allChip.textContent='전체';
    allChip.onclick=()=>{activeTags=null;applyFilter(null);renderChips();renderLegend();renderMonthly();if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();};
    bar.appendChild(allChip);
    allTags.forEach(t=>{
      const isActive=activeTags&&activeTags.includes(t);
      const chip=document.createElement('span');chip.className='tag-chip'+(isActive?' active':'');chip.textContent=t;
      chip.onclick=()=>{
        if(!activeTags)activeTags=[...allTags];
        if(isActive){activeTags=activeTags.filter(x=>x!==t);if(!activeTags.length)activeTags=null;}else{activeTags.push(t);if(activeTags.length===allTags.length)activeTags=null;}
        applyFilter(activeTags);
        renderChips();renderLegend();renderMonthly();if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
      };
      bar.appendChild(chip);
    });
  };
  renderChips();
})();
/* ── iframe 이벤트 관리 ── */
const C16=['#D91F3E','#E84060','#FF5C5C','#FF7A00','#FFA800','#F5C400','#4CAF50','#00A878','#00BCD4','#0064FF','#3D5AFE','#6C5CE7','#E91E8C','#9C27B0','#607D8B','#37474F'];
let _ievColor=C16[0],_ievEditIdx=-1,_ihlType='holiday';
function buildCP(){const el=document.getElementById('iev_colors');if(!el)return;el.innerHTML=C16.map(function(c){return'<div data-c="'+c+'" onclick="pickC(this.dataset.c)" style="width:24px;height:24px;border-radius:6px;background:'+c+';cursor:pointer;box-sizing:border-box;border:3px solid '+(c===_ievColor?'#333':'transparent')+';transition:all .12s"></div>';}).join('');}
function pickC(c){_ievColor=typeof c==='string'?c:c;buildCP();}
function pickC(c){_ievColor=c;buildCP();}
function fillProcSel(){const sel=document.getElementById('iev_process');if(!sel)return;sel.innerHTML='<option value="">-- 공정 선택 --</option>'+PROCESSES.map(p=>'<option value="'+p+'">'+p+'</option>').join('');}
function openAddEvModal(idx){
  idx=idx===undefined?-1:idx;_ievEditIdx=idx;
  fillProcSel();
  const today=ds(TODAY);
  if(idx===-1){
    document.getElementById('addEvTitle').textContent='일정 추가';
    ['iev_project','iev_task','iev_note','iev_episode'].forEach(id=>{document.getElementById(id).value='';});
    document.getElementById('iev_start').value=today;document.getElementById('iev_end').value=today;
    document.getElementById('iev_startTime').value='10:00';document.getElementById('iev_endTime').value='19:00';
    document.getElementById('iev_excl').checked=true;document.getElementById('iev_process').value='';
    document.getElementById('iev_del').style.display='none';_ievColor=C16[0];
  }else{
    const ev=EVENTS[idx];
    document.getElementById('addEvTitle').textContent='일정 수정';
    document.getElementById('iev_project').value=ev.project||'';
    document.getElementById('iev_task').value=ev.task||ev.name||'';
    document.getElementById('iev_note').value=ev.note||'';
    document.getElementById('iev_episode').value=ev.episode||'';
    document.getElementById('iev_start').value=ev.start;document.getElementById('iev_end').value=ev.end;
    document.getElementById('iev_startTime').value=ev.startTime||'10:00';
    document.getElementById('iev_endTime').value=ev.endTime||'19:00';
    document.getElementById('iev_excl').checked=ev.excludeWeekend!==undefined?ev.excludeWeekend:true;
    document.getElementById('iev_process').value=ev.process||'';
    document.getElementById('iev_del').style.display='inline-block';
    _ievColor=ev.color||C16[0];
  }
  buildCP();document.getElementById('addEvOverlay').style.display='flex';
}
function closeAddEvModal(){document.getElementById('addEvOverlay').style.display='none';}
function saveIframeEv(){
  const project=document.getElementById('iev_project').value.trim();
  const task=document.getElementById('iev_task').value.trim();
  const start=document.getElementById('iev_start').value;
  const end=document.getElementById('iev_end').value;
  if(!start||!end||start>end){alert('날짜를 확인해주세요.');return;}
  if(!project&&!task){alert('프로젝트명 또는 작업명을 입력해주세요.');return;}
  const ev={name:task||project,project,task,
    note:document.getElementById('iev_note').value.trim(),
    episode:document.getElementById('iev_episode').value.trim(),
    color:_ievColor,start,end,
    startTime:document.getElementById('iev_startTime').value||'',
    endTime:document.getElementById('iev_endTime').value||'',
    excludeWeekend:document.getElementById('iev_excl').checked,
    process:document.getElementById('iev_process').value||'',tags:[]};
  if(_ievEditIdx===-1){EVENTS.push(ev);}else{EVENTS[_ievEditIdx]=ev;}
  window.parent.postMessage({type:'iframeEvSave',events:JSON.parse(JSON.stringify(EVENTS)),specials:JSON.parse(JSON.stringify(SPECIALS))},'*');
  closeAddEvModal();renderLegend();renderMonthly();
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
}
function deleteIframEv(){
  if(_ievEditIdx===-1)return;if(!confirm('이 일정을 삭제할까요?'))return;
  EVENTS.splice(_ievEditIdx,1);
  window.parent.postMessage({type:'iframeEvSave',events:JSON.parse(JSON.stringify(EVENTS)),specials:JSON.parse(JSON.stringify(SPECIALS))},'*');
  closeAddEvModal();renderLegend();renderMonthly();
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
}
function openHolidayModal(){
  document.getElementById('ihl_date').value=ds(TODAY);
  selIHlType('holiday');document.getElementById('ihl_note').value='';
  document.getElementById('hlOverlay').style.display='flex';
}
function closeHolidayModal(){document.getElementById('hlOverlay').style.display='none';}
function selIHlType(t){
  _ihlType=t;
  document.getElementById('ihl_h').style.background=t==='holiday'?'#FFF3F5':'#fff';
  document.getElementById('ihl_l').style.background=t==='leave'?'#F0F5FF':'#fff';
}
function saveIframeHl(){
  const date=document.getElementById('ihl_date').value;if(!date)return;
  const note=document.getElementById('ihl_note').value.trim();
  const existing=SPECIALS.findIndex(s=>s.date===date);
  const sp={date,type:_ihlType,note};
  if(existing>=0)SPECIALS[existing]=sp;else SPECIALS.push(sp);
  window.parent.postMessage({type:'iframeEvSave',events:JSON.parse(JSON.stringify(EVENTS)),specials:JSON.parse(JSON.stringify(SPECIALS))},'*');
  closeHolidayModal();renderMonthly();
}
// ev-bar 클릭으로 수정 모달 열기
document.addEventListener('click',function(e){
  const bar=e.target.closest('[data-evidx]');
  if(bar){openAddEvModal(parseInt(bar.dataset.evidx));return;}
  const a=e.target.closest('a');if(a&&(!a.getAttribute('href')||a.getAttribute('href')==='#'))e.preventDefault();
});
setV('m');
<\/script></body></html>`;
}


const TODAY=new Date();TODAY.setHours(0,0,0,0);
let cY=TODAY.getFullYear(),cM=TODAY.getMonth();
const MN=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const C16=['#D91F3E','#E84060','#FF5C5C','#FF7A00','#FFA800','#F5C400','#4CAF50','#00A878','#00BCD4','#0064FF','#3D5AFE','#6C5CE7','#E91E8C','#9C27B0','#607D8B','#37474F'];
let selColor=C16[0],editEvIdx=-1,hlType='holiday';

/* ══ 태그 관련 ══ */
let _activeTag=null;
let _editTags=[];

function renderTagChips(){
  const container=document.getElementById('tagChipsContainer');
  if(!container)return;
  container.innerHTML=_editTags.map((t,i)=>`<span class="ev-tag-chip">${t}<span class="ev-tag-chip-x" onclick="removeEditTag(${i})">✕</span></span>`).join('');
  _renderTagSuggestions();
}
function removeEditTag(i){_editTags.splice(i,1);renderTagChips();}
function handleTagInput(e){
  if(e.key==='Enter'){
    const v=document.getElementById('tagRealInput').value.trim();
    if(v&&!_editTags.includes(v)){_editTags.push(v);renderTagChips();document.getElementById('tagRealInput').value='';}
    e.preventDefault();
  }
}
function _addTagFromSuggestion(tag){
  if(!_editTags.includes(tag)){_editTags.push(tag);renderTagChips();document.getElementById('tagRealInput').value='';}
}
function _renderTagSuggestions(){
  const wrap=document.getElementById('tagSuggestWrap');
  if(!wrap)return;
  const allTags=[...new Set(EVENTS.flatMap(ev=>ev.tags||[]))].sort();
  if(!allTags.length){wrap.style.display='none';return;}
  wrap.style.display='block';
  wrap.innerHTML=allTags.map(t=>{
    const isUsed=_editTags.includes(t);
    return`<span class="tag-suggest-chip${isUsed?' used':''}" onclick="${isUsed?'':`_addTagFromSuggestion('${t.replace(/'/g,"\\'")}')`}">${t}</span>`;
  }).join('');
}
function setTagFilter(tag){
  _activeTag=tag;
  renderTagFilter();renderLegend();renderMonthly();
}
function renderTagFilter(){
  const wrap=document.getElementById('tagFilterWrap');
  if(!wrap)return;
  const allTags=[...new Set(EVENTS.flatMap(ev=>ev.tags||[]))];
  if(!allTags.length){wrap.style.display='none';return;}
  wrap.style.display='flex';
  const chips=document.getElementById('tagFilterChips');
  if(chips){
    chips.innerHTML=allTags.map(t=>`<span class="tag-chip${_activeTag===t?' active':''}" onclick="setTagFilter('${t.replace(/'/g,"\\'")}')"> ${t}</span>`).join('');
  }
  wrap.querySelectorAll('.tag-chip.all').forEach(el=>el.classList.toggle('active',!_activeTag));
}

/* ══ 캘린더 설정 ══ */
// CAL_CFG — 최상단으로 이동됨
const DEF_PROCESSES=['스토리기획','콘티','선화','채색','교정','식자편집','로컬','납품','연재','런칭프로모션','연참 및 팝업배너'];
// PROCESSES — 최상단으로 이동됨
// ASSIGNEE_SETS — 최상단으로 이동됨
// CAL_DISPLAY: 캘린더 표기 설정 — task/process/project/project+process/process+task/all/episode/name
// CAL_DISPLAY — 최상단으로 이동됨

/* ══ 캘린더 표기 레이블 생성 ══ */
function getEvLabel(ev){
  const mode=(CAL_DISPLAY||{}).labelMode||'task';
  const proj=ev.project||'';
  const proc=ev.process||'';
  const task=ev.task||ev.name||'';
  const ep=ev.episode||'';
  const SEP=' · ';
  switch(mode){
    case 'task':       return task||ep||proj;
    case 'process':    return proc||task;
    case 'project':    return proj||task;
    case 'project+process': return [proj,proc].filter(Boolean).join(SEP)||task;
    case 'process+task':    return [proc,task].filter(Boolean).join(SEP);
    case 'all':        return [proj,proc,task].filter(Boolean).join(SEP)||ep;
    case 'episode':    return ep||task;
    case 'name':       return ev.name||task;
    default:           return task||ev.name;
  }
}

/* ══ 캘린더 표기 설정 ══ */
let _calLabelPickedMode=null;
function openCalDisplayModal(){
  const cur=(CAL_DISPLAY||{}).labelMode||'task';
  _calLabelPickedMode=cur;
  document.querySelectorAll('#calLabelOptGrid .cal-label-opt').forEach(el=>{
    el.classList.toggle('active',el.dataset.mode===cur);
  });
  updateCalLabelPreview(cur);
  document.getElementById('calDisplayOverlay').classList.add('open');
}
function closeCalDisplayModal(){document.getElementById('calDisplayOverlay').classList.remove('open');}
function pickCalLabelMode(el){
  document.querySelectorAll('#calLabelOptGrid .cal-label-opt').forEach(e=>e.classList.remove('active'));
  el.classList.add('active');
  _calLabelPickedMode=el.dataset.mode;
  updateCalLabelPreview(_calLabelPickedMode);
}
function updateCalLabelPreview(mode){
  const sampleEv={name:'글콘티 검수',project:'로도스도 전기',process:'콘티',task:'글콘티 검수',episode:'19화'};
  const prevCAL=CAL_DISPLAY;CAL_DISPLAY={labelMode:mode};
  const label=getEvLabel(sampleEv);CAL_DISPLAY=prevCAL;
  const el=document.getElementById('calLabelPreviewText');
  if(el)el.textContent=label||'(빈칸)';
}
function saveCalDisplaySettings(){
  if(!CAL_DISPLAY)CAL_DISPLAY={};
  CAL_DISPLAY.labelMode=_calLabelPickedMode||'task';
  saveAll();closeCalDisplayModal();
  renderMonthly();renderLegend();
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
  toast('표기 설정이 저장되었습니다.');
}
function applyCalCfg(){
  document.documentElement.style.setProperty('--TD',CAL_CFG.todayColor||'#2E9E50');
  document.documentElement.style.setProperty('--HL',CAL_CFG.holidayColor||'#E84060');
}
function openCalSettings(){
  const cfg=CAL_CFG;
  document.getElementById('csTodayClr').value=cfg.todayColor||'#2E9E50';
  document.getElementById('csTodayClrTxt').value=cfg.todayColor||'#2E9E50';
  document.getElementById('csHolidayClr').value=cfg.holidayColor||'#E84060';
  document.getElementById('csHolidayClrTxt').value=cfg.holidayColor||'#E84060';
  ['csViewM','csViewY'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.className='hl-btn'+(id.endsWith(cfg.defaultView||'m')?' sel-hl':'');
  });
  document.getElementById('csDefaultColorPicker').innerHTML=C16.map(c=>`<div class="clr-sw${c===(cfg.defaultColor||C16[0])?' sel':''}" style="background:${c}" onclick="pickCalDefaultClr('${c}')"></div>`).join('');
  // 태그 목록 렌더
  renderCalSettingsTagList();
  calSetTab('view');
  document.getElementById('calSettingsOverlay').classList.add('open');
}
/* ══ 캘린더 설정 태그 필터 (다중 선택) ══
   CAL_CFG.visibleTags = null(전체) 또는 선택된 태그 배열
   visibleTags가 비어있으면 모든 일정 표시 */
function renderCalSettingsTagList(){
  const allTags=[...new Set(EVENTS.flatMap(ev=>ev.tags||[]))];
  const el=document.getElementById('csTagCheckList');
  if(!el)return;
  if(!allTags.length){
    el.innerHTML='<div style="font-size:.82rem;color:var(--t3);font-weight:500;padding:8px 0;">등록된 업무 태그가 없습니다.<br>일정 추가 시 태그를 입력하면 나타납니다.</div>';
    return;
  }
  // null = 전체 선택 상태
  const vis=CAL_CFG.visibleTags;
  const isAll=(!vis||vis.length===allTags.length);
  el.innerHTML=allTags.map(t=>{
    const checked=(!vis||vis.includes(t));
    return`<label class="tag-check-item">
      <input type="checkbox" class="cs-tag-cb" value="${t}" ${checked?'checked':''}>
      <span class="tag-check-name">${t}</span>
    </label>`;
  }).join('');
}
function csTagSelectAll(checked){
  document.querySelectorAll('#csTagCheckList .cs-tag-cb').forEach(cb=>cb.checked=checked);
}
function saveCalTagSettings(){
  const cbs=[...document.querySelectorAll('#csTagCheckList .cs-tag-cb')];
  const allTags=[...new Set(EVENTS.flatMap(ev=>ev.tags||[]))];
  const checked=cbs.filter(cb=>cb.checked).map(cb=>cb.value);
  CAL_CFG.visibleTags=(checked.length===allTags.length)?null:checked;
  saveAll();  // Supabase 동기화
  renderMonthly();renderLegend();renderTagFilter();
  closeCalSettings();
  toast('태그 필터가 저장되었습니다.');
}
function mainCalTagCheckAll(){}  // deprecated
function closeCalSettings(){document.getElementById('calSettingsOverlay').classList.remove('open');}
function calSetTab(id){
  document.querySelectorAll('#calSettingsOverlay .m-stab').forEach((b,i)=>b.classList.toggle('active',['view','color','tags'][i]===id));
  document.querySelectorAll('#calSettingsOverlay .m-sp').forEach(p=>p.classList.toggle('active',p.id===`cst-${id}`));
}
function calSetDefaultView(v){
  CAL_CFG.defaultView=v;
  ['csViewM','csViewY'].forEach(id=>{const el=document.getElementById(id);if(el)el.className='hl-btn'+(id.endsWith(v)?' sel-hl':'');});
}
function pickCalDefaultClr(c){
  CAL_CFG.defaultColor=c;selColor=c;
  document.getElementById('csDefaultColorPicker').innerHTML=C16.map(cl=>`<div class="clr-sw${cl===c?' sel':''}" style="background:${cl}" onclick="pickCalDefaultClr('${cl}')"></div>`).join('');
}
function saveCalViewSettings(){
  CAL_CFG.todayColor=document.getElementById('csTodayClr').value;
  CAL_CFG.holidayColor=document.getElementById('csHolidayClr').value;
  saveAll();applyCalCfg();
  renderMonthly();toast('캘린더 설정이 저장되었습니다.');
}
function saveCalColorSettings(){
  saveAll();
  toast('색상 설정이 저장되었습니다.');closeCalSettings();
}

function pd(s){const[y,m,d]=s.split('-').map(Number);const dt=new Date(y,m-1,d);dt.setHours(0,0,0,0);return dt;}
function ds(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function isTD(d){return d.getTime()===TODAY.getTime();}
function getSP(str){return SPECIALS.find(s=>s.date===str)||null;}
function getWeeks(y,m){
  const fd=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate();
  const weeks=[],total=Math.ceil((fd+dim)/7)*7;
  for(let w=0;w<total/7;w++){
    const wk=[];
    for(let d=0;d<7;d++){const dn=w*7+d-fd+1;const dt=new Date(y,m,dn);dt.setHours(0,0,0,0);wk.push({date:dt,inM:dn>=1&&dn<=dim});}
    weeks.push(wk);
  }
  return weeks;
}
function getEC(ev,week){const es=pd(ev.start),ee=pd(ev.end);let sc=-1,ec=-1;for(let i=0;i<7;i++){const d=week[i].date;if(d>=es&&d<=ee){if(sc===-1)sc=i;ec=i;}}return{sc,ec};}
function assignL(evts,week){const items=evts.map(e=>{const{sc,ec}=getEC(e,week);return{e,sc,ec,lane:-1};}).filter(i=>i.sc!==-1);items.sort((a,b)=>a.sc-b.sc);const ends=[];items.forEach(item=>{let p=false;for(let l=0;l<ends.length;l++){if(ends[l]<item.sc){item.lane=l;ends[l]=item.ec;p=true;break;}}if(!p){item.lane=ends.length;ends.push(item.ec);}});return items;}
function getCls(ev,week){const es=pd(ev.start),ee=pd(ev.end),wS=week[0].date,wE=week[6].date;const sh=es>=wS&&es<=wE,eh=ee>=wS&&ee<=wE;if(sh&&eh)return'alone';if(sh)return'start';if(eh)return'end';return'mid';}

/* ── 레전드 열림 상태 관리 ── */
const _legOpenMonths=new Set();
let _legUserInteracted=false; // 사용자가 한 번이라도 클릭했는지 추적
function toggleLegMonth(key){
  _legUserInteracted=true;
  if(_legOpenMonths.has(key))_legOpenMonths.delete(key);
  else _legOpenMonths.add(key);
  renderLegend();
}

function renderLegend(){
  const el=document.getElementById('evLegend');
  if(!el)return;
  if(!EVENTS.length){el.innerHTML='<div class="leg-empty">등록된 일정이 없습니다.</div>';return;}

  const vis=CAL_CFG.visibleTags;
  const visEvts=vis?EVENTS.filter(ev=>(ev.tags||[]).some(t=>vis.includes(t))||(ev.tags||[]).length===0):EVENTS;
  const filtered=_activeTag?visEvts.filter(ev=>(ev.tags||[]).includes(_activeTag)):visEvts;
  if(!filtered.length){el.innerHTML='<div class="leg-empty">표시할 일정이 없습니다.</div>';return;}

  // 월별 그룹핑 (시작일 기준)
  const monthMap=new Map();
  filtered.forEach(ev=>{
    const d=pd(ev.start);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if(!monthMap.has(key))monthMap.set(key,[]);
    monthMap.get(key).push(ev);
  });

  // 날짜순 정렬
  const sortedKeys=[...monthMap.keys()].sort();

  // 사용자가 아직 클릭하지 않은 경우만 자동 열기
  if(!_legUserInteracted && !_legOpenMonths.size){
    const curKey=`${cY}-${String(cM+1).padStart(2,'0')}`;
    const autoOpen=sortedKeys.includes(curKey)?curKey:sortedKeys[sortedKeys.length-1];
    if(autoOpen)_legOpenMonths.add(autoOpen);
  }

  el.innerHTML=sortedKeys.map(key=>{
    const [y,m]=key.split('-');
    const label=`${y}년 ${parseInt(m)}월`;
    const evts=monthMap.get(key).slice().sort((a,b)=>{
      if(a.start!==b.start)return a.start.localeCompare(b.start);
      return (a.startTime||'00:00').localeCompare(b.startTime||'00:00');
    });
    const isOpen=_legOpenMonths.has(key);

    const items=evts.map(ev=>{
      const realIdx=EVENTS.indexOf(ev);
      const timeStr=ev.startTime?`<span class="leg-time">${ev.startTime}${ev.endTime?'~'+ev.endTime:''}</span>`:'';
      const tagStr=(ev.tags||[]).map(t=>`<span class="leg-tag">${t}</span>`).join('');
      const projStr=ev.project?`<span class="leg-project-lbl">${ev.project}</span>`:'';
      const label=getEvLabel(ev);
      return`<div class="leg-item" title="${ev.note||''}" onclick="openEventModal(${realIdx})"><div class="leg-dot" style="background:${ev.color}"></div><span>${label}</span>${timeStr}${projStr}${tagStr}</div>`;
    }).join('');

    return`<div class="leg-month-group">
      <div class="leg-month-hd" onclick="toggleLegMonth('${key}')">
        <div class="leg-month-hd-left">
          <span class="leg-month-toggle${isOpen?' open':''}">▶</span>
          <span class="leg-month-lbl">${label}</span>
          <span class="leg-month-count">${evts.length}개</span>
        </div>
      </div>
      <div class="leg-month-body${isOpen?'':' closed'}">${items}</div>
    </div>`;
  }).join('');
}

function renderMonthly(){
  document.getElementById('mLabel').textContent=`${cY}년 ${MN[cM]}`;
  document.getElementById('calYearBadge').textContent=String(cY);
  // 사용자가 클릭하지 않은 경우만 현재 월 자동 열기
  if(!_legUserInteracted){
    const curKey=`${cY}-${String(cM+1).padStart(2,'0')}`;
    _legOpenMonths.add(curKey);
  }
  const weeks=getWeeks(cY,cM);
  const mS=new Date(cY,cM,1),mE=new Date(cY,cM+1,0);
  const cont=document.getElementById('calWeeks');
  cont.innerHTML='';
  // visibleTags 필터 + _activeTag 필터 + 시간 순 정렬
  const vis=CAL_CFG.visibleTags;
  const baseEvts=(()=>{
    let evts=vis?EVENTS.filter(ev=>(ev.tags||[]).some(t=>vis.includes(t))||(ev.tags||[]).length===0):EVENTS;
    if(_activeTag)evts=evts.filter(ev=>(ev.tags||[]).includes(_activeTag));
    return evts.slice().sort((a,b)=>(a.startTime||'00:00').localeCompare(b.startTime||'00:00'));
  })();
  weeks.forEach(week=>{
    const wEvts=baseEvts.filter(ev=>{const es=pd(ev.start),ee=pd(ev.end);return es<=week[6].date&&ee>=week[0].date&&es<=mE&&ee>=mS;});
    const laned=assignL(wEvts,week);const numL=laned.length?Math.max(...laned.map(i=>i.lane))+1:0;
    const row=document.createElement('div');row.className='cal-week-row';
    const dn=document.createElement('div');dn.className='cal-dnums';
    week.forEach(day=>{
      const str=ds(day.date);const sp=getSP(str);
      const cell=document.createElement('div');
      let cls='cal-dc'+(!day.inM?' out':'')+(isTD(day.date)?' today':'');
      if(day.inM&&sp)cls+=` ${sp.type}`;
      cell.className=cls;
      cell.title=sp?(sp.type==='holiday'?'공휴일':'연차')+(sp.note?': '+sp.note:''):'';
      cell.innerHTML=`<span class="dni">${day.date.getDate()}</span>`;
      dn.appendChild(cell);
    });
    row.appendChild(dn);
    if(numL>0){
      const lsEl=document.createElement('div');lsEl.className='ev-lanes';
      for(let l=0;l<numL;l++){
        const lEl=document.createElement('div');lEl.className='ev-lane';
        laned.filter(i=>i.lane===l).forEach(item=>{
          const bar=document.createElement('div');
          // excludeWeekend: 시작/끝 col 재계산 (주말 칸 건너뜀)
          let sc=item.sc,ec=item.ec;
          if(item.e.excludeWeekend){
            // 주말(일=0, 토=6) 칸 위에 그리지 않음 — 스킵
            const validCols=[];
            for(let ci=sc;ci<=ec;ci++){
              const dow=week[ci].date.getDay();
              if(dow!==0&&dow!==6)validCols.push(ci);
            }
            if(!validCols.length)return; // 이 주에 그릴 칸 없음
            sc=validCols[0];ec=validCols[validCols.length-1];
            // 연속된 세그먼트로 분리해서 각각 그리기
            const segments=[];let segStart=validCols[0];let prev=validCols[0];
            for(let vi=1;vi<validCols.length;vi++){
              if(validCols[vi]!==prev+1){segments.push({sc:segStart,ec:prev});segStart=validCols[vi];}
              prev=validCols[vi];
            }
            segments.push({sc:segStart,ec:prev});
            segments.forEach(seg=>{
              const segBar=document.createElement('div');
              const es=pd(item.e.start),ee=pd(item.e.end),wS=week[0].date,wE=week[6].date;
              const sh=es>=wS&&es<=wE,eh=ee>=wS&&ee<=wE;
              let cls='alone';
              if(segments.length===1){if(sh&&eh)cls='alone';else if(sh)cls='start';else if(eh)cls='end';else cls='mid';}
              else if(seg===segments[0]){cls=sh?'start':'mid';}
              else if(seg===segments[segments.length-1]){cls=eh?'end':'mid';}
              else{cls='mid';}
              segBar.className=`ev-bar ${cls}`;
              segBar.style.cssText=`background:${item.e.color};grid-column:${seg.sc+1}/${seg.ec+2}`;
              segBar.onclick=()=>openEventModal(EVENTS.indexOf(item.e));
              const sh2=pd(item.e.start)>=week[0].date&&pd(item.e.start)<=week[6].date;
              if(sh2&&seg===segments[0]){
                const timeStr=item.e.startTime?item.e.startTime+' ':'';
                segBar.innerHTML=`<span class="ev-time">${timeStr}</span>${getEvLabel(item.e)}`;
              }
              segBar.title=`${item.e.name}\n${item.e.start}~${item.e.end} (주말 제외)`;
              lEl.appendChild(segBar);
            });
            return;
          }
          bar.className=`ev-bar ${getCls(item.e,week)}`;
          bar.style.cssText=`background:${item.e.color};grid-column:${item.sc+1}/${item.ec+2}`;
          bar.onclick=()=>openEventModal(EVENTS.indexOf(item.e));
          const sh=pd(item.e.start)>=week[0].date&&pd(item.e.start)<=week[6].date;
          if(sh){
            const timeStr=item.e.startTime?item.e.startTime+' ':'';
            bar.innerHTML=`<span class="ev-time">${timeStr}</span>${getEvLabel(item.e)}`;
          }
          bar.title=`${item.e.name}${item.e.startTime?' '+item.e.startTime+(item.e.endTime?'~'+item.e.endTime:''):''}${item.e.note?'\n'+item.e.note:''}\n${item.e.start}~${item.e.end}`;
          lEl.appendChild(bar);
        });
        lsEl.appendChild(lEl);
      }
      row.appendChild(lsEl);
    }
    cont.appendChild(row);
  });
}

function renderYearly(){
  const cont=document.getElementById('calYearly');cont.innerHTML='';
  const vis=CAL_CFG.visibleTags;
  const visEvts=vis?EVENTS.filter(ev=>(ev.tags||[]).some(t=>vis.includes(t))||(ev.tags||[]).length===0):EVENTS;
  const filtEvts=_activeTag?visEvts.filter(ev=>(ev.tags||[]).includes(_activeTag)):visEvts;
  for(let m=0;m<12;m++){
    const mini=document.createElement('div');mini.className='mini-m';mini.onclick=()=>{cM=m;setView('m');};
    mini.innerHTML=`<div class="mini-mt">${MN[m]}</div><div class="mini-wds">${['일','월','화','수','목','금','토'].map(d=>`<div class="mini-wd">${d}</div>`).join('')}</div>`;
    getWeeks(cY,m).forEach(week=>{
      const wkEl=document.createElement('div');wkEl.className='mini-wk';
      week.forEach(day=>{
        const str=ds(day.date);const sp=getSP(str);
        const dEl=document.createElement('div');
        let cls='mini-d'+(!day.inM?' out':'')+(isTD(day.date)?' today':'');
        if(day.inM&&sp)cls+=` ${sp.type}`;
        dEl.className=cls;if(day.inM)dEl.textContent=day.date.getDate();
        const hasEv=day.inM&&filtEvts.some(ev=>{const es=pd(ev.start),ee=pd(ev.end);return day.date>=es&&day.date<=ee;});
        if(hasEv)dEl.classList.add('has-ev');
        wkEl.appendChild(dEl);
      });
      mini.appendChild(wkEl);
    });
    cont.appendChild(mini);
  }
}

function setView(v){
  document.getElementById('viewM').style.display=v==='m'?'block':'none';
  document.getElementById('viewY').style.display=v==='y'?'block':'none';
  document.getElementById('viewQ').style.display=v==='q'?'block':'none';
  document.getElementById('btnM').classList.toggle('active',v==='m');
  document.getElementById('btnY').classList.toggle('active',v==='y');
  document.getElementById('btnQ').classList.toggle('active',v==='q');
  if(v==='m')renderMonthly();
  else if(v==='y')renderYearly();
  else if(v==='q')renderQuarterly();
}
function chMonth(d){cM+=d;if(cM<0){cM=11;cY--;}if(cM>11){cM=0;cY++;}renderMonthly();}
function chGanttYear(d){cY+=d;renderQuarterly();}

/* ══ GANTT / 분기 뷰 ══ */
let _ganttProject=''; // 선택된 프로젝트 필터 (빈 문자열 = 전체)
function setGanttProject(v){_ganttProject=v;renderQuarterly();}
function _updateGanttProjectFilter(){
  const sel=document.getElementById('ganttProjectFilter');
  if(!sel)return;
  const projects=[...new Set(EVENTS.map(e=>e.project||'').filter(Boolean))].sort();
  const prev=sel.value;
  sel.innerHTML='<option value="">전체 프로젝트</option>'+projects.map(p=>`<option value="${p}"${p===prev?' selected':''}>${p}</option>`).join('');
  // 선택된 프로젝트가 더 이상 없으면 전체로 복원
  if(prev&&!projects.includes(prev)){_ganttProject='';sel.value='';}
}
function renderQuarterly(){
  _updateGanttProjectFilter();
  document.getElementById('ganttYearLabel').textContent=`${cY}년`;
  document.getElementById('calYearBadge').textContent=String(cY);

  const year=cY;
  const COL_W=14;
  const LBL_W=150;

  const cols=[];
  const tmp=new Date(year,0,1);
  while(tmp.getFullYear()===year){cols.push(new Date(tmp));tmp.setDate(tmp.getDate()+1);}
  const N=cols.length;

  function getColIdx(dt){
    const start=new Date(year,0,1);
    return Math.max(0,Math.min(N-1,Math.round((dt.getTime()-start.getTime())/86400000)));
  }
  function getBarPos(es,ee){
    const yS=new Date(year,0,1),yE=new Date(year,11,31);
    if(ee<yS||es>yE)return null;
    const sc=getColIdx(es),ec=getColIdx(ee);
    return{left:sc*COL_W+1,width:(ec-sc+1)*COL_W-2};
  }

  const qDays=[0,0,0,0];const mDays=Array(12).fill(0);
  cols.forEach(c=>{const m=c.getMonth();qDays[Math.floor(m/3)]++;mDays[m]++;});
  const todayIdx=TODAY.getFullYear()===year?getColIdx(TODAY):-1;
  const activeSet=ASSIGNEE_SETS.find(s=>s.active)||null;

  let html=`<div class="gantt-outer"><table class="gantt-table" style="min-width:${LBL_W+N*COL_W}px"><colgroup>`;
  html+=`<col style="width:${LBL_W}px">`;
  cols.forEach(()=>html+=`<col style="width:${COL_W}px">`);
  html+=`</colgroup><thead>`;

  // 분기 행
  html+=`<tr><th class="g-th-lbl g-th-q" rowspan="3" style="font-size:.74rem;">공정</th>`;
  ['Q1','Q2','Q3','Q4'].forEach((q,qi)=>{if(qDays[qi]>0)html+=`<th class="g-th-q" colspan="${qDays[qi]}">${q}</th>`;});
  html+=`</tr>`;

  // 월 행
  html+=`<tr>`;
  mDays.forEach((cnt,mi)=>{if(cnt>0)html+=`<th class="g-th-m" colspan="${cnt}">${mi+1}月</th>`;});
  html+=`</tr>`;

  // 날짜 행 — 모든 날짜, 토/일 빨간 배경
  html+=`<tr>`;
  cols.forEach((c,i)=>{
    const day=c.getDate();
    const dow=c.getDay();
    const isWeekend=dow===0||dow===6;
    const isTodayCol=i===todayIdx;
    let cls='g-th-d';
    if(isTodayCol)cls+=' today-col';
    else if(isWeekend)cls+=' weekend-col';
    html+=`<th class="${cls}" title="${c.getMonth()+1}/${day}">${day}</th>`;
  });
  html+=`</tr></thead><tbody>`;

  const vis=CAL_CFG.visibleTags;
  let allEvts=vis?EVENTS.filter(ev=>(ev.tags||[]).some(t=>vis.includes(t))||(ev.tags||[]).length===0):EVENTS;
  // 프로젝트 필터 적용
  if(_ganttProject) allEvts=allEvts.filter(ev=>(ev.project||'')===_ganttProject);

  function buildProcRow(proc,evts,lblHtml,procColor){
    // procColor는 파스텔 색상 (#EEF2FF 등) — 행 배경은 그대로, 바는 진한 버전 사용
    const bgStyle=procColor?`background:${procColor}`:'';
    // 바에 사용할 색: procColor에서 밝기를 낮춰 진하게 (filter로 처리)
    const barBgStyle='';
    let r=`<tr class="g-proc-row"><td class="g-lbl" style="${bgStyle}">${lblHtml}</td>`;
    r+=`<td colspan="${N}" class="g-bars-td" style="${bgStyle}"><div class="g-bars-inner" style="width:${N*COL_W}px">`;
    cols.forEach((c,i)=>{if(c.getDay()===0||c.getDay()===6)r+=`<div style="position:absolute;top:0;bottom:0;left:${i*COL_W}px;width:${COL_W}px;background:rgba(232,64,96,.07);pointer-events:none;z-index:0"></div>`;});
    if(todayIdx>=0)r+=`<div class="g-today-line" style="left:${todayIdx*COL_W+COL_W/2}px"></div>`;
    evts.forEach(ev=>{
      const pos=getBarPos(pd(ev.start),pd(ev.end));if(!pos)return;
      const realIdx=EVENTS.indexOf(ev);
      const label=getEvLabel(ev);
      // 주말제외 처리
      if(ev.excludeWeekend){
        let inSeg=false,segSc=-1;
        const es=pd(ev.start),ee=pd(ev.end);
        for(let ci=0;ci<N;ci++){
          const col=cols[ci];const dow=col.getDay();
          const inRange=col>=es&&col<=ee;
          const isWE=dow===0||dow===6;
          if(inRange&&!isWE){if(!inSeg){segSc=ci;inSeg=true;}}
          else{if(inSeg){
            const sw=(segSc)*COL_W+1,ew=(ci-segSc)*COL_W-2;
            const styleStr=`left:${sw}px;width:${ew}px;background:${ev.color}`;
            r+=`<div class="g-bar" style="${styleStr}" onclick="openEventModal(${realIdx})" title="${ev.name}">${segSc===getColIdx(es)?label:''}</div>`;
            inSeg=false;segSc=-1;
          }}
        }
        if(inSeg){
          const sw=segSc*COL_W+1,ew=(N-segSc)*COL_W-2;
          const styleStr=`left:${sw}px;width:${ew}px;background:${ev.color}`;
          r+=`<div class="g-bar" style="${styleStr}" onclick="openEventModal(${realIdx})" title="${ev.name}">${segSc===getColIdx(es)?label:''}</div>`;
        }
      }else{
        const styleStr=`left:${pos.left}px;width:${pos.width}px;background:${ev.color}`;
        r+=`<div class="g-bar" style="${styleStr}" onclick="openEventModal(${realIdx})" title="${ev.name}${ev.episode?' ['+ev.episode+']':''}\n${ev.start} ~ ${ev.end}">${label}</div>`;
      }
    });
    r+=`</div></td></tr>`;
    return r;
  }

  PROCESSES.forEach(proc=>{
    const procEvts=allEvts.filter(ev=>(ev.process||'')===proc);
    const assigneeName=activeSet?activeSet.assignees[proc]||'':'';
    const procColor=activeSet?activeSet.colors?.[proc]||'':'';
    const lblStyle=procColor?`style="border-left:4px solid ${procColor};background:${procColor}20"`:'';
    const lblHtml=`<span ${lblStyle}>${proc}${assigneeName?`<span class="g-lbl-assignee">${assigneeName}</span>`:''}</span>`;
    html+=buildProcRow(proc,procEvts,lblHtml,procColor);
  });

  const unassigned=allEvts.filter(ev=>!ev.process||!PROCESSES.includes(ev.process));
  if(unassigned.length){
    html+=buildProcRow('미분류',unassigned,`<span style="color:var(--t3);font-size:.76rem;">미분류</span>`,'');
  }

  html+=`</tbody></table></div>`;
  // 스크롤 위치 저장 후 복원
  const oldOuter=document.querySelector('#ganttView .gantt-outer');
  const scrollLeft=oldOuter?oldOuter.scrollLeft:0;
  document.getElementById('ganttView').innerHTML=html;
  const newOuter=document.querySelector('#ganttView .gantt-outer');
  if(newOuter&&scrollLeft) newOuter.scrollLeft=scrollLeft;
}


/* ══ iframe postMessage 수신 (캘린더 문서에서 일정 저장) ══ */
window.addEventListener('message',function(e){
  if(!e.data||e.data.type!=='iframeEvSave')return;
  if(e.data.events){EVENTS.length=0;e.data.events.forEach(ev=>EVENTS.push(ev));}
  if(e.data.specials){SPECIALS.length=0;e.data.specials.forEach(sp=>SPECIALS.push(sp));}
  saveAll();
  const frame=document.getElementById('docFrame');
  if(frame){
    const docs=CARD_DOCS[_curCard]||[];
    const d=docs.find(x=>x.id===_curDocId);
    if(d&&d.type==='calendar'){
      const calMeta=d.calMeta||(CAL_DOC_CFG[_curDocId]?.meta)||null;
      if(calMeta){
        const html=buildInteractiveCal(calMeta.baseYear,calMeta.months,calMeta.title||d.title,CAL_DOC_CFG[_curDocId]||{});
        frame.srcdoc=html;
      }
    }
  }
  renderLegend();renderMonthly();
  if(document.getElementById('viewQ')?.style.display!=='none')renderQuarterly();
  toast('일정이 저장되었습니다.');
});
let _procDragIdx=null;
function openProcessModal(){
  renderProcList();
  document.getElementById('processOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('procNewIn').focus(),180);
}
function closeProcessModal(){document.getElementById('processOverlay').classList.remove('open');}
function renderProcList(){
  const el=document.getElementById('procList');
  if(!PROCESSES.length){el.innerHTML='<div style="font-size:.82rem;color:var(--t3);padding:8px 0;">공정이 없습니다.</div>';return;}
  el.innerHTML=PROCESSES.map((p,i)=>`
    <div class="proc-item" id="procItem-${i}" draggable="true"
      ondragstart="procDragStart(event,${i})"
      ondragover="procDragOver(event,${i})"
      ondrop="procDrop(event,${i})"
      ondragleave="procDragLeave(event)"
      ondragend="procDragEnd(event)">
      <span class="proc-drag-handle" title="드래그하여 순서 변경">⠿</span>
      <span style="flex:1">${p}</span>
      <button class="proc-item-del" onclick="delProcess(${i})" title="삭제">✕</button>
    </div>`).join('');
}
function procDragStart(e,i){
  _procDragIdx=i;
  e.dataTransfer.effectAllowed='move';
  setTimeout(()=>{const el=document.getElementById(`procItem-${i}`);if(el)el.classList.add('dragging');},0);
}
function procDragOver(e,i){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.proc-item').forEach(el=>el.classList.remove('drag-over'));
  const el=document.getElementById(`procItem-${i}`);if(el)el.classList.add('drag-over');
}
function procDragLeave(e){e.currentTarget.classList.remove('drag-over');}
function procDragEnd(e){document.querySelectorAll('.proc-item').forEach(el=>{el.classList.remove('dragging');el.classList.remove('drag-over');});}
function procDrop(e,i){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.proc-item').forEach(el=>{el.classList.remove('drag-over');el.classList.remove('dragging');});
  if(_procDragIdx===null||_procDragIdx===i)return;
  const moved=PROCESSES.splice(_procDragIdx,1)[0];
  PROCESSES.splice(i,0,moved);
  _procDragIdx=null;
  saveAll();renderProcList();
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
  toast('공정 순서가 변경되었습니다.');
}
function addProcess(){
  const v=document.getElementById('procNewIn').value.trim();
  if(!v)return;
  if(PROCESSES.includes(v)){toast('이미 있는 공정입니다.');return;}
  PROCESSES.push(v);
  saveAll();renderProcList();
  document.getElementById('procNewIn').value='';
  toast('공정이 추가되었습니다.');
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
}
function delProcess(i){
  if(!confirm(`"${PROCESSES[i]}" 공정을 삭제할까요?`))return;
  PROCESSES.splice(i,1);
  saveAll();renderProcList();
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
}

/* ══ 공정 담당자 관리 ══ */
let _editAssigneeIdx=-1;

function openAssigneeModal(){
  renderAssigneeSetList();
  document.getElementById('assigneeOverlay').classList.add('open');
}
function closeAssigneeModal(){document.getElementById('assigneeOverlay').classList.remove('open');}

function renderAssigneeSetList(){
  const el=document.getElementById('assigneeSetList');
  if(!ASSIGNEE_SETS.length){
    el.innerHTML='<div style="font-size:.82rem;color:var(--t3);padding:8px 0;">등록된 담당자 세트가 없습니다.</div>';
    return;
  }
  el.innerHTML=ASSIGNEE_SETS.map((s,i)=>`
    <div class="assignee-set-item">
      <input type="radio" name="activeSet" value="${i}" ${s.active?'checked':''} onchange="toggleAssigneeSet(${i})">
      <span class="assignee-set-name">${s.name}</span>
      <button class="dv-share-btn" style="padding:4px 10px;font-size:.72rem" onclick="openAssigneeEditModal(${i})">✎ 편집</button>
      <button class="assignee-set-del" onclick="delAssigneeSet(${i})" title="삭제">✕</button>
    </div>`).join('');
}

function toggleAssigneeSet(i){
  ASSIGNEE_SETS.forEach((s,idx)=>s.active=(idx===i));
  saveAll();
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
  toast('담당자 세트가 적용되었습니다.');
}

function addAssigneeSet(){
  const v=document.getElementById('assigneeSetNameIn').value.trim();
  if(!v)return;
  ASSIGNEE_SETS.push({id:uid(),name:v,assignees:{},active:false});
  document.getElementById('assigneeSetNameIn').value='';
  saveAll();renderAssigneeSetList();
  toast('담당자 세트가 추가되었습니다.');
}

function delAssigneeSet(i){
  if(!confirm(`"${ASSIGNEE_SETS[i].name}" 세트를 삭제할까요?`))return;
  ASSIGNEE_SETS.splice(i,1);
  saveAll();renderAssigneeSetList();
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
}

function openAssigneeEditModal(i){
  _editAssigneeIdx=i;
  const s=ASSIGNEE_SETS[i];
  document.getElementById('assigneeEditTitle').textContent=`담당자 설정 — ${s.name}`;
  const PROC_COLORS=['#EEF2FF','#F0FFF4','#FFF7F0','#FFF0F5','#F0FAFF','#FFFBF0','#F5F0FF','#F0FFF9','#FFF0F0','#F0F5FF','#FFFFF0'];
  const rows=document.getElementById('assigneeEditRows');
  rows.innerHTML=PROCESSES.map((proc,pi)=>{
    const curColor=s.colors?s.colors[proc]||'':'';
    const colorSwatches=PROC_COLORS.map(c=>`<span class="assignee-color-swatch${curColor===c?' sel':''}" style="background:${c}" data-color="${c}" onclick="pickProcColor(this,'${proc.replace(/'/g,"\\'")}')"></span>`).join('');
    return`<div class="assignee-row">
      <span class="assignee-proc-lbl">${proc}</span>
      <input class="assignee-name-in" type="text" data-proc="${proc}" value="${s.assignees[proc]||''}" placeholder="담당자 이름">
      <div style="display:flex;gap:3px;flex-wrap:wrap;max-width:140px;align-items:center">
        ${colorSwatches}
        <span class="assignee-color-swatch${!curColor?' sel':''}" style="background:#fff;border:1px solid #ccc;color:#999;font-size:.6rem;display:flex;align-items:center;justify-content:center" data-color="" onclick="pickProcColor(this,'${proc.replace(/'/g,"\\'")}')">✕</span>
      </div>
    </div>`;
  }).join('');
  document.getElementById('assigneeEditOverlay').classList.add('open');
}
function pickProcColor(el,proc){
  // 같은 행 내 swatches 선택 해제
  el.closest('.assignee-row').querySelectorAll('.assignee-color-swatch').forEach(s=>s.classList.remove('sel'));
  el.classList.add('sel');
}
function closeAssigneeEditModal(){document.getElementById('assigneeEditOverlay').classList.remove('open');}
function saveAssigneeSet(){
  if(_editAssigneeIdx<0)return;
  const s=ASSIGNEE_SETS[_editAssigneeIdx];
  if(!s.colors)s.colors={};
  document.querySelectorAll('#assigneeEditRows .assignee-row').forEach(row=>{
    const inp=row.querySelector('.assignee-name-in');
    const selSwatch=row.querySelector('.assignee-color-swatch.sel');
    const proc=inp.dataset.proc;
    const val=inp.value.trim();
    if(val)s.assignees[proc]=val; else delete s.assignees[proc];
    const color=selSwatch?selSwatch.dataset.color||'':'';
    if(color)s.colors[proc]=color; else delete s.colors[proc];
  });
  saveAll();closeAssigneeEditModal();
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
  toast('담당자 세트가 저장되었습니다.');
}

/* ── COLOR PICKER ── */
function buildCP(){document.getElementById('colorPicker').innerHTML=C16.map(c=>`<div class="clr-sw${c===selColor?' sel':''}" style="background:${c}" onclick="pickClr('${c}')"></div>`).join('');}
function pickClr(c){selColor=c;buildCP();}

/* ── PRESETS ── */
function renderPresets(){document.getElementById('presetChips').innerHTML=PRESETS.map((n,i)=>`<span class="preset-chip" onclick="usePreset('${n.replace(/'/g,"\\'")}')">${n}<span class="preset-chip-x" onclick="event.stopPropagation();delPreset(${i})">✕</span></span>`).join('');}
function usePreset(n){
  // 프로젝트 필드 채우기 (프로젝트 빠른 선택으로 변경)
  const p=document.getElementById('evProject');
  if(p){p.value=n;p.focus();}
}
function savePreset(){const v=document.getElementById('presetNewIn').value.trim();if(!v)return;if(!PRESETS.includes(v)){PRESETS.push(v);saveAll();}renderPresets();document.getElementById('presetNewIn').value='';}
function delPreset(i){PRESETS.splice(i,1);saveAll();renderPresets();}

/* ── EVENT MODAL ── */
function openEventModal(idx=-1){
  editEvIdx=idx;
  _editTags=[];
  document.getElementById('evModalTitle').textContent=idx===-1?'일정 추가':'일정 수정';
  // 공정 드롭다운 재구성
  const procSel=document.getElementById('evProcess');
  procSel.innerHTML=`<option value="">-- 공정 선택 --</option>`+
    PROCESSES.map(p=>`<option value="${p}">${p}</option>`).join('');
  // 프로젝트 datalist 업데이트
  const dl=document.getElementById('evProjectList');
  if(dl){const projects=[...new Set(EVENTS.map(e=>e.project||'').filter(Boolean))];dl.innerHTML=projects.map(p=>`<option value="${p}">`).join('');}
  if(idx===-1){
    document.getElementById('evProject').value='';
    document.getElementById('evTask').value='';
    // evName compat clear
    try{document.getElementById('evName').value='';}catch(e){}
    document.getElementById('evNote').value='';
    document.getElementById('evStart').value=ds(TODAY);
    document.getElementById('evEnd').value=ds(TODAY);
    document.getElementById('evStartTime').value='10:00';
    document.getElementById('evEndTime').value='19:00';
    selColor=CAL_CFG.defaultColor||C16[0];
    document.getElementById('evExcludeWeekend').checked=true;
    procSel.value='';
    document.getElementById('evEpisode').value='';
  }else{
    const ev=EVENTS[idx];
    document.getElementById('evProject').value=ev.project||'';
    document.getElementById('evTask').value=ev.task||'';
    // evName compat load
    try{document.getElementById('evName').value=ev.name;}catch(e){}
    document.getElementById('evNote').value=ev.note||'';
    document.getElementById('evStart').value=ev.start;document.getElementById('evEnd').value=ev.end;
    document.getElementById('evStartTime').value=ev.startTime||'10:00';
    document.getElementById('evEndTime').value=ev.endTime||'19:00';
    _editTags=[...(ev.tags||[])];
    selColor=ev.color;
    document.getElementById('evExcludeWeekend').checked=ev.excludeWeekend!==undefined?ev.excludeWeekend:true;
    procSel.value=ev.process||'';
    document.getElementById('evEpisode').value=ev.episode||'';
  }
  renderTagChips();
  renderPresets();buildCP();
  const delBtn=document.getElementById('evDelBtn');
  if(delBtn)delBtn.style.display=idx===-1?'none':'flex';
  document.getElementById('eventOverlay').classList.add('open');
  setTimeout(()=>{const el=document.getElementById('evProject');if(el)el.focus();},180);
}
function closeEventModal(){document.getElementById('eventOverlay').classList.remove('open');}
function saveEvent(){
  const project=(document.getElementById('evProject')?.value||'').trim();
  const task=(document.getElementById('evTask')?.value||'').trim();
  const note=document.getElementById('evNote').value.trim();
  const start=document.getElementById('evStart').value;const end=document.getElementById('evEnd').value;
  const startTime=document.getElementById('evStartTime').value||'';
  const endTime=document.getElementById('evEndTime').value||'';
  if(!start||!end||start>end){toast('날짜를 확인해주세요.');return;}
  if(!project&&!task){toast('프로젝트명 또는 작업명을 입력해주세요.');return;}
  const name=task||project;
  const excludeWeekend=document.getElementById('evExcludeWeekend').checked;
  const process=document.getElementById('evProcess').value||'';
  const episode=document.getElementById('evEpisode').value.trim()||'';
  const ev={name,project,task,note,color:selColor,start,end,startTime,endTime,tags:[..._editTags],excludeWeekend,process,episode};
  if(editEvIdx===-1)EVENTS.push(ev);else EVENTS[editEvIdx]=ev;
  saveAll();closeEventModal();renderLegend();renderMonthly();renderTagFilter();
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
}
function delEvent(idx){
  if(!confirm(`"${EVENTS[idx].name}" 삭제?`))return;
  EVENTS.splice(idx,1);saveAll();renderLegend();
  document.getElementById('viewM').style.display!=='none'?renderMonthly():renderYearly();
}
function delEventFromModal(){
  if(editEvIdx===-1)return;
  if(!confirm(`"${EVENTS[editEvIdx].name}" 삭제?`))return;
  EVENTS.splice(editEvIdx,1);
  saveAll();closeEventModal();renderLegend();renderMonthly();renderTagFilter();
  if(document.getElementById('viewQ').style.display!=='none')renderQuarterly();
}

/* ── HOLIDAY MODAL ── */
function selHlType(t){
  hlType=t;
  document.getElementById('hlHBtn').className='hl-btn'+(t==='holiday'?' sel-hl':'');
  document.getElementById('hlLBtn').className='hl-btn'+(t==='leave'?' sel-lv':'');
}
function openHolidayModal(){
  document.getElementById('hlDate').value=`${cY}-${String(cM+1).padStart(2,'0')}-01`;
  document.getElementById('hlNote').value='';hlType='holiday';selHlType('holiday');
  document.getElementById('holidayOverlay').classList.add('open');
}
function closeHolidayModal(){document.getElementById('holidayOverlay').classList.remove('open');}
function saveHoliday(){
  const date=document.getElementById('hlDate').value;if(!date)return;
  const note=document.getElementById('hlNote').value.trim();
  const ei=SPECIALS.findIndex(s=>s.date===date);
  if(ei!==-1)SPECIALS[ei]={date,type:hlType,note};else SPECIALS.push({date,type:hlType,note});
  saveAll();closeHolidayModal();
  document.getElementById('viewM').style.display!=='none'?renderMonthly():renderYearly();
}

/* ── CAL NAME MODAL ── */
function openCalName(){document.getElementById('calNameIn').value=CAL_NAME;document.getElementById('calNameOverlay').classList.add('open');setTimeout(()=>document.getElementById('calNameIn').select(),180);}
function closeCalName(){document.getElementById('calNameOverlay').classList.remove('open');}
function saveCalName(){const v=document.getElementById('calNameIn').value.trim();if(!v)return;CAL_NAME=v;saveAll();document.getElementById('calNameText').textContent=CAL_NAME;closeCalName();}

/* ══ CROP ══ */
let _cropCb=null,_cropImg=null,_cropBox={x:0,y:0,w:0,h:0},_cropMode=null,_cropStart=null,_cropBoxStart=null,_imgR=null;
const CSIZE=8;

function openCropper(file,cb){
  _cropCb=cb;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      _cropImg=img;
      const c=document.getElementById('cropCanvas');
      const maxW=Math.min(560,window.innerWidth-80),maxH=340;
      const sc=Math.min(maxW/img.width,maxH/img.height,1);
      const iw=img.width*sc,ih=img.height*sc;
      c.width=maxW;c.height=maxH;
      const ox=(maxW-iw)/2,oy=(maxH-ih)/2;
      _imgR={x:ox,y:oy,w:iw,h:ih,sc,ow:img.width,oh:img.height};
      const m=.08;
      _cropBox={x:ox+iw*m,y:oy+ih*m,w:iw*(1-2*m),h:ih*(1-2*m)};
      drawCrop();document.getElementById('cropOverlay').classList.add('open');
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}
function cancelCrop(){document.getElementById('cropOverlay').classList.remove('open');}
function drawCrop(){
  const c=document.getElementById('cropCanvas');const ctx=c.getContext('2d');const b=_cropBox,ir=_imgR;
  ctx.clearRect(0,0,c.width,c.height);
  ctx.drawImage(_cropImg,ir.x,ir.y,ir.w,ir.h);
  ctx.save();ctx.fillStyle='rgba(0,0,0,.52)';ctx.fillRect(0,0,c.width,c.height);
  ctx.globalCompositeOperation='destination-out';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();ctx.drawImage(_cropImg,ir.x,ir.y,ir.w,ir.h);ctx.restore();
  ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.strokeRect(b.x,b.y,b.w,b.h);
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1;
  for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(b.x+b.w*i/3,b.y);ctx.lineTo(b.x+b.w*i/3,b.y+b.h);ctx.stroke();ctx.beginPath();ctx.moveTo(b.x,b.y+b.h*i/3);ctx.lineTo(b.x+b.w,b.y+b.h*i/3);ctx.stroke();}
  getHandles().forEach(h=>{ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(h.x,h.y,CSIZE/2+1,0,Math.PI*2);ctx.fill();});
}
function getHandles(){const b=_cropBox;return[{x:b.x,y:b.y,id:'nw'},{x:b.x+b.w/2,y:b.y,id:'n'},{x:b.x+b.w,y:b.y,id:'ne'},{x:b.x+b.w,y:b.y+b.h/2,id:'e'},{x:b.x+b.w,y:b.y+b.h,id:'se'},{x:b.x+b.w/2,y:b.y+b.h,id:'s'},{x:b.x,y:b.y+b.h,id:'sw'},{x:b.x,y:b.y+b.h/2,id:'w'}];}
function hitHandle(mx,my){return getHandles().find(h=>Math.abs(mx-h.x)<11&&Math.abs(my-h.y)<11)||null;}
function cropPt(e){const c=document.getElementById('cropCanvas');const r=c.getBoundingClientRect();const sx=c.width/r.width,sy=c.height/r.height;const pt=e.touches?e.touches[0]:e;return{x:(pt.clientX-r.left)*sx,y:(pt.clientY-r.top)*sy};}
document.getElementById('cropCanvas').addEventListener('mousedown',e=>{const{x,y}=cropPt(e);const h=hitHandle(x,y);_cropMode=h?h.id:(x>=_cropBox.x&&x<=_cropBox.x+_cropBox.w&&y>=_cropBox.y&&y<=_cropBox.y+_cropBox.h)?'move':null;if(_cropMode){_cropStart={x,y};_cropBoxStart={..._cropBox};}});
document.addEventListener('mousemove',e=>{if(!_cropMode||!_cropStart)return;const{x,y}=cropPt(e);const dx=x-_cropStart.x,dy=y-_cropStart.y;const b={..._cropBoxStart},ir=_imgR,MIN=30;if(_cropMode==='move'){b.x=Math.max(ir.x,Math.min(ir.x+ir.w-b.w,b.x+dx));b.y=Math.max(ir.y,Math.min(ir.y+ir.h-b.h,b.y+dy));}else{if(_cropMode.includes('n')){b.y=b.y+dy;b.h=_cropBoxStart.h-dy;}if(_cropMode.includes('s')){b.h=_cropBoxStart.h+dy;}if(_cropMode.includes('w')){b.x=b.x+dx;b.w=_cropBoxStart.w-dx;}if(_cropMode.includes('e')){b.w=_cropBoxStart.w+dx;}b.x=Math.max(ir.x,b.x);b.y=Math.max(ir.y,b.y);if(b.x+b.w>ir.x+ir.w)b.w=ir.x+ir.w-b.x;if(b.y+b.h>ir.y+ir.h)b.h=ir.y+ir.h-b.y;if(b.w<MIN)b.w=MIN;if(b.h<MIN)b.h=MIN;}_cropBox=b;drawCrop();});
document.addEventListener('mouseup',()=>{_cropMode=null;});
async function applyCrop(){
  const ir=_imgR,b=_cropBox;
  const ox=(b.x-ir.x)/ir.sc,oy=(b.y-ir.y)/ir.sc,ow=b.w/ir.sc,oh=b.h/ir.sc;
  const out=document.createElement('canvas');const MAX=800;const sc=Math.min(MAX/ow,MAX/oh,1);
  out.width=Math.round(ow*sc);out.height=Math.round(oh*sc);
  out.getContext('2d').drawImage(_cropImg,ox,oy,ow,oh,0,0,out.width,out.height);
  const dataUrl=out.toDataURL('image/jpeg',.82);
  document.getElementById('cropOverlay').classList.remove('open');
  toast('이미지 업로드 중...');
  const result = await _uploadImgToStorage(dataUrl);
  if(_cropCb)_cropCb(result);
}

/* ══ NAV SCROLL ══ */
if(!IS_SHARE){
  const ioNav=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        document.querySelectorAll('.nav-link[href^="#"]').forEach(l=>l.classList.remove('active'));
        const lk=document.querySelector(`.nav-link[href="#${e.target.id}"]`);
        if(lk)lk.classList.add('active');
      }
    });
  },{threshold:.25});
  document.querySelectorAll('section[id]').forEach(s=>ioNav.observe(s));
}

/* ══ INIT ══ */
(async function init(){
  // Supabase에서 데이터 불러온 뒤 화면 초기화
  await initData();

  applyColors();applyConfig();applyCalCfg();
  if(!IS_SHARE){
    renderSection('docs');renderSection('webtoon');
    renderLegend();renderTagFilter();
    // 캘린더: viewM 보이게 설정 후 렌더
    document.getElementById('viewM').style.display='block';
    document.getElementById('viewY').style.display='none';
    document.getElementById('btnM').classList.add('active');
    document.getElementById('btnY').classList.remove('active');
    renderMonthly();
  }
  document.getElementById('calNameText').textContent=CAL_NAME;

  const params=new URLSearchParams(window.location.search);
  const cardId=params.get('card');const docId=params.get('doc');
  if(cardId){
    let foundG='',foundTab='';
    outer:for(const[key,cards] of Object.entries(CARDS)){
      for(const c of cards){
        if(c.id===cardId){const parts=key.split(/-(.+)/);foundG=parts[0];foundTab=parts[1];break outer;}
      }
    }
    if(foundG){openCardDetail(cardId,foundG,foundTab);if(docId)setTimeout(()=>openDocViewer(docId),100);}
  }

  window.addEventListener('popstate',()=>{
    const p=new URLSearchParams(window.location.search);
    const cid=p.get('card'),did=p.get('doc');
    if(!cid){
      document.getElementById('cardDetailView').style.display='none';
      document.getElementById('docViewerView').style.display='none';
      if(!IS_SHARE)document.getElementById('mainSite').style.display='block';
    }else if(cid&&!did){
      document.getElementById('docViewerView').style.display='none';
      document.getElementById('cardDetailView').style.display='block';
      document.getElementById('mainSite').style.display='none';
    }
  });
})();
