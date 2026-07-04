"""Check if Twilio package is installed"""
import sys

try:
    import twilio
    from twilio.rest import Client
    print(f"✅ Twilio package installed: {twilio.__version__}")
    sys.exit(0)
except ImportError as e:
    print(f"❌ Twilio package NOT installed: {e}")
    sys.exit(1)
