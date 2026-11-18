"""Explicit staging-only HTTP smoke test. Creates and removes synthetic accounts.
Usage: python3 audit/hosted_smoke.py --project-ref <ref> --allow-staging-writes
Requires an authenticated Supabase CLI. Never prints credentials or response bodies.
"""
import argparse, datetime, json, os, secrets, shutil, subprocess, urllib.request, urllib.error, uuid
p=argparse.ArgumentParser();p.add_argument('--project-ref',required=True);p.add_argument('--allow-staging-writes',action='store_true');a=p.parse_args()
if not a.allow_staging_writes: p.error('Explicit --allow-staging-writes is required.')
if a.project_ref != 'fvmantcrremlqgehbces': p.error('This test is pinned to the designated Kartu staging project.')
cli=shutil.which('supabase') or os.path.expanduser('~/.supabase/bin/supabase')
env=dict(os.environ,SUPABASE_TELEMETRY_DISABLED='1')
def command(args):
 r=subprocess.run([cli,*args],env=env,text=True,capture_output=True)
 if r.returncode: raise RuntimeError('Supabase CLI operation failed (output suppressed to protect credentials)')
 return json.loads(r.stdout)
keys=command(['projects','api-keys','--remote='+a.project_ref,'--reveal','--output','json'])
pub=next(k['api_key'] for k in keys if k.get('type')=='publishable')
secret=next(k['api_key'] for k in keys if k.get('type')=='secret')
base='https://'+a.project_ref+'.supabase.co'
users=[];offers=[];suppliers=[];passes=[]
def api(path,token=None,body=None,method=None,admin=False,deny=False):
 headers={'apikey':secret if admin else pub,'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(base+path,headers=headers,data=None if body is None else json.dumps(body).encode(),method=method or ('POST' if body is not None else 'GET'))
 try:
  with urllib.request.urlopen(req,timeout=20) as r: data=r.read();status=r.status
 except urllib.error.HTTPError as e:
  status=e.code;data=e.read()
 if deny:
  assert 400<=status<500, 'Expected permission/validation denial';return None
 if not 200<=status<300:raise RuntimeError(f'HTTP {status} at {path.split("?")[0]} (body suppressed)')
 return json.loads(data) if data else None

def sql(statement):return command(['db','query','--remote='+a.project_ref,'--yes',statement])
def rpc(name,token,body={},deny=False):return api('/rest/v1/rpc/'+name,token,body,deny=deny)
def passed(s):passes.append(s);print('PASS '+s,flush=True)
try:
 accounts={}
 for role in ['buyer_a','buyer_b','supplier_a','supplier_b','admin']:
  email='kartu-smoke-'+uuid.uuid4().hex+'@example.test';password=secrets.token_urlsafe(30)
  user=api('/auth/v1/admin/users',body={'email':email,'password':password,'email_confirm':True,'user_metadata':{'display_name':'Staging smoke '+role}},admin=True)
  user_id=user['id'];users.append(user_id)
  session=api('/auth/v1/token?grant_type=password',body={'email':email,'password':password})
  accounts[role]={'id':user_id,'token':session['access_token'],'refresh':session['refresh_token']}
  if role.startswith('supplier') or role=='admin':sql("select kartu_private.set_account_role('"+user_id+"','"+('supplier' if role.startswith('supplier') else 'admin')+"');")
  if role.startswith('supplier'):
   sid=str(uuid.uuid4());suppliers.append(sid)
   sql("insert into public.suppliers(id,user_id,public_name,approved) values ('"+sid+"','"+user_id+"','Staging test supplier',true);")
 passed('Five real Auth sessions and profile creation')
 b=accounts['buyer_a']['token'];other=accounts['buyer_b']['token'];s=accounts['supplier_a']['token'];s2=accounts['supplier_b']['token'];admin=accounts['admin']['token']
 n=api('/rest/v1/neighborhoods?select=id&limit=1')[0]['id']
 profile=api('/rest/v1/profiles?select=id',b);assert [x['id'] for x in profile]==[accounts['buyer_a']['id']]
 passed('Buyer profile isolation through HTTP RLS')
 payload={'p_offer_type':'group_buy','p_title':'Synthetic staging rice','p_description':'Not a real offer','p_price_cents':250,'p_unit':'bag','p_stock':2,'p_minimum':1,'p_neighborhood_id':n,'p_deadline':(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=2)).isoformat(),'p_pickup_address':'Synthetic test address','p_pickup_details':'Synthetic test window'}
 offer=rpc('submit_offer',s,payload);offers.append(offer)
 rpc('review_offer',b,{'p_offer_id':offer,'p_approve':True},deny=True)
 rpc('review_offer',admin,{'p_offer_id':offer,'p_approve':True})
 passed('Supplier submission and admin-only approval')
 request={'p_offer_id':offer,'p_quantity':1,'p_idempotency_key':str(uuid.uuid4())}
 reservation=rpc('create_reservation',b,request)['id']
 assert rpc('create_reservation',b,request)['id']==reservation
 passed('Reservation retry is idempotent through HTTP')
 assert api('/rest/v1/reservations?select=id&id=eq.'+reservation,other)==[]
 assert api('/rest/v1/reservations?select=id&id=eq.'+reservation,s2)==[]
 rpc('cancel_reservation',other,{'p_reservation_id':reservation},deny=True)
 api('/rest/v1/rpc/create_reservation',body=request,deny=True)
 passed('Cross-buyer, cross-supplier and anonymous isolation')
 rpc('delete_my_account',b,deny=True);rpc('delete_my_account',s,deny=True)
 passed('Active orders block buyer and supplier deletion')
 rpc('cancel_reservation',b,{'p_reservation_id':reservation})
 request['p_idempotency_key']=str(uuid.uuid4());reservation=rpc('create_reservation',b,request)['id']
 rpc('supplier_mark_ready',s,{'p_offer_id':offer})
 rpc('supplier_complete_reservation',s2,{'p_reservation_id':reservation},deny=True)
 rpc('supplier_complete_reservation',s,{'p_reservation_id':reservation})
 assert api('/rest/v1/reservations?select=status&id=eq.'+reservation,b)[0]['status']=='completed'
 passed('Cancellation, preparation and completed pickup')
 refreshed=api('/auth/v1/token?grant_type=refresh_token',body={'refresh_token':accounts['buyer_a']['refresh']});b=refreshed['access_token']
 passed('Auth refresh returns a usable session')
 rpc('delete_my_account',b);rpc('delete_my_account',b)
 assert api('/rest/v1/profiles?select=id',b)==[]
 rpc('create_reservation',b,request,deny=True)
 passed('Buyer deletion, safe retry and old-token write denial')
 rpc('delete_my_account',s)
 row=api('/rest/v1/offers?select=title,pickup_address,redacted_at&id=eq.'+offer,admin)[0]
 assert row['title']=='Removed listing' and row['pickup_address']=='' and row['redacted_at']
 passed('Supplier deletion redacts hosted listing text')
 api('/auth/v1/logout',other,body={})
 api('/auth/v1/token?grant_type=refresh_token',body={'refresh_token':accounts['buyer_b']['refresh']},deny=True)
 passed('Logout revokes refresh token')
finally:
 # Only this run's UUIDs are eligible for cleanup. No broad deletes or reset.
 for offer in offers:
  api('/rest/v1/reservations?offer_id=eq.'+offer,method='DELETE',admin=True)
  api('/rest/v1/offers?id=eq.'+offer,method='DELETE',admin=True)
 for sid in suppliers:api('/rest/v1/suppliers?id=eq.'+sid,method='DELETE',admin=True)
 for user_id in users:
  # Already-deleted users return 404; cleanup is deliberately idempotent.
  try:api('/auth/v1/admin/users/'+user_id,method='DELETE',admin=True)
  except RuntimeError as e:
   if 'HTTP 404 ' not in str(e):raise
 print('Removed this run\'s synthetic records.',flush=True)
print(f'{len(passes)} hosted HTTP checks passed. Real SMTP delivery was not tested.')
