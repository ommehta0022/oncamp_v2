import os
for root, dirs, files in os.walk(r"d:\2026-06-30\oncampus-mobile-app\lib"):
    for file in files:
        if file.endswith('.dart'):
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                content = f.read()
                if 'TODO' in content or 'throw UnimplementedError' in content or 'NotImplemented' in content:
                    print(f"File: {os.path.join(root, file)}")
