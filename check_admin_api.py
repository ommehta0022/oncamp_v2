with open('admin-panel/src/lib/api.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the end of the api class to add wipe methods
# Look for the executeQuery method to add wipe methods after it
old = '  async executeQuery(query: string)'
exists = old in text
print("executeQuery found:", exists)
if exists:
    import re
    m = re.search(r'async executeQuery\(query: string\).*?\}', text, re.DOTALL)
    if m:
        print("Found executeQuery block, length:", len(m.group(0)))
