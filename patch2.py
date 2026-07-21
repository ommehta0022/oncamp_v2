with open('server.py', encoding='utf-8') as f:
    content = f.read()

unpin_endpoint = '''
@app.delete("/v1/posts/{post_id}/pin")
def unpin_post(post_id: str, user: CurrentUser = Depends(current_user)) -> dict[str, bool]:
    post = safe_get("posts", {"id": f"eq.{post_id}", "deleted_at": "is.null"}, one=True)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not (user.role == "platform_admin" or (_admin := current_institution_admin(user)) and post.get("institution_id") == _admin.get("institution_id")):
        raise HTTPException(status_code=403, detail="Not authorized to pin posts")
    db.patch("posts", {"id": f"eq.{post_id}"}, {"pinned": False})
    return {"pinned": False}
'''

if 'unpin_post' not in content:
    content = content.replace(
        '@app.post("/v1/posts/{post_id}/pin")',
        unpin_endpoint + '\n@app.post("/v1/posts/{post_id}/pin")'
    )
    with open('server.py', 'w', encoding='utf-8') as f:
        f.write(content)
print('Unpin endpoint added')
