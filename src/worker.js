// BabyFat V8.2.1 — Cloudflare Worker + D1
// D1 is the transaction source of truth. Google Sheets is a mirrored operating backend.

const DEFAULTS = {
  SEASON_START: "2026-12-15",
  SEASON_END: "2027-04-30",
  PAYMENT_HOURS: "24",
  YUZAWA_GROUP_HALF: "2500",
  YUZAWA_GROUP_FULL: "4000",
  YUZAWA_PRIVATE_HALF: "10000",
  YUZAWA_PRIVATE_FULL: "15000",
  YUZAWA_SHARE_HALF: "8000",
  YUZAWA_SHARE_FULL: "13000",
  YUZAWA_DUAL_COACH_HALF: "10000",
  YUZAWA_DUAL_COACH_FULL: "15000",
  KARUIZAWA_GROUP_HALF: "3000",
  KARUIZAWA_GROUP_FULL: "4500",
  KARUIZAWA_PRIVATE_HALF: "12000",
  KARUIZAWA_PRIVATE_FULL: "17000",
  KARUIZAWA_SHARE_HALF: "10000",
  KARUIZAWA_SHARE_FULL: "15000",
  KARUIZAWA_DUAL_COACH_HALF: "12000",
  KARUIZAWA_DUAL_COACH_FULL: "17000",
  PRIVATE_EXTRA_PERSON: "1000",
  EARLY_LOW_START: "2026-12-15",
  EARLY_LOW_END: "2027-01-05",
  PEAK_START: "2027-01-06",
  PEAK_END: "2027-03-05",
  TAIL_LOW_START: "2027-03-06",
  TAIL_LOW_END: "2027-04-30",
  STAY_ROOM_TWD: "6500",
  PHOTO_TWD: "13000",
  SHUTTLE_KANDATSU_JPY: "3500",
  SHUTTLE_IWAPPARA_JPY: "5000",
  SHUTTLE_ISHIUCHI_JPY: "6000",
  BANK_NAME: "",
  BANK_CODE: "",
  BANK_ACCOUNT: "",
  BANK_HOLDER: "",
  CONTACT_EMAIL: "mangowalkers@gmail.com",
  CONTACT_PHONE: "0913172857",
  LINE_ID: "@572opdeh",
  INSTAGRAM_URL: "https://www.instagram.com/babyfat_snowteam/",
  FACEBOOK_URL: "https://www.facebook.com/search/top?q=BabyFat%E9%9B%AA%E8%83%96%E6%95%99%E7%B7%B4%E5%9C%98"
};

const ALLOWED_STATUS = new Set([
  "PENDING_REVIEW","PENDING_PAYMENT","PAYMENT_REVIEW","CONFIRMED","EXPIRED","CANCELLED"
]);
const ALLOWED_PAY_STATUS = new Set(["PENDING","REVIEWING","PAID","EXPIRED"]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, ctx, url);
      } catch (err) {
        console.error("BabyFat API error", err);
        const status = Number(err?.status || 500);
        const body = {ok:false,error:String(err?.message || "SERVER_ERROR")};
        if (err?.authDebug) body.authDebug = err.authDebug;
        return json(body, status);
      }
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(expireBookings(env));
    ctx.waitUntil(flushSyncQueue(env, 30));
  }
};

async function handleApi(request, env, ctx, url) {
  const path = url.pathname;
  if (request.method === "OPTIONS") return new Response(null,{status:204});

  if (path === "/api/health" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings").first();
    return json({ok:true,data:{backend:"Cloudflare D1",bookings:Number(row?.n||0),version:"8.2.1"}});
  }

  if (path === "/api/config" && request.method === "GET") {
    return json({ok:true,data:await publicConfig(env)});
  }

  if (path === "/api/bookings" && request.method === "POST") {
    const payload = await readJson(request);
    const data = await createBooking(env, payload);
    ctx.waitUntil(flushSyncQueue(env, 5));
    return json({ok:true,data}, 201);
  }

  if (path === "/api/bookings/lookup" && request.method === "GET") {
    const q = clean(url.searchParams.get("q"), 180);
    return json({ok:true,data:await lookupBookings(env,q)});
  }

  if (path === "/api/payments" && request.method === "POST") {
    const payload = await readJson(request);
    const data = await submitPayment(env,payload);
    ctx.waitUntil(flushSyncQueue(env, 5));
    return json({ok:true,data});
  }

  if (path === "/api/partnerships" && request.method === "POST") {
    const payload = await readJson(request);
    const data = await createPartnership(env,payload);
    ctx.waitUntil(flushSyncQueue(env, 5));
    return json({ok:true,data},201);
  }

  // Authenticated bridge from Google Sheets -> D1.
  if (path.startsWith("/api/internal/")) {
    requireSyncAuth(request, env);

    if (path === "/api/internal/settings-sync" && request.method === "POST") {
      const payload = await readJson(request);
      await syncSettingsFromSheet(env,payload);
      return json({ok:true,data:{synced:true}});
    }

    if (path === "/api/internal/booking-update" && request.method === "POST") {
      const payload = await readJson(request);
      const data = await upsertBookingFromSheet(env,payload.booking||payload);
      return json({ok:true,data});
    }

    if (path === "/api/internal/import-sheet" && request.method === "POST") {
      const payload = await readJson(request);
      const bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
      const participants = Array.isArray(payload.participants) ? payload.participants : [];
      let count = 0;
      for (const b of bookings) {
        await upsertBookingFromSheet(env,b);
        count++;
      }
      const byBooking = new Map();
      for (const p of participants) {
        const id = String(p.booking_id||"");
        if (!id) continue;
        if (!byBooking.has(id)) byBooking.set(id,[]);
        byBooking.get(id).push(p);
      }
      for (const [bookingId, rows] of byBooking.entries()) {
        await replaceParticipants(env,bookingId,rows);
      }
      return json({ok:true,data:{bookings:count,participants:participants.length}});
    }


    if (path === "/api/internal/pull-bookings" && request.method === "POST") {
      const payload = await readJson(request);
      const limit = Math.max(1, Math.min(500, Math.floor(num(payload.limit, 200))));
      const updatedAfter = clean(payload.updatedAfter, 40);
      const data = await pullBookingsForSheet(env, updatedAfter, limit);
      return json({ok:true,data});
    }

    if (path === "/api/internal/sync-status" && request.method === "POST") {
      const counts = await env.DB.prepare(`
        SELECT status, COUNT(*) AS n
        FROM sync_queue
        GROUP BY status
      `).all();
      const recent = await env.DB.prepare(`
        SELECT id,entity_type,ref_id,status,attempts,next_attempt_at,last_error,updated_at
        FROM sync_queue
        ORDER BY id DESC
        LIMIT 20
      `).all();
      return json({ok:true,data:{
        counts:counts.results||[],
        recent:recent.results||[]
      }});
    }

    return json({ok:false,error:"INTERNAL_ROUTE_NOT_FOUND"},404);
  }

  return json({ok:false,error:"NOT_FOUND"},404);
}

function requireSyncAuth(request, env) {
  const expectedRaw = String(env.SHEET_SYNC_TOKEN ?? "");
  const gotRaw = String(request.headers.get("X-BabyFat-Sync") ?? "");
  const expected = expectedRaw.trim();
  const got = gotRaw.trim();

  if (!expected) {
    const e = new Error("AUTH_SECRET_MISSING");
    e.status = 401;
    e.authDebug = {
      secretPresent:false,
      headerPresent:!!got,
      expectedLength:0,
      receivedLength:got.length
    };
    throw e;
  }

  if (!got) {
    const e = new Error("AUTH_HEADER_MISSING");
    e.status = 401;
    e.authDebug = {
      secretPresent:true,
      headerPresent:false,
      expectedLength:expected.length,
      receivedLength:0
    };
    throw e;
  }

  if (got !== expected) {
    const e = new Error("AUTH_TOKEN_MISMATCH");
    e.status = 401;
    e.authDebug = {
      secretPresent:true,
      headerPresent:true,
      expectedLength:expected.length,
      receivedLength:got.length,
      expectedWhitespaceTrimmed:expectedRaw.length !== expected.length,
      receivedWhitespaceTrimmed:gotRaw.length !== got.length
    };
    throw e;
  }
}

async function readJson(request) {
  const type = request.headers.get("content-type")||"";
  if (!type.includes("application/json")) {
    const e = new Error("JSON_REQUIRED"); e.status=415; throw e;
  }
  try { return await request.json(); }
  catch { const e=new Error("INVALID_JSON"); e.status=400; throw e; }
}

function json(body,status=200) {
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "x-content-type-options":"nosniff"
    }
  });
}

function clean(v,max=500){ return String(v??"").trim().slice(0,max); }
function bool(v){ return v===true || v===1 || v==="1" || String(v).toLowerCase()==="true"; }
function num(v,fallback=0){ const n=Number(v); return Number.isFinite(n)?n:fallback; }
function isoNow(){ return new Date().toISOString(); }
function emailNorm(v){ return clean(v,180).toLowerCase(); }
function safeDateOnly(v){
  const s=clean(v,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s;
}
function bookingId(lessonDate){
  const d=(safeDateOnly(lessonDate)||new Date().toISOString().slice(0,10)).replace(/-/g,"").slice(2);
  const bytes=new Uint8Array(5);crypto.getRandomValues(bytes);
  return "BF-"+d+"-"+[...bytes].map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
}
function partnershipId(){
  const d=new Date().toISOString().slice(2,10).replace(/-/g,"");
  const bytes=new Uint8Array(4);crypto.getRandomValues(bytes);
  return "BP-"+d+"-"+[...bytes].map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
}

let settingsCache = {at:0,data:null};
async function getSettings(env){
  if(settingsCache.data && Date.now()-settingsCache.at<15000) return settingsCache.data;
  const out={...DEFAULTS};
  const rows=await env.DB.prepare("SELECT key,value FROM settings").all();
  for(const r of (rows.results||[])) if(r.key) out[String(r.key)]=String(r.value??"");
  settingsCache={at:Date.now(),data:out};
  return out;
}
function clearSettingsCache(){settingsCache={at:0,data:null};}

async function publicConfig(env){
  const s=await getSettings(env);
  return {
    seasonStart:s.SEASON_START,
    seasonEnd:s.SEASON_END,
    paymentHours:num(s.PAYMENT_HOURS,24),
    seasonPhases:[
      {key:"early_low",label:"早鳥淡季",start:s.EARLY_LOW_START,end:s.EARLY_LOW_END},
      {key:"peak",label:"旺季",start:s.PEAK_START,end:s.PEAK_END},
      {key:"tail_low",label:"尾聲淡季",start:s.TAIL_LOW_START,end:s.TAIL_LOW_END}
    ],
    privateExtraPerson:num(s.PRIVATE_EXTRA_PERSON,1000),
    prices:{
      yuzawa:{
        groupHalf:num(s.YUZAWA_GROUP_HALF,2500),groupFull:num(s.YUZAWA_GROUP_FULL,4000),
        shareHalf:num(s.YUZAWA_SHARE_HALF,8000),shareFull:num(s.YUZAWA_SHARE_FULL,13000),
        privateHalf:num(s.YUZAWA_PRIVATE_HALF,10000),privateFull:num(s.YUZAWA_PRIVATE_FULL,15000),
        dualCoachHalf:num(s.YUZAWA_DUAL_COACH_HALF,10000),dualCoachFull:num(s.YUZAWA_DUAL_COACH_FULL,15000)
      },
      karuizawa:{
        groupHalf:num(s.KARUIZAWA_GROUP_HALF,3000),groupFull:num(s.KARUIZAWA_GROUP_FULL,4500),
        shareHalf:num(s.KARUIZAWA_SHARE_HALF,10000),shareFull:num(s.KARUIZAWA_SHARE_FULL,15000),
        privateHalf:num(s.KARUIZAWA_PRIVATE_HALF,12000),privateFull:num(s.KARUIZAWA_PRIVATE_FULL,17000),
        dualCoachHalf:num(s.KARUIZAWA_DUAL_COACH_HALF,12000),dualCoachFull:num(s.KARUIZAWA_DUAL_COACH_FULL,17000)
      }
    },
    stayRoomTwd:num(s.STAY_ROOM_TWD,6500),
    photoTwd:num(s.PHOTO_TWD,13000),
    shuttle:{
      none:0,station:0,naeba:0,tashiro:0,kagura:0,
      kandatsu:num(s.SHUTTLE_KANDATSU_JPY,3500),
      iwappara:num(s.SHUTTLE_IWAPPARA_JPY,5000),
      ishiuchi:num(s.SHUTTLE_ISHIUCHI_JPY,6000)
    },
    contact:{
      email:s.CONTACT_EMAIL||DEFAULTS.CONTACT_EMAIL,
      phone:s.CONTACT_PHONE||DEFAULTS.CONTACT_PHONE,
      lineId:s.LINE_ID||DEFAULTS.LINE_ID,
      instagramUrl:s.INSTAGRAM_URL||DEFAULTS.INSTAGRAM_URL,
      facebookUrl:s.FACEBOOK_URL||DEFAULTS.FACEBOOK_URL
    }
  };
}

function seasonPhase(date,s){
  const d=safeDateOnly(date);
  if(d>=s.EARLY_LOW_START&&d<=s.EARLY_LOW_END)return "early_low";
  if(d>=s.PEAK_START&&d<=s.PEAK_END)return "peak";
  if(d>=s.TAIL_LOW_START&&d<=s.TAIL_LOW_END)return "tail_low";
  return "";
}
function seasonPhaseLabel(v){return ({early_low:"早鳥淡季",peak:"旺季",tail_low:"尾聲淡季"}[v]||"")}


async function ensureBookingDaysTable(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS booking_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL,
      lesson_date TEXT NOT NULL,
      duration TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      assigned_coach TEXT DEFAULT '',
      second_coach TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(booking_id, lesson_date)
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_booking_days_date ON booking_days(lesson_date)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_booking_days_booking ON booking_days(booking_id)").run();
}

function normalizeLessonDates(p,s){
  let arr=Array.isArray(p.lessonDates)?p.lessonDates:[p.lessonDate];
  arr=[...new Set(arr.map(x=>safeDateOnly(x)).filter(Boolean))].sort();
  if(!arr.length){const e=new Error("MISSING_LESSON_DATES");e.status=400;throw e;}
  if(arr.length>10){const e=new Error("TOO_MANY_LESSON_DAYS");e.status=400;throw e;}
  for(const d of arr){
    if(d<s.SEASON_START || d>s.SEASON_END){const e=new Error("OUTSIDE_SEASON");e.status=400;throw e;}
  }
  return arr;
}

async function lessonDatesForBooking(env,bookingId,fallbackDate){
  await ensureBookingDaysTable(env);
  const rs=await env.DB.prepare(
    "SELECT lesson_date FROM booking_days WHERE booking_id=? AND status='ACTIVE' ORDER BY lesson_date"
  ).bind(bookingId).all();
  const arr=(rs.results||[]).map(x=>String(x.lesson_date||"")).filter(Boolean);
  return arr.length?arr:(fallbackDate?[String(fallbackDate)]:[]);
}

async function replaceBookingDays(env,bookingId,lessonDates,duration,timeSlot,createdAt,updatedAt){
  await ensureBookingDaysTable(env);
  await env.DB.prepare("DELETE FROM booking_days WHERE booking_id=?").bind(bookingId).run();
  if(!lessonDates.length)return;
  const now=updatedAt||isoNow();
  const created=createdAt||now;
  const stmts=lessonDates.map(d=>env.DB.prepare(`
    INSERT INTO booking_days
      (booking_id,lesson_date,duration,time_slot,assigned_coach,second_coach,status,created_at,updated_at)
    VALUES (?,?,?,?,?,'','ACTIVE',?,?)
  `).bind(bookingId,d,duration,timeSlot,'',created,now));
  await env.DB.batch(stmts);
}

function validateBooking(p,s){
  const required=["contactName","phone","email","line","region","board","course","duration","timeSlot","partyType"];
  for(const k of required) if(!clean(p[k])) {const e=new Error("MISSING_"+k.toUpperCase());e.status=400;throw e;}
  if(!bool(p.lineJoined)){const e=new Error("LINE_NOT_CONFIRMED");e.status=400;throw e;}
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(p.email,180))){const e=new Error("INVALID_EMAIL");e.status=400;throw e;}
  const phone=clean(p.phone,40).replace(/[^\d+]/g,"");
  if(phone.replace(/\D/g,"").length<8){const e=new Error("INVALID_PHONE");e.status=400;throw e;}
  const region=clean(p.region,20),board=clean(p.board,20),course=clean(p.course,20),duration=clean(p.duration,20),partyType=clean(p.partyType,20);
  if(!["yuzawa","karuizawa"].includes(region)){const e=new Error("INVALID_REGION");e.status=400;throw e;}
  if(!["ski","snowboard"].includes(board)){const e=new Error("INVALID_BOARD");e.status=400;throw e;}
  if(!["group","share","private","dual"].includes(course)){const e=new Error("INVALID_COURSE");e.status=400;throw e;}
  if(!["half","full"].includes(duration)){const e=new Error("INVALID_DURATION");e.status=400;throw e;}
  if(!["adult","family"].includes(partyType)){const e=new Error("INVALID_PARTY_TYPE");e.status=400;throw e;}
  const people=Math.floor(num(p.people,1));
  if(people<1||people>8){const e=new Error("CONTACT_FOR_LARGE_GROUP");e.status=400;throw e;}
  if(partyType==="family" && ["group","share"].includes(course)){const e=new Error("FAMILY_PRIVATE_ONLY");e.status=400;throw e;}
  if(course==="group" && people>5){const e=new Error("GROUP_MAX_5");e.status=400;throw e;}
  if(course==="share" && people>2){const e=new Error("SHARE_MAX_2_INITIAL");e.status=400;throw e;}
  if(course==="private" && people>6){const e=new Error("PRIVATE_MAX_6");e.status=400;throw e;}
  if(course==="dual" && (people<5||people>8)){const e=new Error("DUAL_5_TO_8");e.status=400;throw e;}
  normalizeLessonDates(p,s);
  if(!bool(p.termsConsent)||!bool(p.privacyConsent)){const e=new Error("CONSENT_REQUIRED");e.status=400;throw e;}
}

function calculate(p,s){
  const people=Math.floor(num(p.people,1));
  const region=clean(p.region,20).toUpperCase();
  const course=clean(p.course,20);
  const duration=clean(p.duration,20).toUpperCase();
  const basePrivate=num(s[`${region}_PRIVATE_${duration}`],0);
  const extra=Math.max(0,people-3)*num(s.PRIVATE_EXTRA_PERSON,1000);
  let dailyTuition=0,coachCount=1;
  if(course==="group") dailyTuition=num(s[`${region}_GROUP_${duration}`],0)*people;
  else if(course==="share") dailyTuition=num(s[`${region}_SHARE_${duration}`],0);
  else if(course==="private") dailyTuition=basePrivate+extra;
  else if(course==="dual"){
    coachCount=2;
    dailyTuition=basePrivate+extra+num(s[`${region}_DUAL_COACH_${duration}`],basePrivate);
  }
  const lessonDates=normalizeLessonDates(p,s);
  const dayCount=lessonDates.length;
  const tuition=dailyTuition*dayCount;
  const stay=bool(p.stay);
  const nights=stay?Math.max(1,Math.floor(num(p.nights,1))):0;
  const rooms=stay?Math.max(1,Math.floor(num(p.rooms,1))):0;
  const stayTwd=stay*num(s.STAY_ROOM_TWD,6500)*nights*rooms;
  const photo=bool(p.photo);
  const photoTwd=photo?num(s.PHOTO_TWD,13000):0;
  const shuttle=clean(p.shuttle||"none",30);
  const shuttleMap={none:0,station:0,naeba:0,tashiro:0,kagura:0,kandatsu:num(s.SHUTTLE_KANDATSU_JPY,3500),iwappara:num(s.SHUTTLE_IWAPPARA_JPY,5000),ishiuchi:num(s.SHUTTLE_ISHIUCHI_JPY,6000)};
  return {people,tuition,dailyTuition,lessonDates,dayCount,coachCount,nights,rooms,stayTwd,photoTwd,shuttle,shuttleJpy:shuttleMap[shuttle]||0,totalTwd:tuition+stayTwd+photoTwd};
}

async function createBooking(env,p){
  const s=await getSettings(env);
  validateBooking(p,s);
  await ensureBookingDaysTable(env);
  const lessonDates=normalizeLessonDates(p,s);
  const requestKey=clean(p.requestKey,120);
  if(requestKey){
    const existing=await env.DB.prepare("SELECT * FROM bookings WHERE request_key=?").bind(requestKey).first();
    if(existing){
      const days=await lessonDatesForBooking(env,existing.booking_id,existing.lesson_date);
      return bookingPublic(existing,s,days);
    }
  }

  const c=calculate({...p,lessonDates},s),now=isoNow(),id=bookingId(lessonDates[0]);
  const hasAddon=bool(p.stay)||bool(p.photo)||c.shuttle!=="none";
  const status=hasAddon?"PENDING_REVIEW":"PENDING_PAYMENT";
  const deadline=hasAddon?null:new Date(Date.now()+num(s.PAYMENT_HOURS,24)*3600000).toISOString();
  const course=clean(p.course,20),duration=clean(p.duration,20);
  const row={
    booking_id:id,request_key:requestKey||null,created_at:now,updated_at:now,
    booking_status:status,payment_status:"PENDING",payment_deadline:deadline,payment_submitted_at:null,payment_last5:null,paid_at:null,
    contact_name:clean(p.contactName,120),phone:clean(p.phone,50),email:clean(p.email,180),email_norm:emailNorm(p.email),line_name:clean(p.line,120),line_id:clean(p.lineId,120),line_joined:1,line_contact_status:"PENDING_CONFIRMATION",
    region:clean(p.region,20),resort:clean(p.resort,120),lesson_date:lessonDates[0],board:clean(p.board,20),course,duration,time_slot:clean(p.timeSlot,30),people_count:c.people,tuition_twd:c.tuition,
    stay_requested:bool(p.stay)?1:0,stay_nights:c.nights,stay_rooms:c.rooms,stay_twd:c.stayTwd,stay_status:bool(p.stay)?"REQUESTED":"NOT_REQUESTED",
    photo_requested:bool(p.photo)?1:0,photo_twd:c.photoTwd,photo_status:bool(p.photo)?"REQUESTED":"NOT_REQUESTED",
    shuttle:c.shuttle,shuttle_jpy:c.shuttleJpy,shuttle_status:c.shuttle!=="none"?"REQUESTED":"NOT_REQUESTED",
    total_twd:c.totalTwd,needs_review:hasAddon?1:0,assigned_coach:null,notes:clean(p.notes,1500),privacy_consent:1,terms_consent:1,source:"website",sync_status:"PENDING",
    party_type:clean(p.partyType,20),season_phase:seasonPhase(lessonDates[0],s),coach_count:c.coachCount,
    share_status:course==="share"?"AVAILABLE":"NOT_APPLICABLE",share_group_id:null,
    bonus_hour_eligible:0,bonus_hour_status:duration==="full"?"PENDING_PAYMENT":"NOT_APPLICABLE"
  };

  const cols=[
    "booking_id","request_key","created_at","updated_at","booking_status","payment_status","payment_deadline","payment_submitted_at","payment_last5","paid_at",
    "contact_name","phone","email","email_norm","line_name","line_id","line_joined","line_contact_status","region","resort","lesson_date","board","course","duration","time_slot","people_count","tuition_twd",
    "stay_requested","stay_nights","stay_rooms","stay_twd","stay_status","photo_requested","photo_twd","photo_status","shuttle","shuttle_jpy","shuttle_status",
    "total_twd","needs_review","assigned_coach","notes","privacy_consent","terms_consent","source","sync_status",
    "party_type","season_phase","coach_count","share_status","share_group_id","bonus_hour_eligible","bonus_hour_status"
  ];
  try{
    const values=cols.map(k=>row[k]===undefined?null:row[k]);
    await env.DB.prepare(`INSERT INTO bookings (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).bind(...values).run();
  }catch(err){
    if(requestKey){
      const existing=await env.DB.prepare("SELECT * FROM bookings WHERE request_key=?").bind(requestKey).first();
      if(existing){
        const days=await lessonDatesForBooking(env,existing.booking_id,existing.lesson_date);
        return bookingPublic(existing,s,days);
      }
    }
    throw err;
  }

  await replaceBookingDays(env,id,lessonDates,duration,clean(p.timeSlot,30),now,now);

  const participants=Array.isArray(p.participants)?p.participants.slice(0,c.people):[];
  if(participants.length){
    const statements=participants.map((x,i)=>env.DB.prepare("INSERT INTO participants (booking_id,participant_no,name,age,level,notes,created_at) VALUES (?,?,?,?,?,?,?)").bind(id,i+1,clean(x.name,120),clean(x.age,20),clean(x.level,50),clean(x.notes,500),now));
    await env.DB.batch(statements);
  }
  const syncPayload={...row,lesson_dates:lessonDates.join(","),lesson_days_count:lessonDates.length,participants:participants.map((x,i)=>({booking_id:id,participant_no:i+1,name:clean(x.name,120),age:clean(x.age,20),level:clean(x.level,50),notes:clean(x.notes,500),created_at:now}))};
  await enqueueSync(env,"booking",id,syncPayload);
  const stored=await env.DB.prepare("SELECT * FROM bookings WHERE booking_id=?").bind(id).first();
  return bookingPublic(stored,s,lessonDates);
}

async function lookupBookings(env,q){
  q=clean(q,180);
  if(!q){const e=new Error("LOOKUP_REQUIRED");e.status=400;throw e;}
  const s=await getSettings(env);
  let rows=[];
  if(q.includes("@") && !/^BF-/i.test(q)){
    const rs=await env.DB.prepare("SELECT * FROM bookings WHERE email_norm=? ORDER BY created_at DESC LIMIT 20").bind(emailNorm(q)).all();
    rows=rs.results||[];
  }else{
    const one=await env.DB.prepare("SELECT * FROM bookings WHERE UPPER(booking_id)=UPPER(?) LIMIT 1").bind(q).first();
    if(one) rows=[one];
  }
  if(!rows.length){const e=new Error("NOT_FOUND");e.status=404;throw e;}
  const out=[];
  for(const r of rows){
    const days=await lessonDatesForBooking(env,r.booking_id,r.lesson_date);
    out.push(bookingPublic(r,s,days));
  }
  return {mode:rows.length>1?"multiple":"single",bookings:out};
}

async function submitPayment(env,p){
  const bookingId=clean(p.bookingId,80),last5=clean(p.last5,5);
  if(!bookingId||!/^\d{5}$/.test(last5)){const e=new Error("INVALID_PAYMENT_DATA");e.status=400;throw e;}
  const row=await env.DB.prepare("SELECT * FROM bookings WHERE booking_id=?").bind(bookingId).first();
  if(!row){const e=new Error("NOT_FOUND");e.status=404;throw e;}
  if(row.booking_status==="PENDING_REVIEW"){const e=new Error("WAIT_FOR_SERVICE_CONFIRMATION");e.status=409;throw e;}
  if(["EXPIRED","CANCELLED"].includes(row.booking_status)){const e=new Error("BOOKING_NOT_ACTIVE");e.status=409;throw e;}
  if(row.payment_deadline&&Date.parse(row.payment_deadline)<Date.now()){
    await env.DB.prepare("UPDATE bookings SET booking_status='EXPIRED',payment_status='EXPIRED',updated_at=? WHERE booking_id=?").bind(isoNow(),bookingId).run();
    const e=new Error("PAYMENT_DEADLINE_EXPIRED");e.status=409;throw e;
  }
  const now=isoNow();
  const bonusEligible=row.duration==="full" && (!row.payment_deadline || Date.parse(now)<=Date.parse(row.payment_deadline));
  await env.DB.prepare("UPDATE bookings SET payment_status='REVIEWING',booking_status='PAYMENT_REVIEW',payment_last5=?,payment_submitted_at=?,bonus_hour_eligible=?,bonus_hour_status=?,updated_at=?,sync_status='PENDING' WHERE booking_id=?")
    .bind(last5,now,bonusEligible?1:0,bonusEligible?"LINE_CONFIRM_REQUIRED":"NOT_APPLICABLE",now,bookingId).run();
  await env.DB.prepare("INSERT INTO payments (booking_id,last5,submitted_at,status) VALUES (?,?,?,'REVIEWING')").bind(bookingId,last5,now).run();
  const updated=await env.DB.prepare("SELECT * FROM bookings WHERE booking_id=?").bind(bookingId).first();
  await enqueueSync(env,"payment",bookingId,updated);
  return {bookingId,status:"PAYMENT_REVIEW",bonusHourEligible:bonusEligible,bonusHourStatus:bonusEligible?"LINE_CONFIRM_REQUIRED":"NOT_APPLICABLE"};
}

async function createPartnership(env,p){
  const name=clean(p.name,120), email=clean(p.email,180);
  if(!name||!email){const e=new Error("NAME_EMAIL_REQUIRED");e.status=400;throw e;}
  const id=partnershipId(), now=isoNow();
  const row={
    partnership_id:id,created_at:now,updated_at:now,type:clean(p.type||"coach",30),name,
    organization:clean(p.organization,160),phone:clean(p.phone,50),email,line:clean(p.line,120),
    boards:clean(p.boards,200),regions:clean(p.regions,200),experience:clean(p.experience,500),
    certificates:clean(p.certificates,500),availability:clean(p.availability,500),social:clean(p.social,500),
    industry:clean(p.industry,200),website:clean(p.website,500),offer:clean(p.offer,1000),need:clean(p.need,1000),
    message:clean(p.message,1500),status:"NEW",owner:"",sync_status:"PENDING"
  };
  await env.DB.prepare(`INSERT INTO partnerships (
    partnership_id,created_at,updated_at,type,name,organization,phone,email,line,boards,regions,experience,certificates,availability,social,
    industry,website,offer,need,message,status,owner,sync_status
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(row.partnership_id,row.created_at,row.updated_at,row.type,row.name,row.organization,row.phone,row.email,row.line,row.boards,row.regions,row.experience,row.certificates,row.availability,row.social,row.industry,row.website,row.offer,row.need,row.message,row.status,row.owner,row.sync_status).run();
  await enqueueSync(env,"partnership",id,row);
  return {partnershipId:id};
}

function bookingPublic(b,s,lessonDates){
  const status=String(b.booking_status||"");
  const exposeBank=["PENDING_PAYMENT","PAYMENT_REVIEW","CONFIRMED"].includes(status);
  const labels={group:"初雪萌新小團班",share:"你好同學班",private:"獨自升級專屬包班",dual:"雙教練專屬包班"};
  return {
    bookingId:String(b.booking_id||""),bookingStatus:status,paymentStatus:String(b.payment_status||""),paymentDeadline:b.payment_deadline||"",email:String(b.email||""),
    region:String(b.region||""),regionLabel:b.region==="karuizawa"?"輕井澤":"越後湯澤",resort:String(b.resort||""),lessonDate:String(b.lesson_date||""),lessonDates:Array.isArray(lessonDates)&&lessonDates.length?lessonDates:[String(b.lesson_date||"")].filter(Boolean),lessonDaysCount:Array.isArray(lessonDates)&&lessonDates.length?lessonDates.length:(b.lesson_date?1:0),
    seasonPhase:String(b.season_phase||""),seasonPhaseLabel:seasonPhaseLabel(b.season_phase),partyType:String(b.party_type||"adult"),partyTypeLabel:b.party_type==="family"?"親子／含兒童":"成人同行",
    board:String(b.board||""),boardLabel:b.board==="snowboard"?"單板 Snowboard":"雙板 Ski",course:String(b.course||""),courseLabel:labels[b.course]||String(b.course||""),
    duration:String(b.duration||""),timeSlot:String(b.time_slot||""),timeSlotLabel:slotLabel(b.time_slot,b.duration),peopleCount:Number(b.people_count||0),coachCount:Number(b.coach_count||1),
    totalTwd:Number(b.total_twd||0),shareStatus:String(b.share_status||""),shareGroupId:String(b.share_group_id||""),
    bonusHourEligible:!!b.bonus_hour_eligible,bonusHourStatus:String(b.bonus_hour_status||""),
    stayRequested:!!b.stay_requested,stayNights:Number(b.stay_nights||0),stayRooms:Number(b.stay_rooms||0),stayStatus:String(b.stay_status||""),
    photoRequested:!!b.photo_requested,photoStatus:String(b.photo_status||""),shuttle:String(b.shuttle||"none"),shuttleJpy:Number(b.shuttle_jpy||0),shuttleStatus:String(b.shuttle_status||""),assignedCoach:String(b.assigned_coach||""),
    bank:exposeBank?{bankName:String(s.BANK_NAME||""),bankCode:String(s.BANK_CODE||""),account:String(s.BANK_ACCOUNT||""),holder:String(s.BANK_HOLDER||"")}:null
  };
}

function slotLabel(slot,duration){
  if(duration==="full"||slot==="FULL")return "09:30–15:30 含用餐";
  return slot==="PM"?"13:00–16:00":"09:00–12:00";
}

async function enqueueSync(env,type,refId,payload){
  const now=isoNow();
  await env.DB.prepare("INSERT INTO sync_queue (entity_type,ref_id,payload,status,attempts,next_attempt_at,created_at,updated_at) VALUES (?,?,?,'PENDING',0,?,?,?)")
    .bind(type,refId,JSON.stringify(payload),now,now,now).run();
}

async function flushSyncQueue(env,limit=20){
  if(!env.GAS_SYNC_URL || !env.SHEET_SYNC_TOKEN) return;
  const now=isoNow();
  const rs=await env.DB.prepare("SELECT * FROM sync_queue WHERE status!='SYNCED' AND next_attempt_at<=? AND attempts<20 ORDER BY id ASC LIMIT ?").bind(now,limit).all();
  for(const item of (rs.results||[])){
    try{
      const body=new URLSearchParams({
        action:"syncFromD1",
        token:String(env.SHEET_SYNC_TOKEN),
        entity:String(item.entity_type),
        payload:String(item.payload)
      });
      const res=await fetch(String(env.GAS_SYNC_URL),{
        method:"POST",
        headers:{"content-type":"application/x-www-form-urlencoded;charset=UTF-8"},
        body:body.toString(),
        redirect:"follow"
      });
      const text=await res.text();
      let ok=res.ok;
      try{const parsed=JSON.parse(text);ok=ok&&parsed.ok===true}catch{}
      if(!ok)throw new Error("GAS_SYNC_FAILED_"+res.status);
      await env.DB.prepare("UPDATE sync_queue SET status='SYNCED',attempts=attempts+1,updated_at=?,last_error=NULL WHERE id=?").bind(isoNow(),item.id).run();
      if(item.entity_type==="booking"||item.entity_type==="payment"){
        await env.DB.prepare("UPDATE bookings SET sync_status='SYNCED' WHERE booking_id=?").bind(item.ref_id).run();
      }else if(item.entity_type==="partnership"){
        await env.DB.prepare("UPDATE partnerships SET sync_status='SYNCED' WHERE partnership_id=?").bind(item.ref_id).run();
      }
    }catch(err){
      const attempts=Number(item.attempts||0)+1;
      const delay=Math.min(3600,Math.pow(2,Math.min(attempts,8))*30);
      const next=new Date(Date.now()+delay*1000).toISOString();
      await env.DB.prepare("UPDATE sync_queue SET status='RETRY',attempts=?,next_attempt_at=?,updated_at=?,last_error=? WHERE id=?")
        .bind(attempts,next,isoNow(),String(err?.message||err).slice(0,800),item.id).run();
    }
  }
}

async function expireBookings(env){
  const now=isoNow();
  const due=await env.DB.prepare(`SELECT booking_id FROM bookings
    WHERE booking_status='PENDING_PAYMENT' AND payment_status='PENDING'
    AND payment_deadline IS NOT NULL AND payment_deadline<? LIMIT 200`).bind(now).all();
  for(const x of (due.results||[])){
    await env.DB.prepare("UPDATE bookings SET booking_status='EXPIRED',payment_status='EXPIRED',updated_at=?,sync_status='PENDING' WHERE booking_id=?")
      .bind(now,x.booking_id).run();
    const row=await env.DB.prepare("SELECT * FROM bookings WHERE booking_id=?").bind(x.booking_id).first();
    if(row)await enqueueSync(env,"payment",x.booking_id,row);
  }
  await flushSyncQueue(env,30);
}


async function pullBookingsForSheet(env,updatedAfter,limit){
  let rows;
  if(updatedAfter){
    rows = await env.DB.prepare(`
      SELECT * FROM bookings
      WHERE updated_at >= ?
      ORDER BY updated_at ASC
      LIMIT ?
    `).bind(updatedAfter,limit).all();
  }else{
    rows = await env.DB.prepare(`
      SELECT * FROM bookings
      ORDER BY updated_at ASC
      LIMIT ?
    `).bind(limit).all();
  }

  const bookings = rows.results || [];
  if(!bookings.length) return {bookings:[],count:0,lastUpdated:""};

  const ids = bookings.map(x=>String(x.booking_id||"")).filter(Boolean);
  let participants = [];
  if(ids.length){
    const placeholders = ids.map(()=>"?").join(",");
    const pr = await env.DB.prepare(`
      SELECT booking_id,participant_no,name,age,level,notes,created_at
      FROM participants
      WHERE booking_id IN (${placeholders})
      ORDER BY booking_id,participant_no
    `).bind(...ids).all();
    participants = pr.results || [];
  }

  const byId = new Map();
  for(const p of participants){
    const id = String(p.booking_id||"");
    if(!byId.has(id)) byId.set(id,[]);
    byId.get(id).push(p);
  }

  await ensureBookingDaysTable(env);
  const daysById=new Map();
  if(ids.length){
    const placeholders = ids.map(()=>"?").join(",");
    const dr=await env.DB.prepare(`
      SELECT booking_id,lesson_date
      FROM booking_days
      WHERE booking_id IN (${placeholders}) AND status='ACTIVE'
      ORDER BY booking_id,lesson_date
    `).bind(...ids).all();
    for(const d of (dr.results||[])){
      const id=String(d.booking_id||"");
      if(!daysById.has(id))daysById.set(id,[]);
      daysById.get(id).push(String(d.lesson_date||""));
    }
  }

  const out = bookings.map(b=>{
    const id=String(b.booking_id||"");
    const dates=(daysById.get(id)||[]);
    const lessonDates=dates.length?dates:[String(b.lesson_date||"")].filter(Boolean);
    return {...b,lesson_dates:lessonDates.join(","),lesson_days_count:lessonDates.length,participants:byId.get(id)||[]};
  });
  return {
    bookings:out,
    count:out.length,
    lastUpdated:String(out[out.length-1]?.updated_at||"")
  };
}

async function syncSettingsFromSheet(env,payload){
  const settings=payload.settings&&typeof payload.settings==="object"?payload.settings:payload;
  const allowed=new Set(Object.keys(DEFAULTS));
  const statements=[];
  for(const [k,v] of Object.entries(settings)){
    if(!allowed.has(k))continue;
    statements.push(env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
      .bind(k,String(v??""),isoNow()));
  }
  if(statements.length)await env.DB.batch(statements);
  clearSettingsCache();
}

function normalizeSheetBooking(b){
  const out={};
  const keys=[
    "booking_id","created_at","updated_at","booking_status","payment_status","payment_deadline","payment_submitted_at","payment_last5","paid_at",
    "contact_name","phone","email","line_name","line_id","line_contact_status","region","resort","lesson_date","lesson_dates","board","course","duration","time_slot","people_count","tuition_twd",
    "stay_requested","stay_nights","stay_rooms","stay_twd","stay_status","photo_requested","photo_twd","photo_status","shuttle","shuttle_jpy","shuttle_status",
    "total_twd","needs_review","assigned_coach","notes","privacy_consent","terms_consent","source",
    "party_type","season_phase","coach_count","share_status","share_group_id","bonus_hour_eligible","bonus_hour_status"
  ];
  for(const k of keys)out[k]=b[k]??null;
  out.booking_id=clean(out.booking_id,80);
  out.email=clean(out.email,180);
  out.email_norm=emailNorm(out.email);
  out.line_id=clean(out.line_id,120);
  out.line_joined=out.line_name?1:0;
  out.line_contact_status=clean(out.line_contact_status||"PENDING_CONFIRMATION",40);
  out.sync_status="SYNCED";
  out.created_at=normalizeDate(out.created_at)||isoNow();
  out.updated_at=normalizeDate(out.updated_at)||isoNow();
  out.lesson_date=normalizeDateOnly(out.lesson_date);
  out.payment_deadline=normalizeDate(out.payment_deadline);
  out.payment_submitted_at=normalizeDate(out.payment_submitted_at);
  out.paid_at=normalizeDate(out.paid_at);
  return out;
}
function normalizeDate(v){
  if(!v)return null;
  const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null;
}
function normalizeDateOnly(v){
  if(!v)return "";
  const s=String(v).slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):"";
}

async function upsertBookingFromSheet(env,b){
  const r=normalizeSheetBooking(b);
  if(!r.booking_id){const e=new Error("BOOKING_ID_REQUIRED");e.status=400;throw e;}
  if(!ALLOWED_STATUS.has(String(r.booking_status||"")))r.booking_status="PENDING_REVIEW";
  if(!ALLOWED_PAY_STATUS.has(String(r.payment_status||"")))r.payment_status="PENDING";
  r.party_type=clean(r.party_type||"adult",20);
  r.season_phase=clean(r.season_phase||"",30);
  r.coach_count=Math.max(1,num(r.coach_count,1));
  r.share_status=clean(r.share_status||(r.course==="share"?"AVAILABLE":"NOT_APPLICABLE"),40);
  r.share_group_id=clean(r.share_group_id||"",80)||null;
  r.bonus_hour_eligible=bool(r.bonus_hour_eligible)?1:0;
  r.bonus_hour_status=clean(r.bonus_hour_status||(r.duration==="full"?"PENDING_PAYMENT":"NOT_APPLICABLE"),50);
  const cols=[
    "booking_id","request_key","created_at","updated_at","booking_status","payment_status","payment_deadline","payment_submitted_at","payment_last5","paid_at",
    "contact_name","phone","email","email_norm","line_name","line_id","line_joined","line_contact_status","region","resort","lesson_date","board","course","duration","time_slot","people_count","tuition_twd",
    "stay_requested","stay_nights","stay_rooms","stay_twd","stay_status","photo_requested","photo_twd","photo_status","shuttle","shuttle_jpy","shuttle_status",
    "total_twd","needs_review","assigned_coach","notes","privacy_consent","terms_consent","source","sync_status",
    "party_type","season_phase","coach_count","share_status","share_group_id","bonus_hour_eligible","bonus_hour_status"
  ];
  const v={...r,request_key:null,email_norm:emailNorm(r.email),line_id:clean(r.line_id,120),line_joined:r.line_name?1:0,line_contact_status:clean(r.line_contact_status||"PENDING_CONFIRMATION",40),sync_status:"SYNCED"};
  const updateCols=cols.filter(k=>!["booking_id","request_key","created_at"].includes(k));
  const sql=`INSERT INTO bookings (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')}) ON CONFLICT(booking_id) DO UPDATE SET ${updateCols.map(k=>`${k}=excluded.${k}`).join(',')},sync_status='SYNCED'`;
  await env.DB.prepare(sql).bind(...cols.map(k=>v[k]===undefined?null:v[k])).run();

  const rawDates=String(r.lesson_dates||"").split(/[，,\n\s]+/).map(x=>normalizeDateOnly(x)).filter(Boolean);
  const lessonDates=[...new Set((rawDates.length?rawDates:[r.lesson_date]).filter(Boolean))].sort().slice(0,10);
  if(lessonDates.length){
    await replaceBookingDays(env,r.booking_id,lessonDates,clean(r.duration,20),clean(r.time_slot,30),r.created_at,r.updated_at);
  }
  return {bookingId:r.booking_id};
}

async function replaceParticipants(env,bookingId,rows){
  bookingId=clean(bookingId,80);
  await env.DB.prepare("DELETE FROM participants WHERE booking_id=?").bind(bookingId).run();
  if(!rows.length)return;
  const statements=rows.slice(0,20).map((p,i)=>env.DB.prepare(
    "INSERT INTO participants (booking_id,participant_no,name,age,level,notes,created_at) VALUES (?,?,?,?,?,?,?)"
  ).bind(bookingId,num(p.participant_no,i+1),clean(p.name,120),clean(p.age,20),clean(p.level,50),clean(p.notes,500),normalizeDate(p.created_at)||isoNow()));
  await env.DB.batch(statements);
}
