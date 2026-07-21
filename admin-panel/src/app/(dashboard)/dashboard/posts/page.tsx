"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Search, Eye, Filter } from "lucide-react";

export default function PostsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any>([]);
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 font-medium">Total Posts</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 font-medium">Published</p>
          <p className="text-2xl font-bold text-green-600 mt-2">{items.filter(i => i.status === 'published').length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 font-medium">Drafts</p>
          <p className="text-2xl font-bold text-yellow-600 mt-2">{items.filter(i => i.status === 'draft').length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 font-medium">Events</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">{items.filter(i => i.type === 'event').length}</p>
        </div>
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
            <button onClick={fetchItems} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Search</button>
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
                  <td className="px-6 py-4">
                    <span className={\px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.type === 'event' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }\}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={\px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.status === 'published' ? 'bg-green-100 text-green-800' : 
                      item.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                    }\}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button onClick={() => router.push(\/dashboard/posts/${item.id}\)} className="text-gray-400 hover:text-blue-600"><Eye className="h-5 w-5 inline" /></button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No posts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
