import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/brief.js';
function response(){return {code:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(c){this.code=c;return this;},json(obj){this.body=obj;return this;}};}
async function invoke(req){const res=response();await handler(req,res);return res;}
test('optional AI is disabled by default without both server-side secrets',async()=>{
 const a=process.env.OPENAI_API_KEY,b=process.env.BRIEF_ACCESS_CODE;
 delete process.env.OPENAI_API_KEY;delete process.env.BRIEF_ACCESS_CODE;
 try{const r=await invoke({method:'POST',headers:{},body:{held:[],ready:[]}});assert.equal(r.code,503);assert.equal(r.headers['Cache-Control'],'no-store');}
 finally{if(a!==undefined)process.env.OPENAI_API_KEY=a;if(b!==undefined)process.env.BRIEF_ACCESS_CODE=b;}
});
test('AI rejects invalid or absent access code without network request',async()=>{
 const a=process.env.OPENAI_API_KEY,b=process.env.BRIEF_ACCESS_CODE;
 process.env.OPENAI_API_KEY='not-an-actual-key';process.env.BRIEF_ACCESS_CODE='private-rehearsal-code-not-real';
 try{const r=await invoke({method:'POST',headers:{'x-brief-access':'wrong'},body:{held:[],ready:[]}});assert.equal(r.code,401);}
 finally{if(a===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=a;if(b===undefined)delete process.env.BRIEF_ACCESS_CODE;else process.env.BRIEF_ACCESS_CODE=b;}
});
test('AI endpoint rejects oversized parsed JSON even without content-length',async()=>{
 const a=process.env.OPENAI_API_KEY,b=process.env.BRIEF_ACCESS_CODE;
 process.env.OPENAI_API_KEY='not-an-actual-key';process.env.BRIEF_ACCESS_CODE='private-rehearsal-code-not-real';
 try{const r=await invoke({method:'POST',headers:{'x-brief-access':process.env.BRIEF_ACCESS_CODE},body:{held:[{session_id:'X',reason:'x'.repeat(26000)}],ready:[]}});assert.equal(r.code,413);}
 finally{if(a===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=a;if(b===undefined)delete process.env.BRIEF_ACCESS_CODE;else process.env.BRIEF_ACCESS_CODE=b;}
});
test('AI endpoint refuses duplicate exception IDs even when session IDs repeat',async()=>{
 const a=process.env.OPENAI_API_KEY,b=process.env.BRIEF_ACCESS_CODE;
 process.env.OPENAI_API_KEY='not-an-actual-key';process.env.BRIEF_ACCESS_CODE='private-rehearsal-code-not-real';
 try{const r=await invoke({method:'POST',headers:{'x-brief-access':process.env.BRIEF_ACCESS_CODE},body:{held:[{exception_id:'E0001',session_id:'A',reason:'missing meter'},{exception_id:'E0001',session_id:'A',reason:'unknown charger'}],ready:[]}});assert.equal(r.code,400);}
 finally{if(a===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=a;if(b===undefined)delete process.env.BRIEF_ACCESS_CODE;else process.env.BRIEF_ACCESS_CODE=b;}
});
test('AI endpoint returns no invented actions for zero held records',async()=>{
 const a=process.env.OPENAI_API_KEY,b=process.env.BRIEF_ACCESS_CODE;
 process.env.OPENAI_API_KEY='not-an-actual-key';process.env.BRIEF_ACCESS_CODE='private-rehearsal-code-not-real';
 try{const r=await invoke({method:'POST',headers:{'x-brief-access':process.env.BRIEF_ACCESS_CODE},body:{held:[],ready:[]}});assert.equal(r.code,200);assert.deepEqual(r.body.actions,[]);}
 finally{if(a===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=a;if(b===undefined)delete process.env.BRIEF_ACCESS_CODE;else process.env.BRIEF_ACCESS_CODE=b;}
});

test('AI uses unique exception identities for duplicate sessions and rejects unknown response IDs',async()=>{
 const prevKey=process.env.OPENAI_API_KEY,prevCode=process.env.BRIEF_ACCESS_CODE,prevFetch=globalThis.fetch;
 process.env.OPENAI_API_KEY='synthetic-not-real';process.env.BRIEF_ACCESS_CODE='private-rehearsal-code-not-real';
 const held=[{exception_id:'E0001',session_id:'S107',reason:'duplicate session'},{exception_id:'E0002',session_id:'S107',reason:'duplicate session'}];
 const request={method:'POST',headers:{'x-brief-access':process.env.BRIEF_ACCESS_CODE},body:{held,ready:[]}};
 try{
  let observed;
  globalThis.fetch=async(_url,opts)=>{
   observed=JSON.parse(opts.body).messages[1].content;
   return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({actions:[
    {exception_id:'E0001',next_check:'Check the source record for duplicate entries'},
    {exception_id:'E0002',next_check:'Compare the overlapping source records'}]})}}]})};
  };
  let res=await invoke(request);assert.equal(res.code,200);assert.deepEqual(res.body.actions.map(a=>a.exception_id),['E0001','E0002']);
  assert.equal(JSON.parse(observed).held_records.length,2);
  globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({actions:[
    {exception_id:'E9999',next_check:'Check unexpected source'},
    {exception_id:'E0002',next_check:'Check duplicate records'}]})}}]})});
  res=await invoke(request);assert.equal(res.code,502);
 }finally{
  globalThis.fetch=prevFetch;
  if(prevKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=prevKey;
  if(prevCode===undefined)delete process.env.BRIEF_ACCESS_CODE;else process.env.BRIEF_ACCESS_CODE=prevCode;
 }
});

test('AI endpoint rejects null or non-object held records with HTTP 400 rather than throwing',async()=>{
 const key=process.env.OPENAI_API_KEY,code=process.env.BRIEF_ACCESS_CODE;
 process.env.OPENAI_API_KEY='synthetic-test-value';process.env.BRIEF_ACCESS_CODE='long-private-test-access';
 try{
  for(const body of [{held:[null],ready:[]},{held:[[]],ready:[]},{held:[],ready:[null]}]){
   const response=await invoke({method:'POST',headers:{'x-brief-access':process.env.BRIEF_ACCESS_CODE},body});
   assert.equal(response.code,400);
  }
 }finally{
  if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;
  if(code===undefined)delete process.env.BRIEF_ACCESS_CODE;else process.env.BRIEF_ACCESS_CODE=code;
 }
});
