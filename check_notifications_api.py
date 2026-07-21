import requests
import json

SUPABASE_URL = "https://nxoqasndyebhiwkkfvnj.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3Fhc25keWViaGl3a2tmdm5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjgxODcwOCwiZXhwIjoyMDk4Mzk0NzA4fQ.N4cMXJYSpOXfLjKiaN66uKr557I6cuBowqgil-3m-dA"

headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
}

params = {
    "select": "id,user_id,type,title,body,data,read,read_at,created_at",
    "order": "created_at.desc",
    "limit": "100"
}
res = requests.get(f"{SUPABASE_URL}/rest/v1/notifications", headers=headers, params=params)
print("Status Code:", res.status_code)
if res.status_code != 200:
    print("Error:", res.text)
else:
    print("Success, returned records:", len(res.json()))
