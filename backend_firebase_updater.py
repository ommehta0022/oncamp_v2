# -*- coding: utf-8 -*-
import os

server_path = r"d:\2026-06-30\oncampuses-v1\backend\server.py"

with open(server_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add google imports if not present
if "from google.oauth2 import id_token" not in content:
    import_statement = "from google.oauth2 import id_token\nfrom google.auth.transport import requests as google_requests\n"
    content = content.replace("import jwt", import_statement + "import jwt")

# Replace VerifyOtpDto
old_dto = """class VerifyOtpDto(BaseModel):
    challengeId: str
    code: Optional[str] = None
    firebaseIdToken: Optional[str] = None
    platform: Optional[str] = None"""
new_dto = """class VerifyOtpDto(BaseModel):
    challengeId: Optional[str] = None
    code: Optional[str] = None
    firebaseIdToken: Optional[str] = None
    platform: Optional[str] = None"""
content = content.replace(old_dto, new_dto)

# Replace verify_otp function body up to hashed_phone assignment
old_verify_logic = """def verify_otp(payload: VerifyOtpDto, x_device_id: Optional[str] = Header(default=None)) -> dict[str, Any]:
    rows = db.get("otp_challenges", {"id": f"eq.{payload.challengeId}", "select": "*"})
    if not rows:
        raise HTTPException(status_code=400, detail="Invalid OTP challenge")
    challenge = rows[0]
    if challenge.get("verified"):
        raise HTTPException(status_code=400, detail="OTP already used")
    if datetime.fromisoformat(challenge["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")
    if not payload.firebaseIdToken and sha256(payload.code or "") != challenge["code_hash"]:
        db.patch("otp_challenges", {"id": f"eq.{payload.challengeId}"}, {"attempts": int(challenge.get("attempts", 0)) + 1})
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    db.patch("otp_challenges", {"id": f"eq.{payload.challengeId}"}, {"verified": True, "verified_at": now_iso()})
    hashed_phone = phone_hash(challenge["phone"])"""

new_verify_logic = """def verify_otp(payload: VerifyOtpDto, x_device_id: Optional[str] = Header(default=None)) -> dict[str, Any]:
    phone = None
    if payload.firebaseIdToken:
        try:
            req = google_requests.Request()
            project_id = firebase_project_id()
            if not project_id:
                raise HTTPException(status_code=503, detail="Firebase project ID not configured on backend")
            
            decoded = id_token.verify_firebase_token(payload.firebaseIdToken, req, audience=project_id)
            phone = decoded.get("phone_number")
            if not phone:
                raise HTTPException(status_code=400, detail="Firebase token missing phone_number")
        except ValueError as e:
            raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {str(e)}")
    else:
        if not payload.challengeId:
            raise HTTPException(status_code=400, detail="Missing firebaseIdToken or challengeId")
        rows = db.get("otp_challenges", {"id": f"eq.{payload.challengeId}", "select": "*"})
        if not rows:
            raise HTTPException(status_code=400, detail="Invalid OTP challenge")
        challenge = rows[0]
        if challenge.get("verified"):
            raise HTTPException(status_code=400, detail="OTP already used")
        if datetime.fromisoformat(challenge["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="OTP expired")
        if sha256(payload.code or "") != challenge["code_hash"]:
            db.patch("otp_challenges", {"id": f"eq.{payload.challengeId}"}, {"attempts": int(challenge.get("attempts", 0)) + 1})
            raise HTTPException(status_code=400, detail="Invalid OTP code")

        db.patch("otp_challenges", {"id": f"eq.{payload.challengeId}"}, {"verified": True, "verified_at": now_iso()})
        phone = challenge["phone"]

    hashed_phone = phone_hash(phone)"""

content = content.replace(old_verify_logic, new_verify_logic)

with open(server_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated server.py to securely verify Firebase ID tokens using Google JWKS.")
