"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

export default function InstitutionDetails() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [newIdentifier, setNewIdentifier] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.getInstitution(id as string).then(res => setItem(res)).catch(console.error);
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
          <button onClick={() => setResetModalOpen(true)} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">Reset Login</button>
          <button onClick={async () => {
            if(confirm('Are you sure you want to delete this institution?')) {
              await api.deleteInstitution(id as string);
              router.push('/dashboard/institutions');
            }
          }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete Institution</button>
        </div>
      </div>

      {resetModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2">Reset Institution Login</h2>
              <p className="text-gray-600 mb-4 text-sm">Enter the new phone number or email for this institution's login.</p>
              
              <input
                type="text"
                value={newIdentifier}
                onChange={(e) => setNewIdentifier(e.target.value)}
                placeholder="New Phone or Email"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 mb-4"
              />

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resetting || !newIdentifier}
                  onClick={async () => {
                    try {
                      setResetting(true);
                      await api.resetInstitutionLogin(id as string, newIdentifier);
                      alert("Login reset successfully");
                      setResetModalOpen(false);
                    } catch (e: any) {
                      alert(e.response?.data?.detail || "Failed to reset login");
                    } finally {
                      setResetting(false);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {resetting ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}