with open('frontend/src/lib/api.ts', 'r', encoding='utf-8') as f:
    text = f.read()

old_stats = '    stats: () => request<{ groups: number; posts: number; followers: number; following: number }>("/users/me/stats"),'
new_stats = '''    stats: () => request<{ groups: number; posts: number; followers: number; following: number; streak: number; daysSinceJoin: number }>("/users/me/stats"),
    achievements: () => request<Array<{ id: string; label: string; icon: string; color: string; earned: boolean; description: string }>>("/users/me/achievements"),'''

if old_stats in text:
    text = text.replace(old_stats, new_stats)
    with open('frontend/src/lib/api.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated api.ts stats + achievements!")
else:
    print("Could not find stats in api.ts")
