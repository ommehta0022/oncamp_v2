#!/usr/bin/env python3
"""
Railway API deployment script
Configures and deploys the backend service properly
"""

import requests
import json
import time

# Railway API configuration
API_TOKEN = "3d9b2513-a53a-4f33-a72c-19857a712125"
PROJECT_ID = "9c8cd366-c8cb-449c-af2c-2219e2838616"
SERVICE_ID = "8f7432e1-22cc-479e-8f84-79f77a1639d6"
ENVIRONMENT_ID = "f914081b-ffa2-42b1-af2c-2219e2838616"  # production

GRAPHQL_ENDPOINT = "https://backboard.railway.app/graphql/v2"

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

def graphql_query(query, variables=None):
    """Execute GraphQL query"""
    response = requests.post(
        GRAPHQL_ENDPOINT,
        headers=HEADERS,
        json={"query": query, "variables": variables or {}}
    )
    
    if response.status_code != 200:
        print(f"❌ GraphQL Error: {response.status_code}")
        print(response.text)
        return None
    
    data = response.json()
    if "errors" in data:
        print(f"❌ GraphQL Errors: {json.dumps(data['errors'], indent=2)}")
        return None
    
    return data.get("data")

def update_service_config():
    """Update service configuration"""
    print("\n📌 Updating service configuration...")
    
    # Set root directory to backend
    query = """
    mutation ServiceUpdate($id: String!, $input: ServiceUpdateInput!) {
        serviceUpdate(id: $id, input: $input) {
            id
            name
        }
    }
    """
    
    variables = {
        "id": SERVICE_ID,
        "input": {
            "source": {
                "repo": "ommehta0022/oncamp_v2",
                "rootDirectory": "backend"
            }
        }
    }
    
    result = graphql_query(query, variables)
    if result:
        print(f"✅ Service configuration updated")
        return True
    return False

def set_start_command():
    """Set custom start command"""
    print("\n📌 Setting start command...")
    
    query = """
    mutation ServiceUpdate($id: String!, $input: ServiceUpdateInput!) {
        serviceUpdate(id: $id, input: $input) {
            id
            name
        }
    }
    """
    
    variables = {
        "id": SERVICE_ID,
        "input": {
            "startCommand": "python startup_check.py && uvicorn server:app --host 0.0.0.0 --port $PORT"
        }
    }
    
    result = graphql_query(query, variables)
    if result:
        print("✅ Start command updated")
        return True
    return False

def trigger_deployment():
    """Trigger a new deployment"""
    print("\n📌 Triggering deployment...")
    
    query = """
    mutation ServiceInstanceRedeploy($serviceId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId)
    }
    """
    
    variables = {
        "serviceId": SERVICE_ID
    }
    
    result = graphql_query(query, variables)
    if result:
        print("✅ Deployment triggered!")
        return True
    return False

def get_deployment_status():
    """Check latest deployment status"""
    print("\n📌 Checking deployment status...")
    
    query = """
    query GetDeployments($serviceId: String!, $first: Int!) {
        service(id: $serviceId) {
            id
            name
            deployments(first: $first, orderBy: { column: CREATED_AT, direction: DESC }) {
                edges {
                    node {
                        id
                        status
                        createdAt
                    }
                }
            }
        }
    }
    """
    
    variables = {
        "serviceId": SERVICE_ID,
        "first": 1
    }
    
    result = graphql_query(query, variables)
    if result and result.get("service"):
        deployments = result["service"]["deployments"]["edges"]
        if deployments:
            deployment = deployments[0]["node"]
            print(f"Latest deployment: {deployment['status']}")
            return deployment["status"]
    
    return None

def main():
    print("="*60)
    print("🚀 Railway Deployment Script")
    print("="*60)
    
    # Step 1: Update service configuration
    if not update_service_config():
        print("❌ Failed to update service config")
        return False
    
    # Step 2: Set start command
    if not set_start_command():
        print("❌ Failed to set start command")
        return False
    
    # Step 3: Trigger deployment
    if not trigger_deployment():
        print("❌ Failed to trigger deployment")
        return False
    
    # Step 4: Wait and check status
    print("\n⏳ Waiting for deployment to complete...")
    print("This usually takes 2-3 minutes...")
    
    for i in range(12):  # Check for 2 minutes
        time.sleep(10)
        status = get_deployment_status()
        
        if status == "SUCCESS":
            print("\n" + "="*60)
            print("✅ DEPLOYMENT SUCCESSFUL!")
            print("="*60)
            print("\nNow test the health endpoint:")
            print("https://perpetual-motivation-production-be1a.up.railway.app/v1/integrations/health")
            return True
        elif status == "FAILED":
            print("\n" + "="*60)
            print("❌ DEPLOYMENT FAILED!")
            print("="*60)
            print("Check Railway logs for errors")
            return False
        else:
            print(f"Status: {status or 'BUILDING'}... ({i+1}/12)")
    
    print("\n⏳ Deployment still in progress. Check Railway dashboard.")
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
