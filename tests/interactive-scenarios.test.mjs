import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FILES, validateFile, reconcile} from '../assets/engine.mjs';
async function sample(){const d={};for(const n of FILES)d[n]=validateFile(n,await readFile(new URL(`../sample_data/${n}.csv`,import.meta.url),'utf8'));return d;}
test('readable meter/tariff breakdown explains S101 £3.14 without interval rounding',async()=>{
 const r=await reconcile(await sample()),s=r.ready.find(x=>x.session_id==='S101');
 assert.equal(s.allocated_gbp,'3.14');assert.equal(s.metered_kwh,'12.000');
 assert.deepEqual(s.breakdown.map(x=>[x.metered_kwh,x.rate_gbp_per_kwh,x.unrounded_gbp]),[['5.000','0.180000','0.900000000'],['7.000','0.320000','2.240000000']]);
});
test('fictional tariff change changes real allocations, not just the display',async()=>{
 const d=await sample(),a=await reconcile(d);
 d.tariffs.find(x=>x.site_id==='BRIGHTON-OFFICE'&&x.gbp_per_kwh==='0.18').gbp_per_kwh='0.21';
 const b=await reconcile(d);
 assert.equal(a.summary.candidate_total_gbp,'6.94');assert.equal(b.summary.candidate_total_gbp,'7.39');
 assert.equal(b.ready.find(x=>x.session_id==='S100').allocated_gbp,'2.10');
 assert.equal(b.ready.find(x=>x.session_id==='S101').allocated_gbp,'3.29');
 assert.equal(b.held.length,6);
});
test('fictional charger mapping resolves held session by actual engine evaluation',async()=>{
 const d=await sample();d.chargers.push({charger_id:'CH-MISSING',site_id:'WARWICK-DEPOT',allocation_party:'Fleet'});
 const b=await reconcile(d);
 assert.equal(b.ready.length,4);assert.equal(b.held.length,5);assert.equal(b.summary.candidate_total_gbp,'7.44');
 assert.equal(b.ready.find(x=>x.session_id==='S103').allocated_gbp,'0.50');
});
test('double-count scenario holds BOTH cumulative duplicates without inventing costs',async()=>{
 const d=await sample(),original=d.sessions.find(x=>x.session_id==='S102');d.sessions.push({...original,session_id:'DEMO-DUP-01'});
 d.meter_intervals.push(...d.meter_intervals.filter(x=>x.session_id==='S102').map(x=>({...x,session_id:'DEMO-DUP-01'})));
 const b=await reconcile(d);
 assert.equal(b.ready.length,2);assert.equal(b.held.length,8);assert.equal(b.summary.candidate_total_gbp,'4.94');
 assert.ok(b.held.some(x=>x.session_id==='S102'&&/double count/i.test(x.reason)));
 assert.ok(b.held.some(x=>x.session_id==='DEMO-DUP-01'));
});
test('many tiny intervals retain high precision and round only once',async()=>{
 const d=await sample();d.sessions=d.sessions.filter(x=>x.session_id==='S100');d.meter_intervals=[{session_id:'S100',start_utc:'2026-10-29T10:00:00Z',end_utc:'2026-10-29T10:30:00Z',meter_start_wh:'100000',meter_end_wh:'100001'},{session_id:'S100',start_utc:'2026-10-29T10:30:00Z',end_utc:'2026-10-29T11:00:00Z',meter_start_wh:'100001',meter_end_wh:'100002'}];d.sessions[0].meter_end_wh='100002';d.tariffs[0].gbp_per_kwh='0.123456';
 const b=await reconcile(d),rec=b.ready[0];assert.equal(rec.allocated_gbp,'0.00');
 assert.equal(rec.breakdown[0].unrounded_gbp,'0.000123456');assert.equal(rec.breakdown[1].unrounded_gbp,'0.000123456');
});
