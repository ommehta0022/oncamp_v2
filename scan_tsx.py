with open('admin-panel/src/app/(dashboard)/dashboard/database/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

import re
for i, line in enumerate(lines, 1):
    stripped = line.strip()
    if re.search(r'className=\{[a-zA-Z]', stripped):
        print('Line %d: BROKEN className: %s' % (i, stripped[:120]))
