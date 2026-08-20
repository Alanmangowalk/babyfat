/* BabyFat frontend v8.1 - people-first course selector */
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
window.addEventListener('scroll',()=>$('#siteHeader')?.classList.toggle('scrolled',window.scrollY>32));
function toggleMenu(){document.body.classList.toggle('menu-open');$('#mobileMenu')?.classList.toggle('open')}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),3000)}
$$('.faq-q').forEach(b=>b.addEventListener('click',()=>b.closest('.faq-item').classList.toggle('open')));
$$('.lang').forEach(s=>s.addEventListener('change',()=>window.setBabyFatLanguage?.(s.value)));

const BF={config:JSON.parse(JSON.stringify(window.BABYFAT_CONFIG?.FALLBACK||{}))};
const money=n=>'NT$'+Number(n||0).toLocaleString('en-US');
const apiBase=()=>String(window.BABYFAT_CONFIG?.API_BASE||'').trim().replace(/\/$/,'');

async function httpJson(path,{method='GET',body}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(apiBase()+path,{
      method,
      headers:body?{'content-type':'application/json'}:undefined,
      body:body?JSON.stringify(body):undefined,
      signal:controller.signal,
      credentials:'same-origin'
    });
    let data={};
    try{data=await res.json()}catch{}
    if(!res.ok||data?.ok===false){
      const e=new Error(data?.error||('HTTP_'+res.status));
      e.status=res.status;
      throw e;
    }
    return data?.data ?? data;
  }catch(e){
    if(e.name==='AbortError')throw new Error('REQUEST_TIMEOUT');
    throw e;
  }finally{clearTimeout(timer)}
}

function apiRequest(action,payload={}){
  if(action==='publicConfig')return httpJson('/api/config');
  if(action==='health')return httpJson('/api/health');
  if(action==='createBooking')return httpJson('/api/bookings',{method:'POST',body:payload});
  if(action==='lookupBookingFast')return httpJson('/api/bookings/lookup?q='+encodeURIComponent(payload.q||payload.query||''));
  if(action==='submitPayment')return httpJson('/api/payments',{method:'POST',body:payload});
  if(action==='createPartnership')return httpJson('/api/partnerships',{method:'POST',body:payload});
  return Promise.reject(new Error('UNKNOWN_API_ACTION'));
}
window.BabyFatAPI={request:apiRequest};

function lineId(){return String(BF.config.contact?.lineId||window.BABYFAT_CONFIG?.SOCIAL?.lineId||'@572opdeh')}
function lineProfileUrl(){return 'https://line.me/R/ti/p/'+encodeURIComponent(lineId())}
function lineChatUrl(text='您好 我想詢問 BabyFat 滑雪課程'){return 'https://line.me/R/oaMessage/'+encodeURIComponent(lineId())+'/?'+encodeURIComponent(text)}
function setupContactLinks(){
  const contact=BF.config.contact||{};
  const social=window.BABYFAT_CONFIG?.SOCIAL||{};
  const ig=contact.instagramUrl||social.instagramUrl||'https://www.instagram.com/babyfat_snowteam/';
  const fb=contact.facebookUrl||social.facebookUrl||'https://www.facebook.com/search/top?q=BabyFat%E9%9B%AA%E8%83%96%E6%95%99%E7%B7%B4%E5%9C%98';
  const phone=contact.phone||social.phone||'0913172857';
  const phoneHref='tel:'+String(phone).replace(/[^\d+]/g,'');
  const line=lineProfileUrl();

  $$('.footer-contact').forEach(el=>{
    el.innerHTML=`<a href="${line}" target="_blank" rel="noopener">LINE ${escapeHtml(lineId())}</a><a href="${ig}" target="_blank" rel="noopener">Instagram</a><a href="${fb}" target="_blank" rel="noopener">Facebook</a><a href="${phoneHref}">${escapeHtml(phone)}</a>`;
  });

  $$('.nav-actions').forEach(nav=>{
    if(nav.querySelector('.line-nav'))return;
    const a=document.createElement('a');
    a.className='line-nav';
    a.href=lineChatUrl();
    a.target='_blank';a.rel='noopener';a.textContent='LINE客服';
    nav.insertBefore(a,nav.firstChild);
  });

  const mobile=$('#mobileMenu');
  if(mobile&&!mobile.querySelector('.line-mobile')){
    const a=document.createElement('a');a.className='line-mobile';a.href=lineChatUrl();a.target='_blank';a.rel='noopener';a.textContent='LINE 客服';
    mobile.insertBefore(a,mobile.firstChild);
  }

  if(!$('.line-fab')){
    const a=document.createElement('a');
    a.className='line-fab';
    a.href=lineChatUrl();a.target='_blank';a.rel='noopener';
    a.setAttribute('aria-label','LINE 客服');
    a.innerHTML='<span>LINE</span><b>客服</b>';
    document.body.appendChild(a);
  }
}

function showBookingSync(msg){const e=$('#bookingSync');if(e){e.textContent=msg;e.classList.add('show')}}
function hideBookingSync(){const e=$('#bookingSync');if(e)e.classList.remove('show')}
function renderBookingSuccess(r,email){
  bookingDraftClear();
  hideBookingSync();
  $('#bookingError')?.classList.remove('show');
  $('#bookingWizard')?.classList.add('hidden');
  const box=$('#bookingSuccess');
  box.classList.add('show');
  const message=`您好 我剛完成 BabyFat 滑雪預約\n預約編號 ${r.bookingId}`;
  box.innerHTML=`<div class="success-check">✓</div><div class="eyebrow">BOOKING CONFIRMED</div><h3>預約已建立</h3><p class="success-lead">你的資料已安全記錄 不需要再次送出</p><div class="booking-code"><span>預約編號</span><b>${escapeHtml(r.bookingId)}</b></div><p>${r.bookingStatus==='PENDING_REVIEW'?'住宿 攝影或接駁需求正在確認 完成確認後會開放付款':'名額已暫留 請於付款期限內完成匯款'}</p>${r.paymentDeadline?`<p class="small">付款期限 ${escapeHtml(r.paymentDeadline)}</p>`:''}<div class="success-actions"><a class="btn primary" href="my-booking.html?id=${encodeURIComponent(r.bookingId)}">查看我的預約</a><a class="btn line-btn" href="${lineChatUrl(message)}" target="_blank" rel="noopener">用 LINE 傳送預約編號</a></div><p class="small">請加入官方 LINE ${escapeHtml(lineId())} 並傳送預約編號 客服核對後即可完成 LINE 對接</p>`;
  window.scrollTo({top:box.offsetTop-90,behavior:'smooth'});
}
async function loadPublicConfig(){try{const c=await apiRequest('publicConfig');BF.config={...BF.config,...c,prices:{...(BF.config.prices||{}),...(c.prices||{})},shuttle:{...(BF.config.shuttle||{}),...(c.shuttle||{})},contact:{...(BF.config.contact||{}),...(c.contact||{})}};window.dispatchEvent(new CustomEvent('babyfat:config',{detail:BF.config}));setupContactLinks()}catch(e){console.info('BabyFat fallback config',e.message);setupContactLinks()}}
window.BabyFatAPI={request:apiRequest,loadPublicConfig};

document.addEventListener('DOMContentLoaded',()=>{setupContactLinks();loadPublicConfig();setupBooking();setupLookup();setupCooperation();setupSystemCheck()});

function setRegionPrices(region){
  const p=BF.config.prices?.[region];if(!p)return;
  const values={groupHalf:p.groupHalf,groupFull:p.groupFull,shareHalf:p.shareHalf,shareFull:p.shareFull,privateHalf:p.privateHalf,privateFull:p.privateFull,dualHalf:p.dualCoachHalf,dualFull:p.dualCoachFull};
  Object.entries(values).forEach(([id,v])=>{const e=$('#'+id);if(e)e.textContent=(id.startsWith('dual')?'+':'')+money(v)});
  $$('.region-toggle button').forEach(b=>b.classList.toggle('active',b.dataset.region===region));
  if($('#bookingWizard')){renderCourseOptions();updateBookingSummary()}
}
window.setRegion=setRegionPrices;
window.addEventListener('babyfat:config',()=>{const active=$('.region-toggle button.active')?.dataset.region||'yuzawa';setRegionPrices(active);setupSeasonDates()});

const BF_MAX_LESSON_DAYS=10;
function getLessonDates(){
  return [...new Set($$('.lesson-date-input').map(x=>x.value).filter(Boolean))].sort();
}
function renderLessonDateRows(values){
  const box=$('#lessonDates');if(!box)return;
  const min=BF.config.seasonStart||'2026-12-15',max=BF.config.seasonEnd||'2027-04-30';
  const vals=(Array.isArray(values)&&values.length?values:[min]).slice(0,BF_MAX_LESSON_DAYS);
  box.innerHTML='';
  vals.forEach((v,i)=>{
    const row=document.createElement('div');row.className='lesson-date-row';
    row.innerHTML=`<input class="lesson-date-input" type="date" min="${min}" max="${max}" value="${escapeHtml(v||min)}"><button type="button" class="lesson-date-remove" aria-label="移除日期" ${vals.length===1?'disabled':''}>×</button>`;
    box.appendChild(row);
  });
}
function setupSeasonDates(){
  const min=BF.config.seasonStart||'2026-12-15',max=BF.config.seasonEnd||'2027-04-30';
  if(!$('#lessonDates'))return;
  if(!$$('.lesson-date-input').length)renderLessonDateRows([min]);
  $$('.lesson-date-input').forEach(d=>{d.min=min;d.max=max;if(!d.value||d.value<min||d.value>max)d.value=min});
}


const BF_BOOKING_DRAFT_KEY='babyfat_booking_draft_v815';
function bookingDraftLoad(){
  try{
    const d=JSON.parse(localStorage.getItem(BF_BOOKING_DRAFT_KEY)||'null');
    if(!d||!d.savedAt||Date.now()-d.savedAt>24*60*60*1000)return null;
    return d;
  }catch(e){return null}
}
function bookingDraftSave(step){
  const form=$('#bookingWizard');if(!form)return;
  const participants=[...$$('.participant',form)].map(x=>({
    name:x.querySelector('[data-p=name]')?.value||'',
    age:x.querySelector('[data-p=age]')?.value||'',
    level:x.querySelector('[data-p=level]')?.value||'first'
  }));
  const d={
    savedAt:Date.now(),step:Number(step||1),
    region:choiceValue('region','yuzawa'),
    partyType:choiceValue('partyType','adult'),
    board:choiceValue('board','ski'),
    duration:choiceValue('duration','half'),
    lessonDates:getLessonDates(),
    resort:$('#resort')?.value||'',
    people:$('#people')?.value||'2',
    course:$('#courseOptions')?.dataset.selected||'',
    timeSlot:$('#timeSlot')?.value||'AM',
    contactName:$('#contactName')?.value||'',
    phone:$('#phone')?.value||'',
    email:$('#bookingEmail')?.value||'',
    lineName:$('#lineName')?.value||'',
    lineId:$('#lineId')?.value||'',
    lineJoined:!!$('#lineJoined')?.checked,
    participants,
    notes:$('#notes')?.value||'',
    stay:!!$('#stay')?.checked,
    nights:$('#nights')?.value||'1',
    stayRooms:$('#stayRooms')?.value||'1',
    photo:!!$('#photo')?.checked,
    shuttle:$('#shuttle')?.value||'none'
  };
  try{localStorage.setItem(BF_BOOKING_DRAFT_KEY,JSON.stringify(d))}catch(e){}
}
function bookingDraftClear(){try{localStorage.removeItem(BF_BOOKING_DRAFT_KEY)}catch(e){}}
function setChoiceDraft(group,value){
  if(!value)return;
  $$(`.choice[data-group="${group}"]`).forEach(x=>x.classList.toggle('active',x.dataset.value===String(value)));
}
function applyBookingDraftBase(d){
  if(!d)return;
  setChoiceDraft('region',d.region);
  setChoiceDraft('partyType',d.partyType);
  setChoiceDraft('board',d.board);
  setChoiceDraft('duration',d.duration);
  if(Array.isArray(d.lessonDates)&&d.lessonDates.length)renderLessonDateRows(d.lessonDates);else if(d.lessonDate)renderLessonDateRows([d.lessonDate]);
  if($('#people')&&d.people)$('#people').value=d.people;
}
function applyBookingDraftDetails(d){
  if(!d)return;
  const set=(id,v)=>{const e=$('#'+id);if(e&&v!==undefined&&v!==null)e.value=String(v)};
  set('resort',d.resort);set('timeSlot',d.timeSlot);set('contactName',d.contactName);set('phone',d.phone);
  set('bookingEmail',d.email);set('lineName',d.lineName);set('lineId',d.lineId);set('notes',d.notes);
  set('nights',d.nights);set('stayRooms',d.stayRooms);set('shuttle',d.shuttle);
  if($('#lineJoined'))$('#lineJoined').checked=!!d.lineJoined;
  if($('#stay'))$('#stay').checked=!!d.stay;
  if($('#photo'))$('#photo').checked=!!d.photo;
  const box=$('#courseOptions');
  if(box&&d.course&&[...box.querySelectorAll('.course-pick')].some(x=>x.dataset.course===d.course)){
    box.dataset.selected=d.course;
    $$('.course-pick',box).forEach(x=>x.classList.toggle('active',x.dataset.course===d.course));
  }
  const parts=Array.isArray(d.participants)?d.participants:[];
  $$('.participant').forEach((x,i)=>{
    const p=parts[i]||{};
    const name=x.querySelector('[data-p=name]'),age=x.querySelector('[data-p=age]'),level=x.querySelector('[data-p=level]');
    if(name)name.value=p.name||'';
    if(age)age.value=p.age||'';
    if(level&&p.level)level.value=p.level;
  });
}

function setupBooking(){
 const form=$('#bookingWizard');if(!form||form.dataset.ready)return;form.dataset.ready='1';
 const draft=bookingDraftLoad();let step=Math.max(1,Math.min(4,Number(draft?.step||1)));
 const show=(smooth=true)=>{
   $$('.form-step',form).forEach(x=>x.classList.toggle('active',+x.dataset.step===step));
   $$('.progress span',form).forEach((x,i)=>x.classList.toggle('active',i<step));
   updateBookingSummary();bookingDraftSave(step);
   if(smooth)window.scrollTo({top:form.offsetTop-85,behavior:'smooth'});
 };
 window.nextStep=()=>{if(step<4){if(!validateBookingStep(step))return;step++;show()}};
 window.prevStep=()=>{if(step>1){step--;show()}};

 setupSeasonDates();
 applyBookingDraftBase(draft);
 updateResortOptions();
 updateTimeSlotOptions();
 renderParticipants();
 renderCourseOptions();
 applyBookingDraftDetails(draft);
 updateSeasonPhaseHint();
 updateBookingSummary();
 show(false);

 form.addEventListener('click',e=>{
   const b=e.target.closest('.choice');if(!b)return;
   const g=b.dataset.group;
   if(g){$$(`.choice[data-group="${g}"]`,form).forEach(x=>x.classList.remove('active'));b.classList.add('active')}
   if(g==='region')updateResortOptions();
   if(g==='duration')updateTimeSlotOptions();
   if(['region','partyType','board','duration'].includes(g))renderCourseOptions();
   const add=e.target.closest('#addLessonDate');
   const remove=e.target.closest('.lesson-date-remove');
   if(add){
     const dates=getLessonDates();
     if(dates.length>=BF_MAX_LESSON_DAYS){toast('單筆預約最多可選 10 個上課日');return}
     const base=dates[dates.length-1]||BF.config.seasonStart||'2026-12-15';
     const next=new Date(base+'T00:00:00');next.setDate(next.getDate()+1);
     const nextVal=next.toISOString().slice(0,10);
     renderLessonDateRows([...dates,nextVal<=String(BF.config.seasonEnd||'2027-04-30')?nextVal:base]);
     setupSeasonDates();updateSeasonPhaseHint();updateBookingSummary();bookingDraftSave(step);return;
   }
   if(remove){
     const row=remove.closest('.lesson-date-row');
     if(row&&$$('.lesson-date-row').length>1){row.remove();$$('.lesson-date-remove').forEach(x=>x.disabled=$$('.lesson-date-row').length===1);updateSeasonPhaseHint();updateBookingSummary();bookingDraftSave(step)}
     return;
   }
   updateBookingSummary();bookingDraftSave(step);
 });
 form.addEventListener('change',e=>{
   if(e.target.id==='people'){renderParticipants();renderCourseOptions()}
   if(e.target.classList?.contains('lesson-date-input'))updateSeasonPhaseHint();
   updateBookingSummary();bookingDraftSave(step);
 });
 form.addEventListener('input',()=>bookingDraftSave(step));
 $('#submitBooking')?.addEventListener('click',submitBooking);

 $$('.line-open-booking',form).forEach(a=>a.addEventListener('click',()=>{
   bookingDraftSave(step);
   toast('預約資料已暫存 返回此頁可繼續填寫');
 }));
 window.addEventListener('pagehide',()=>bookingDraftSave(step));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')bookingDraftSave(step)});
}
function choiceValue(group,fallback){return $(`.choice.active[data-group="${group}"]`)?.dataset.value||fallback}
function updateResortOptions(){const s=$('#resort');if(!s)return;const region=choiceValue('region','yuzawa');s.innerHTML=region==='yuzawa'?'<option value="BabyFat arrange">由 BabyFat 安排</option><option value="Nakazato">中里</option><option value="Iwappara">岩原</option><option value="Other Yuzawa">其他湯澤雪場</option>':'<option value="BabyFat arrange">由 BabyFat 安排</option><option value="Karuizawa area">輕井澤區</option>'}
function updateTimeSlotOptions(){const s=$('#timeSlot');if(!s)return;const full=choiceValue('duration','half')==='full';if(full){s.innerHTML='<option value="FULL">全日 09:30–15:30</option>';s.value='FULL'}else{s.innerHTML='<option value="AM">AM 09:00–12:00</option><option value="PM">PM 13:00–16:00</option>'}$('#bonusHint')?.classList.toggle('hidden',!full)}
function renderParticipants(){const box=$('#participants');if(!box)return;const n=Math.max(1,Math.min(8,+($('#people')?.value||1)));const old=[...box.querySelectorAll('.participant')].map(x=>({name:x.querySelector('[data-p=name]')?.value||'',age:x.querySelector('[data-p=age]')?.value||'',level:x.querySelector('[data-p=level]')?.value||''}));box.innerHTML='';for(let i=0;i<n;i++){const v=old[i]||{};const div=document.createElement('div');div.className='participant';div.innerHTML=`<div class="participant-title">學員 ${i+1}</div><div class="field-grid"><div class="field"><label>姓名</label><input data-p="name" value="${escapeHtml(v.name||'')}" placeholder="可與預約人相同"></div><div class="field"><label>年齡</label><input data-p="age" inputmode="numeric" value="${escapeHtml(v.age||'')}" placeholder="例如 8"></div><div class="field" style="grid-column:1/-1"><label>程度</label><select data-p="level"><option value="first">完全沒滑過</option><option value="beginner">滑過 1 到 3 次</option><option value="control">可自行煞停轉向</option><option value="advanced">進階需求</option></select></div></div>`;box.appendChild(div);if(v.level)div.querySelector('[data-p=level]').value=v.level}}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function phaseForDate(date){for(const p of (BF.config.seasonPhases||[])){if(date>=p.start&&date<=p.end)return p}return null}
function updateSeasonPhaseHint(){const e=$('#seasonPhaseHint'),dates=getLessonDates();if(!e||!dates.length)return;const phases=[...new Set(dates.map(d=>phaseForDate(d)?.label||'').filter(Boolean))];e.innerHTML=`<b>已選 ${dates.length} 個上課日</b><span>${escapeHtml(dates.join('、'))}${phases.length?`｜${escapeHtml(phases.join('／'))}`:''}</span>`}
function privateBasePrice(region,duration){const p=BF.config.prices?.[region]||{};return duration==='half'?p.privateHalf:p.privateFull}
function privatePrice(region,duration,people){return Number(privateBasePrice(region,duration)||0)+Math.max(0,people-3)*Number(BF.config.privateExtraPerson||1000)}
function coursePrice(course,region,duration,people){const p=BF.config.prices?.[region]||{};if(course==='group')return Number(duration==='half'?p.groupHalf:p.groupFull)*people;if(course==='share')return Number(duration==='half'?p.shareHalf:p.shareFull);if(course==='private')return privatePrice(region,duration,people);if(course==='dual')return privatePrice(region,duration,people)+Number(duration==='half'?p.dualCoachHalf:p.dualCoachFull);return 0}
function courseLabel(course){return({group:'初雪萌新小團班',share:'你好同學班',private:'獨自升級專屬包班',dual:'雙教練專屬包班'}[course]||course)}
function availableCourses(people,partyType){if(people>=9)return[];if(partyType==='family'){if(people<=4)return['private'];if(people<=6)return['private','dual'];return['dual']}if(people<=2)return['group','share','private'];if(people<=4)return['group','private'];if(people===5)return['group','private','dual'];if(people===6)return['private','dual'];return['dual']}
function renderCourseOptions(){const box=$('#courseOptions');if(!box)return;const people=+($('#people')?.value||1),partyType=choiceValue('partyType','adult'),region=choiceValue('region','yuzawa'),duration=choiceValue('duration','half');const courses=availableCourses(people,partyType);const current=box.querySelector('.course-pick.active')?.dataset.course||box.dataset.selected;const selected=courses.includes(current)?current:(courses.includes('private')&&partyType==='family'?'private':courses[0]);box.dataset.selected=selected||'';const desc={group:'成人第一次滑雪｜最多 5 人',share:'1–2 人成立｜可能與新同學共學｜最多 4 人',private:'自己的教練｜親子家庭首選｜1–6 人',dual:'兩位教練｜5–8 人｜多人或分組需求'};box.innerHTML=courses.length?courses.map(c=>`<button type="button" class="course-pick ${c===selected?'active':''}" data-course="${c}"><span>${courseLabel(c)}</span><small>${desc[c]}</small><b>${money(coursePrice(c,region,duration,people))}</b></button>`).join(''):`<div class="large-group-contact"><b>9 人以上由客服安排</b><span>我們會依人數 程度 板種與親子需求配置教練</span><a class="btn line-btn" href="${lineChatUrl('您好 我想詢問 BabyFat 9 人以上團體滑雪課程')}" target="_blank" rel="noopener">LINE 詢問團體安排</a></div>`;$$('.course-pick',box).forEach(btn=>btn.addEventListener('click',()=>{$$('.course-pick',box).forEach(x=>x.classList.remove('active'));btn.classList.add('active');box.dataset.selected=btn.dataset.course;updateBookingSummary()}));const note=$('#courseRecommendation');if(note){note.textContent=partyType==='family'?'親子家庭不安排初雪萌新小團班或你好同學班 優先讓一家人使用專屬教練一起上山與移動':(people<=2?'可依預算與專屬程度選擇三種方案':'系統已依同行人數篩選可選班別')}}
function bookingCalc(){const region=choiceValue('region','yuzawa'),duration=choiceValue('duration','half'),board=choiceValue('board','ski'),partyType=choiceValue('partyType','adult');const people=Math.max(1,+($('#people')?.value||1));const course=$('#courseOptions')?.dataset.selected||availableCourses(people,partyType)[0]||'';const lessonDates=getLessonDates(),dayCount=Math.max(1,lessonDates.length);const dailyTuition=coursePrice(course,region,duration,people);const tuition=dailyTuition*dayCount;const coachCount=course==='dual'?2:1;const stay=$('#stay')?.checked;const nights=Math.max(1,+($('#nights')?.value||1));const rooms=Math.max(1,+($('#stayRooms')?.value||1));const lodge=stay?(BF.config.stayRoomTwd||6500)*nights*rooms:0;const photo=$('#photo')?.checked;const photoFee=photo?(BF.config.photoTwd||13000):0;const shuttle=$('#shuttle')?.value||'none';const shuttleJpy=BF.config.shuttle?.[shuttle]||0;return{region,course,duration,board,partyType,people,coachCount,lessonDates,dayCount,dailyTuition,tuition,stay,nights,rooms,lodge,photo,photoFee,shuttle,shuttleJpy,totalTwd:tuition+lodge+photoFee}}
function updateBookingSummary(){const c=bookingCalc();const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};const phases=[...new Set(c.lessonDates.map(d=>phaseForDate(d)?.label||'').filter(Boolean))];set('#sumRegion',c.region==='yuzawa'?'越後湯澤':'輕井澤');set('#sumDates',c.lessonDates.length?`${c.lessonDates.length} 天｜${c.lessonDates.join('、')}`:'尚未選擇');set('#sumSeason',phases.join('／')||'—');set('#sumCourse',c.course?courseLabel(c.course):'請洽 LINE');set('#sumBoard',c.board==='ski'?'雙板 Ski':'單板 Snowboard');set('#sumDuration',c.duration==='half'?'半日 3H':'全日 6H 含用餐');set('#sumPeople',c.people+' 人');set('#sumCoaches',c.course==='dual'?'2 位':'1 位');set('#sumTuition',c.course?`${money(c.tuition)}（${c.dayCount} 天）`:'客服報價');set('#sumLodge',c.stay?money(c.lodge):'未加購');set('#sumPhoto',c.photo?money(c.photoFee):'未加購');set('#sumTotalTwd',c.course?money(c.totalTwd):'—');set('#sumShuttle',c.shuttle==='none'?'未選擇':($('#shuttle')?.selectedOptions[0]?.text||c.shuttle)+(c.shuttleJpy?` ¥${Number(c.shuttleJpy).toLocaleString()}`:''))}
function validateBookingStep(step){const err=$('#bookingError');if(err)err.classList.remove('show');if(step===1){const dates=getLessonDates();if(!dates.length){showBookingError('請至少選擇 1 個上課日期');return false}if(dates.length>BF_MAX_LESSON_DAYS){showBookingError('單筆預約最多可選 10 個上課日');return false}const min=BF.config.seasonStart||'2026-12-15',max=BF.config.seasonEnd||'2027-04-30';if(dates.some(d=>d<min||d>max)){showBookingError('日期需在本雪季開放期間內');return false}}if(step===2){const c=bookingCalc();if(c.people>=9){showBookingError('9 人以上請使用 LINE 客服 由團隊安排教練配置');return false}if(!c.course){showBookingError('請選擇班別');return false}if(c.partyType==='family'&&['group','share'].includes(c.course)){showBookingError('親子家庭請選擇獨自升級專屬包班或雙教練專屬包班');return false}}if(step===3){for(const id of ['contactName','phone','bookingEmail','lineName']){if(!$('#'+id)?.value.trim()){showBookingError('姓名 手機 Email 與 LINE 都是必填資料');return false}}if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($('#bookingEmail').value.trim())){showBookingError('Email 格式不正確');return false}if($('#phone').value.replace(/\D/g,'').length<8){showBookingError('請填寫可聯絡的手機號碼');return false}if(!$('#lineJoined')?.checked){showBookingError('請先加入 BabyFat 官方 LINE 並勾選確認');return false}}return true}

function showBookingError(msg){const e=$('#bookingError');if(e){e.textContent=msg;e.classList.add('show')}else toast(msg)}
async function submitBooking(){
  if(!validateBookingStep(3))return;
  if(!$('#termsAgree')?.checked||!$('#privacyAgree')?.checked){showBookingError('請先同意預約規則與資料使用說明');return}

  const form=$('#bookingWizard'),btn=$('#submitBooking');
  btn.disabled=true;btn.textContent='正在建立預約';
  $('#bookingError')?.classList.remove('show');
  showBookingSync('正在建立預約 請勿重複送出');

  const c=bookingCalc();
  const participants=[...$$('.participant')].map((x,i)=>({
    no:i+1,name:x.querySelector('[data-p=name]')?.value.trim()||'',
    age:x.querySelector('[data-p=age]')?.value.trim()||'',
    level:x.querySelector('[data-p=level]')?.value||'first'
  }));
  const requestKey=form.dataset.requestKey||(form.dataset.requestKey='BK_'+Date.now()+'_'+Math.random().toString(36).slice(2,10));
  const payload={
    ...c,resort:$('#resort')?.value||'',lessonDates:c.lessonDates,lessonDate:c.lessonDates[0]||'',timeSlot:$('#timeSlot')?.value||'',
    contactName:$('#contactName')?.value.trim()||'',phone:$('#phone')?.value.trim()||'',email:$('#bookingEmail')?.value.trim()||'',
    line:$('#lineName')?.value.trim()||'',lineId:$('#lineId')?.value.trim()||'',lineJoined:!!$('#lineJoined')?.checked,notes:$('#notes')?.value.trim()||'',
    participants,termsConsent:true,privacyConsent:true,source:'website',requestKey
  };

  try{
    const r=await apiRequest('createBooking',payload);
    renderBookingSuccess(r,payload.email);
  }catch(e){
    hideBookingSync();
    const map={
      LINE_NOT_CONFIRMED:'請先加入官方 LINE 並勾選確認',
      INVALID_PHONE:'手機格式不正確',
      INVALID_EMAIL:'Email 格式不正確',
      OUTSIDE_SEASON:'目前日期不在開放雪季',
      MISSING_LESSON_DATES:'請至少選擇 1 個上課日期',
      TOO_MANY_LESSON_DAYS:'單筆預約最多可選 10 個上課日',
      REQUEST_TIMEOUT:'系統回應逾時 請先不要重複送出 可用 Email 或預約編號查詢'
    };
    showBookingError(map[e.message]||'預約尚未建立 請確認資料後再試');
    btn.disabled=false;btn.textContent='送出預約';
  }
}

function setupLookup(){
  const form=$('#lookupForm');
  if(!form||form.dataset.ready)return;
  form.dataset.ready='1';

  const qs=new URLSearchParams(location.search);
  const q=qs.get('id')||qs.get('email')||'';
  if(q)$('#lookupQuery').value=q;

  $('#lookupBtn')?.addEventListener('click',lookupBooking);
  $('#lookupQuery')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupBooking()}});
  $('#paymentBtn')?.addEventListener('click',submitPaymentDetails);

  if(q)lookupBooking();
}

async function lookupBooking(){
  const q=$('#lookupQuery')?.value.trim()||'';
  const err=$('#lookupError'),status=$('#lookupStatus'),btn=$('#lookupBtn');
  err?.classList.remove('show');$('#bookingResult')?.classList.remove('show');$('#lookupMatches')?.classList.remove('show');
  if(!q){if(err){err.textContent='請輸入預約編號或 Email 任一即可';err.classList.add('show')}return}
  btn.disabled=true;const oldText=btn.textContent;btn.textContent='查詢中';
  if(status){status.textContent='正在查詢預約資料';status.classList.add('show')}
  try{
    const out=await apiRequest('lookupBookingFast',{q});
    const bookings=Array.isArray(out?.bookings)?out.bookings:[];
    if(!bookings.length)throw new Error('NOT_FOUND');
    bookings.length===1?renderBookingReceipt(bookings[0]):renderBookingMatches(bookings);
  }catch(e){
    if(err){err.textContent=e.message==='NOT_FOUND'?'找不到符合的預約資料 請確認預約編號或 Email':'目前無法查詢 請稍後再試或使用 LINE 客服';err.classList.add('show')}
  }finally{
    if(status)status.classList.remove('show');btn.disabled=false;btn.textContent=oldText||'查詢';
  }
}

function renderBookingMatches(bookings){
  const box=$('#lookupMatches');
  if(!box)return;
  window._bookingMatches=bookings;
  box.innerHTML=`<div class="match-title">此 Email 找到 ${bookings.length} 筆預約</div>`+
    bookings.map((r,i)=>`
      <button class="booking-match" type="button" data-booking-match="${i}">
        <span><b>${escapeHtml(r.bookingId)}</b><small>${escapeHtml((r.lessonDates&&r.lessonDates.length?r.lessonDates.join('、'):r.lessonDate)||'')}　${escapeHtml(r.regionLabel||'')}　${escapeHtml(r.courseLabel||'')}</small></span>
        <em>${escapeHtml(statusText(r.bookingStatus))}</em>
      </button>`).join('');
  box.classList.add('show');
  $$('[data-booking-match]',box).forEach(b=>b.addEventListener('click',()=>{
    const r=bookings[+b.dataset.bookingMatch];
    box.classList.remove('show');
    renderBookingReceipt(r);
  }));
}
function statusText(v){return({PENDING_REVIEW:'服務確認中',PENDING_PAYMENT:'等待付款',PAYMENT_REVIEW:'付款核對中',CONFIRMED:'預約完成',EXPIRED:'預約已逾期',CANCELLED:'預約已取消'}[v]||v||'—')}
function paymentText(v){return({PENDING:'尚未付款',REVIEWING:'核對中',PAID:'已完成',EXPIRED:'已逾期'}[v]||v||'—')}
function renderBookingReceipt(r){const box=$('#bookingResult');box.classList.add('show');$('#receiptTitle').textContent=`${r.bookingId}  ${r.regionLabel}  ${r.courseLabel}`;$('#receiptStatus').textContent=statusText(r.bookingStatus);const cells={receiptBookingStatus:statusText(r.bookingStatus),receiptPayment:paymentText(r.paymentStatus),receiptDate:((r.lessonDates&&r.lessonDates.length?r.lessonDates.join('、'):r.lessonDate)||'—')+(r.lessonDaysCount>1?`｜共 ${r.lessonDaysCount} 天`:'')+(r.seasonPhaseLabel?`｜${r.seasonPhaseLabel}`:''),receiptTime:r.timeSlotLabel||r.timeSlot||'—',receiptBoard:r.boardLabel||'—',receiptPeople:(r.peopleCount||0)+' 人',receiptCoach:(r.assignedCoach||'安排中')+(r.coachCount>1?'｜2 位教練':''),receiptStay:r.stayRequested?`${r.stayRooms} 間 ${r.stayNights} 晚`:'未加購',receiptPhoto:r.photoRequested?'已登記':'未加購'};Object.entries(cells).forEach(([id,v])=>{const e=$('#'+id);if(e)e.textContent=v});const panel=$('#paymentPanel');if(['PENDING_PAYMENT','PAYMENT_REVIEW'].includes(r.bookingStatus)){panel.classList.remove('hidden');$('#payDeadline').textContent=r.paymentDeadline||'—';$('#payAmount').textContent=money(r.totalTwd);$('#bankInfo').innerHTML=r.bank&&r.bank.account?`<strong>${escapeHtml(r.bank.bankName||'')} ${escapeHtml(r.bank.bankCode||'')}</strong><span>${escapeHtml(r.bank.account)} ${r.bank.holder?`｜${escapeHtml(r.bank.holder)}`:''}</span>`:'<strong>匯款資訊請洽客服</strong>'}else panel.classList.add('hidden');let extra=$('#bookingExtraStatus');if(!extra){extra=document.createElement('div');extra.id='bookingExtraStatus';extra.className='booking-extra-status';box.appendChild(extra)}const items=[];if(r.course==='share')items.push(`<div><b>你好同學班</b><span>預約已成立 ${r.shareGroupId?'已安排共學群組 '+escapeHtml(r.shareGroupId):'若有合適同學會由雪胖安排 沒有也照常上課'}</span></div>`);if(r.duration==='full')items.push(`<div><b>24H 延時 1 小時</b><span>${r.bonusHourStatus==='CONFIRMED'?'已確認':r.bonusHourEligible?'符合條件 請用官方 LINE 回傳付款資訊完成確認':'24 小時內付款後可申請'}</span></div>`);extra.innerHTML=items.join('');window._currentBooking=r;window.scrollTo({top:box.offsetTop-85,behavior:'smooth'})}
async function submitPaymentDetails(){const r=window._currentBooking,last5=$('#last5')?.value.trim();if(!r)return;if(!/^\d{5}$/.test(last5||'')){toast('請輸入 5 碼數字');return}const b=$('#paymentBtn');b.disabled=true;try{const result=await apiRequest('submitPayment',{bookingId:r.bookingId,last5});toast('付款資料已送出');if(result?.bonusHourEligible){const msg=`您好 我已完成 BabyFat 全日課程匯款\n預約編號 ${r.bookingId}\n匯款末五碼 ${last5}\n申請 24H 免費延時 1 小時`;setTimeout(()=>{if(confirm('這筆全日課符合 24H 延時申請條件。現在開啟 LINE 回傳付款資訊嗎？'))window.open(lineChatUrl(msg),'_blank','noopener')},250)}$('#lookupQuery').value=r.bookingId;await lookupBooking()}catch(e){toast(e.message)}finally{b.disabled=false}}

function setupCooperation(){const form=$('#coopForm');if(!form||form.dataset.ready)return;form.dataset.ready='1';$$('[data-partner-type]').forEach(b=>b.addEventListener('click',()=>{const type=b.dataset.partnerType;$$('[data-partner-type]').forEach(x=>x.classList.toggle('active',x===b));$$('.partner-panel').forEach(x=>x.classList.toggle('active',x.dataset.panel===type));form.dataset.type=type}));const requested=new URLSearchParams(location.search).get('type');if(requested==='business')$('[data-partner-type="business"]')?.click();$('#coopSubmit')?.addEventListener('click',submitCooperation)}
async function submitCooperation(){const form=$('#coopForm'),type=form.dataset.type||'coach';const q=id=>$('#'+id)?.value.trim()||'';const base={type,name:q('coopName'),organization:q('coopOrg'),phone:q('coopPhone'),email:q('coopEmail'),line:q('coopLine'),message:q('coopMessage'),source:'website'};if(!base.name||!base.email){toast('請填寫姓名與 Email');return}const payload=type==='coach'?{...base,boards:q('coopBoards'),regions:q('coopRegions'),experience:q('coopExp'),certificates:q('coopCert'),availability:q('coopAvail'),social:q('coopSocial')}:{...base,industry:q('coopIndustry'),website:q('coopWebsite'),offer:q('coopOffer'),need:q('coopNeed')};const b=$('#coopSubmit');b.disabled=true;try{const r=await apiRequest('createPartnership',payload);form.classList.add('hidden');const s=$('#coopSuccess');s.classList.add('show');s.innerHTML=`<div class="eyebrow">PARTNERSHIP</div><h3>${escapeHtml(r.partnershipId)}</h3><p>合作資料已送出 我們會依內容聯絡你</p>`}catch(e){toast(e.message==='BACKEND_NOT_CONFIGURED'?'合作後台尚未連線':e.message)}finally{b.disabled=false}}

function setupSystemCheck(){if(!$('#systemCheckBtn'))return;$('#systemCheckBtn').addEventListener('click',async()=>{const s=$('#systemStatus');s.textContent='檢查中';try{const r=await apiRequest('health',{});s.textContent='已連線';$('#systemSheet').textContent=`${r.backend||'Cloudflare D1'} · ${r.bookings||0} 筆預約`;$('#systemSeason').textContent='V'+(r.version||'8.1')}catch(e){s.textContent='未連線';$('#systemSheet').textContent=e.message}})}
