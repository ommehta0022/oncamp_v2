import time
import requests
import sys
import json

URL = "https://perpetual-motivation-production-be1a.up.railway.app/v1/integrations/health"
print("Monitoring Railway deployment for Twilio OTP... (every 10s, max 5 min)")

for i in range(30):
    try:
        r = requests.get(URL, timeout=8)
        data = r.json()
        provider = data.get("otp", {}).get("provider", "unknown")
        tw = data.get("twilio", {})
        tw_enabled = tw.get("enabled", False)
        tw_configured = tw.get("configured", False)
        print(f"[{i+1}/30] OTP provider: {provider} | Twilio configured: {tw_configured} | enabled: {tw_enabled}")
        if provider == "twilio":
            print("\n=== SUCCESS! Deployment is live with Twilio OTP! ===")
            print(json.dumps(data, indent=2))
            sys.exit(0)
    except Exception as e:
        print(f"[{i+1}/30] Error: {e}")
    time.sleep(10)

print("Timeout after 5 minutes - deployment may still be in progress")
sys.exit(1)
