import os
import requests

SUPABASE_URL = "https://nxoqasndyebhiwkkfvnj.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3Fhc25keWViaGl3a2tmdm5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjgxODcwOCwiZXhwIjoyMDk4Mzk0NzA4fQ.N4cMXJYSpOXfLjKiaN66uKr557I6cuBowqgil-3m-dA"

headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
}

def check_table_and_fields(table_name, required_fields=None):
    print(f"\n--- Checking table: {table_name} ---")
    res = requests.get(f"{SUPABASE_URL}/rest/v1/{table_name}", params={"limit": "1"}, headers=headers)
    if res.status_code == 200:
        print("Table exists!")
        if required_fields:
            res_fields = requests.get(f"{SUPABASE_URL}/rest/v1/{table_name}", params={"limit": "1", "select": ",".join(required_fields)}, headers=headers)
            if res_fields.status_code == 200:
                print("All required fields exist!")
            else:
                print(f"Error fetching specific fields: {res_fields.text}")
    else:
        print(f"Table error: {res.text}")

print("Checking required tables and fields for Institutional Verification...")

check_table_and_fields("institution_verification_requests", [
    "id", "institution_id", "submitted_by", "institution_name", 
    "institution_type", "city", "state", "country", "official_email", 
    "phone", "website", "admin_name", "designation", "document_url", 
    "status", "review_notes", "reviewed_by", "reviewed_at", "created_at"
])

check_table_and_fields("institutions", [
    "id", "name", "type", "city", "state", "country", "email", 
    "phone", "website", "official", "verified"
])

check_table_and_fields("institution_admins", [
    "id", "institution_id", "user_id", "role", "status"
])

check_table_and_fields("users", [
    "id", "account_type", "can_create_posts", "can_create_groups", "verified"
])
