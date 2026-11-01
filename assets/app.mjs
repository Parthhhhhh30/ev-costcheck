import {FILES,COLUMNS,validateFile,reconcile,sourceHash,effectiveReviews,canUseRun,renderCsv,deterministicBrief} from './engine.mjs';
const $=id=>document.getElementById(id),all=sel=>[...document.querySelectorAll(sel)];
const KEY='evcostcheck_v2_local', initial={data:{},decisions:[],actions:{},history:[],dirty:false,sourceRevision:0,lastRun:null,comparison:null};
let state=structuredClone(initial), selected='sessions',reviewId=null,explainId=null, pendingChangeLabel='Source records edited',toastTimeout,activeRunId=0;
try{const cached=JSON.parse(localStorage.getItem(KEY)||'null');if(cached&&cached.data&&cached.decisions)state={...state,...cached};}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const toast=(message,error=false)=>{const t=$('toast');t.textContent=message;t.style.background=error?'#8d3a34':'#193e42';t.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.remove('show'),3700);};
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){toast('Local storage is full. Export your data before leaving this page.',true);}};
function page(name){all('.page').forEach(x=>x.classList.toggle('hidden',x.id!==`page-${name}`));all('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===name));$('bread').textContent=name[0].toUpperCase()+name.slice(1);if(name==='method')updateBrief();}
all('.nav').forEach(b=>b.addEventListener('click',()=>page(b.dataset.page)));
all('[data-goto]').forEach(b=>b.addEventListener('click',()=>page(b.dataset.goto)));
function download(filename,content,type='text/plain;charset=utf-8'){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function objectCsv(obj,cols){return renderCsv(obj,cols);}
function markDirty(label='Source records edited'){
  activeRunId++;pendingChangeLabel=label;
  state.sourceRevision=(Number.isSafeInteger(state.sourceRevision)?state.sourceRevision:0)+1;
  state.dirty=true;reviewId=null;explainId=null;
  $('review-editor').classList.add('hidden');$('explain-panel').classList.add('hidden');
  persist();render();
}
function resultSnapshot(result){
  return {total:result.summary.candidate_total_gbp,ready:result.ready.length,held:result.held.length,
    allocations:result.ready.slice(0,50).map(r=>({session_id:r.session_id,amount:r.allocated_gbp})),
    holds:result.held.slice(0,50).map(r=>r.session_id)};
}
function compareRuns(before,after,label){
  const first=resultSnapshot(before),last=resultSnapshot(after),was=new Map(first.allocations.map(x=>[x.session_id,x.amount])),now=new Map(last.allocations.map(x=>[x.session_id,x.amount]));
  const changes=[];
  for(const [id,amount] of now){if(was.has(id)&&was.get(id)!==amount)changes.push(`${id}: £${was.get(id)} → £${amount}`);
    else if(!was.has(id))changes.push(`${id}: moved into review (£${amount})`);}
  for(const [id] of was)if(!now.has(id))changes.push(`${id}: moved from review onto HOLD`);
  for(const id of last.holds)if(!first.holds.includes(id)&&!was.has(id))changes.push(`${id}: new held evidence`);
  return {label,before:first,after:last,changes:changes.slice(0,12),truncated:changes.length>12};
}

async function loadSamples(replace=true){
  const data={};for(const name of FILES){const resp=await fetch(`/sample_data/${name}.csv`,{cache:'no-store'});if(!resp.ok)throw Error(`Could not fetch ${name}.csv`);data[name]=validateFile(name,await resp.text());}
  state={...structuredClone(initial),data,decisions:replace?[]:state.decisions,actions:replace?{}:state.actions};persist();await run();
}
async function run(){
  // Immutable inputs and a monotonic run token prevent an in-flight hash from
  // authenticating a different dataset if an editor changes records mid-run.
  const runId=++activeRunId, revision=state.sourceRevision;
  try {
    const snapshot=structuredClone(state.data);
    for(const name of FILES)if(!Array.isArray(snapshot[name]))throw Error(`Upload ${name}.csv or load the sample dataset`);
    const result=await reconcile(snapshot);
    if(runId!==activeRunId||revision!==state.sourceRevision){
      toast('Source records changed while reconciliation was running. Run reconciliation again.',true);return;
    }
    migrateLegacyActions(state.lastRun?.held||[]);
    const earlier=state.lastRun;
    if(earlier&&earlier.source_sha256!==result.source_sha256){
      state.comparison=compareRuns(earlier,result,pendingChangeLabel);
    }else if(earlier&&!state.comparison){
      state.comparison={unchanged:true,label:'Reconciliation repeated without changing source records'};
    }
    state.lastRun={...result,source_revision:revision,generated_at_utc:new Date().toISOString()};state.dirty=false;
    state.history.push({source_sha256:result.source_sha256,at:state.lastRun.generated_at_utc,ready:result.ready.length,held:result.held.length,total:result.summary.candidate_total_gbp});state.history=state.history.slice(-40);
    persist();render();toast(`${result.ready.length} ready for review; ${result.held.length} held. No automatic billing.`);
  }catch(e){if(runId===activeRunId)toast(`Reconciliation stopped: ${e.message}`,true);}
}
const countMap=()=>effectiveReviews(state.lastRun,state.decisions,state.dirty);
function ensureCurrentRun(){if(canUseRun(state))return true;toast('Source data has changed or no run exists. Reconcile before using results.',true);return false;}
function render(){
  const result=canUseRun(state)?state.lastRun:null,rv=countMap();
  $('stat-total').textContent=result?'£'+result.summary.candidate_total_gbp:'—';$('stat-ready').textContent=result?result.ready.length:'—';$('stat-held').textContent=result?result.held.length:'—';
  $('stat-reviewed').textContent=result?Object.values(rv.current).filter(r=>r.decision==='approve'||r.decision==='reject').length:'—';
  $('nav-ready').textContent=result?result.ready.length:'—';$('nav-held').textContent=result?result.held.length:'—';$('nav-files').textContent=FILES.filter(n=>Array.isArray(state.data[n])).length;
  $('footer-status').textContent=state.dirty?'Unapplied source edits · Reconcile to refresh':result?`Last run ${new Date(result.generated_at_utc).toLocaleString()} · No billing or equipment control`:'Local-first · No billing';
  renderFiles();renderSourceTable();renderAllocations();renderExceptions();renderAudit();renderComparison();updateBrief();
  $('recent-exceptions').innerHTML=!result?'<div class="list-placeholder">No run yet.</div>':result.held.slice(0,4).map(x=>`<div class="mini-exception"><span class="state-badge error">HOLD</span><div><b>${esc(x.session_id||'[missing ID]')}</b><p>${esc(x.reason)}</p></div></div>`).join('')||'<div class="list-placeholder">No held records.</div>';
}
function renderFiles(){
  $('file-cards').innerHTML=FILES.map(n=>`<div class="file-card"><b>${esc(n)}.csv</b><p>${state.data[n]?.length??0} rows · ${COLUMNS[n].length} required columns</p><label>↑ Replace file<input type="file" data-file="${n}" accept=".csv,text/csv" aria-label="Replace ${n}.csv"></label></div>`).join('');
  all('[data-file]').forEach(el=>el.addEventListener('change',async()=>{
    try{const file=el.files[0];if(!file)return;if(file.size>2000000)throw Error('Demo CSV is limited to 2 MB');state.data[el.dataset.file]=validateFile(el.dataset.file,await file.text());markDirty();render();toast(`${el.dataset.file}.csv loaded. Reconcile to apply.`);}catch(e){toast(e.message,true);}
  }));
  $('table-select').innerHTML=FILES.map(n=>`<option value="${n}">${n}.csv</option>`).join('');$('table-select').value=selected;
}
function renderSourceTable(){
  const cols=COLUMNS[selected],rows=state.data[selected]||[];const cap=rows.length>150?150:rows.length;
  $('source-table').innerHTML=`<thead><tr><th>#</th>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}<th></th></tr></thead><tbody>${rows.slice(0,cap).map((r,i)=>`<tr><td>${i+1}</td>${cols.map(col=>`<td><input data-col="${col}" data-row="${i}" value="${esc(r[col])}" aria-label="Row ${i+1} ${esc(col)}"></td>`).join('')}<td><button class="small-button" data-remove="${i}">Remove</button></td></tr>`).join('')}</tbody>`;
  $('row-cap')?.remove();
  if(rows.length>cap)$('source-table').insertAdjacentHTML('afterend','<p class="notice" id="row-cap">Showing first 150 rows. For large datasets, replace the CSV directly.</p>');
  all('#source-table input').forEach(el=>el.addEventListener('change',()=>{state.data[selected][Number(el.dataset.row)][el.dataset.col]=el.value;markDirty();}));
  all('[data-remove]').forEach(el=>el.addEventListener('click',()=>{state.data[selected].splice(Number(el.dataset.remove),1);markDirty();render();}));
}
function renderAllocations(){const rs=canUseRun(state)?state.lastRun.ready:[],rv=countMap().current;
  $('alloc-table').innerHTML=`<thead><tr><th>Session</th><th>Site</th><th>Allocation</th><th>kWh</th><th>Cost</th><th>Review</th><th></th></tr></thead><tbody>${!canUseRun(state)?'<tr><td colspan="7">Source files changed or no run exists. Reconcile to display current allocations.</td></tr>':rs.map(r=>`<tr><td><b>${esc(r.session_id)}</b></td><td>${esc(r.site_id)}</td><td>${esc(r.allocation_party)}</td><td>${esc(r.metered_kwh)}</td><td><b>£${esc(r.allocated_gbp)}</b></td><td><span class="state-badge ${rv[r.session_id]?.decision==='approve'?'ok':rv[r.session_id]?.decision==='reject'?'error':''}">${esc(rv[r.session_id]?.decision||'pending')}</span></td><td><button class="small-button" data-explain="${esc(r.session_id)}">Explain cost</button> <button class="small-button" data-review="${esc(r.session_id)}">Review →</button></td></tr>`).join('')}</tbody>`;
  all('[data-explain]').forEach(el=>el.addEventListener('click',()=>showExplanation(el.dataset.explain)));
  if(explainId)renderExplanation();
  all('[data-review]').forEach(el=>el.addEventListener('click',()=>{
    reviewId=el.dataset.review;$('review-title').textContent=`Session ${reviewId}`;
    $('review-editor').classList.remove('hidden');$('review-note').value='';$('review-editor').scrollIntoView({behavior:'smooth',block:'center'});
  }));
}
function showExplanation(sessionId){
  if(!ensureCurrentRun())return;
  explainId=sessionId;page('allocations');renderExplanation();
  $('explain-panel').scrollIntoView({behavior:'smooth',block:'center'});
}
function renderExplanation(){
  const result=canUseRun(state)?state.lastRun:null;
  const record=result?.ready.find(r=>r.session_id===explainId);
  if(!record){explainId=null;$('explain-panel').classList.add('hidden');return;}
  $('explain-panel').classList.remove('hidden');
  $('explain-title').textContent=`Session ${record.session_id}: why £${record.allocated_gbp}?`;
  $('explain-context').innerHTML=`<span>Charger: ${esc(record.charger_id)}</span><span>Site: ${esc(record.site_id)}</span><span>Allocated to: ${esc(record.allocation_party)}</span>`;
  const segments=record.breakdown||[];
  $('explain-table').innerHTML='<thead><tr><th>Meter interval (UTC)</th><th>Meter evidence (Wh)</th><th>Energy (kWh)</th><th>Rate (£/kWh)</th><th>Unrounded cost</th></tr></thead><tbody>'+segments.map(x=>`<tr><td>${esc(x.start_utc)}<br>to ${esc(x.end_utc)}</td><td>${esc(x.meter_start_wh)} → ${esc(x.meter_end_wh)}</td><td>${esc(x.metered_kwh)}</td><td>£${esc(x.rate_gbp_per_kwh)}</td><td>£${esc(x.unrounded_gbp)}</td></tr>`).join('')+'</tbody>';
  $('explain-total').textContent=`${record.metered_kwh} kWh · final amount £${record.allocated_gbp} (rounded once per session)`;
}
$('close-explain').addEventListener('click',()=>{explainId=null;$('explain-panel').classList.add('hidden');});
$('explain-s101-hero').addEventListener('click',()=>showExplanation('S101'));
async function applyScenario(name){
  if(!canUseRun(state)){toast('Reconcile or reset the current source records before applying a scenario.',true);return;}
  const d=state.data;let label='';
  if(name==='tariff'){
    const row=d.tariffs.find(t=>t.site_id==='BRIGHTON-OFFICE'&&t.gbp_per_kwh==='0.18');
    if(!row){toast('Morning £0.18 Brighton tariff not found. Reset the demo to try this scenario.',true);return;}
    row.gbp_per_kwh='0.21';label='Morning Brighton tariff raised: £0.18 → £0.21 per kWh';
  }else if(name==='mapping'){
    if(!d.sessions.some(s=>s.session_id==='S103')||d.chargers.some(c=>c.charger_id==='CH-MISSING')){
      toast('S103 is missing or its charger is already registered. Reset to try this scenario.',true);return;
    }
    d.chargers.push({charger_id:'CH-MISSING',site_id:'WARWICK-DEPOT',allocation_party:'Fleet'});
    label='Fictional property registration added for CH-MISSING (S103)';
  }else if(name==='overlap'){
    const original=d.sessions.find(s=>s.session_id==='S102');
    if(!original||d.sessions.some(s=>s.session_id==='DEMO-DUP-01')){
      toast('S102 is missing or the duplicate has already been added. Reset to try this scenario.',true);return;
    }
    const intervals=d.meter_intervals.filter(x=>x.session_id==='S102');
    if(!intervals.length){toast('No meter evidence for S102. Reset the sample.',true);return;}
    d.sessions.push({...original,session_id:'DEMO-DUP-01'});
    d.meter_intervals.push(...intervals.map(x=>({...x,session_id:'DEMO-DUP-01'})));
    label='Duplicate cumulative meter range introduced for S102';
  }else return;
  markDirty(label);await run();
  page('overview');$('change-comparison').scrollIntoView({behavior:'smooth',block:'center'});
}
all('[data-scenario]').forEach(el=>el.addEventListener('click',()=>applyScenario(el.dataset.scenario)));
$('reset-scenarios').addEventListener('click',async()=>{
  if(!window.confirm('Restore the original fictional example? This replaces current source records AND removes local reviews and investigation notes. Export anything you need first.'))return;
  await loadSamples(true);page('overview');toast('Original sample restored: 3 ready, 6 held, £6.94.');
});
const actionKey=r=>r.case_key||JSON.stringify(['case-v2',r.session_id,r.charger_id,r.reason,0]);
function migrateLegacyActions(held){
  if(!state.actions||typeof state.actions!=='object')state.actions={};
  const occurrence=new Map();
  for(const r of held){
    if(!r.case_key){
      // Migrate older browser state without merging identical duplicate cases.
      const base=JSON.stringify([r.session_id,r.charger_id,r.reason]);
      const nth=occurrence.get(base)||0;occurrence.set(base,nth+1);
      r.case_key=JSON.stringify(['case-v2',r.session_id,r.charger_id,r.reason,nth]);
    }
    const key=actionKey(r),legacy=`${r.source_sha256}|${r.exception_id||r.session_id+'|'+r.reason}`;
    if(!state.actions[key]&&state.actions[legacy])state.actions[key]={...state.actions[legacy]};
  }
}
function renderExceptions(){const held=canUseRun(state)?state.lastRun.held:[];
  migrateLegacyActions(held);
  $('exception-queue').innerHTML=held.map((r,i)=>{
    const key=actionKey(r),a=state.actions[key]||{owner:'',due:'',status:'open',note:''};
    return `<div class="exception-item"><div class="exception-head"><div class="row"><span class="state-badge error">HOLD</span><b>${esc(r.session_id||'Unknown session')}</b><span class="exception-location">${esc(r.site_id||r.charger_id||'Unmapped')}</span></div><button class="link-button" data-goto="sources">Correct source records →</button></div><p class="exception-reason">${esc(r.reason)}</p><div class="exception-fields"><label>Investigation owner<input maxlength="100" data-action="owner" data-key="${esc(key)}" value="${esc(a.owner)}" placeholder="Assign owner"></label><label>Target date<input type="date" data-action="due" data-key="${esc(key)}" value="${esc(a.due)}"></label><label>Status<select data-action="status" data-key="${esc(key)}"><option value="open" ${a.status==='open'?'selected':''}>Open</option><option value="investigating" ${a.status==='investigating'?'selected':''}>Investigating</option><option value="awaiting_evidence" ${a.status==='awaiting_evidence'?'selected':''}>Awaiting evidence</option></select></label><label>Next action<input maxlength="300" data-action="note" data-key="${esc(key)}" value="${esc(a.note)}" placeholder="What must be checked?"></label></div></div>`;
  }).join('')||`<div class="list-placeholder">${!canUseRun(state)?'Reconcile current source files to display exceptions.':'No held records. All supplied data reconciled.'}</div>`;
  all('[data-action]').forEach(el=>el.addEventListener('change',()=>{const key=el.dataset.key;state.actions[key]??={};state.actions[key][el.dataset.action]=el.value;persist();toast('Investigation note saved locally.');}));
  all('#exception-queue [data-goto]').forEach(el=>el.addEventListener('click',()=>page('sources')));
}
function renderAudit(){
  const decisions=state.decisions,rv=countMap(),currentSha=state.lastRun?.source_sha256||'';
  const rows=decisions.slice().reverse().map(d=>{
    const current=canUseRun(state)&&d.source_sha256===currentSha&&d.source_revision===state.sourceRevision;
    const amount=d.allocated_gbp===undefined?'Legacy (not recorded)':'£'+d.allocated_gbp;
    return '<tr><td>'+esc(d.session_id)+'</td><td><span class="state-badge '+(d.decision==='approve'?'ok':'error')+'">'+esc(d.decision)+'</span></td><td>'+esc(amount)+'</td><td>'+esc(d.reviewer)+'</td><td>'+esc(new Date(d.utc).toLocaleString())+'</td><td><span class="state-badge '+(current?'ok':'error')+'">'+(current?'Current':'Stale')+'</span></td><td>'+esc(d.note)+'</td></tr>';
  }).join('');
  $('audit-table').innerHTML='<thead><tr><th>Session</th><th>Decision</th><th>Cost at decision</th><th>Reviewer</th><th>When</th><th>Evidence</th><th>Rationale</th></tr></thead><tbody>'+rows+'</tbody>';
  $('run-info').textContent=state.lastRun?`Last run: ${state.lastRun.generated_at_utc}\nSource SHA-256: ${state.lastRun.source_sha256}\nReady: ${state.lastRun.ready.length}\nHeld: ${state.lastRun.held.length}\nCurrent reviews: ${Object.values(rv.current).filter(d=>d.decision!=='pending').length}\nStale historical reviews: ${rv.stale.length}\nSource revision: ${state.sourceRevision} (run: ${state.lastRun.source_revision??'legacy'})\nSource edits pending: ${state.dirty?'YES — rerun required':'no'}`:'No reconciliation yet.';
}
function renderComparison(){
  const target=$('change-comparison'),c=state.comparison;
  if(state.dirty){target.innerHTML='<p><strong>Source edits are pending.</strong> Reconcile to calculate updated results and compare them with the previous run. Past approvals are no longer current.</p>';return;}
  if(!c){target.innerHTML='<p>Start with a scenario above, or edit a source record, to see actual changes in costs and held cases.</p>';return;}
  if(c.unchanged){target.innerHTML='<p>Reconciliation completed. The underlying records have not changed, so the calculated outcome is unchanged. Try a scenario to make a real input change.</p>';return;}
  const fmt=(val)=>'£'+esc(val),deltaPence=Math.round((Number(c.after.total)-Number(c.before.total))*100);
  const signed=(n)=>n>0?'+'+n:String(n);
  target.innerHTML=`<h3>${esc(c.label)} — before and after</h3><p>This comparison uses two actual reconciliation runs. Held amounts are excluded, and older human approvals are no longer current after input edits.</p>
    <div class="comparison-summary">
      <div class="comparison-metric"><small>CANDIDATE COST</small><b>${fmt(c.before.total)} → ${fmt(c.after.total)}</b><em>${deltaPence===0?'No cost change':(deltaPence>0?'+£':'−£')+(Math.abs(deltaPence)/100).toFixed(2)}</em></div>
      <div class="comparison-metric"><small>READY FOR REVIEW</small><b>${c.before.ready} → ${c.after.ready}</b><em>${signed(c.after.ready-c.before.ready)} reviewable</em></div>
      <div class="comparison-metric"><small>HELD FOR INVESTIGATION</small><b>${c.before.held} → ${c.after.held}</b><em>${signed(c.after.held-c.before.held)} held</em></div>
    </div><p class="comparison-detail">${c.changes.length?c.changes.map(esc).join(' · '):'The source changed, but no candidate allocations changed.'}${c.truncated?' · More changes omitted for display.':''}</p>
    <div class="comparison-links"><button class="button primary" data-demo-go="allocations">Review calculations →</button><button class="button secondary" data-demo-go="exceptions">Investigate holds →</button><button class="button secondary" data-demo-go="audit">Check review history →</button></div>`;
  all('[data-demo-go]').forEach(el=>el.addEventListener('click',()=>page(el.dataset.demoGo)));
}
function updateBrief(){const res=state.lastRun;
  $('brief-output').textContent=!canUseRun(state)?'Source data changed or no reconciliation exists. Reconcile before generating the briefing.':deterministicBrief(res,countMap().current);
}
const brief=()=>{if(!ensureCurrentRun())return;download('review_brief.txt',deterministicBrief(state.lastRun,countMap().current));};
for(const id of ['download-brief','download-brief2'])$(id).addEventListener('click',brief);
$('generate-brief').addEventListener('click',()=>{page('method');if(!ensureCurrentRun())return;updateBrief();toast('Generated from checked records; no AI or invented numbers.');});
$('request-ai').addEventListener('click',async()=>{
  if(!ensureCurrentRun())return;
  const requestedRevision=state.sourceRevision,requestedRunId=activeRunId;
  const code=window.prompt('Optional AI analysis requires a configured server-side access code. Enter it here. Cancel to stay with the deterministic briefing.');if(!code)return;
  try{const r=await fetch('/api/brief',{method:'POST',headers:{'Content-Type':'application/json','x-brief-access':code},body:JSON.stringify({held:state.lastRun.held.map(e=>({exception_id:e.exception_id,session_id:e.session_id,reason:e.reason,status:e.status})),ready:state.lastRun.ready.map(e=>({session_id:e.session_id,status:e.status})),summary:state.lastRun.summary})});const payload=await r.json();if(!r.ok)throw Error(payload.error||'AI service unavailable');
    if(!canUseRun(state)||state.sourceRevision!==requestedRevision||activeRunId!==requestedRunId)throw Error('Source changed during AI analysis; suggestions discarded.');
    const allowed=new Set(state.lastRun.held.map(e=>e.exception_id));
    if(!Array.isArray(payload.actions)||payload.actions.length!==allowed.size||payload.actions.some(a=>!allowed.has(a.exception_id))||new Set(payload.actions.map(a=>a.exception_id)).size!==allowed.size)throw Error('Model output did not pass exception-ID verification');
    const labels=new Map(state.lastRun.held.map(e=>[e.exception_id,e.session_id]));
    $('brief-output').textContent=deterministicBrief(state.lastRun,countMap().current)+'\n\nAI suggested follow-up (not approved, must verify):\n'+payload.actions.map(a=>`${a.exception_id} (${labels.get(a.exception_id)||'missing session ID'}): ${a.next_check}`).join('\n');
    $('ai-state').textContent='AI output is advisory only; verify every suggested step against the source records.';
  }catch(e){toast(e.message,true);$('ai-state').textContent='AI analysis unavailable. Deterministic reconciliation and reporting remain fully functional.';}
});
$('table-select').addEventListener('change',e=>{selected=e.target.value;renderSourceTable();});
$('add-row').addEventListener('click',()=>{state.data[selected]??=[];state.data[selected].push(Object.fromEntries(COLUMNS[selected].map(c=>[c,''])));markDirty();render();});
$('download-table').addEventListener('click',()=>download(`${selected}.csv`,objectCsv(state.data[selected]||[],COLUMNS[selected]),'text/csv'));
$('download-allocations').addEventListener('click',()=>{
  if(!ensureCurrentRun())return;download('allocations_pending.csv',renderCsv(state.lastRun.ready,['session_id','charger_id','site_id','allocation_party','metered_kwh','allocated_gbp','status','source_sha256']),'text/csv');
});
$('download-exceptions').addEventListener('click',()=>{
  if(!ensureCurrentRun())return;
  const rows=state.lastRun.held.map(e=>({...e,investigation_status:(state.actions[actionKey(e)]?.status||'open'),owner:state.actions[actionKey(e)]?.owner||'',due:state.actions[actionKey(e)]?.due||'',note:state.actions[actionKey(e)]?.note||''}));
  download('exceptions_actions.csv',renderCsv(rows,['exception_id','session_id','charger_id','site_id','reason','status','investigation_status','owner','due','note','source_sha256']),'text/csv');
});
$('download-audit').addEventListener('click',()=>download('review_audit.json',JSON.stringify({decisions:state.decisions,current_run_sha256:canUseRun(state)?state.lastRun.source_sha256:null,source_revision:state.sourceRevision,source_edits_pending:state.dirty,exception_actions:state.actions,history:state.history,current_source_data:canUseRun(state)?structuredClone(state.data):null,note:'Source inputs are supplied for the current run only. Historical decisions preserve candidate fields but historical full source inputs may not be recoverable. This local export is not tamper-proof.' },null,2),'application/json'));
$('close-review').addEventListener('click',()=>$('review-editor').classList.add('hidden'));
$('save-review').addEventListener('click',()=>{
  if(!ensureCurrentRun())return;
  const reviewer=$('review-name').value.trim(),note=$('review-note').value.trim(),decision=$('review-decision').value;
  if(!reviewId||!reviewer||!note){toast('Reviewer name and rationale are required.',true);return;}
  const hit=state.lastRun.ready.find(r=>r.session_id===reviewId);if(!hit){toast('Held or missing records cannot be approved.',true);return;}
  state.decisions.push({session_id:reviewId,charger_id:hit.charger_id,site_id:hit.site_id,allocation_party:hit.allocation_party,metered_kwh:hit.metered_kwh,allocated_gbp:hit.allocated_gbp,scope:hit.scope,source_sha256:hit.source_sha256,source_revision:state.sourceRevision,decision,reviewer,note,utc:new Date().toISOString()});
  state.decisions=state.decisions.slice(-1500);persist();$('review-editor').classList.add('hidden');render();toast(`Recorded ${decision} decision for ${reviewId}. No invoice issued.`);
});
$('reset-all').addEventListener('click',async()=>{if(!confirm('Reset the local demo? This discards uploaded records, reviews and investigation notes in this browser.'))return;await loadSamples(true);page('overview');});
for(const id of ['run-global','reconcile-hero','reconcile-after-edit'])$(id).addEventListener('click',run);
(async()=>{try{if(FILES.some(n=>!Array.isArray(state.data[n])))await loadSamples();else{if(state.lastRun&&canUseRun(state)){const actualHash=await sourceHash(state.data);if(actualHash!==state.lastRun.source_sha256){state.dirty=true;persist();render();toast('Saved source records do not match the last run. Reconciliation required.',true);}else render();}else await run();}}catch(e){render();toast(`Initial demo load failed: ${e.message}`,true);}})();
