import requests
import json

supabase_url = "https://nxoqasndyebhiwkkfvnj.supabase.co"
service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3Fhc25keWViaGl3a2tmdm5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjgxODcwOCwiZXhwIjoyMDk4Mzk0NzA4fQ.N4cMXJYSpOXfLjKiaN66uKr557I6cuBowqgil-3m-dA"

headers = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json"
}

response = requests.get(f"{supabase_url}/rest/v1/admin_users?select=email", headers=headers)
print(json.dumps(response.json(), indent=2))
