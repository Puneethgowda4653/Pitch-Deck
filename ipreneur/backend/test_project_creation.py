"""
Quick test to verify project creation endpoint is working correctly.
"""
import httpx
import json

base_url = "http://127.0.0.1:8000/api/v1"

print("=" * 60)
print("Testing iPreneur Project Creation Fix")
print("=" * 60)

with httpx.Client(timeout=30.0) as client:
    # Step 1: Register a test user
    print("\n1️⃣  Registering test user...")
    user_email = "test_fix@example.com"
    user_payload = {
        "email": user_email,
        "name": "Fix Tester",
        "password": "TestPassword123!"
    }
    
    try:
        auth_response = client.post(f"{base_url}/auth/register", json=user_payload)
        auth_response.raise_for_status()
        auth_data = auth_response.json()
        token = auth_data['data']['access_token']
        print(f"   ✅ User registered: {user_email}")
        print(f"   ✅ Token received: {token[:20]}...")
    except Exception as e:
        print(f"   ❌ Registration failed: {e}")
        raise
    
    # Step 2: Create a project WITHOUT automatic analysis
    print("\n2️⃣  Creating project WITHOUT automatic analysis...")
    headers = {"Authorization": f"Bearer {token}"}
    project_payload = {
        "name": "Test Project - No Analysis",
        "company_url": "https://example.com",
        "start_analysis": False
    }
    
    try:
        create_response = client.post(f"{base_url}/projects", json=project_payload, headers=headers)
        create_response.raise_for_status()
        project_data = create_response.json()
        project_id = project_data['id']
        print(f"   ✅ Project created successfully!")
        print(f"   ✅ Project ID: {project_id}")
        print(f"   ✅ Status: {project_data['status']}")
    except Exception as e:
        print(f"   ❌ Project creation failed: {e}")
        if hasattr(e, 'response'):
            print(f"   Response: {e.response.text}")
        raise
    
    # Step 3: Create a project WITH automatic analysis
    print("\n3️⃣  Creating project WITH automatic analysis (this may take a moment)...")
    project_payload_2 = {
        "name": "Test Project - With Analysis",
        "company_url": "https://stripe.com",
        "start_analysis": True
    }
    
    try:
        create_response_2 = client.post(f"{base_url}/projects", json=project_payload_2, headers=headers, timeout=10.0)
        create_response_2.raise_for_status()
        project_data_2 = create_response_2.json()
        project_id_2 = project_data_2['id']
        print(f"   ✅ Project created successfully!")
        print(f"   ✅ Project ID: {project_id_2}")
        print(f"   ✅ Status: {project_data_2['status']}")
        print(f"   ℹ️  Analysis is running in the background...")
    except Exception as e:
        print(f"   ❌ Project creation failed: {e}")
        if hasattr(e, 'response'):
            print(f"   Response: {e.response.text}")
        raise

print("\n" + "=" * 60)
print("✅ All tests passed! The fix is working correctly.")
print("=" * 60)
