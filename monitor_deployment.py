#!/usr/bin/env python3
"""
Monitor Railway deployment and verify Twilio configuration
Run this script and it will automatically check until deployment succeeds
"""

import requests
import time
import json
from datetime import datetime

HEALTH_URL = "https://perpetual-motivation-production-be1a.up.railway.app/v1/integrations/health"
CHECK_INTERVAL = 10  # seconds
MAX_CHECKS = 60  # 10 minutes total

def check_health():
    """Check health endpoint"""
    try:
        response = requests.get(HEALTH_URL, timeout=10)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"❌ Error checking health: {e}")
        return None

def analyze_health(data):
    """Analyze health response"""
    if not data:
        return False, "No response"
    
    otp_config = data.get("otp", {})
    twilio_config = data.get("twilio", {})
    
    provider = otp_config.get("provider")
    dev_mode = otp_config.get("devMode")
    twilio_enabled = twilio_config.get("enabled", False)
    
    if provider == "twilio" and not dev_mode and twilio_enabled:
        return True, "✅ Twilio configured correctly!"
    
    if provider == "firebase_phone_auth":
        return False, f"❌ Still using Firebase (Twilio not loading)"
    
    if dev_mode:
        return False, f"❌ Dev mode still active"
    
    return False, f"⚠️  Unknown state: provider={provider}, devMode={dev_mode}"

def main():
    print("="*70)
    print("🔍 Railway Deployment Monitor")
    print("="*70)
    print(f"\nMonitoring: {HEALTH_URL}")
    print(f"Check interval: {CHECK_INTERVAL} seconds")
    print(f"Max duration: {MAX_CHECKS * CHECK_INTERVAL // 60} minutes\n")
    print("Waiting for Railway to deploy latest code...")
    print("(You need to manually click 'Redeploy' in Railway dashboard)")
    print("="*70 + "\n")
    
    last_provider = None
    checks = 0
    
    while checks < MAX_CHECKS:
        checks += 1
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        print(f"[{timestamp}] Check #{checks}/{MAX_CHECKS}...", end=" ")
        
        health_data = check_health()
        
        if health_data:
            success, message = analyze_health(health_data)
            current_provider = health_data.get("otp", {}).get("provider")
            
            # Only print if provider changed or success
            if current_provider != last_provider or success:
                print(f"\n{message}")
                if current_provider != last_provider:
                    print(f"   Provider: {current_provider}")
                    print(f"   DevMode: {health_data.get('otp', {}).get('devMode')}")
                    if health_data.get("twilio"):
                        print(f"   Twilio: {json.dumps(health_data['twilio'], indent=6)}")
                last_provider = current_provider
            else:
                print("(no change)")
            
            if success:
                print("\n" + "="*70)
                print("🎉 SUCCESS! Twilio is now configured!")
                print("="*70)
                print("\n📋 Full Health Response:")
                print(json.dumps(health_data, indent=2))
                print("\n✅ You can now test OTP in the mobile app!")
                print("   1. Open Expo Go app")
                print("   2. Enter phone: 9356800676")
                print("   3. Tap 'Send OTP'")
                print("   4. Check your phone for SMS")
                print("   5. Enter OTP and login!")
                return True
        else:
            print("❌ No response (server might be restarting)")
        
        if checks < MAX_CHECKS:
            time.sleep(CHECK_INTERVAL)
    
    print("\n" + "="*70)
    print("⏰ Monitoring timeout reached")
    print("="*70)
    print("Railway deployment might not have been triggered.")
    print("Please manually click 'Redeploy' in Railway dashboard.")
    return False

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Monitoring stopped by user")
        exit(1)
