import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../deployment/site/dist/server/index.js';
const get = (route,method='GET')=>worker.fetch(new Request('https://staging.example'+route,{method}));
test('all app assets served with correct types and enforced security headers',async()=>{
  for(const [route,type] of [['/','text/html'],['/app.js','text/javascript'],['/config.js','text/javascript'],['/styles.css','text/css'],['/icon.svg','image/svg+xml'],['/manifest.webmanifest','application/manifest+json']]) {
    const r=await get(route); assert.equal(r.status,200); assert.ok(r.headers.get('content-type').startsWith(type));
    assert.ok(r.headers.get('content-security-policy').includes("script-src 'self'"));
    assert.equal(r.headers.get('x-frame-options'),'DENY'); assert.equal(r.headers.get('cache-control'),'no-store');
    assert.ok((await r.text()).length>0);
  }
});
test('repository, credentials and unknown paths are never served',async()=>{
  for(const p of ['/supabase/schema.sql','/.git/config','/.env','/README.md','/audit/regressions.cjs','/%2e%2e%2fconfig.js','/missing']) assert.equal((await get(p)).status,404);
});
test('HEAD sends no body and unsupported methods are rejected',async()=>{
  assert.equal(await (await get('/','HEAD')).text(),'');
  const r=await get('/','POST'); assert.equal(r.status,405); assert.equal(r.headers.get('allow'),'GET, HEAD');
});
test('health distinguishes demo from backend configuration without secrets',async()=>{
  const body=await (await get('/healthz')).json();
  assert.ok(['demo','staging'].includes(body.mode)); assert.equal(body.backendConfigured,body.mode==='staging');
  assert.match(body.revision,/^[a-f0-9]{16}$/); assert.equal(body.status,'ok');
  assert.deepEqual(Object.keys(body).sort(),['backendConfigured','mode','revision','status']);
});
