import os

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip())
    print(f"Created {path}")

# institutions/page.tsx
write_file("d:/oncampus_V2/oncamp_v2/admin-panel/src/app/(dashboard)/dashboard/institutions/page.tsx", '''
"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Search, Eye, Trash2, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export default function InstitutionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ status: "all" });

  useEffect(() => { fetchItems(); }, [filters]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.getInstitutions({
        search: search || undefined,
        status: filters.status !== "all" ? filters.status : undefined,
      });
      setItems(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => { fetchItems(); };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Institutions</h1>
          <p className="text-gray-600 mt-1">Manage platform institutions</p>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 justify-between items-center">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <input type="text" placeholder="Search institutions..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <select value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))} className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Search</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.institution_type}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.city}</td>
                  <td className="px-6 py-4">
                    <span className={px-2 inline-flex text-xs leading-5 font-semibold rounded-full }>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => router.push(/dashboard/institutions/)} className="text-gray-400 hover:text-blue-600" title="View details"><Eye className="h-5 w-5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
''')

# institutions/[id]/page.tsx
write_file("d:/oncampus_V2/oncamp_v2/admin-panel/src/app/(dashboard)/dashboard/institutions/[id]/page.tsx", '''
"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

export default function InstitutionDetails() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);

  useEffect(() => {
    api.getInstitution(id as string).then(res => setItem(res.data)).catch(console.error);
  }, [id]);

  if (!item) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold">{item.name}</h1>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div><p className="text-gray-500">City</p><p>{item.city}</p></div>
          <div><p className="text-gray-500">State/Country</p><p>{item.state}, {item.country}</p></div>
          <div><p className="text-gray-500">Email</p><p>{item.official_email || "N/A"}</p></div>
          <div><p className="text-gray-500">Status</p><p>{item.status}</p></div>
          <div><p className="text-gray-500">Type</p><p>{item.institution_type}</p></div>
        </div>
        <div className="mt-8 flex gap-4">
          <button onClick={async () => {
            const newStatus = item.status === 'active' ? 'suspended' : 'active';
            await api.updateInstitution(id as string, { status: newStatus });
            setItem({ ...item, status: newStatus });
          }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {item.status === 'active' ? 'Suspend Institution' : 'Activate Institution'}
          </button>
          <button onClick={async () => {
            if(confirm('Are you sure you want to delete this institution?')) {
              await api.deleteInstitution(id as string);
              router.push('/dashboard/institutions');
            }
          }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete Institution</button>
        </div>
      </div>
    </div>
  );
}
''')

# posts/page.tsx
write_file("d:/oncampus_V2/oncamp_v2/admin-panel/src/app/(dashboard)/dashboard/posts/page.tsx", '''
"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Search, Eye } from "lucide-react";

export default function PostsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ type: "all", status: "all" });

  useEffect(() => { fetchItems(); }, [filters]);

  const fetchItems = async () => {
    const res = await api.getPosts({ search: search || undefined, type: filters.type !== "all" ? filters.type : undefined, status: filters.status !== "all" ? filters.status : undefined });
    setItems(res.data || []);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Posts</h1><p className="text-gray-600 mt-1">Manage platform posts</p></div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 justify-between items-center">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <input type="text" placeholder="Search titles..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchItems()} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <select value={filters.type} onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))} className="border border-gray-300 rounded-lg px-4 py-2 bg-white">
              <option value="all">All Types</option><option value="event">Event</option><option value="general">General</option>
            </select>
            <select value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))} className="border border-gray-300 rounded-lg px-4 py-2 bg-white">
              <option value="all">All Status</option><option value="published">Published</option><option value="draft">Draft</option>
            </select>
            <button onClick={fetchItems} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Search</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{item.title || "Untitled"}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.status}</td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button onClick={() => router.push(/dashboard/posts/)} className="text-gray-400 hover:text-blue-600"><Eye className="h-5 w-5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
''')

# posts/[id]/page.tsx
write_file("d:/oncampus_V2/oncamp_v2/admin-panel/src/app/(dashboard)/dashboard/posts/[id]/page.tsx", '''
"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PostDetails() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);

  useEffect(() => {
    api.getPost(id as string).then(res => setItem(res.data)).catch(console.error);
  }, [id]);

  if (!item) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-2xl font-bold">Post Details</h1>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">{item.title || "No Title"}</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div><p className="text-gray-500">Type</p><p>{item.type}</p></div>
          <div><p className="text-gray-500">Status</p><p>{item.status}</p></div>
          <div><p className="text-gray-500">Visibility</p><p>{item.visibility}</p></div>
          <div><p className="text-gray-500">Pinned</p><p>{item.pinned ? 'Yes' : 'No'}</p></div>
        </div>
        <div className="mt-8 flex gap-4">
          <button onClick={async () => {
            const newStatus = item.status === 'published' ? 'draft' : 'published';
            await api.updatePost(id as string, { status: newStatus });
            setItem({ ...item, status: newStatus });
          }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {item.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
          <button onClick={async () => {
            if(confirm('Are you sure you want to delete this post?')) {
              await api.deletePost(id as string);
              router.push('/dashboard/posts');
            }
          }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete Post</button>
        </div>
      </div>
    </div>
  );
}
''')

