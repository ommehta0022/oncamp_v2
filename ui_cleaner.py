import os

profile = r"d:\2026-06-30\oncampus-mobile-app\lib\features\profile\profile_settings_screen.dart"
with open(profile, "r", encoding="utf-8") as f:
    p_content = f.read()

p_content = p_content.replace("'Vihaan Mehta'", "''")
p_content = p_content.replace("'IIT Bombay'", "''")
p_content = p_content.replace("'Mumbai'", "''")
p_content = p_content.replace("'B.Tech - Computer Science'", "''")

with open(profile, "w", encoding="utf-8") as f:
    f.write(p_content)

chat = r"d:\2026-06-30\oncampus-mobile-app\lib\features\groups\group_chat_screen.dart"
with open(chat, "r", encoding="utf-8") as f:
    c_content = f.read()

c_content = c_content.replace(
    "'Pinned: tonight 8 PM mock interview room opens for approved members.'",
    "'Welcome to the group chat!'"
)

with open(chat, "w", encoding="utf-8") as f:
    f.write(c_content)

print("Removed hardcoded dummy data from profile and chat screens.")
