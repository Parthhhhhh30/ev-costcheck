import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FILES,validateFile,reconcile} from '../assets/engine.mjs';
async function sample(){const data={};for(const name of FILES)data[name]=validateFile(name,await readFile(new URL(`../sample_data/${name}.csv`,import.meta.url),'utf8'));return data;}
test('same cumulative meter range cannot produce two reviewable allocations for one charger',async()=>{
 const d=await sample(),s=d.sessions.find(s=>s.session_id==='S102');
 d.sessions.push({...s,session_id:'X1'});
 for(const interval of d.meter_intervals.filter(m=>m.session_id==='S102'))d.meter_intervals.push({...interval,session_id:'X1'});
 const r=await reconcile(d);
 assert.equal(r.ready.filter(s=>['S102','X1'].includes(s.session_id)).length,0);
 assert.equal(r.held.filter(s=>['S102','X1'].includes(s.session_id)).length,2);
 assert.match(r.held.find(s=>s.session_id==='S102').reason,/overlap|double.count/i);
});
test('adjacent non-overlapping cumulative ranges remain independently reviewable',async()=>{
 const d=await sample(),s=d.sessions.find(s=>s.session_id==='S102');
 d.sessions.push({...s,session_id:'X1',start_utc:'2026-10-29T16:00:00Z',end_utc:'2026-10-29T17:00:00Z',meter_start_wh:'508000',meter_end_wh:'516000'});
 d.meter_intervals.push({session_id:'X1',start_utc:'2026-10-29T16:00:00Z',end_utc:'2026-10-29T17:00:00Z',meter_start_wh:'508000',meter_end_wh:'516000'});
 const r=await reconcile(d);assert.ok(r.ready.some(x=>x.session_id==='S102'));assert.ok(r.ready.some(x=>x.session_id==='X1'));
});
test('unresolved investigation case identity stays stable after unrelated source edit and held-list reshuffle',async()=>{
 const d=await sample(),a=await reconcile(d),target=a.held.find(x=>x.session_id==='S103');
 d.tariffs[0].gbp_per_kwh='0.21';d.sessions=d.sessions.filter(x=>x.session_id!=='S104');
 const b=await reconcile(d),after=b.held.find(x=>x.session_id==='S103');
 assert.ok(after);assert.equal(target.case_key,after.case_key);assert.notEqual(target.source_sha256,after.source_sha256);
});
test('duplicate exception cases retain separate stable identities across reruns',async()=>{
 const d=await sample();let a=await reconcile(d);
 const ids=a.held.filter(x=>x.session_id==='S107').map(x=>x.case_key);assert.equal(new Set(ids).size,2);
 d.tariffs[0].gbp_per_kwh='0.21';a=await reconcile(d);
 assert.deepEqual(a.held.filter(x=>x.session_id==='S107').map(x=>x.case_key),ids);
});