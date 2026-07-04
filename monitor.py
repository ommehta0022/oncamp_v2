import time
import requests
import sys

URL = 'https://perpetual-motivation-production-be1a.up.railway.app/v1/integrations/health'
print(f'Monitoring {URL} for Twilio OTP...')

for i in range(60):
    try:
        r = requests.get(URL, timeout=5)
        if r.status_code == 200:
            data = r.json()
            provider = data.get('otp', {}).get('provider')
            if provider == 'twilio':
                print('\nSUCCESS! Twilio is now active!')
                print(data)
                sys.exit(0)
            else:
                print(f'Still {provider}...', end=' ', flush=True)
    except Exception as e:
        print('e', end='', flush=True)
    time.sleep(5)
print('\nTimeout')
sys.exit(1)
