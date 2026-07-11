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