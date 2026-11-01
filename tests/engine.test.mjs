import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FILES,validateFile,reconcile,currentReviews,effectiveReviews,canUseRun,parseCsv,renderCsv} from '../assets/engine.mjs';
const source=new URL('../sample_data/',import.meta.url);
async function fixture(){const d={};for(const n of FILES)d[n]=validateFile(n,await readFile(new URL(n+'.csv',source),'utf8'));return d;}
const clone=structuredClone;
test('demo matches independently created Python engine: 3 ready 6 held £6.94',async()=>{const r=await reconcile(await fixture());assert.equal(r.ready.length,3);assert.equal(r.held.length,6);assert.equal(r.summary.candidate_total_gbp,'6.94');assert.deepEqual(r.ready.map(x=>x.allocated_gbp),['1.80','3.14','2.00']);});
test('tariff crossing without metered boundary is held',async()=>{const d=await fixture(),r=await reconcile(d);assert.match(r.held.find(x=>x.session_id==='S106').reason,/tariff boundary/i);});
test('unknown charger held',async()=>{const r=await reconcile(await fixture());assert.match(r.held.find(x=>x.session_id==='S103').reason,/not in approved property register/i);});
test('negative meter readings held',async()=>{const r=await reconcile(await fixture());assert.match(r.held.find(x=>x.session_id==='S104').reason,/invalid session cumulative/i);});
test('duplicate sessions all held',async()=>{const d=await fixture();d.sessions.push({...d.sessions[0]});const r=await reconcile(d);assert.equal(r.held.filter(x=>x.session_id==='S100').length,2);});
test('negative rate held',async()=>{const d=await fixture();d.tariffs[0].gbp_per_kwh='-0.18';const r=await reconcile(d);assert.match(r.held.find(x=>x.session_id==='S100').reason,/tariff/i);});
test('unknown timezone held',async()=>{const d=await fixture();d.sessions[0].start_utc='2026-10-29T10:00:00';const r=await reconcile(d);assert.match(r.held.find(x=>x.session_id==='S100').reason,/timezone/i);});
test('gaps in meter data held',async()=>{const d=await fixture();d.meter_intervals=d.meter_intervals.filter(x=>!(x.session_id==='S101'&&x.start_utc.includes('12:00:00')));const r=await reconcile(d);assert.ok(r.held.some(x=>x.session_id==='S101'));});
test('sub-penny cost accumulates before HALF_UP rounding',async()=>{
  const d={sessions:[{session_id:'X',charger_id:'C',start_utc:'2026-10-29T00:00:00Z',end_utc:'2026-10-29T02:00:00Z',meter_start_wh:'0',meter_end_wh:'2'}],chargers:[{charger_id:'C',site_id:'P',allocation_party:'T'}],meter_intervals:[{session_id:'X',start_utc:'2026-10-29T00:00:00Z',end_utc:'2026-10-29T01:00:00Z',meter_start_wh:'0',meter_end_wh:'1'},{session_id:'X',start_utc:'2026-10-29T01:00:00Z',end_utc:'2026-10-29T02:00:00Z',meter_start_wh:'1',meter_end_wh:'2'}],tariffs:[{site_id:'P',start_utc:'2026-10-29T00:00:00Z',end_utc:'2026-10-29T02:00:00Z',gbp_per_kwh:'5.000000'}]};
  const r=await reconcile(d);assert.equal(r.ready[0].allocated_gbp,'0.01');
});
test('no double count for overlapping tariff windows',async()=>{const d=await fixture();d.tariffs.push({...d.tariffs[0],start_utc:'2026-10-29T09:00:00Z',end_utc:'2026-10-29T11:00:00Z'});const r=await reconcile(d);assert.match(r.held.find(x=>x.session_id==='S100').reason,/overlap/i);});
test('approval becomes stale if tariff changes',async()=>{const d=await fixture(),a=await reconcile(d),approval={session_id:'S100',source_sha256:a.source_sha256,decision:'approve'};d.tariffs[0].gbp_per_kwh='0.21';const b=await reconcile(d);const s=currentReviews(b,[approval]);assert.equal(s.current.S100.decision,'pending');assert.equal(s.stale.length,1);});
test('approval becomes stale if charger mapping changes',async()=>{const d=await fixture(),a=await reconcile(d),approval={session_id:'S100',source_sha256:a.source_sha256,decision:'approve'};d.chargers[0].allocation_party='Finance';const b=await reconcile(d);assert.equal(currentReviews(b,[approval]).current.S100.decision,'pending');});
test('CSV parsing supports quoted comma and quoted newline',()=>{const csv='id,note\n"a,1","first\nsecond"\n';assert.deepEqual(parseCsv(csv).rows,[{id:'a,1',note:'first\nsecond'}]);});
test('CSV export neutralises spreadsheet formula injection',()=>{const s=renderCsv([{note:'=HYPERLINK("bad")'}],['note']);assert.match(s,/'=HYPERLINK/);assert.ok(s.includes("'=HYPERLINK"));});
test('reject incomplete input columns',()=>{assert.throws(()=>validateFile('chargers','charger_id,site_id\na,b\n'),/missing columns/);});
test('truncated audit IDs cannot approve held records',async()=>{const r=await reconcile(await fixture());assert.ok(!r.ready.some(x=>x.session_id==='S103'));});

test('pending edits invalidate all visible approvals before a rerun',async()=>{
 const r=await reconcile(await fixture());const log=[{session_id:'S100',source_sha256:r.source_sha256,decision:'approve'}];
 const state={sourceRevision:2,lastRun:{...r,source_revision:1},dirty:true};
 assert.equal(canUseRun(state),false);
 const pending=effectiveReviews(r,log,true);
 assert.equal(pending.current.S100.decision,'pending');
 assert.equal(pending.stale.length,1);
 assert.equal(canUseRun({...state,dirty:false}),false);
 assert.equal(effectiveReviews(r,log,false).current.S100.decision,'approve');
});
test('without reconciliation or with dirty inputs current exports must be denied',()=>{
 assert.equal(canUseRun({lastRun:null,dirty:false}),false);
 assert.equal(canUseRun({lastRun:{ready:[],source_revision:0},sourceRevision:0,dirty:true}),false);
 assert.equal(canUseRun({lastRun:{ready:[],source_revision:0},sourceRevision:0,dirty:false}),true);
});

test('approval never revives when edited source values are later reverted exactly',async()=>{
 const d=await fixture(),a={...await reconcile(d),source_revision:0};
 const approval={session_id:'S100',source_sha256:a.source_sha256,source_revision:0,decision:'approve'};
 d.tariffs[0].gbp_per_kwh='0.21';const changed=await reconcile(d);assert.notEqual(changed.source_sha256,a.source_sha256);
 d.tariffs[0].gbp_per_kwh='0.18';const restored={...await reconcile(d),source_revision:2};
 assert.equal(restored.source_sha256,a.source_sha256);
 assert.equal(currentReviews(restored,[approval]).current.S100.decision,'pending');
 assert.equal(currentReviews(restored,[approval]).stale.length,1);
});
test('malformed calendar dates and impossible timezone offsets hold session instead of allocating',async()=>{
 const d=await fixture();d.sessions[0].start_utc='2026-02-30T10:00:00Z';
 let r=await reconcile(d);assert.match(r.held.find(x=>x.session_id==='S100').reason,/calendar date|time/i);
 d.sessions[0].start_utc='2026-10-29T10:00:00+15:00';
 r=await reconcile(d);assert.match(r.held.find(x=>x.session_id==='S100').reason,/timezone offset/i);
});
test('every held row receives a distinct investigation identity even for duplicate sessions',async()=>{
 const d=await fixture();d.sessions.push({...d.sessions[0]});
 const r=await reconcile(d),ids=r.held.map(x=>x.exception_id);
 assert.equal(new Set(ids).size,ids.length);
 assert.equal(r.held.filter(x=>x.session_id==='S100').length,2);
});
