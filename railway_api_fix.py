#!/usr/bin/env python3
"""
Fix Railway Root Directory via REST API
Attempts to update service configuration using Railway's REST API
"""

import requests
import json
import subprocess
import time

# Railway Configuration
RAILWAY_TOKEN = "3d9b2513-a53a-4f33-a72c-19857a712125"
PROJECT_ID = "9c8cd366-c8cb-449c-af2c-2219e2838616"
SERVICE_ID = "71cca2d6-9f1d-45c9-b759-cf1343568d23"
ENVIRONMENT_ID = "f91498b3-cccb-4a20-930a-02aefd8fd5ad"

GRAPHQL_API = "https://backboard.railway.app/graphql/v2"

def graphql_request(query, variables=None):
    """Make GraphQL API request"""
    headers = {
        "Authorization": f"Bearer {RAILWAY_TOKEN}",
        "Content-Type": "application/json",
    }
    
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    
    response = requests.post(GRAPHQL_API, headers=headers, json=payload)
    return response

def update_service_source():
    """Try to update service source/root directory"""
    
    # Try mutation to update service
    mutation = """
    mutation serviceUpdate($serviceId: String!, $rootDirectory: String) {
        serviceUpdate(id: $serviceId, input: {rootDirectory: $rootDirectory}) {
            id
            name
        }
    }
    """
    
    variables = {
        "serviceId": SERVICE_ID,
        "rootDirectory": None  # null means root directory
    }
    
    print("📌 Attempting to update service root directory via GraphQL...")
    response = graphql_request(mutation, variables)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
    if response.status_code == 200:
        data = response.json()
        if "errors" not in data:
            print("✅ Service updated successfully!")
            return True
        else:
            print(f"❌ GraphQL Error: {data['errors']}")
    
    return False

def trigger_deployment_via_cli():
    """Trigger new deployment using Railway CLI"""
    print("\n📌 Triggering new deployment via Railway CLI...")
    try:
        result = subprocess.run(
            ["railway", "up", "--detach"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✅ Deployment triggered!")
            print(result.stdout)
            return True
        else:
            print(f"❌ Deployment failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error triggering deployment: {e}")
        return False

def check_health_endpoint():
    """Check if Twilio is loaded"""
    url = "https://perpetual-motivation-production-be1a.up.railway.app/v1/integrations/health"
    
    print(f"\n📌 Checking health endpoint...")
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        
        provider = data.get("otp", {}).get("provider", "unknown")
        twilio_config = data.get("twilio", {})
        
        print(f"OTP Provider: {provider}")
        print(f"Twilio Configured: {twilio_config.get('configured', False)}")
        print(f"Twilio Enabled: {twilio_config.get('enabled', False)}")
        
        if provider == "twilio":
            print("✅ SUCCESS! Twilio is loaded and configured!")
            return True
        else:
            print(f"❌ Still using {provider} instead of Twilio")
            return False
            
    except Exception as e:
        print(f"❌ Error checking health: {e}")
        return False

def main():
    print("="*70)
    print("🔧 Railway Root Directory Fix via API")
    print("="*70)
    print()
    
    print("⚠️  WARNING: API might not support root directory changes")
    print("   If this fails, you MUST change it manually in Railway Dashboard")
    print()
    
    # Step 1: Try to update service
    print("Step 1: Attempt API update...")
    if not update_service_source():
        print("\n❌ API update failed (expected - Railway doesn't expose this via API)")
        print()
        print("="*70)
        print("MANUAL FIX REQUIRED")
        print("="*70)
        print()
        print("You MUST fix this in Railway Dashboard:")
        print("1. Go to: https://railway.com/project/9c8cd366-c8cb-449c-af2c-2219e2838616")
        print("2. Click on 'perpetual-motivation' service")
        print("3. Go to 'Settings' tab")
        print("4. Find 'Root Directory' setting")
        print("5. Change from 'backend' to EMPTY (or delete the value)")
        print("6. Save and wait for automatic redeploy")
        print()
        print("See RAILWAY_ROOT_DIRECTORY_FIX.md for detailed instructions!")
        print("="*70)
        return
    
    # Step 2: Trigger deployment
    print("\nStep 2: Trigger new deployment...")
    if not trigger_deployment_via_cli():
        print("❌ Failed to trigger deployment")
        return
    
    # Step 3: Wait and check
    print("\nStep 3: Waiting 60 seconds for deployment to complete...")
    time.sleep(60)
    
    print("\nStep 4: Verify Twilio is loaded...")
    if check_health_endpoint():
        print("\n" + "="*70)
        print("🎉 SUCCESS! Twilio OTP is now deployed and working!")
        print("="*70)
    else:
        print("\n" + "="*70)
        print("❌ Twilio still not loaded. Manual intervention needed.")
        print("="*70)
        print("\nSee RAILWAY_ROOT_DIRECTORY_FIX.md for manual fix instructions")

if __name__ == "__main__":
    main()
