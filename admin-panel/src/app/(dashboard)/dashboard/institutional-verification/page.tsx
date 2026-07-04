'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '@/lib/admin-api';

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'needs_changes';

interface InstitutionVerificationRequest {
  id: string;
  institution_id: string | null;
  submitted_by: string | null;
  institution_name: string;
  institution_type: string;
  city: string;
  state: string | null;
  country: string | null;
  official_email: string;
  phone: string | null;
  website: string | null;
  admin_name: string;
  designation: string | null;
  document_url: string | null;
  status: VerificationStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export default function InstitutionalVerificationPage() {
  const [selectedStatus, setSelectedStatus] = useState<'all' | VerificationStatus>('pending');
  const [selectedRequest, setSelectedRequest] = useState<InstitutionVerificationRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const queryClient = useQueryClient();

  // Fetch verification requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ['institutional-verification-requests', selectedStatus],
    queryFn: async () => {
      const params = selectedStatus !== 'all' ? `status=eq.${selectedStatus}` : '';
      const response = await adminAPI(`/database/query?table=institution_verification_requests&${params}&order=created_at.desc`);
      return response as InstitutionVerificationRequest[];
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      // Update verification request status
      await adminAPI(`/database/query?table=institution_verification_requests&id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'approved',
          review_notes: notes,
          reviewed_at: new Date().toISOString(),
        }),
      });

      const request = requests?.find(r => r.id === id);
      if (!request) return;

      // Create institution if doesn't exist
      let institutionId = request.institution_id;
      if (!institutionId) {
        const newInstitution = await adminAPI('/database/query?table=institutions', {
          method: 'POST',
          body: JSON.stringify({
            name: request.institution_name,
            type: request.institution_type,
            city: request.city,
            state: request.state,
            country: request.country,
            email: request.official_email,
            phone: request.phone,
            website: request.website,
            official: true,
            verified: true,
          }),
        });
        institutionId = newInstitution[0]?.id;
      }

      // Create institution admin record if user exists
      if (request.submitted_by && institutionId) {
        await adminAPI('/database/query?table=institution_admins', {
          method: 'POST',
          body: JSON.stringify({
            id: crypto.randomUUID(),
            institution_id: institutionId,
            user_id: request.submitted_by,
            role: 'owner',
            status: 'active',
          }),
        });

        // Update user account type
        await adminAPI(`/database/query?table=users&id=eq.${request.submitted_by}`, {
          method: 'PATCH',
          body: JSON.stringify({
            account_type: 'institution_admin',
            can_create_posts: true,
            can_create_groups: true,
            verified: true,
          }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutional-verification-requests'] });
      setSelectedRequest(null);
      setReviewNotes('');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      await adminAPI(`/database/query?table=institution_verification_requests&id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'rejected',
          review_notes: notes,
          reviewed_at: new Date().toISOString(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutional-verification-requests'] });
      setSelectedRequest(null);
      setReviewNotes('');
    },
  });

  // Request changes mutation
  const requestChangesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      await adminAPI(`/database/query?table=institution_verification_requests&id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'needs_changes',
          review_notes: notes,
          reviewed_at: new Date().toISOString(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutional-verification-requests'] });
      setSelectedRequest(null);
      setReviewNotes('');
    },
  });

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    needs_changes: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Institutional Verification Requests</h1>
        <p className="text-gray-600 mt-1">Review and approve institutions registering on the platform</p>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex gap-2">
        {(['all', 'pending', 'approved', 'rejected', 'needs_changes'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading requests...</p>
        </div>
      ) : requests && requests.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{request.institution_name}</div>
                    <div className="text-sm text-gray-500">{request.institution_type}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{request.admin_name}</div>
                    <div className="text-sm text-gray-500">{request.designation || 'No designation'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{request.official_email}</div>
                    <div className="text-sm text-gray-500">{request.phone || 'No phone'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{request.city}</div>
                    <div className="text-sm text-gray-500">{request.state || request.country || 'No state/country'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[request.status]}`}>
                      {request.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(request.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setReviewNotes(request.review_notes || '');
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No verification requests found</p>
        </div>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">Review Verification Request</h2>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <h3 className="font-semibold text-gray-700">Institution Details</h3>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="text-sm font-medium">{selectedRequest.institution_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <p className="text-sm font-medium">{selectedRequest.institution_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">City</p>
                      <p className="text-sm font-medium">{selectedRequest.city}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">State/Country</p>
                      <p className="text-sm font-medium">{selectedRequest.state || selectedRequest.country || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="text-sm font-medium">{selectedRequest.official_email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="text-sm font-medium">{selectedRequest.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Website</p>
                      <p className="text-sm font-medium">{selectedRequest.website || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Admin Details</h3>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="text-sm font-medium">{selectedRequest.admin_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Designation</p>
                      <p className="text-sm font-medium">{selectedRequest.designation || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {selectedRequest.document_url && (
                  <div>
                    <h3 className="font-semibold text-gray-700">Verification Document</h3>
                    <a
                      href={selectedRequest.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-blue-600 hover:text-blue-800"
                    >
                      View Document →
                    </a>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Notes
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add notes about this request..."
                  />
                </div>
              </div>

              <div className="flex gap-3">
                {selectedRequest.status === 'pending' || selectedRequest.status === 'needs_changes' ? (
                  <>
                    <button
                      onClick={() => approveMutation.mutate({ id: selectedRequest.id, notes: reviewNotes })}
                      disabled={approveMutation.isPending}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {approveMutation.isPending ? 'Approving...' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => requestChangesMutation.mutate({ id: selectedRequest.id, notes: reviewNotes })}
                      disabled={requestChangesMutation.isPending}
                      className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                    >
                      {requestChangesMutation.isPending ? 'Requesting...' : '↺ Request Changes'}
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate({ id: selectedRequest.id, notes: reviewNotes })}
                      disabled={rejectMutation.isPending}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {rejectMutation.isPending ? 'Rejecting...' : '✕ Reject'}
                    </button>
                  </>
                ) : (
                  <div className="text-center w-full py-2 text-gray-600">
                    This request has already been {selectedRequest.status}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
