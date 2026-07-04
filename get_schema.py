import requests

SUPABASE_URL = "https://nxoqasndyebhiwkkfvnj.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3Fhc25keWViaGl3a2tmdm5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjgxODcwOCwiZXhwIjoyMDk4Mzk0NzA4fQ.N4cMXJYSpOXfLjKiaN66uKr557I6cuBowqgil-3m-dA"

res = requests.get(f"{SUPABASE_URL}/rest/v1/?apikey={SUPABASE_SERVICE_ROLE_KEY}")
data = res.json()
for table in ['institutions', 'institution_admins', 'users', 'institution_verification_requests']:
    props = data.get('definitions', {}).get(table, {}).get('properties', {})
    print(f"\n{table.upper()} table properties:")
    for p in props:
        print("-", p)
