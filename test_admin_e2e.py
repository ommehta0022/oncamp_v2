import requests
import json

RAILWAY_URL = "https://perpetual-motivation-production-be1a.up.railway.app"
EMAIL = "admin@oncampus.app"
PASSWORD = "Admin@123"

print("=== STEP 1: Login ===")
lr = requests.post(
    f"{RAILWAY_URL}/admin/auth/login",
    json={"email": EMAIL, "password": PASSWORD},
    headers={"Content-Type": "application/json"},
    timeout=20
)
print(f"Login status: {lr.status_code}")
if lr.status_code != 200:
    print("FAILED:", lr.text)
    exit(1)

data = lr.json()
token = data.get("accessToken")
user = data.get("user", {})
print(f"User: {user.get('email')} | Role: {user.get('role')}")
print(f"Token (first 40): {token[:40]}...")

auth_headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

print()
print("=== STEP 2: GET /admin/auth/me ===")
me = requests.get(f"{RAILWAY_URL}/admin/auth/me", headers=auth_headers, timeout=15)
print(f"Status: {me.status_code} | Body: {me.text[:300]}")

print()
print("=== STEP 3: GET /admin/dashboard ===")
dash = requests.get(f"{RAILWAY_URL}/admin/dashboard", headers=auth_headers, timeout=15)
print(f"Status: {dash.status_code}")
if dash.status_code == 200:
    print("Dashboard response:", json.dumps(dash.json(), indent=2)[:500])
else:
    print("Error:", dash.text[:300])

print()
print("=== STEP 4: GET /admin/analytics/overview ===")
ao = requests.get(f"{RAILWAY_URL}/admin/analytics/overview", headers=auth_headers, timeout=15)
print(f"Status: {ao.status_code}")
if ao.status_code == 200:
    print("Analytics overview:", json.dumps(ao.json(), indent=2)[:500])
else:
    print("Error:", ao.text[:300])

print()
print("=== STEP 5: GET /admin/users ===")
users = requests.get(f"{RAILWAY_URL}/admin/users", headers=auth_headers, timeout=15)
print(f"Status: {users.status_code}")
if users.status_code == 200:
    print("Users:", json.dumps(users.json(), indent=2)[:300])
else:
    print("Error:", users.text[:300])

print()
print("=== ALL CHECKS COMPLETE ===")
print("Login: OK" if lr.status_code == 200 else "Login: FAILED")
print("Auth/me: OK" if me.status_code == 200 else f"Auth/me: FAILED ({me.status_code})")
print("Dashboard: OK" if dash.status_code == 200 else f"Dashboard: FAILED ({dash.status_code})")
print("Analytics: OK" if ao.status_code == 200 else f"Analytics: FAILED ({ao.status_code})")
print("Users: OK" if users.status_code == 200 else f"Users: FAILED ({users.status_code})")
