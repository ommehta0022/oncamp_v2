import os
def replace_in_file(path, old, new):
    with open(path, 'r', encoding='utf-8') as f: content = f.read()
    if old in content:
        content = content.replace(old, new)
        with open(path, 'w', encoding='utf-8') as f: f.write(content)
        print(f"Updated {path}")
    else: print(f"Old content not found in {path}")

replace_in_file(
    'frontend/src/lib/api.ts',
    '  course?: string;',
    '  course?: string;\n  email?: string;'
)
