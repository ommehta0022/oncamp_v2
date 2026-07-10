import os
import re

v1_path = r'd:\oncampus_V2\oncampuses-v1\frontend\app\(tabs)\feed.tsx'
v2_path = r'd:\oncampus_V2\oncamp_v2\frontend\app\(tabs)\feed.tsx'

with open(v1_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove mock imports
content = re.sub(r'import \{ feed, currentUser, FeedPost \} from "@/src/data/mock";\n', '', content)
# Add api imports
content = content.replace('import { useRole } from "@/src/context/RoleProvider";', 'import { useRole } from "@/src/context/RoleProvider";\nimport { api, FeedPostDto } from "@/src/lib/api";\nimport { cache } from "@/src/lib/cache";')

# Replace the FeedPost type with FeedPostDto in PostCard
content = content.replace('post: FeedPost;', 'post: FeedPostDto | any;')

# Add useEffect and loadPosts to Feed component
feed_logic = """
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const cached = await cache.get("feed_posts");
        if (cached) setPosts(cached as any);
        const response = await api.feed.list(1);
        setPosts(response.posts || response.feed || []);
        await cache.set("feed_posts", response.posts || response.feed || []);
      } catch (e) {} finally { setLoading(false); }
    };
    loadPosts();
  }, []);
"""
content = re.sub(r'const \[posts, setPosts\] = useState\(feed\);', feed_logic, content)

with open(v2_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Migrated feed.tsx")
