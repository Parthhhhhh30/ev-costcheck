"""Real-origin end-to-end release test (no mocked APIs, storage or cryptography).
Usage: BASE_URL=http://127.0.0.1:4173 python tests/browser_live.py
Works on unrestricted developer machines/CI/Vercel preview. This restricted
runtime blocks navigation to localhost and cannot run this live test.
"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE_URL=os.environ.get('BASE_URL','http://127.0.0.1:4173')

def main():
 with sync_playwright() as pw:
  executable=os.environ.get('CHROMIUM_EXECUTABLE')
  b=pw.chromium.launch(headless=True,**({'executable_path':executable,'args':['--no-sandbox']} if executable else {}))
  page=b.new_page(viewport={'width':1365,'height':850},accept_downloads=True)
  page.set_default_timeout(8000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  csp_errors=[];page.on('console',lambda message:csp_errors.append(message.text) if ('Content Security Policy' in message.text and 'Refused' in message.text) else None)
  response=page.goto(BASE_URL,wait_until='domcontentloaded',timeout=15000)
  assert response and response.status==200, f'Cannot load {BASE_URL}'
  page.wait_for_function("document.querySelector('#stat-ready').textContent==='3'",timeout=10000)
  assert page.locator('#stat-held').inner_text()=='6'
  assert page.locator('#stat-total').inner_text()=='£6.94'
  page.locator('[data-page="exceptions"]').first.click()
  page.locator('[data-action="owner"]').first.fill('Sample coordinator')
  page.locator('[data-action="owner"]').first.dispatch_event('change')
  page.locator('[data-action="status"]').first.select_option('investigating')
  with page.expect_download() as event:page.locator('#download-exceptions').click()
  raw=Path(event.value.path()).read_text()
  assert 'HOLD' in raw and 'investigating' in raw
  # Block cryptographic fingerprinting and edit data mid-reconciliation.
  # This regression must run on a real HTTP origin with native WebCrypto.
  page.evaluate("""() => {
    window.__digestOriginal = crypto.subtle.digest.bind(crypto.subtle);
    window.__hashWaiters = [];
    crypto.subtle.digest = async (...args) => {
      await new Promise(resolve => window.__hashWaiters.push(resolve));
      return window.__digestOriginal(...args);
    };
  }""")
  page.locator('#run-global').click()
  page.wait_for_function('window.__hashWaiters.length===1')
  page.locator('[data-page="sources"]').first.click()
  page.locator('#table-select').select_option('tariffs')
  rate=page.locator('#source-table input[data-col="gbp_per_kwh"]').first
  original_rate=rate.input_value();rate.fill('0.19');rate.dispatch_event('change')
  assert page.locator('#stat-ready').inner_text()=='—'
  page.evaluate('window.__hashWaiters.splice(0).forEach(resolve=>resolve())')
  page.wait_for_timeout(180)
  assert page.locator('#stat-ready').inner_text()=='—','An in-flight stale calculation revived as current'
  page.evaluate('() => { crypto.subtle.digest = window.__digestOriginal; }')
  rate=page.locator('#source-table input[data-col="gbp_per_kwh"]').first
  rate.fill(original_rate);rate.dispatch_event('change')
  page.locator('#run-global').click()
  page.wait_for_function("document.querySelector('#stat-ready').textContent==='3'")
  assert page.locator('#stat-total').inner_text()=='£6.94'
  page.locator('[data-page="allocations"]').first.click()
  page.locator('[data-review="S100"]').click()
  page.locator('#review-name').fill('Release reviewer')
  page.locator('#review-note').fill('Checked source data, interval continuity and tariff scope.')
  page.locator('#save-review').click()
  assert page.locator('#stat-reviewed').inner_text()=='1'
  # A reviewer must approve identifiable candidate evidence, not just a session ID.
  page.locator('[data-page="audit"]').first.click()
  with page.expect_download() as event:page.locator('#download-audit').click()
  first_audit=json.loads(Path(event.value.path()).read_text())
  approved=first_audit['decisions'][0]
  assert approved['allocated_gbp']=='1.80' and approved['metered_kwh']=='10.000'
  assert approved['site_id']=='BRIGHTON-OFFICE'
  assert first_audit['current_source_data']['sessions']
  page.locator('[data-page="sources"]').first.click()
  page.locator('#table-select').select_option('tariffs')
  first=page.locator('#source-table input[data-col="gbp_per_kwh"]').first
  original=first.input_value();first.fill('0.21');first.dispatch_event('change')
  assert page.locator('#stat-ready').inner_text()=='—'
  page.locator('[data-page="allocations"]').first.click();page.locator('#download-allocations').click()
  assert 'Reconcile before using results' in page.locator('#toast').inner_text()
  page.locator('#run-global').click()
  page.wait_for_function("document.querySelector('#stat-ready').textContent==='3'")
  assert page.locator('#stat-reviewed').inner_text()=='0'
  page.locator('[data-page="exceptions"]').first.click()
  assert page.locator('[data-action="owner"]').first.input_value()=='Sample coordinator', 'Unrelated source edit erased an existing investigation owner'
  assert page.locator('[data-action="status"]').first.input_value()=='investigating'
  page.locator('[data-page="sources"]').first.click()
  first=page.locator('#source-table input[data-col="gbp_per_kwh"]').first
  first.fill(original);first.dispatch_event('change');page.locator('#run-global').click()
  page.wait_for_function("document.querySelector('#stat-ready').textContent==='3'")
  assert page.locator('#stat-total').inner_text()=='£6.94'
  assert page.locator('#stat-reviewed').inner_text()=='0'
  page.reload(wait_until='domcontentloaded')
  page.wait_for_function("document.querySelector('#stat-ready').textContent==='3'")
  assert page.locator('#stat-reviewed').inner_text()=='0','Approval improperly revived on refresh'
  page.locator('[data-page="audit"]').first.click()
  with page.expect_download() as event:page.locator('#download-audit').click()
  report=json.loads(Path(event.value.path()).read_text())
  assert report['decisions'][0]['reviewer']=='Release reviewer'
  assert report['exception_actions']
  # Recruiter journey: the interactive actions must mutate real inputs and
  # recompute the full engine output, not just swap numbers in a dashboard.
  page.locator('[data-page="overview"]').first.click()
  page.locator('#explain-s101-hero').click()
  assert 'why £3.14' in page.locator('#explain-title').inner_text()
  assert page.locator('#explain-table tbody tr').count()==2
  assert '0.900000000' in page.locator('#explain-table').inner_text()
  assert '2.240000000' in page.locator('#explain-table').inner_text()
  page.locator('#close-explain').click()
  page.locator('[data-page="overview"]').first.click()
  page.locator('[data-scenario="tariff"]').click()
  page.wait_for_function("document.querySelector('#stat-total').textContent==='£7.39'")
  assert '£6.94 → £7.39' in page.locator('#change-comparison').inner_text()
  assert 'S101: £3.14 → £3.29' in page.locator('#change-comparison').inner_text()
  page.reload(wait_until='domcontentloaded')
  page.wait_for_function("document.querySelector('#stat-total').textContent==='£7.39'")
  assert '£6.94 → £7.39' in page.locator('#change-comparison').inner_text()
  page.locator('[data-scenario="mapping"]').click()
  page.wait_for_function("document.querySelector('#stat-total').textContent==='£7.89'")
  assert page.locator('#stat-ready').inner_text()=='4'
  assert page.locator('#stat-held').inner_text()=='5'
  assert 'S103: moved into review (£0.50)' in page.locator('#change-comparison').inner_text()
  page.locator('[data-scenario="overlap"]').click()
  page.wait_for_function("document.querySelector('#stat-total').textContent==='£5.89'")
  assert page.locator('#stat-ready').inner_text()=='3'
  assert page.locator('#stat-held').inner_text()=='7'
  assert 'S102: moved from review onto HOLD' in page.locator('#change-comparison').inner_text()
  page.once('dialog',lambda d:d.accept())
  page.locator('#reset-scenarios').click()
  page.wait_for_function("document.querySelector('#stat-total').textContent==='£6.94'")
  assert page.locator('#stat-ready').inner_text()=='3'
  assert page.locator('#stat-held').inner_text()=='6'
  assert not page.locator('#change-comparison').get_attribute('data-unchanged')
  page.set_viewport_size({'width':390,'height':844})
  page.locator('[data-page="overview"]').first.click()
  assert page.locator('#stat-ready').inner_text()=='3'
  assert not errors,errors
  assert not csp_errors,csp_errors
  print('LIVE BROWSER PASS:',BASE_URL,'real SHA-256, real navigation, real localStorage and downloads')
  b.close()
if __name__=='__main__': main()
