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
test('AI endpoint refuses duplicate held IDs and cannot suggest checks for mismatched records',async()=>{
 const a=process.env.OPENAI_API_KEY,b=process.env.BRIEF_ACCESS_CODE;
 process.env.OPENAI_API_KEY='not-an-actual-key';process.env.BRIEF_ACCESS_CODE='private-rehearsal-code-not-real';
 try{const r=await invoke({method:'POST',headers:{'x-brief-access':process.env.BRIEF_ACCESS_CODE},body:{held:[{session_id:'A',reason:'missing meter'},{session_id:'A',reason:'unknown charger'}],ready:[]}});assert.equal(r.code,400);}
 finally{if(a===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=a;if(b===undefined)delete process.env.BRIEF_ACCESS_CODE;else process.env.BRIEF_ACCESS_CODE=b;}
});
test('AI endpoint returns no invented actions for zero held records',async()=>{
 const a=process.env.OPENAI_API_KEY,b=process.env.BRIEF_ACCESS_CODE;
 process.env.OPENAI_API_KEY='not-an-actual-key';process.env.BRIEF_ACCESS_CODE='private-rehearsal-code-not-real';
 try{const r=await invoke({method:'POST',headers:{'x-brief-access':process.env.BRIEF_ACCESS_CODE},body:{held:[],ready:[]}});assert.equal(r.code,200);assert.deepEqual(r.body.actions,[]);}
 finally{if(a===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=a;if(b===undefined)delete process.env.BRIEF_ACCESS_CODE;else process.env.BRIEF_ACCESS_CODE=b;}
});
