'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, X, Check, Clock, AlertCircle, Copy, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';

type InviteCode = {
  id: number;
  code: string;
  is_active: boolean;
  uses_count: number;
  max_uses: number;
  expires_at: string | null;
  created_at: string;
};

type Member = {
  id: number;
  member_id: number;
  username: string | null;
  status: string;
  invited_at: string;
  approved_at: string | null;
  invite_code: string | null;
};

export default function OrganizationMembers() {
  const { user } = useAuth();
  const { get, post, delete: del } = useApi();
  const toast = useToast();

  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (user?.role !== 2) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [codesRes, membersRes] = await Promise.all([
        get('/org/invite-codes'),
        get('/org/members')
      ]);
      setInviteCodes(codesRes.codes || []);
      setMembers(membersRes.members || []);
    } catch (err) {
      toast.error('Error loading data', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const createInviteCode = async () => {
    try {
      const res = await post('/org/invite-codes');
      toast.success('Invite Code Created', `Code: ${res.code}`);
      loadAll();
    } catch (err) {
      toast.error('Failed to create code', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const deactivateCode = async (codeId: number) => {
    if (!confirm('Deactivate this invite code?')) return;
    try {
      await del(`/org/invite-codes/${codeId}`);
      toast.success('Code Deactivated', 'Invite code has been deactivated');
      loadAll();
    } catch (err) {
      toast.error('Failed to deactivate', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const approveMember = async (memberId: number) => {
    try {
      await post(`/org/members/${memberId}/approve`);
      toast.success('Member Approved', 'Member has been approved');
      loadAll();
    } catch (err) {
      toast.error('Failed to approve', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const declineMember = async (memberId: number) => {
    if (!confirm('Decline this member?')) return;
    try {
      await post(`/org/members/${memberId}/decline`);
      toast.success('Member Declined', 'Member has been declined');
      loadAll();
    } catch (err) {
      toast.error('Failed to decline', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const removeMember = async (memberId: number) => {
    if (!confirm('Remove this member from the organization?')) return;
    try {
      await del(`/org/members/${memberId}`);
      toast.success('Member Removed', 'Member has been removed from the organization');
      loadAll();
    } catch (err) {
      toast.error('Failed to remove', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Copied', 'Invite code copied to clipboard');
  };

  const filteredMembers = statusFilter === 'all' ? members : members.filter(m => m.status === statusFilter);

  if (user?.role !== 2) {
    return <div className="p-8 text-red-500">Organization account required</div>;
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Organization Members</h1>
      <p className="text-slate-400 mb-8">Manage invite codes and member approvals for {user.org_name || 'your organization'}</p>

      {/* Invite Codes Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 mb-8">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Invite Codes</h2>
          <div className="flex gap-2">
            <button
              onClick={loadAll}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={createInviteCode}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Create Code
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-4 py-2 text-left text-slate-300">Code</th>
                <th className="px-4 py-2 text-left text-slate-300">Uses</th>
                <th className="px-4 py-2 text-left text-slate-300">Expires</th>
                <th className="px-4 py-2 text-left text-slate-300">Status</th>
                <th className="px-4 py-2 text-left text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inviteCodes.map((code) => (
                <tr key={code.id} className="border-t border-slate-700">
                  <td className="px-4 py-2">
                    <button
                      onClick={() => copyCode(code.code)}
                      className="font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      {code.code}
                      <Copy className="w-3 h-3" />
                    </button>
                  </td>
                  <td className="px-4 py-2 text-slate-300">
                    {code.uses_count} / {code.max_uses}
                  </td>
                  <td className="px-4 py-2 text-slate-300">
                    {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      code.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {code.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {code.is_active && (
                      <button
                        onClick={() => deactivateCode(code.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {inviteCodes.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No invite codes yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Members Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Members</h2>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-4 py-2 text-left text-slate-300">Username</th>
                <th className="px-4 py-2 text-left text-slate-300">Status</th>
                <th className="px-4 py-2 text-left text-slate-300">Invited</th>
                <th className="px-4 py-2 text-left text-slate-300">Approved</th>
                <th className="px-4 py-2 text-left text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id} className="border-t border-slate-700">
                  <td className="px-4 py-2 text-white">{member.username || 'Unknown'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 w-fit ${
                      member.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      member.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {member.status === 'approved' && <Check className="w-3 h-3" />}
                      {member.status === 'pending' && <Clock className="w-3 h-3" />}
                      {member.status === 'declined' && <X className="w-3 h-3" />}
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-300">
                    {new Date(member.invited_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-slate-300">
                    {member.approved_at ? new Date(member.approved_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-2">
                    {member.status === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => approveMember(member.member_id)}
                          className="text-green-400 hover:text-green-300"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => declineMember(member.member_id)}
                          className="text-red-400 hover:text-red-300"
                          title="Decline"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {member.status === 'approved' && (
                      <button
                        onClick={() => removeMember(member.member_id)}
                        className="text-red-400 hover:text-red-300"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No members found for this filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
