"""Chromium DOM integration smoke test, loading the actual UI scripts in-memory.
The runtime blocks navigation to localhost/file:; this runs on about:blank with mocked
fetch/localStorage and WebCrypto digest, so this is NOT a deployed origin test.
Run: python tests/browser_smoke.py
"""
import base64,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
ENGINE=(ROOT/'assets/engine.mjs').read_bytes()
APP=(ROOT/'assets/app.mjs').read_text().replace("from './engine.mjs'", "from 'data:text/javascript;base64,"+base64.b64encode(ENGINE).decode()+"'")
FILES={p.name:p.read_text() for p in (ROOT/'sample_data').glob('*.csv')}
MOCK='''
const csvFiles=__CSV__;
const store=new Map();
Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
Object.defineProperty(window,'crypto',{configurable:true,value:{subtle:{digest:async(_name,buffer)=>{
  // Deterministic browser-harness digest; financial calculations remain production code.
  let a=2166136261;for(const c of new Uint8Array(buffer))a=Math.imul(a^c,16777619)>>>0;
  const x=new Uint8Array(32);for(let i=0;i<32;i++){a=Math.imul(a^i,16777619)>>>0;x[i]=a&255;}return x.buffer;
}}}});
window.fetch=async url=>{const name=String(url).split('/').pop().split('?')[0];if(csvFiles[name]!==undefined)return {ok:true,text:async()=>csvFiles[name]};throw Error('Unexpected network: '+url)};
'''.replace('__CSV__',json.dumps(FILES))

def check():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1400,'height':900},accept_downloads=True)
  page.set_default_timeout(3500)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  # Replace the external script with its identical source; other DOM remains the actual app.
  html=re.sub(r'<script type="module" src="/assets/app.mjs"></script>','',HTML)
  html=html.replace('<link rel="stylesheet" href="/assets/app.css">','<style>'+(ROOT/'assets/app.css').read_text()+'</style>')
  page.set_content(html,wait_until='domcontentloaded')
  page.add_script_tag(content=MOCK)
  page.add_script_tag(type='module',content=APP)
  page.wait_for_function("document.querySelector('#stat-ready').textContent==='3'",timeout=10000)
  assert page.locator('#stat-held').inner_text()=='6'
  assert page.locator('#stat-total').inner_text()=='£6.94'
  # Investigate a held record and export the action register.
  print('nav exceptions',flush=True); page.locator('[data-page="exceptions"]').first.click()
  print('TEST STEP: page.locator(\'[data-action="owner"]\').first.fill',flush=True); page.locator('[data-action="owner"]').first.fill('Operations coordinator')
  page.locator('[data-action="owner"]').first.dispatch_event('change')
  page.locator('[data-action="status"]').first.select_option('investigating')
  print('TEST STEP: with page.expect_download() as download:',flush=True)
  with page.expect_download() as download:
   page.locator('#download-exceptions').click()
  dl=download.value
  contents=Path(dl.path()).read_text()
  assert 'investigation_status' in contents and 'investigating' in contents and 'HOLD' in contents
  # While the digest is waiting, edit the source. No in-flight calculation may
  # be published as current under the new revision or unlock stale approvals.
  page.evaluate("""() => {
    window.__hashWaiters=[];
    const originalDigest=window.crypto.subtle.digest;
    window.crypto.subtle.digest=async (...args) => {
      await new Promise(resolve => window.__hashWaiters.push(resolve));
      return originalDigest(...args);
    };
  }""")
  page.locator('#run-global').click()
  page.wait_for_function('window.__hashWaiters.length===1')
  page.locator('[data-page="sources"]').first.click()
  page.locator('#table-select').select_option('tariffs')
  rate=page.locator('#source-table input[data-col="gbp_per_kwh"]').first
  original_rate=rate.input_value(); rate.fill('0.19');rate.dispatch_event('change')
  assert page.locator('#stat-ready').inner_text()=='—'
  page.evaluate('window.__hashWaiters.splice(0).forEach(resolve=>resolve())')
  page.wait_for_timeout(200)
  assert page.locator('#stat-ready').inner_text()=='—', 'In-flight reconciliation incorrectly cleared source-dirty hold'
  page.evaluate('delete window.__hashWaiters')
  # Run with normal hashing again; the old, interrupted run must not overwrite it.
  page.evaluate("""() => {
    window.crypto.subtle.digest = async(_name,buffer) => {
      let a=2166136261;for(const c of new Uint8Array(buffer))a=Math.imul(a^c,16777619)>>>0;
      const x=new Uint8Array(32);for(let i=0;i<32;i++){a=Math.imul(a^i,16777619)>>>0;x[i]=a&255;}return x.buffer;
    }
  }""")
  rate=page.locator('#source-table input[data-col="gbp_per_kwh"]').first
  rate.fill(original_rate);rate.dispatch_event('change')
  page.locator('#run-global').click()
  page.wait_for_function("document.querySelector('#stat-ready').textContent==='3'")
  # Review a valid session.
  print('TEST STEP: page.locator(\'[data-page="allocations"]\').first.click()',flush=True); page.locator('[data-page="allocations"]').first.click()
  print('TEST STEP: page.locator(\'[data-review="S100"]\').click()',flush=True); page.locator('[data-review="S100"]').click()
  page.locator('#review-name').fill('Reviewer One')
  page.locator('#review-note').fill('Verified interval evidence and tariff applicability against synthetic fixtures.')
  print('TEST STEP: page.locator(\'#save-review\').click()',flush=True); page.locator('#save-review').click()
  assert page.locator('#stat-reviewed').inner_text()=='1'
  # Change a tariff: immediately hide outdated costs and deny exports.
  page.locator('[data-page="sources"]').first.click()
  print('TEST STEP: page.locator(\'#table-select\').select_option(\'tariffs\')',flush=True); page.locator('#table-select').select_option('tariffs')
  first=page.locator('#source-table input[data-col="gbp_per_kwh"]').first
  original=first.input_value();first.fill('0.21');first.dispatch_event('change')
  assert page.locator('#stat-ready').inner_text()=='—'
  assert 'Reconcile' in page.locator('#footer-status').inner_text()
  page.locator('[data-page="allocations"]').first.click();page.locator('#download-allocations').click()
  assert 'Reconcile before using results' in page.locator('#toast').inner_text()
  print('TEST STEP: page.locator(\'#run-global\').click()',flush=True); page.locator('#run-global').click()
  page.wait_for_function("document.querySelector('#stat-ready').textContent==='3'")
  assert page.locator('#stat-reviewed').inner_text()=='0'
  # Revert to original value; historical review must not revive.
  page.locator('[data-page="sources"]').first.click()
  first=page.locator('#source-table input[data-col="gbp_per_kwh"]').first
  first.fill(original);first.dispatch_event('change');print('TEST STEP: page.locator(\'#run-global\').click()',flush=True); page.locator('#run-global').click()
  page.wait_for_function("document.querySelector('#stat-ready').textContent==='3'")
  assert page.locator('#stat-total').inner_text()=='£6.94'
  assert page.locator('#stat-reviewed').inner_text()=='0'
  page.locator('[data-page="audit"]').first.click()
  assert page.locator('#audit-table').locator('text=Stale').count()>=1
  # Export audit includes original decision AND exception action data.
  print('TEST STEP: with page.expect_download() as download:',flush=True)
  with page.expect_download() as download:page.locator('#download-audit').click()
  exported=json.loads(Path(download.value.path()).read_text())
  assert exported['decisions'][0]['reviewer']=='Reviewer One'
  assert exported['exception_actions']
  page.screenshot(path=str(ROOT/'docs/browser-desktop-smoke.png'),full_page=True)
  # Functional mobile navigation and content layout at phone width.
  print('TEST STEP: page.set_viewport_size({\'width\':390,\'height\':844})',flush=True); page.set_viewport_size({'width':390,'height':844})
  page.locator('[data-page="overview"]').first.click()
  assert page.locator('#stat-ready').inner_text()=='3'
  page.screenshot(path=str(ROOT/'docs/browser-mobile-smoke.png'),full_page=True)
  assert not errors, 'Browser JavaScript errors: '+str(errors)
  print('PASS: Chromium DOM interaction; sample 3/6/£6.94; exception status export; review; edit/hold; rerun; revert stale; audit; mobile smoke')
  browser.close()
if __name__=='__main__':check()
