"""One-shot staging availability check. Exits nonzero on a failed probe."""
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SITE = 'https://kartu-staging-arham.stripycompass32.chatgpt.site'
BACKEND = 'https://fvmantcrremlqgehbces.supabase.co'


def main():
    # The private Sites gate answers unauthenticated requests with 401.
    try:
        with urlopen(Request(SITE + '/healthz', headers={'User-Agent': 'Kartu-Staging-Monitor/1.0'}), timeout=10) as response:
            health = json.load(response)
        if health.get('status') != 'ok' or health.get('mode') != 'staging' or not health.get('backendConfigured'):
            raise ValueError('Unexpected staging health response')
        print('PASS Site worker health')
    except HTTPError as error:
        if error.code != 401 or error.url != SITE + '/healthz':
            raise
        print('PASS Private site access gate (worker health requires signed-in access)')

    config = Path(__file__).resolve().parents[1].joinpath('config.js').read_text()
    prefix = 'window.KARTU_CONFIG = '
    if not config.startswith(prefix):
        raise ValueError('Expected generated staging config.js')
    settings = json.loads(config[len(prefix):].strip().removesuffix(';'))
    key = settings.get('supabasePublishableKey', '')
    if settings.get('supabaseUrl') != BACKEND or not key.startswith('sb_publishable_'):
        raise ValueError('Staging URL and publishable key required')
    request = Request(BACKEND + '/rest/v1/neighborhoods?select=id&limit=1', headers={'apikey': key})
    with urlopen(request, timeout=10) as response:
        rows = json.load(response)
    if not rows or not rows[0].get('id'):
        raise ValueError('Expected a published neighborhood')
    print('PASS Supabase API and database read')


if __name__ == '__main__':
    try:
        main()
    except (URLError, OSError, ValueError) as error:
        code = getattr(error, 'code', None)
        raise SystemExit(f'Staging check failed: {type(error).__name__}' + (f' (HTTP {code})' if code else ''))
