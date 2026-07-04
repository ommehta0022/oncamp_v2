#!/usr/bin/env python3
"""
Startup Check Script for Railway Deployment
Verifies all critical dependencies are installed
"""

import sys
import os

def check_python_version():
    """Check Python version is 3.7+"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 7):
        print(f"❌ Python {version.major}.{version.minor} is too old. Need 3.7+")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
    return True

def check_package(package_name, import_name=None):
    """Check if a package is installed"""
    if import_name is None:
        import_name = package_name
    
    try:
        __import__(import_name)
        print(f"✅ {package_name} installed")
        return True
    except ImportError:
        print(f"❌ {package_name} NOT installed")
        return False

def check_env_var(var_name, required=True):
    """Check if environment variable is set"""
    value = os.getenv(var_name)
    if value:
        # Mask sensitive values
        if 'TOKEN' in var_name or 'SECRET' in var_name or 'KEY' in var_name:
            display = f"{value[:8]}..." if len(value) > 8 else "***"
        else:
            display = value
        print(f"✅ {var_name} = {display}")
        return True
    else:
        status = "❌" if required else "⚠️ "
        print(f"{status} {var_name} not set")
        return not required

def main():
    print("\n" + "="*60)
    print("🚀 Railway Deployment Startup Check")
    print("="*60 + "\n")
    
    all_good = True
    
    # Check Python version
    print("📌 Checking Python version...")
    if not check_python_version():
        all_good = False
    print()
    
    # Check critical packages
    print("📌 Checking critical packages...")
    critical_packages = [
        ('fastapi', 'fastapi'),
        ('uvicorn', 'uvicorn'),
        ('pydantic', 'pydantic'),
        ('twilio', 'twilio'),  # CRITICAL!
    ]
    
    for pkg_name, import_name in critical_packages:
        if not check_package(pkg_name, import_name):
            all_good = False
    print()
    
    # Check Twilio specifically
    print("📌 Checking Twilio configuration...")
    try:
        from twilio.rest import Client
        from twilio.base.exceptions import TwilioRestException
        print("✅ Twilio SDK imports successful")
        
        # Check Twilio environment variables
        twilio_sid = check_env_var('TWILIO_ACCOUNT_SID', required=True)
        twilio_token = check_env_var('TWILIO_AUTH_TOKEN', required=True)
        twilio_phone = check_env_var('TWILIO_PHONE_NUMBER', required=True)
        
        if twilio_sid and twilio_token and twilio_phone:
            print("✅ All Twilio credentials present")
        else:
            print("❌ Missing Twilio credentials!")
            all_good = False
            
    except ImportError as e:
        print(f"❌ Twilio import failed: {e}")
        all_good = False
    print()
    
    # Check other environment variables
    print("📌 Checking other environment variables...")
    check_env_var('SUPABASE_URL', required=True)
    check_env_var('SUPABASE_SERVICE_ROLE_KEY', required=True)
    check_env_var('JWT_SECRET', required=True)
    check_env_var('DEV_MODE', required=False)
    print()
    
    # Final result
    print("="*60)
    if all_good:
        print("✅ ALL CHECKS PASSED - Ready to start server")
        print("="*60)
        return 0
    else:
        print("❌ SOME CHECKS FAILED - Review errors above")
        print("="*60)
        return 1

if __name__ == "__main__":
    sys.exit(main())
