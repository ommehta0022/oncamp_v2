import os

def ensure_dir(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)

def write_file(path, content):
    ensure_dir(path)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

with open("d:/oncampus_V2/oncamp_v2/admin_routes_simple.py", "a", encoding="utf-8") as f:
    f.write('''

@router.get("/institutions")
async def get_all_institutions(
    page: int = 1, limit: int = 50, search: Optional[str] = None, status: Optional[str] = None, admin: dict = Depends(get_current_admin)
):
    params = {}
    if search: params["name"] = f"ilike.*{search}*"
    if status: params["status"] = f"eq.{status}"
    return table_rows("institutions", params, page, limit)

@router.get("/institutions/{institution_id}")
async def get_institution_by_id(institution_id: str, admin: dict = Depends(get_current_admin)):
    rows = safe_get("institutions", {"id": f"eq.{institution_id}"})
    if not rows: raise HTTPException(status_code=404, detail="Institution not found")
    return {"data": rows[0]}

@router.patch("/institutions/{institution_id}")
async def update_institution(institution_id: str, data: dict, admin: dict = Depends(get_current_admin)):
    updated = safe_patch("institutions", {"id": f"eq.{institution_id}"}, data)
    if not updated: raise HTTPException(status_code=404, detail="Institution not found")
    return {"success": True, "data": updated[0]}

@router.delete("/institutions/{institution_id}")
async def delete_institution(institution_id: str, admin: dict = Depends(get_current_admin)):
    deleted = safe_delete("institutions", {"id": f"eq.{institution_id}"})
    if not deleted: raise HTTPException(status_code=404, detail="Institution not found")
    return {"success": True}

@router.get("/posts")
async def get_all_posts(
    page: int = 1, limit: int = 50, search: Optional[str] = None, type: Optional[str] = None, status: Optional[str] = None, admin: dict = Depends(get_current_admin)
):
    params = {}
    if search: params["title"] = f"ilike.*{search}*"
    if type and type != 'all': params["type"] = f"eq.{type}"
    if status and status != 'all': params["status"] = f"eq.{status}"
    return table_rows("posts", params, page, limit)

@router.get("/posts/{post_id}")
async def get_post_by_id(post_id: str, admin: dict = Depends(get_current_admin)):
    rows = safe_get("posts", {"id": f"eq.{post_id}"})
    if not rows: raise HTTPException(status_code=404, detail="Post not found")
    return {"data": rows[0]}

@router.patch("/posts/{post_id}")
async def update_post(post_id: str, data: dict, admin: dict = Depends(get_current_admin)):
    updated = safe_patch("posts", {"id": f"eq.{post_id}"}, data)
    if not updated: raise HTTPException(status_code=404, detail="Post not found")
    return {"success": True, "data": updated[0]}

@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, admin: dict = Depends(get_current_admin)):
    deleted = safe_delete("posts", {"id": f"eq.{post_id}"})
    if not deleted: raise HTTPException(status_code=404, detail="Post not found")
    return {"success": True}
''')

api_path = "d:/oncampus_V2/oncamp_v2/admin-panel/src/lib/api.ts"
with open(api_path, "r", encoding="utf-8") as f: api_content = f.read()
if "getInstitutions(" not in api_content:
    api_content += '''
  // Institutions
  async getInstitutions(params?: any) { const response = await this.client.get("/admin/institutions", { params }); return response.data; }
  async getInstitution(id: string) { const response = await this.client.get(/admin/institutions/); return response.data; }
  async updateInstitution(id: string, data: any) { const response = await this.client.patch(/admin/institutions/, data); return response.data; }
  async deleteInstitution(id: string) { const response = await this.client.delete(/admin/institutions/); return response.data; }

  // Posts
  async getPosts(params?: any) { const response = await this.client.get("/admin/posts", { params }); return response.data; }
  async getPost(id: string) { const response = await this.client.get(/admin/posts/); return response.data; }
  async updatePost(id: string, data: any) { const response = await this.client.patch(/admin/posts/, data); return response.data; }
  async deletePost(id: string) { const response = await this.client.delete(/admin/posts/); return response.data; }
'''
    with open(api_path, "w", encoding="utf-8") as f: f.write(api_content)

layout_path = "d:/oncampus_V2/oncamp_v2/admin-panel/src/app/(dashboard)/layout.tsx"
with open(layout_path, "r", encoding="utf-8") as f: layout_content = f.read()
if "{ name: \"Posts\"" not in layout_content:
    layout_content = layout_content.replace(
        '{ name: "Groups", href: "/dashboard/groups", icon: UsersRound },',
        '{ name: "Groups", href: "/dashboard/groups", icon: UsersRound },\n  { name: "Institutions", href: "/dashboard/institutions", icon: School },\n  { name: "Posts", href: "/dashboard/posts", icon: FileText },'
    )
    with open(layout_path, "w", encoding="utf-8") as f: f.write(layout_content)

print("Backend APIs and Layout updated successfully.")
