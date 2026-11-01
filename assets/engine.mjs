/** EV CostCheck deterministic reconciliation engine.
 * Data never needs an external server. All financial calculations use integer
 * Wh and micro-pound tariff rates (BigInt), rounded HALF_UP once per session.
 * Independent synthetic-data exercise; not for billing or physical control.
 */
export const FILES=['sessions','meter_intervals','chargers','tariffs'];
export const COLUMNS={
  sessions:['session_id','charger_id','start_utc','end_utc','meter_start_wh','meter_end_wh'],
  meter_intervals:['session_id','start_utc','end_utc','meter_start_wh','meter_end_wh'],
  chargers:['charger_id','site_id','allocation_party'],
  tariffs:['site_id','start_utc','end_utc','gbp_per_kwh']
};
export const LIMITS={maxRows:12000,maxFileBytes:2_000_000};

export function parseCsv(input){
  const text=input.replace(/^\uFEFF/,''); const table=[];let row=[],cell='',quoted=false,afterQuote=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=ch;continue;}
    if(afterQuote){if(ch===','||ch==='\r'||ch==='\n'){afterQuote=false;}else if(ch===' '||ch==='\t'){continue;}else throw Error('Malformed CSV: text after closing quote');}
    if(ch==='"'){if(cell.trim())throw Error('Malformed CSV: misplaced quote');quoted=true;continue;}
    if(ch===','){row.push(cell);cell='';continue;}
    if(ch==='\r'||ch==='\n'){
      if(ch==='\r'&&text[i+1]==='\n')i++;
      row.push(cell);cell='';if(row.some(x=>x!==''))table.push(row);row=[];continue;
    }
    cell+=ch;
  }
  if(quoted)throw Error('Malformed CSV: unclosed quote');
  if(cell!==''||row.length){row.push(cell);if(row.some(x=>x!==''))table.push(row);}
  if(!table.length)throw Error('CSV is empty');
  const headers=table.shift().map(x=>x.trim());if(headers.some(x=>!x)||new Set(headers).size!==headers.length)throw Error('Empty or repeated CSV header');
  const rows=table.map((values,i)=>{
    if(values.length!==headers.length)throw Error(`Row ${i+2}: expected ${headers.length} columns; got ${values.length}`);
    return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));
  });
  if(rows.length>LIMITS.maxRows)throw Error('Too many rows for local demo');
  return {headers,rows};
}
export function validateFile(name,txt){
  if(txt.length>LIMITS.maxFileBytes)throw Error(`${name} exceeds 2 MB demo file limit`);
  const obj=parseCsv(txt);const missing=COLUMNS[name].filter(x=>!obj.headers.includes(x));
  if(missing.length)throw Error(`${name}.csv missing columns: ${missing.join(', ')}`);
  return obj.rows.map(r=>Object.fromEntries(COLUMNS[name].map(x=>[x,r[x]??''])));
}
function instant(str){
  if(!/(?:Z|[+-]\d\d:\d\d)$/i.test(str||''))throw Error('Timezone or UTC offset required');
  const parts=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/i.exec(str);
  if(!parts)throw Error('Invalid ISO-8601 timestamp (seconds and timezone required)');
  const [year,month,day,hour,minute,second]=parts.slice(1,7).map(Number), offset=parts[8].toUpperCase();
  const calendar=new Date(Date.UTC(year,month-1,day));
  if(year<1000||calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day||hour>23||minute>59||second>59)throw Error('Invalid calendar date or time');
  if(offset!=='Z'){
    const h=Number(offset.slice(1,3)),m=Number(offset.slice(4,6));
    if(h>14||m>59||(h===14&&m!==0))throw Error('Invalid timezone offset');
  }
  const ms=Date.parse(str);if(!Number.isFinite(ms))throw Error('Invalid timestamp');
  return ms;
}
function wh(str){
  if(!/^-?\d+$/.test(String(str??'')))throw Error('Meter readings must be whole Wh');
  return BigInt(str);
}
function tariffMicropounds(str){
  const s=String(str??'');if(!/^\d+(?:\.\d{1,6})?$/.test(s))throw Error('Tariff must be a nonnegative decimal with up to 6 places');
  const [a,b='']=s.split('.');const rate=BigInt(a)*1000000n+BigInt((b+'000000').slice(0,6));
  if(rate>1000000000n)throw Error('Tariff exceeds £1,000/kWh plausibility limit');
  return rate;
}
function sourceStamp(data){return JSON.stringify(FILES.map(name=>[name,data[name]]));}
export async function sourceHash(data){
  const bytes=new TextEncoder().encode(sourceStamp(data));
  if(globalThis.crypto?.subtle){const out=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(out),b=>b.toString(16).padStart(2,'0')).join('');}
  // Browser only uses secure origins or localhost. No silent weak fallback for approvals.
  throw Error('A secure browser origin is required for the approval audit fingerprint.');
}
function money(pence){return `${pence/100n}.${(pence%100n).toString().padStart(2,'0')}`;}
function fixedDecimal(value,divisor,digits){
 const whole=value/divisor, fraction=(value%divisor).toString().padStart(digits,'0');
 return `${whole}.${fraction}`;
}
// Explain each interval at full GBP precision; round once per session.
function traceRate(rate){return fixedDecimal(rate,1000000n,6);}
function traceCost(wh,rate){return fixedDecimal(wh*rate,1000000000n,9);}
function matchingTariff(tariffs,site,a,b){
  const overlapping=[];
  for(const r of tariffs){if(r.site_id!==site)continue;
    const x=instant(r.start_utc),y=instant(r.end_utc);if(x>=y)throw Error('Invalid tariff interval');
    if(x<b&&a<y)overlapping.push({x,y,r});
  }
  if(!overlapping.length)throw Error('No tariff covers interval');
  if(overlapping.length>1){
    overlapping.sort((a,b)=>a.x-b.x);
    if(overlapping.every((r,i)=>i===0||overlapping[i-1].y<=r.x))throw Error('Meter interval straddles a tariff boundary');
    throw Error('Multiple overlapping tariffs: ambiguous rate');
  }
  const t=overlapping[0];if(t.x>a||t.y<b)throw Error('Meter interval straddles a tariff boundary');
  return tariffMicropounds(t.r.gbp_per_kwh);
}
export async function reconcile(data){
  for(const n of FILES)if(!Array.isArray(data[n]))throw Error(`Missing file: ${n}.csv`);
  const stamp=await sourceHash(data);
  const counts=new Map(), chargerCounts=new Map(),chargerMap=new Map(),grouped=new Map();
  for(const s of data.sessions)counts.set(s.session_id,(counts.get(s.session_id)||0)+1);
  for(const c of data.chargers){chargerCounts.set(c.charger_id,(chargerCounts.get(c.charger_id)||0)+1);chargerMap.set(c.charger_id,c);}
  for(const m of data.meter_intervals){const arr=grouped.get(m.session_id)||[];arr.push(m);grouped.set(m.session_id,arr);}
  const ready=[],held=[];
  const put=(s,site='',party='',status='HOLD',reason='',consumption='',amount='',breakdown=[])=>{
    const rec={session_id:s.session_id||'',charger_id:s.charger_id||'',site_id:site,allocation_party:party,status,source_sha256:stamp};
    if(status==='HOLD')held.push({...rec,exception_id:`E${String(held.length+1).padStart(4,'0')}`,reason});
    else ready.push({...rec,metered_kwh:consumption,allocated_gbp:amount,breakdown,scope:'variable_energy_only_excl_VAT_and_fixed_charges'});
  };
  for(const s of data.sessions){let site='',party='';try{
    if(!s.session_id)throw Error('Missing session ID');
    if(!s.charger_id)throw Error('Missing charger ID');
    if(counts.get(s.session_id)!==1)throw Error('Duplicate session ID: all instances held');
    if(chargerCounts.get(s.charger_id)>1)throw Error('Duplicated charger mapping');
    const charger=chargerMap.get(s.charger_id);if(!charger)throw Error('Charger not in approved property register');
    site=charger.site_id;party=charger.allocation_party;
    if(!site||!party)throw Error('Property mapping incomplete');
    const start=instant(s.start_utc),end=instant(s.end_utc);if(end<=start)throw Error('Invalid session start/end');
    const a=wh(s.meter_start_wh),b=wh(s.meter_end_wh);if(a<0n||b<a)throw Error('Invalid session cumulative meter readings');
    const segments=grouped.get(s.session_id)||[];if(!segments.length)throw Error('No interval readings');
    const intervals=segments.map(m=>({start:instant(m.start_utc),end:instant(m.end_utc),a:wh(m.meter_start_wh),b:wh(m.meter_end_wh)})).sort((x,y)=>x.start-y.start);
    if(intervals.some(v=>v.end<=v.start||v.a<0n||v.b<v.a))throw Error('Invalid interval meter readings');
    if(intervals[0].start!==start||intervals.at(-1).end!==end)throw Error('Interval data does not cover the complete session');
    if(intervals[0].a!==a||intervals.at(-1).b!==b)throw Error('Session and interval meter readings disagree');
    let prevEnd=start,prevWh=a,total=0n,used=0n;const breakdown=[];
    for(const v of intervals){
      if(v.start!==prevEnd)throw Error('Gap or overlap in meter intervals');
      if(v.a!==prevWh)throw Error('Discontinuous cumulative meter readings');
      const rate=matchingTariff(data.tariffs,site,v.start,v.end);
      const delta=v.b-v.a;used+=delta;total+=delta*rate;prevEnd=v.end;prevWh=v.b;
      breakdown.push({start_utc:new Date(v.start).toISOString(),end_utc:new Date(v.end).toISOString(),
        metered_kwh:fixedDecimal(delta,1000n,3),rate_gbp_per_kwh:traceRate(rate),
        unrounded_gbp:traceCost(delta,rate),meter_start_wh:v.a.toString(),meter_end_wh:v.b.toString()});
    }
    if(used!==b-a)throw Error('Energy consumption cannot be reconciled');
    // numerator unit = Wh * GBP * 10^6/ kWh; divide by 1e7 for penny.
    const pence=(total+5000000n)/10000000n;
    const formattedKwh=`${used/1000n}.${(used%1000n).toString().padStart(3,'0')}`;
    put(s,site,party,'PENDING_HUMAN_REVIEW','',formattedKwh,money(pence),breakdown);
  }catch(e){put(s,site,party,'HOLD',e.message||'Invalid record');}}

  // Shared cumulative meter register per charger: overlapping positive Wh
  // ranges across individually valid sessions would count energy twice.
  // Distinct connector meters and meter resets require a separate model.
  const byCharger=new Map();
  for(const rec of ready){
    const session=data.sessions.find(s=>s.session_id===rec.session_id);
    const group=byCharger.get(rec.charger_id)||[];
    group.push({rec,start:wh(session.meter_start_wh),end:wh(session.meter_end_wh)});
    byCharger.set(rec.charger_id,group);
  }
  const conflicting=new Set();
  for(const rows of byCharger.values()){
    rows.sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);
    let maximum=null;
    for(const row of rows){
      if(maximum&&row.start<maximum.end&&row.start<row.end&&maximum.start<maximum.end){
        conflicting.add(row.rec.session_id);conflicting.add(maximum.rec.session_id);
      }
      if(!maximum||row.end>maximum.end)maximum=row;
    }
  }
  if(conflicting.size){
    const safe=ready.filter(rec=>{
      if(!conflicting.has(rec.session_id))return true;
      held.push({...rec,status:'HOLD',exception_id:`E${String(held.length+1).padStart(4,'0')}`,reason:'Overlapping cumulative meter energy across sessions on the same charger: possible double count'});
      return false;
    });
    ready.splice(0,ready.length,...safe);
  }
  const seen=new Set(data.sessions.map(s=>s.session_id));
  for(const sid of Array.from(grouped.keys()).sort())if(!seen.has(sid))put({session_id:sid},'','','HOLD','Orphan interval readings without session');
  // Stable case keys persist owner/status through unrelated source edits.
  const occurrence=new Map();
  for(const rec of held){
    const base=JSON.stringify([rec.session_id,rec.charger_id,rec.reason]);
    const nth=occurrence.get(base)||0;occurrence.set(base,nth+1);
    rec.case_key=JSON.stringify(['case-v2',rec.session_id,rec.charger_id,rec.reason,nth]);
  }
  const totalPence=ready.reduce((sum,r)=>{const [p,q]=r.allocated_gbp.split('.');return sum+BigInt(p)*100n+BigInt(q);},0n);
  const summary={ready_for_review:ready.length,held:held.length,candidate_total_gbp:money(totalPence),approved_for_billing:false,source_sha256:stamp,scope:'Variable energy costs only; excludes VAT, standing charges, charger losses, PV/battery apportionment, supplier reconciliation and customer invoicing.'};
  return {ready,held,summary,source_sha256:stamp};
}
export function currentReviews(result,decisionLog){
  const valid=new Map(result.ready.map(r=>[r.session_id,r.source_sha256]));
  const current={},stale=[];
  for(const row of result.ready){
    const decisions=decisionLog.filter(d=>d.session_id===row.session_id&&d.source_sha256===row.source_sha256&&(result.source_revision===undefined||d.source_revision===result.source_revision));
    current[row.session_id]=decisions.length?decisions.at(-1):{decision:'pending'};
  }
  for(const d of decisionLog)if(valid.get(d.session_id)!==d.source_sha256||(result.source_revision!==undefined&&d.source_revision!==result.source_revision))stale.push(d);
  return {current,stale};
}
/** A pending source edit makes the last reconciliation unusable for decisions or exports.
 * Historical approvals remain in the audit log but are no longer current.
 */
export function canUseRun(state){
  return Boolean(state?.lastRun&&!state?.dirty&&Number.isSafeInteger(state.sourceRevision)&&state.lastRun.source_revision===state.sourceRevision);
}
export function effectiveReviews(result,decisionLog=[],dirty=false){
  if(!result)return {current:{},stale:[...decisionLog]};
  if(dirty){return {current:Object.fromEntries(result.ready.map(r=>[r.session_id,{decision:'pending'}])),stale:[...decisionLog]};}
  return currentReviews(result,decisionLog);
}
export function renderCsv(data,cols){
  const safe=v=>{let s=String(v??'');if(/^[\t\r\n ]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return cols.map(safe).join(',')+'\r\n'+data.map(r=>cols.map(c=>safe(r[c])).join(',')).join('\r\n')+'\r\n';
}
export function deterministicBrief(result,reviewerStatuses={}){
  const lines=[`Reconciliation review — ${result.ready.length} allocations awaiting decision; ${result.held.length} held records.`,
  `Candidate variable-energy total: £${result.summary.candidate_total_gbp}. Not approved for billing.`,
  ...result.held.map(e=>`${e.session_id||'[missing session ID]'}: ${e.reason}. Action: inspect and correct the corresponding source record.`),
  ...result.ready.map(r=>`${r.session_id}: £${r.allocated_gbp}, review ${reviewerStatuses[r.session_id]?.decision||'pending'}.`)];
  return lines.join('\n');
}
