with open('admin-panel/src/lib/api.ts', 'r', encoding='utf-8') as f:
    text = f.read()

old = '''  async executeQuery(query: string) {
    const response = await this.client.post("/admin/database/query", { query });
    return response.data;
  }'''

new = '''  async executeQuery(query: string) {
    const response = await this.client.post("/admin/database/query", { query });
    return response.data;
  }

  async wipeEntity(entity: string) {
    const response = await this.client.post(/v1/admin/wipe/);
    return response.data;
  }

  async wipeAll() {
    const response = await this.client.post("/v1/admin/wipe-all");
    return response.data;
  }'''

if old in text:
    text = text.replace(old, new)
    with open('admin-panel/src/lib/api.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated admin api.ts with wipe methods!")
else:
    print("Could not find executeQuery block")
