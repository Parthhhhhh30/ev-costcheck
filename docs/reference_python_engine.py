"""EV CostCheck: evidence-first, deterministic charging cost reconciliation.

Independent synthetic-data portfolio exercise. Not billing, not a production energy system.
No third-party Python dependencies are required.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, sqlite3, sys
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

CENTS = Decimal('0.01')


def utc(s: str) -> datetime:
    d = datetime.fromisoformat(s.replace('Z', '+00:00'))
    if d.utcoffset() is None:
        raise ValueError('Timezone/UTC offset required')
    return d.astimezone(timezone.utc)


def dec(s: str) -> Decimal:
    d=Decimal(str(s))
    if not d.is_finite(): raise ValueError('Nonfinite number')
    return d


def rows(path: Path):
    with path.open(newline='', encoding='utf-8-sig') as f:
        rd=csv.DictReader(f)
        if not rd.fieldnames: raise ValueError(f'Empty CSV: {path}')
        return [dict(r) for r in rd]


def writecsv(path, head, data):
    with open(path,'w',newline='',encoding='utf-8') as f:
        wr=csv.DictWriter(f,fieldnames=head,extrasaction='ignore')
        wr.writeheader(); wr.writerows(data)


def fingerprint(r, segments, chargers, tariffs):
    # Conservative audit rule: re-review any allocation after ANY tariff or mapping change.
    compact=json.dumps({'engine_schema':'reconciliation_v1','session':r,'meter_intervals':segments,'charger_register':chargers,'tariff_schedule':tariffs},sort_keys=True,separators=(',',':'))
    return hashlib.sha256(compact.encode()).hexdigest()


def tariff_for(tariffs, site, start, end):
    """A reading interval must be wholly covered by exactly one tariff.
    This intentionally rejects readings straddling a tariff change, as kWh
    cannot be accurately split from elapsed time alone.
    """
    overlapping=[]
    for r in tariffs:
        if r['site_id'] != site: continue
        ts, te=utc(r['start_utc']),utc(r['end_utc'])
        if ts >= te: raise ValueError('Invalid tariff interval')
        if ts < end and start < te: overlapping.append(r)
    if len(overlapping)==0: raise ValueError('No tariff covers interval')
    if len(overlapping)>1:
        t=sorted((utc(r['start_utc']),utc(r['end_utc'])) for r in overlapping)
        if all(t[i][1] <= t[i+1][0] for i in range(len(t)-1)):
            raise ValueError('Meter interval straddles a tariff boundary')
        raise ValueError('Multiple overlapping tariffs: ambiguous rate')
    candidates=[r for r in overlapping if utc(r['start_utc']) <= start and end <= utc(r['end_utc'])]
    if len(candidates)!=1: raise ValueError('Meter interval straddles a tariff boundary')
    rate=dec(candidates[0]['gbp_per_kwh'])
    if rate < 0: raise ValueError('Negative tariff')
    return rate


def calculate(sessions,meters,chargers,tariffs):
    charger_ids={}
    duplicated_chargers={r['charger_id'] for r in chargers if sum(z['charger_id']==r['charger_id'] for z in chargers)>1}
    for r in chargers: charger_ids[r['charger_id']]=r
    grouped={}
    for m in meters: grouped.setdefault(m['session_id'],[]).append(m)
    counter=Counter(x['session_id'] for x in sessions)
    alloc, exc=[] ,[]
    for s in sessions:
        sid=s.get('session_id','')
        seg=grouped.get(sid,[])
        sh=fingerprint(s,seg,chargers,tariffs)
        reason=''; amount=None; kwh=None; site=''; alloc_to=''
        try:
            if not sid: raise ValueError('Missing session ID')
            if counter[sid]!=1: raise ValueError('Duplicate session ID: all instances held')
            cid=s['charger_id']
            if cid in duplicated_chargers: raise ValueError('Duplicated charger mapping')
            if cid not in charger_ids: raise ValueError('Charger not in approved property register')
            site=charger_ids[cid]['site_id'];alloc_to=charger_ids[cid]['allocation_party']
            st,en=utc(s['start_utc']),utc(s['end_utc'])
            if en <= st: raise ValueError('Invalid session start/end')
            start_wh, end_wh=dec(s['meter_start_wh']),dec(s['meter_end_wh'])
            if start_wh < 0 or end_wh < start_wh: raise ValueError('Invalid session cumulative meter readings')
            if not seg: raise ValueError('No interval readings')
            intervals=[]
            for m in seg:
                ms,me=utc(m['start_utc']),utc(m['end_utc'])
                a,b=dec(m['meter_start_wh']),dec(m['meter_end_wh'])
                if me<=ms or b<a or a<0: raise ValueError('Invalid interval meter readings')
                intervals.append((ms,me,a,b))
            intervals.sort(key=lambda x:x[0])
            if intervals[0][0]!=st or intervals[-1][1]!=en:
                raise ValueError('Interval data does not cover the complete session')
            if intervals[0][2]!=start_wh or intervals[-1][3]!=end_wh:
                raise ValueError('Session and interval meter readings disagree')
            total=Decimal(0); measured=Decimal(0)
            prev_end=st;prev_wh=start_wh
            for a,b,m0,m1 in intervals:
                if a!=prev_end: raise ValueError('Gap or overlap in meter intervals')
                if m0!=prev_wh: raise ValueError('Discontinuous cumulative meter readings')
                rate=tariff_for(tariffs,site,a,b)
                used=(m1-m0)/Decimal(1000)
                measured+=used;total+=used*rate
                prev_end=b;prev_wh=m1
            if measured != (end_wh-start_wh)/Decimal(1000):
                raise ValueError('Energy consumption cannot be reconciled')
            amount=total.quantize(CENTS,rounding=ROUND_HALF_UP)
            kwh=measured
        except (ValueError,KeyError,InvalidOperation,OverflowError) as e:
            reason=str(e)
        base={'session_id':sid,'charger_id':s.get('charger_id',''), 'site_id':site,'allocation_party':alloc_to, 'source_sha256':sh}
        if reason:
            exc.append({**base,'status':'HOLD','reason':reason})
        else:
            alloc.append({**base,'status':'PENDING_HUMAN_REVIEW','metered_kwh':str(kwh),'allocated_gbp':f'{amount:.2f}', 'scope':'variable_energy_only_excl_VAT_and_fixed_charges'})
    # Warn if meter data exists for a session that isn't in the session file.
    known={s.get('session_id','') for s in sessions}
    for sid in sorted(set(grouped)-known):
        exc.append({'session_id':sid,'charger_id':'','site_id':'','allocation_party':'','source_sha256':'','status':'HOLD','reason':'Orphan interval readings without session'})
    return alloc,exc


def run(input_dir:Path,output_dir:Path):
    input_dir=input_dir.resolve();output_dir.mkdir(parents=True,exist_ok=True)
    data={s:rows(input_dir/(s+'.csv')) for s in ('sessions','meter_intervals','chargers','tariffs')}
    allocations,exceptions=calculate(data['sessions'],data['meter_intervals'],data['chargers'],data['tariffs'])
    writecsv(output_dir/'allocations_pending.csv', ['session_id','charger_id','site_id','allocation_party','status','metered_kwh','allocated_gbp','scope','source_sha256'],allocations)
    writecsv(output_dir/'exceptions.csv',['session_id','charger_id','site_id','allocation_party','status','reason','source_sha256'],exceptions)
    total=sum((dec(r['allocated_gbp']) for r in allocations),Decimal('0.00'))
    summary={'ready_for_review':len(allocations),'held':len(exceptions),'candidate_total_gbp':f'{total:.2f}','approved_for_billing':False,'scope':'Variable energy costs only; excludes VAT, standing charges, charger losses, PV/battery apportionment, supplier reconciliation and customer invoicing.'}
    (output_dir/'summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    packet={'instructions':'Draft only a factual reviewer briefing. No new numbers, approvals, assumptions, billing instruction or inferred causes. Cite session IDs and copy exact status/reason. Human review required.', 'summary':summary,'held_records':[{k:v for k,v in e.items() if k in ('session_id','status','reason')} for e in exceptions],'ready_ids':[r['session_id'] for r in allocations]}
    (output_dir/'ai_briefing_packet.json').write_text(json.dumps(packet,indent=2)+'\n',encoding='utf-8')
    notes=[f'# EV CostCheck reconciliation: synthetic demo', '',f'**Cost allocations awaiting review:** {len(allocations)}',f'**Held / cannot allocate:** {len(exceptions)}',f'**Candidate variable-energy total:** £{total:.2f} (NOT an invoice; unapproved)', '', '## Exceptions requiring follow-up']
    notes +=[f"- {e['session_id'] or '[missing ID]'} — {e['reason']}" for e in exceptions] or ['- None found in supplied test data.']
    notes +=['','## Controls','- Every pending allocation requires named human approval.','- Only interval meter readings can support allocation across changing tariffs.','- Cannot treat charger output as proof of grid procurement costs.','- No customer billing, VAT, fixed charges or physical charger control.','- Check source meter accuracy and electricity contracts before real use.']
    (output_dir/'review_brief.md').write_text('\n'.join(notes)+'\n',encoding='utf-8')
    db=sqlite3.connect(output_dir/'audit.sqlite')
    db.execute('CREATE TABLE IF NOT EXISTS decisions (decision_id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, source_sha256 TEXT, decision TEXT, reviewer TEXT, note TEXT, decided_at_utc TEXT)')
    db.commit();db.close()
    print(json.dumps(summary,indent=2))
    return summary


def approve(out:Path,sid:str,reviewer:str,decision:str,note:str):
    if not reviewer.strip() or not note.strip(): raise ValueError('Reviewer and rationale required')
    pending=rows(out/'allocations_pending.csv')
    hit=[r for r in pending if r['session_id']==sid]
    if len(hit)!=1: raise ValueError('Session is not uniquely eligible for review (may be held)')
    with sqlite3.connect(out/'audit.sqlite') as db:
        db.execute('INSERT INTO decisions (session_id,source_sha256,decision,reviewer,note,decided_at_utc) VALUES (?,?,?,?,?,?)',(sid,hit[0]['source_sha256'],decision,reviewer,note,datetime.now(timezone.utc).isoformat()))
        db.commit()
    print(f'Audit decision saved: {sid} {decision} by {reviewer}. This does not issue an invoice.')


def review_status(out:Path):
    """Show current review state; old approvals on altered data are never treated as current."""
    pending=rows(out/'allocations_pending.csv')
    with sqlite3.connect(out/'audit.sqlite') as db:
        decisions=db.execute('SELECT session_id, source_sha256, decision, reviewer, decided_at_utc FROM decisions ORDER BY decision_id').fetchall()
    latest={}
    for sid,source_hash,decision,reviewer,stamp in decisions:
        latest[(sid,source_hash)]={'decision':decision,'reviewer':reviewer,'utc':stamp}
    valid={(r['session_id'],r['source_sha256']) for r in pending}
    result={r['session_id']:latest.get((r['session_id'],r['source_sha256']),{'decision':'pending'}) for r in pending}
    stale=[{'session_id':sid,'decision':decision,'utc':stamp} for sid,sha,decision,_,stamp in decisions if (sid,sha) not in valid]
    print(json.dumps({'current_session_reviews':result,'stale_or_ineligible_historical_decisions':stale,'ready_record_count':len(pending)},indent=2))


def main():
    p=argparse.ArgumentParser(description=__doc__)
    sub=p.add_subparsers(dest='command',required=True)
    r=sub.add_parser('run',help='Reconcile files and create review-ready outputs')
    r.add_argument('--input',default='sample_data');r.add_argument('--output',default='output')
    a=sub.add_parser('review',help='Record a human approve/reject decision on one pending allocation')
    a.add_argument('--output',default='output');a.add_argument('--session-id',required=True);a.add_argument('--reviewer',required=True);a.add_argument('--decision',required=True,choices=['approve','reject']);a.add_argument('--note',required=True)
    q=sub.add_parser('status',help='Show reviewed/pending cases and invalidate stale approvals after reruns')
    q.add_argument('--output',default='output')
    args=p.parse_args()
    if args.command=='run':run(Path(args.input),Path(args.output))
    elif args.command=='review':approve(Path(args.output),args.session_id,args.reviewer,args.decision,args.note)
    else:review_status(Path(args.output))
if __name__=='__main__':
    try:main()
    except (ValueError,FileNotFoundError) as ex: print(f'ERROR: {ex}',file=sys.stderr);sys.exit(2)
