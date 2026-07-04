"""
Twilio SMS Service for OTP
Sends verification codes via SMS using Twilio API
"""

import os
import random
import hashlib
from typing import Optional, Tuple
from datetime import datetime, timedelta, timezone

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException


class TwilioOTPService:
    """Handles OTP generation and sending via Twilio SMS"""
    
    def __init__(self):
        # Get Twilio credentials from environment
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_phone = os.getenv("TWILIO_PHONE_NUMBER")
        
        # Configuration
        self.otp_length = 6
        self.otp_expiry_minutes = 5
        self.max_attempts = 3
        
        # Check if Twilio is configured
        self.enabled = bool(
            self.account_sid and 
            self.auth_token and 
            self.from_phone
        )
        
        # Initialize Twilio client
        if self.enabled:
            try:
                self.client = Client(self.account_sid, self.auth_token)
                print(f"✅ Twilio OTP service initialized with number: {self.from_phone}")
            except Exception as e:
                print(f"⚠️  Twilio initialization error: {e}")
                self.enabled = False
        else:
            print("⚠️  Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER")
    
    def generate_otp(self) -> str:
        """Generate a random 6-digit OTP code"""
        return ''.join([str(random.randint(0, 9)) for _ in range(self.otp_length)])
    
    def hash_otp(self, code: str) -> str:
        """Hash OTP code for secure storage"""
        return hashlib.sha256(code.encode()).hexdigest()
    
    def verify_otp(self, code: str, hashed_code: str) -> bool:
        """Verify OTP code matches the hash"""
        return self.hash_otp(code) == hashed_code
    
    def format_phone(self, phone: str) -> str:
        """
        Format phone number to E.164 format (+1234567890)
        Handles various input formats
        """
        # Remove all non-digit characters
        digits = ''.join(filter(str.isdigit, phone))
        
        # Add country code if missing (assume +91 for India, +1 for US)
        if not phone.startswith('+'):
            if len(digits) == 10:
                # Indian number (10 digits) - add +91
                digits = '91' + digits
            elif len(digits) == 11 and digits.startswith('1'):
                # US number (11 digits starting with 1)
                pass
            elif len(digits) == 11:
                # Assume Indian number with 0 prefix
                digits = '91' + digits[1:]
        else:
            digits = phone[1:]  # Remove + for processing
        
        return f'+{digits}'
    
    def create_message(self, code: str, app_name: str = "OnCampus") -> str:
        """Create OTP message text"""
        return f"""Your {app_name} verification code is: {code}

This code expires in {self.otp_expiry_minutes} minutes.

Do not share this code with anyone.

If you didn't request this code, please ignore this message."""
    
    def send_otp(
        self, 
        phone: str, 
        code: Optional[str] = None,
        app_name: str = "OnCampus"
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Send OTP via Twilio SMS
        
        Args:
            phone: Phone number to send to
            code: OTP code (generates one if not provided)
            app_name: Application name for message
            
        Returns:
            Tuple of (success, message, code)
        """
        if not self.enabled:
            return False, "Twilio OTP service not configured", None
        
        # Generate OTP if not provided
        if code is None:
            code = self.generate_otp()
        
        # Format phone number
        try:
            to_phone = self.format_phone(phone)
        except Exception as e:
            return False, f"Invalid phone number format: {str(e)}", None
        
        # Create message
        message_body = self.create_message(code, app_name)
        
        # Send SMS via Twilio
        try:
            message = self.client.messages.create(
                body=message_body,
                from_=self.from_phone,
                to=to_phone
            )
            
            print(f"✅ OTP sent to {to_phone}, SID: {message.sid}, Status: {message.status}")
            
            return True, f"OTP sent successfully to {phone}", code
            
        except TwilioRestException as e:
            error_msg = f"Twilio error: {e.msg}"
            print(f"❌ {error_msg}")
            
            # Handle specific errors
            if e.code == 21211:
                return False, "Invalid phone number. Please check the number and try again.", None
            elif e.code == 21608:
                return False, "This phone number is not verified for trial account. Please verify it in Twilio console.", None
            elif e.code == 21614:
                return False, "Invalid phone number format.", None
            else:
                return False, error_msg, None
                
        except Exception as e:
            error_msg = f"Failed to send OTP: {str(e)}"
            print(f"❌ {error_msg}")
            return False, error_msg, None
    
    def send_otp_with_retry(
        self,
        phone: str,
        max_retries: int = 2
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Send OTP with retry logic
        
        Args:
            phone: Phone number
            max_retries: Maximum retry attempts
            
        Returns:
            Tuple of (success, message, code)
        """
        code = self.generate_otp()
        
        for attempt in range(max_retries + 1):
            success, message, _ = self.send_otp(phone, code)
            
            if success:
                return True, message, code
            
            if attempt < max_retries:
                print(f"⚠️  Retry {attempt + 1}/{max_retries} for {phone}")
            else:
                return False, message, None
        
        return False, "Failed to send OTP after retries", None


# Global instance
twilio_otp = TwilioOTPService()


def send_otp_sms(phone: str) -> Tuple[bool, str, Optional[str]]:
    """
    Convenience function to send OTP
    
    Args:
        phone: Phone number to send to
        
    Returns:
        Tuple of (success, message, code)
    """
    return twilio_otp.send_otp_with_retry(phone)


def verify_otp_code(code: str, hashed_code: str) -> bool:
    """
    Verify OTP code against hash
    
    Args:
        code: User-entered code
        hashed_code: Stored hash
        
    Returns:
        True if valid
    """
    return twilio_otp.verify_otp(code, hashed_code)


def hash_otp_code(code: str) -> str:
    """
    Hash OTP code for storage
    
    Args:
        code: OTP code to hash
        
    Returns:
        Hashed code
    """
    return twilio_otp.hash_otp(code)
