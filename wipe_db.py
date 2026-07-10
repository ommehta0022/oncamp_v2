from server import db
import time

tables = [
    'reports', 'audit_logs', 'admin_notifications',
    'post_comments', 'post_reactions', 'post_views', 'saved_posts', 
    'group_post_requests', 'posts',
    'group_member_bans', 'group_member_mutes', 'group_members', 'groups',
    'message_reads', 'messages', 
    'join_requests', 'notification_preferences', 'notifications', 
    'otp_challenges', 'user_devices', 'user_settings',
    'institution_admins', 'institution_verification_requests',
    'users',
    'institutions'
]

print('Starting DB Wipe via API...')
for table in tables:
    print(f'Fetching and deleting from {table}...')
    while True:
        try:
            # Fetch up to 1000 rows, selecting only 'id' (some tables might not have id)
            rows = db.get(table, {'select': '*', 'limit': '1000'})
            if not rows:
                break
                
            print(f'  Found {len(rows)} rows to delete in {table}')
            for row in rows:
                # If table has id, use it, else try user_id, etc.
                if 'id' in row:
                    db.delete(table, {'id': f"eq.{row['id']}"})
                elif 'user_id' in row and 'group_id' in row:
                    db.delete(table, {'user_id': f"eq.{row['user_id']}", 'group_id': f"eq.{row['group_id']}"})
                elif 'user_id' in row:
                    db.delete(table, {'user_id': f"eq.{row['user_id']}"})
            time.sleep(0.5)
        except Exception as e:
            print(f"Error on table {table}: {e}")
            break

print('Database Wipe Complete!')
