'use client';

import { useState, useEffect } from 'react';
import { Users, DollarSign, HardDrive, Brain, CreditCard, Settings, Plus, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';

type User = {
  user_id: number;
  username: string;
  role: number;
  plan: string;
  org_name?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  plan_expires_at?: string;
  phone_number?: number;
  device_count?: number;
  file_count?: number;
};

type Payment = {
  id: number;
  user_id: number;
  username?: string;
  amount: number;
  currency: string;
  plan: string;
  status: string;
  created_at: string;
};

type Stats = {
  total_users: number;
  total_orgs: number;
  total_admins: number;
  total_devices: number;
  total_files: number;
  total_models: number;
  total_revenue_cents: number;
  plan_counts: Record<string, number>;
  recent_payments: Payment[];
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { get, post, put, delete: del } = useApi();
  const toast = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    role: 0,
    plan: 'free',
    org_name: '',
  });

  useEffect(() => {
    if (user?.role !== 1) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, paymentsRes] = await Promise.all([
        get('/admin/stats'),
        get('/admin/users?limit=100'),
        get('/admin/payments?limit=50')
      ]);
      setStats(statsRes);
      setUsers(usersRes.users || []);
      setPayments(paymentsRes.payments || []);
    } catch (err) {
      toast.error('Error loading data', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await put(`/admin/users/${editingUser.user_id}`, userForm);
      toast.success('User updated');
      setShowUserModal(false);
      setEditingUser(null);
      loadAll();
    } catch (err) {
      toast.error('Update failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Delete this user?')) return;
    try {
      await del(`/admin/users/${userId}`);
      toast.success('User deleted');
      loadAll();
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setUserForm({
      role: u.role,
      plan: u.plan,
      org_name: u.org_name || '',
    });
    setShowUserModal(true);
  };

  if (user?.role !== 1) {
    return <div className="p-8 text-red-500">Admin access required</div>;
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
      <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
      <p className="text-slate-400 mb-8">Manage users, plans, and payments</p>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-white">{stats.total_users}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats.plan_counts.free} free, {stats.plan_counts.researcher} researcher, {stats.plan_counts.organization} org
                </p>
              </div>
              <Users className="w-8 h-8 text-indigo-400" />
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Revenue</p>
                <p className="text-2xl font-bold text-green-400">
                  ${(stats.total_revenue_cents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 mt-1">USD</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Devices</p>
                <p className="text-2xl font-bold text-white">{stats.total_devices}</p>
              </div>
              <HardDrive className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Models</p>
                <p className="text-2xl font-bold text-white">{stats.total_models}</p>
              </div>
              <Brain className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 mb-8">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Users</h2>
          <button
            onClick={loadAll}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-4 py-2 text-left text-slate-300">Username</th>
                <th className="px-4 py-2 text-left text-slate-300">Role</th>
                <th className="px-4 py-2 text-left text-slate-300">Plan</th>
                <th className="px-4 py-2 text-left text-slate-300">Org Name</th>
                <th className="px-4 py-2 text-left text-slate-300">Devices</th>
                <th className="px-4 py-2 text-left text-slate-300">Files</th>
                <th className="px-4 py-2 text-left text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-t border-slate-700">
                  <td className="px-4 py-2 text-white">{u.username}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      u.role === 1 ? 'bg-red-500/20 text-red-400' :
                      u.role === 2 ? 'bg-blue-500/20 text-blue-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {u.role === 1 ? 'Admin' : u.role === 2 ? 'Org' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-300">{u.plan}</td>
                  <td className="px-4 py-2 text-slate-300">{u.org_name || '-'}</td>
                  <td className="px-4 py-2 text-slate-300">{u.device_count || 0}</td>
                  <td className="px-4 py-2 text-slate-300">{u.file_count || 0}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => openEditModal(u)}
                      className="text-indigo-400 hover:text-indigo-300 mr-2"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.user_id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Recent Payments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-4 py-2 text-left text-slate-300">User</th>
                <th className="px-4 py-2 text-left text-slate-300">Amount</th>
                <th className="px-4 py-2 text-left text-slate-300">Plan</th>
                <th className="px-4 py-2 text-left text-slate-300">Status</th>
                <th className="px-4 py-2 text-left text-slate-300">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-700">
                  <td className="px-4 py-2 text-white">{p.username}</td>
                  <td className="px-4 py-2 text-green-400">${(p.amount / 100).toFixed(2)}</td>
                  <td className="px-4 py-2 text-slate-300">{p.plan}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      p.status === 'succeeded' ? 'bg-green-500/20 text-green-400' :
                      p.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-300">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {showUserModal && editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Edit User: {editingUser.username}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                  >
                    <option value={0}>User</option>
                    <option value={1}>Admin</option>
                    <option value={2}>Organization</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Plan</label>
                  <select
                    value={userForm.plan}
                    onChange={(e) => setUserForm({ ...userForm, plan: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                  >
                    <option value="free">Free</option>
                    <option value="researcher">Researcher</option>
                    <option value="organization">Organization</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Organization Name</label>
                  <input
                    type="text"
                    value={userForm.org_name}
                    onChange={(e) => setUserForm({ ...userForm, org_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                    placeholder="For organization accounts"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateUser}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
