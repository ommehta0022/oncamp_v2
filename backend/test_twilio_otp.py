"""
Test Twilio OTP Service Locally
Run this to test SMS sending without starting the full server
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(".env.local")

# Import Twilio service
from twilio_service import send_otp_sms, twilio_otp

def test_twilio_config():
    """Check if Twilio is configured"""
    print("\n" + "="*60)
    print("📱 TWILIO OTP SERVICE TEST")
    print("="*60)
    
    print(f"\n✅ Configuration:")
    print(f"   Account SID: {os.getenv('TWILIO_ACCOUNT_SID', 'NOT SET')[:10]}...")
    print(f"   Auth Token: {os.getenv('TWILIO_AUTH_TOKEN', 'NOT SET')[:10]}...")
    print(f"   Phone Number: {os.getenv('TWILIO_PHONE_NUMBER', 'NOT SET')}")
    print(f"   Twilio Enabled: {twilio_otp.enabled}")
    
    if not twilio_otp.enabled:
        print("\n❌ Twilio not configured properly!")
        print("   Check your .env.local file")
        return False
    
    return True

def test_send_otp(phone: str):
    """Test sending OTP to a phone number"""
    print(f"\n📤 Sending OTP to: {phone}")
    print("-" * 60)
    
    try:
        success, message, code = send_otp_sms(phone)
        
        if success:
            print(f"\n✅ SUCCESS!")
            print(f"   Message: {message}")
            print(f"   OTP Code: {code}")
            print(f"\n📱 Check your phone for SMS!")
            print(f"   Code: {code}")
            return True
        else:
            print(f"\n❌ FAILED!")
            print(f"   Error: {message}")
            return False
            
    except Exception as e:
        print(f"\n❌ EXCEPTION!")
        print(f"   Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test function"""
    # Test configuration
    if not test_twilio_config():
        return
    
    # Get phone number
    print("\n" + "="*60)
    phone = input("📱 Enter phone number to test (with country code): ").strip()
    
    if not phone:
        phone = "+919356800676"  # Default to your number
        print(f"   Using default: {phone}")
    
    # Test sending OTP
    success = test_send_otp(phone)
    
    print("\n" + "="*60)
    if success:
        print("✅ TEST PASSED!")
        print("="*60)
        print("\n📱 Check your phone for the SMS!")
        print(f"\nThe message will look like:")
        print("-" * 60)
        print("Your OnCampus verification code is: 123456")
        print("")
        print("This code expires in 5 minutes.")
        print("")
        print("Do not share this code with anyone.")
        print("")
        print("If you didn't request this code, please ignore this message.")
        print("-" * 60)
    else:
        print("❌ TEST FAILED!")
        print("="*60)
        print("\n⚠️  Common Issues:")
        print("   1. Phone number not verified in Twilio (trial account)")
        print("   2. Invalid phone number format")
        print("   3. Twilio credentials incorrect")
        print("   4. No internet connection")
        print("\n💡 To verify your number:")
        print("   https://console.twilio.com/us1/develop/phone-numbers/manage/verified")
    
    print("\n")

if __name__ == "__main__":
    main()
