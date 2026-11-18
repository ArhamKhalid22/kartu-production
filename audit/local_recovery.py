"""Exercise password recovery with the local Supabase stack and Mailpit."""
import json
import os
import re
import secrets
import shutil
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

API = 'http://127.0.0.1:54321'
MAIL = 'http://127.0.0.1:54324'


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    cli = shutil.which('supabase') or str(Path.home()/'.supabase/bin/supabase')
    status = json.loads(subprocess.check_output(
        [cli, 'status', '-o', 'json'], stderr=subprocess.DEVNULL,
        env=dict(os.environ, SUPABASE_TELEMETRY_DISABLED='1'),
    ))
    key = status['PUBLISHABLE_KEY']

    def auth(route, body=None, token=None, method='POST'):
        headers = {'apikey': key, 'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer '+token
        request = Request(API+'/auth/v1/'+route, data=None if body is None else json.dumps(body).encode(),
                          headers=headers, method=method)
        with urlopen(request, timeout=10) as response:
            raw = response.read()
            return json.loads(raw) if raw else None

    def mail(route):
        with urlopen(MAIL+'/api/v1/'+route, timeout=5) as response:
            return json.load(response)

    email = 'kartu-recovery-'+secrets.token_hex(10)+'@example.test'
    old, new = secrets.token_urlsafe(24), secrets.token_urlsafe(24)
    session = auth('signup', {'email': email, 'password': old, 'data': {'display_name': 'Recovery test'}})
    cleanup_token = session['access_token']
    message_id = None
    try:
        auth('recover', {'email': email})
        for _ in range(20):
            messages = mail('messages')['messages']
            message_id = next((m['ID'] for m in messages if any(r['Address'] == email for r in m['To'])), None)
            if message_id:
                break
            time.sleep(.25)
        if not message_id:
            raise RuntimeError('Mailpit received no recovery message')
        link = re.search(r'https?://[^\s<>"]+/auth/v1/verify\?[^\s<>"]+', mail('message/'+message_id)['Text'])
        if not link or not link[0].startswith(API+'/auth/v1/verify?'):
            raise RuntimeError('Expected a local verification link')
        try:
            build_opener(NoRedirect()).open(link[0], timeout=10)
        except HTTPError as response:
            if response.code not in (302, 303):
                raise
            redirect = urlsplit(response.headers['Location'])
        else:
            raise RuntimeError('Recovery verification did not redirect')
        fragment = parse_qs(redirect.fragment)
        if fragment.get('type') != ['recovery'] or not fragment.get('access_token'):
            raise RuntimeError('Expected recovery session in redirect')
        cleanup_token = fragment['access_token'][0]
        auth('user', {'password': new}, cleanup_token, 'PUT')
        try:
            auth('token?grant_type=password', {'email': email, 'password': old})
        except HTTPError as error:
            if error.code != 400:
                raise
        else:
            raise RuntimeError('Old password still works')
        session = auth('token?grant_type=password', {'email': email, 'password': new})
        cleanup_token = session['access_token']
        print('PASS Local signup, Mailpit recovery email, verification redirect and password reset')
    finally:
        request = Request(API+'/rest/v1/rpc/delete_my_account', data=b'{}',
                          headers={'apikey': key, 'Authorization': 'Bearer '+cleanup_token,
                                   'Content-Type': 'application/json'}, method='POST')
        with urlopen(request, timeout=10):
            pass
        if message_id:
            delete_message = Request(MAIL+'/api/v1/messages', method='DELETE',
                                     data=json.dumps({'IDs': [message_id]}).encode(),
                                     headers={'Content-Type': 'application/json'})
            with urlopen(delete_message, timeout=5):
                pass


if __name__ == '__main__':
    try:
        main()
    except HTTPError as error:
        raise SystemExit(f'Local recovery check failed with HTTP {error.code}.')
