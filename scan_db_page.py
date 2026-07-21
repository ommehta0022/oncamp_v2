import re
with open(r'd:\oncampus_V2\v3\admin-panel\src\app\(dashboard)\dashboard\database\page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
found = False
backtick = chr(96)
dollar_brace = '$' + '{'
for i, line in enumerate(lines, 1):
    s = line.strip()
    if dollar_brace in s and backtick not in s and not s.startswith('//') and not s.startswith('*'):
        print('Line %d: %s' % (i, s[:120]))
        found = True
if not found:
    print('No broken template literals found!')
