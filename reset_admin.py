import requests
import hashlib
import json

SUPABASE_URL = "https://nxoqasndyebhiwkkfvnj.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3Fhc25keWViaGl3a2tmdm5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjgxODcwOCwiZXhwIjoyMDk4Mzk0NzA4fQ.N4cMXJYSpOXfLjKiaN66uKr557I6cuBowqgil-3m-dA"
RAILWAY_URL = "https://perpetual-motivation-production-be1a.up.railway.app"

h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=representation"}

print("=== STEP 1: Current admin_users state ===")
r = requests.get(f"{SUPABASE_URL}/rest/v1/admin_users", params={"limit": "10"}, headers=h)
print("Status:", r.status_code)
rows = r.json()
for row in rows:
    print(f"  email={row.get('email')} | hash_algo={row.get('hash_algorithm')} | is_active={row.get('is_active')} | hash_start={row.get('password_hash','')[:20]}")

print()
print("=== STEP 2: DELETE all admin users and start fresh ===")
for row in rows:
    dr = requests.delete(f"{SUPABASE_URL}/rest/v1/admin_users", params={"id": f"eq.{row['id']}"}, headers=h)
    print(f"  Deleted {row['email']}: {dr.status_code}")

print()
print("=== STEP 3: Create single clean admin user (SHA256, simple) ===")
EMAIL = "admin@oncampus.app"
PASSWORD = "Admin@123"
pw_hash = hashlib.sha256(PASSWORD.encode()).hexdigest()
print(f"  Email: {EMAIL}")
print(f"  Password: {PASSWORD}")
print(f"  SHA256 hash: {pw_hash}")

cr = requests.post(
    f"{SUPABASE_URL}/rest/v1/admin_users",
    headers=h,
    json={
        "email": EMAIL,
        "password_hash": pw_hash,
        "hash_algorithm": "sha256",
        "name": "Super Admin",
        "role": "super_admin",
        "is_active": True,
    }
)
print(f"  Create status: {cr.status_code}")
if cr.status_code in (200, 201):
    created = cr.json()
    if isinstance(created, list) and created:
        print(f"  Created user id: {created[0].get('id')}")
    else:
        print(f"  Response: {created}")
else:
    print(f"  Error: {cr.text}")

print()
print("=== STEP 4: Verify row in DB ===")
vr = requests.get(f"{SUPABASE_URL}/rest/v1/admin_users", params={"email": f"eq.{EMAIL}"}, headers=h)
print("Verify status:", vr.status_code)
for row in vr.json():
    print(f"  email={row.get('email')} | algo={row.get('hash_algorithm')} | active={row.get('is_active')} | hash={row.get('password_hash','')[:20]}")

print()
print("=== STEP 5: Test login against Railway backend ===")
lr = requests.post(
    f"{RAILWAY_URL}/admin/auth/login",
    json={"email": EMAIL, "password": PASSWORD},
    headers={"Content-Type": "application/json"},
    timeout=20
)
print(f"  Login status: {lr.status_code}")
if lr.status_code == 200:
    data = lr.json()
    print("  LOGIN SUCCESS!")
    print("  accessToken:", data.get("accessToken","")[:40], "...")
    print("  user:", json.dumps(data.get("user"), indent=2))
else:
    print("  LOGIN FAILED:", lr.text)
