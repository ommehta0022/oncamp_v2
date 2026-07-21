import os
import requests

SUPABASE_URL = "https://nxoqasndyebhiwkkfvnj.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3Fhc25keWViaGl3a2tmdm5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjgxODcwOCwiZXhwIjoyMDk4Mzk0NzA4fQ.N4cMXJYSpOXfLjKiaN66uKr557I6cuBowqgil-3m-dA"

headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
}

res = requests.get(f"{SUPABASE_URL}/rest/v1/notifications?limit=1", headers=headers)
if res.status_code == 200:
    data = res.json()
    if data:
        print("Columns:", list(data[0].keys()))
    else:
        print("Table is empty, can't infer columns from data. Wait, let's trigger an error.")
else:
    print("Error:", res.text)
