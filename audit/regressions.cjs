// Local app regressions for the current implementation.
// Run with Node.js: node audit/regressions.cjs
// Uses mocked browser/storage/network objects; never contacts a Supabase project.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8')
  .replace(/\bboot\(\);\s*$/, '');

function fixture({ shared = false, fetch } = {}) {
  const local = new Map();
  const session = new Map();
  const location = { hash: '', pathname: '/', search: '' };
  if (shared) session.set('kartu-supabase-session-v1', JSON.stringify({
    access_token: 'audit-fake-token', user: { id: 'audit-buyer' }
  }));
  const nodes = new Map();
  const element = () => ({ innerHTML: '', textContent: '', addEventListener() {}, setAttribute() {}, remove() {} });
  const context = vm.createContext({
    window: { location, confirm: () => true, KARTU_CONFIG: shared ? {
      supabaseUrl: 'https://audit.invalid', supabasePublishableKey: 'audit-fake-public-key'
    } : {} },
    location,
    history: { replaceState(_state, _title, url) { location.hash = ''; location.lastUrl = url; } },
    document: {
      getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
      querySelector() { return null; },
      createElement: element,
      body: { append() {} },
      addEventListener() {}
    },
    localStorage: { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value), removeItem: key => local.delete(key) },
    sessionStorage: { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key) },
    structuredClone, Intl, URLSearchParams, console,
    setTimeout() { return 1; }, clearTimeout() {},
    fetch: fetch || (() => { throw new Error('Unexpected network request in local fixture'); })
  });
  vm.runInContext(source, context);
  vm.runInContext("state.lang = 'en';", context);
  return expression => vm.runInContext(expression, context);
}

const cases = [
  ['Supplier counts still agree after a group reaches its minimum', async () => {
    const run = fixture({ shared: true });
    run("remoteProfile = {id:'test-supplier', display_name:'Test supplier', role:'supplier', supplierId:'sup-home'}; state.offers = [getOffer('offer-detergent')]; state.offers[0].status = 'minimum_reached';");
    const html = run('renderSupplier()');
    assert.match(html, /class="status-pill">1 active offers</);
    assert.match(html, /<span>Active offers<\/span><strong>1<\/strong>/);
  }],
  ['Cancellation remains available after the group minimum is reached', async () => {
    const run = fixture();
    await run("modalOfferId = 'offer-detergent'; modalQuantity = 3; reserveOffer();");
    assert.equal(run("getOffer('offer-detergent').status"), 'minimum_reached');
    assert.ok(run('renderOrders()').includes('data-action="cancel-order"'), 'Cancellation control disappeared');
  }],
  ['An existing reservation remains visible when its offer is unavailable', async () => {
    const run = fixture();
    run("state.offers = []; state.orders = [{id:'audit-order', offerId:'closed-offer', buyerId:'demo-buyer', quantity:1, totalCents:250, code:'KTAUDIT', status:'ready_for_pickup'}];");
    assert.ok(run('renderOrders()').includes('KTAUDIT'), 'Pickup code and entire order were omitted');
  }],
  ['An expired demo offer cannot accept a reservation', async () => {
    const run = fixture();
    run("Object.assign(getOffer('offer-rice'), {deadline:'2000-01-01T00:00:00Z', hoursLeft:1}); modalOfferId = 'offer-rice'; modalQuantity = 1;");
    await run('reserveOffer()');
    assert.equal(run('state.orders.length'), 0, 'Reservation was accepted using a stale hoursLeft value');
  }],
  ['A shared-data failure shows an error instead of demo offers as shared data', async () => {
    const run = fixture({ shared: true, fetch: async url => {
      const profile = url.includes('/rest/v1/profiles?');
      return { ok: profile, status: profile ? 200 : 503, text: async () => JSON.stringify(profile
        ? [{ id: 'audit-buyer', display_name: 'Audit Buyer', role: 'buyer', neighborhoods: {name: 'Naujamiestis'} }]
        : { message: 'Audit backend unavailable' }) };
    } });
    await run('loadRemoteData()');
    const html = run('app.innerHTML');
    assert.ok(html.includes('Audit backend unavailable'), 'Backend failure was hidden from the signed-in screen');
    assert.ok(!html.includes('Long-grain rice, 10 kg'), 'Demo seed offers were labelled as shared data');
  }],
  ['A recovery link opens the password-update form and clears URL tokens', async () => {
    const run = fixture();
    run("window.location.hash = '#access_token=audit-reset&refresh_token=audit-refresh&type=recovery&expires_in=3600'; initializeRecoveryLink(); renderAuth();");
    const html = run("document.getElementById('app').innerHTML");
    assert.ok(html.includes('Set a new password'), 'Recovery link did not open the password update screen');
    assert.ok(html.includes('name=\"confirm_password\"'), 'Password confirmation field is missing');
    assert.equal(run('window.location.hash'), '', 'Recovery tokens remain in the address bar');
    assert.ok(run("sessionStorage.getItem('kartu-supabase-session-v1')").includes('audit-reset'), 'Temporary recovery session was not stored');
    assert.equal(run("localStorage.getItem('kartu-supabase-session-v1')"), null, 'Session token was written to persistent local storage');
  }],
  ['Deletion prevents duplicate requests and clears state after success', async () => {
    let resolve; let calls = 0;
    const run = fixture({ shared: true, fetch: async () => { calls++; return new Promise(r => { resolve = r; }); } });
    run("remoteProfile = {id:'audit-buyer', display_name:'Audit buyer', role:'buyer'}; state.offers=[]; state.orders=[];");
    const pending = run('deleteAccount()');
    assert.equal(run('deletionBusy'), true);
    assert.ok(run('app.innerHTML').includes('disabled aria-busy="true"'));
    await run('deleteAccount()');
    assert.equal(calls, 1);
    resolve({ok:true, status:204, text:async()=>''});
    await pending;
    assert.equal(run('authSession'), null);
    assert.equal(run('remoteProfile'), null);
    assert.equal(run('deletionBusy'), false);
    assert.ok(run('app.innerHTML').includes('Limited order history remains.'));
  }],
  ['Blocked deletion keeps the account and gives a persistent useful error', async () => {
    const run = fixture({ shared:true, fetch:async()=>({ok:false,status:400,text:async()=>JSON.stringify({code:'P0001',message:'Supplier orders must be completed before account deletion'})}) });
    run("remoteProfile = {id:'audit-buyer', display_name:'Supplier', role:'supplier'}; state.offers=[]; state.orders=[];");
    await run('deleteAccount()');
    assert.equal(run('remoteProfile.id'),'audit-buyer');
    assert.ok(run('app.innerHTML').includes('Some supplier orders are still active'));
    assert.equal(run('deletionBusy'),false);
  }],
  ['Lost deletion response stays uncertain and permits an idempotent retry', async () => {
    let calls = 0;
    const run = fixture({shared:true,fetch:async()=>{
      if (++calls===1) throw new TypeError('Network unavailable');
      return {ok:true,status:204,text:async()=>''};
    }});
    run("remoteProfile = {id:'audit-buyer', display_name:'Buyer', role:'buyer'}; state.offers=[]; state.orders=[];");
    await run('deleteAccount()');
    assert.ok(run('app.innerHTML').includes('could not confirm whether deletion finished'));
    assert.notEqual(run('authSession'),null);
    await run('deleteAccount()');
    assert.equal(run('authSession'),null);
    assert.equal(calls,2);
  }],
  ['Redacted history retains totals and hides removed pickup codes', async () => {
    const run = fixture();
    run("state.offers=[{id:'removed', redacted:true, name:'Removed listing', priceCents:250, tone:'#fff', emoji:'📦', pickup:'', supplier:''}]; state.orders=[{id:'history', offerId:'removed', buyerId:'demo-buyer', quantity:2,totalCents:500,code:null,status:'completed'}];");
    const html = run('renderOrders()');
    assert.ok(html.includes('Removed listing'));
    assert.ok(html.includes('Pickup details removed'));
    assert.ok(html.includes('5.00'));
    assert.ok(!html.includes('pickup-code'));
    assert.ok(!html.includes('null'));
  }],
  ['A late token refresh cannot restore a deleted session', async () => {
    let resolve;
    const run = fixture({shared:true,fetch:()=>new Promise(r=>{resolve=r;})});
    run("authSession.expires_at=1; authSession.refresh_token='old-refresh';");
    const pending = run('loadRemoteData()');
    run('persistAuthSession(null); remoteProfile=null;');
    resolve({ok:true,status:200,text:async()=>JSON.stringify({access_token:'late-token',user:{id:'audit-buyer'}})});
    await pending;
    assert.equal(run('authSession'),null);
    assert.equal(run('remoteProfile'),null);
  }],
  ['A failed old request cannot clear a replacement session', async () => {
    let reject;
    const run = fixture({shared:true,fetch:()=>new Promise((_resolve,r)=>{reject=r;})});
    const pending = run('loadRemoteData()');
    run("persistAuthSession({access_token:'replacement-token',user:{id:'replacement-user'}}); remoteProfile={id:'replacement-user',role:'buyer'};");
    reject(new TypeError('Network unavailable'));
    await pending;
    assert.equal(run('authSession.user.id'),'replacement-user');
    assert.equal(run('remoteProfile.id'),'replacement-user');
  }],
  ['A response from before deletion cannot restore the old account snapshot', async () => {
    let release;
    const run = fixture({shared:true,fetch:async url=>{
      if(url.includes('/profiles?'))return {ok:true,status:200,text:async()=>JSON.stringify([{id:'audit-buyer',role:'buyer',display_name:'Buyer'}])};
      if(url.includes('/offers?'))return new Promise(r=>{release=()=>r({ok:true,status:200,text:async()=>'[]'});});
      return {ok:true,status:200,text:async()=>'[]'};
    }});
    const pending = run('loadRemoteData()');
    while(!release) await new Promise(resolve=>setImmediate(resolve));
    run('persistAuthSession(null); remoteProfile=null;');
    release(); await pending;
    assert.equal(run('remoteProfile'),null);
    assert.ok(!run('app.innerHTML').includes('account-menu'));
  }]
];

(async () => {
  let failures = 0;
  for (const [name, check] of cases) {
    try { await check(); console.log(`PASS ${name}`); }
    catch (error) { failures++; console.log(`FAIL ${name}\n  ${error.message.split('\n')[0]}`); }
  }
  console.log(`\n${cases.length - failures}/${cases.length} regression checks passed.`);
  process.exitCode = failures ? 1 : 0;
})();
