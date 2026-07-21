with open('admin-panel/src/app/(dashboard)/dashboard/database/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Count braces to find imbalance
depth = 0
in_string = False
string_char = None
for i, ch in enumerate(content):
    if not in_string:
        if ch in ('"', "'"):
            in_string = True
            string_char = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth < 0:
                line_num = content[:i].count('\n') + 1
                print('NEGATIVE DEPTH at line %d, char: %s, context: %s' % (line_num, ch, repr(content[max(0,i-30):i+30])))
                depth = 0
    else:
        if ch == string_char and (i == 0 or content[i-1] != '\\\\'):
            in_string = False

print('Final brace depth:', depth)
