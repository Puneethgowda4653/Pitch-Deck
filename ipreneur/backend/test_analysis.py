#!/usr/bin/env python3
"""
Test script to verify analysis is running in background.
"""
import asyncio
import httpx
import json
import time

API_URL = "http://127.0.0.1:8000/api/v1"

async def test_analysis_flow():
    """Test full analysis flow: create project -> poll status."""
    
    async with httpx.AsyncClient() as client:
        # 1. Register user
        print("📝 Registering test user...")
        user_response = await client.post(
            f"{API_URL}/users/register",
            json={
                "email": f"test_{time.time()}@test.com",
                "password": "testpass123"
            }
        )
        if user_response.status_code != 201:
            print(f"❌ Registration failed: {user_response.text}")
            return
        
        user_data = user_response.json()
        token = user_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"✅ User registered: {user_data['user']['id']}")
        
        # 2. Create project with analysis
        print("\n🚀 Creating project with analysis...")
        project_response = await client.post(
            f"{API_URL}/projects",
            headers=headers,
            json={
                "name": "Analysis Test Project",
                "company_url": "https://www.figma.com",
                "start_analysis": True,
                "branding_data": {}
            }
        )
        
        if project_response.status_code != 201:
            print(f"❌ Project creation failed: {project_response.text}")
            return
        
        project_data = project_response.json()
        project_id = project_data["id"]
        print(f"✅ Project created: {project_id}")
        print(f"   Status: {project_data['status']}")
        
        # 3. Poll status and watch progress
        print("\n📊 Monitoring analysis progress...")
        max_polls = 60
        poll_count = 0
        
        while poll_count < max_polls:
            await asyncio.sleep(2)  # Wait 2 seconds between polls
            poll_count += 1
            
            status_response = await client.get(
                f"{API_URL}/projects/{project_id}/status",
                headers=headers
            )
            
            if status_response.status_code != 200:
                print(f"❌ Status check failed: {status_response.text}")
                break
            
            status_data = status_response.json()
            
            print(f"\n[Poll {poll_count}] Status: {status_data['status']}")
            print(f"  Step: {status_data['current_step']}")
            print(f"  Progress: {status_data['total_progress']}%")
            print(f"  Message: {status_data['message']}")
            
            # Check if done
            if status_data['status'] == 'completed':
                print("\n✅ Analysis completed!")
                break
            elif status_data['status'] == 'failed':
                print(f"\n❌ Analysis failed: {status_data['message']}")
                break
            
            # Stop after 2 minutes if still working
            if poll_count >= 60:
                print("\n⏱️  Reached 2-minute timeout - analysis may still be running in background")
                break

if __name__ == "__main__":
    print("🔍 Testing Analysis Pipeline\n")
    print("=" * 50)
    asyncio.run(test_analysis_flow())
    print("\n" + "=" * 50)
