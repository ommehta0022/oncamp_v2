"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PostDetails() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<any | null>(null);

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