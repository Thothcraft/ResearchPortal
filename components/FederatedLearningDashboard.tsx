/**
 * Federated Learning Dashboard Component
 * 
 * Professional UI for FL training with Flower framework
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Network, Play, Square, RefreshCw, Plus, Settings, BarChart3,
  Users, Target, Clock, CheckCircle, XCircle, AlertCircle, Loader2,
  ChevronRight, Trash2, Eye, Zap, Shield, Database, Cpu, TrendingUp,
  Activity, Layers, X, ArrowLeft
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';

interface FLSession {
  session_id: string;
  session_name: string;
  algorithm: string;
  status: string;
  current_round: number;
  total_rounds: number;
  best_accuracy: number;
  created_at: string;
  started_at?: string;
  error_message?: string;
}

interface RoundMetric {
  round: number;
  avg_accuracy: number;
  avg_loss: number;
  participating_clients: number;
}

const ALGORITHMS = [
  { id: 'fedavg', name: 'FedAvg', description: 'Standard federated averaging', category: 'standard', color: 'bg-blue-500' },
  { id: 'fedprox', name: 'FedProx', description: 'Proximal term for non-IID data', category: 'standard', color: 'bg-indigo-500' },
  { id: 'fedadam', name: 'FedAdam', description: 'Adaptive learning with Adam', category: 'adaptive', color: 'bg-green-500' },
  { id: 'fedyogi', name: 'FedYogi', description: 'Controlled adaptivity', category: 'adaptive', color: 'bg-emerald-500' },
  { id: 'fedadagrad', name: 'FedAdagrad', description: 'Adagrad optimizer', category: 'adaptive', color: 'bg-teal-500' },
  { id: 'fedavgm', name: 'FedAvgM', description: 'Server-side momentum', category: 'standard', color: 'bg-cyan-500' },
  { id: 'fedmedian', name: 'FedMedian', description: 'Byzantine-robust median', category: 'robust', color: 'bg-orange-500' },
  { id: 'fedtrimmedavg', name: 'FedTrimmedAvg', description: 'Trimmed mean aggregation', category: 'robust', color: 'bg-amber-500' },
  { id: 'krum', name: 'Krum', description: 'Byzantine-robust selection', category: 'robust', color: 'bg-red-500' },
  { id: 'bulyan', name: 'Bulyan', description: 'Krum + trimmed mean', category: 'robust', color: 'bg-rose-500' },
  { id: 'qfedavg', name: 'QFedAvg', description: 'Fair federated learning', category: 'fair', color: 'bg-purple-500' },
  { id: 'dpfedavg_adaptive', name: 'DP-FedAvg (Adaptive)', description: 'Differential privacy', category: 'privacy', color: 'bg-pink-500' },
  { id: 'dpfedavg_fixed', name: 'DP-FedAvg (Fixed)', description: 'Fixed clipping DP', category: 'privacy', color: 'bg-fuchsia-500' },
];

const DATASETS = [
  { id: 'cifar10', name: 'CIFAR-10', description: '60K 32x32 color images', num_classes: 10, samples: '50K' },
  { id: 'cifar100', name: 'CIFAR-100', description: '60K images, 100 classes', num_classes: 100, samples: '50K' },
  { id: 'mnist', name: 'MNIST', description: 'Handwritten digits', num_classes: 10, samples: '60K' },
  { id: 'fashion_mnist', name: 'Fashion-MNIST', description: 'Fashion items', num_classes: 10, samples: '60K' },
  { id: 'emnist', name: 'EMNIST', description: 'Extended MNIST', num_classes: 62, samples: '697K' },
  { id: 'svhn', name: 'SVHN', description: 'Street View House Numbers', num_classes: 10, samples: '73K' },
];

const FederatedLearningDashboard: React.FC = () => {
  const [view, setView] = useState<'list' | 'create' | 'monitor'>('list');
  const [sessions, setSessions] = useState<FLSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    session_name: '',
    algorithm: 'fedavg',
    model_architecture: 'cnn',
    dataset: 'cifar10',
    num_rounds: 10,
    num_partitions: 5,
    partition_strategy: 'iid',
    local_epochs: 2,
    local_batch_size: 32,
    learning_rate: 0.01,
    fraction_fit: 1.0,
    proximal_mu: 0.01,
    server_learning_rate: 1.0,
  });

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSession && view === 'monitor') {
      loadSessionDetails(selectedSession);
      const interval = setInterval(() => loadSessionDetails(selectedSession), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedSession, view]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fl/sessions`, { credentials: 'include' });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/fl/sessions/${sessionId}`, { credentials: 'include' });
      const data = await res.json();
      setSessionDetails(data);
    } catch (err) {
      console.error('Failed to load session details:', err);
    }
  };

  const createSession = async () => {
    if (!form.session_name.trim()) {
      setError('Please enter a session name');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const payload = {
        session_name: form.session_name,
        algorithm: form.algorithm,
        model_architecture: form.model_architecture,
        server: {
          num_rounds: form.num_rounds,
          fraction_fit: form.fraction_fit,
          min_fit_clients: 1,
          min_available_clients: 1,
        },
        client: {
          local_epochs: form.local_epochs,
          local_batch_size: form.local_batch_size,
          learning_rate: form.learning_rate,
        },
        data: {
          dataset: form.dataset,
          num_partitions: form.num_partitions,
          partition_strategy: form.partition_strategy,
        },
        algorithm_params: {
          proximal_mu: form.proximal_mu,
          server_learning_rate: form.server_learning_rate,
        },
      };

      const res = await fetch(`${API_BASE_URL}/fl/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create session');
      }

      const data = await res.json();
      
      // Auto-start the session
      await fetch(`${API_BASE_URL}/fl/sessions/${data.data.session_id}/start`, {
        method: 'POST',
        credentials: 'include',
      });

      await loadSessions();
      setForm({ ...form, session_name: '' });
      setView('list');
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const startSession = async (sessionId: string) => {
    try {
      await fetch(`${API_BASE_URL}/fl/sessions/${sessionId}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      await loadSessions();
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  };

  const stopSession = async (sessionId: string) => {
    try {
      await fetch(`${API_BASE_URL}/fl/sessions/${sessionId}/stop`, {
        method: 'POST',
        credentials: 'include',
      });
      await loadSessions();
    } catch (err) {
      console.error('Failed to stop session:', err);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`${API_BASE_URL}/fl/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await loadSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'cancelled': return <Square className="w-4 h-4 text-orange-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'completed': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'failed': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'cancelled': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  const getAlgoColor = (algo: string) => {
    const found = ALGORITHMS.find(a => a.id === algo);
    return found?.color || 'bg-slate-500';
  };

  // Sessions List View
  const renderSessionsList = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-purple-400" />
            FL Sessions
          </h2>
          <p className="text-sm text-slate-400 mt-1">Manage your federated learning experiments</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSessions}
            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
        </div>
      </div>

      {/* Sessions Grid */}
      {sessions.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
          <Network className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No FL Sessions</h3>
          <p className="text-slate-400 mb-4">Create your first federated learning experiment</p>
          <button
            onClick={() => setView('create')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Create Session
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-white">{session.session_name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getAlgoColor(session.algorithm)}`}>
                      {session.algorithm.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(session.status)}`}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(session.status)}
                        {session.status}
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-6 text-sm">
                    <div>
                      <span className="text-slate-500">Progress</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 transition-all"
                            style={{ width: `${session.total_rounds > 0 ? (session.current_round / session.total_rounds) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-white font-medium">
                          {session.current_round}/{session.total_rounds}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Best Accuracy</span>
                      <p className="text-white font-medium mt-1">
                        {session.best_accuracy > 0 ? `${(session.best_accuracy * 100).toFixed(1)}%` : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Created</span>
                      <p className="text-white font-medium mt-1">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Duration</span>
                      <p className="text-white font-medium mt-1">
                        {session.started_at ? 
                          `${Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000)}m` : 
                          '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  {session.status === 'pending' && (
                    <button
                      onClick={() => startSession(session.session_id)}
                      className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      title="Start"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {session.status === 'running' && (
                    <button
                      onClick={() => stopSession(session.session_id)}
                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      title="Stop"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedSession(session.session_id);
                      setView('monitor');
                    }}
                    className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    title="Monitor"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteSession(session.session_id)}
                    className="p-2 bg-slate-700 hover:bg-red-600 text-white rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {session.error_message && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{session.error_message}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Create Session View
  const renderCreateSession = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setView('list')}
          className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-white">Create FL Session</h2>
          <p className="text-sm text-slate-400">Configure your federated learning experiment</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <span className="text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Basic Settings */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            Basic Settings
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Session Name</label>
              <input
                type="text"
                value={form.session_name}
                onChange={(e) => setForm({ ...form, session_name: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                placeholder="My FL Experiment"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Algorithm</label>
              <select
                value={form.algorithm}
                onChange={(e) => setForm({ ...form, algorithm: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <optgroup label="Standard">
                  {ALGORITHMS.filter(a => a.category === 'standard').map(a => (
                    <option key={a.id} value={a.id}>{a.name} - {a.description}</option>
                  ))}
                </optgroup>
                <optgroup label="Adaptive">
                  {ALGORITHMS.filter(a => a.category === 'adaptive').map(a => (
                    <option key={a.id} value={a.id}>{a.name} - {a.description}</option>
                  ))}
                </optgroup>
                <optgroup label="Byzantine-Robust">
                  {ALGORITHMS.filter(a => a.category === 'robust').map(a => (
                    <option key={a.id} value={a.id}>{a.name} - {a.description}</option>
                  ))}
                </optgroup>
                <optgroup label="Privacy">
                  {ALGORITHMS.filter(a => a.category === 'privacy').map(a => (
                    <option key={a.id} value={a.id}>{a.name} - {a.description}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Model Architecture</label>
              <select
                value={form.model_architecture}
                onChange={(e) => setForm({ ...form, model_architecture: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="cnn">CNN (Convolutional)</option>
                <option value="resnet18">ResNet-18</option>
                <option value="mlp">MLP (Fully Connected)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Dataset</label>
              <select
                value={form.dataset}
                onChange={(e) => setForm({ ...form, dataset: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                {DATASETS.map(ds => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.num_classes} classes, {ds.samples} samples)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Training Config */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-green-400" />
            Training Configuration
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Rounds</label>
                <input
                  type="number"
                  value={form.num_rounds}
                  onChange={(e) => setForm({ ...form, num_rounds: parseInt(e.target.value) || 10 })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  min={1}
                  max={1000}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Clients</label>
                <input
                  type="number"
                  value={form.num_partitions}
                  onChange={(e) => setForm({ ...form, num_partitions: parseInt(e.target.value) || 5 })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  min={2}
                  max={100}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Local Epochs</label>
                <input
                  type="number"
                  value={form.local_epochs}
                  onChange={(e) => setForm({ ...form, local_epochs: parseInt(e.target.value) || 2 })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  min={1}
                  max={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Batch Size</label>
                <input
                  type="number"
                  value={form.local_batch_size}
                  onChange={(e) => setForm({ ...form, local_batch_size: parseInt(e.target.value) || 32 })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  min={1}
                  max={512}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Learning Rate</label>
              <input
                type="number"
                step="0.001"
                value={form.learning_rate}
                onChange={(e) => setForm({ ...form, learning_rate: parseFloat(e.target.value) || 0.01 })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Data Partition</label>
              <select
                value={form.partition_strategy}
                onChange={(e) => setForm({ ...form, partition_strategy: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <option value="iid">IID (Uniform)</option>
                <option value="dirichlet">Non-IID (Dirichlet)</option>
                <option value="shard">Non-IID (Shard)</option>
                <option value="pathological">Pathological</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Create Button */}
      <div className="flex justify-end">
        <button
          onClick={createSession}
          disabled={creating || !form.session_name.trim()}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
        >
          {creating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Create & Start Session
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Monitor View
  const renderMonitor = () => {
    if (!sessionDetails) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      );
    }

    const { session, round_metrics = [], clients = [] } = sessionDetails;
    const progress = session.total_rounds > 0 ? (session.current_round / session.total_rounds) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView('list')}
              className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                {session.session_name}
                <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getAlgoColor(session.algorithm)}`}>
                  {session.algorithm.toUpperCase()}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(session.status)}`}>
                  {getStatusIcon(session.status)}
                  <span className="ml-1">{session.status}</span>
                </span>
              </h2>
              <p className="text-sm text-slate-400">Real-time training progress</p>
            </div>
          </div>
          {session.status === 'running' && (
            <button
              onClick={() => stopSession(session.session_id)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop Training
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-purple-200 text-sm mb-1">
              <Activity className="w-4 h-4" />
              Progress
            </div>
            <div className="text-2xl font-bold text-white">{session.current_round}/{session.total_rounds}</div>
            <div className="mt-2 h-1.5 bg-purple-800 rounded-full overflow-hidden">
              <div className="h-full bg-white/80 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-200 text-sm mb-1">
              <Target className="w-4 h-4" />
              Best Accuracy
            </div>
            <div className="text-2xl font-bold text-white">
              {session.best_accuracy > 0 ? `${(session.best_accuracy * 100).toFixed(2)}%` : '-'}
            </div>
            <div className="text-green-200 text-sm mt-1">Round #{session.best_round || '-'}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-200 text-sm mb-1">
              <Users className="w-4 h-4" />
              Clients
            </div>
            <div className="text-2xl font-bold text-white">{clients.length}</div>
            <div className="text-blue-200 text-sm mt-1">Simulated</div>
          </div>
          <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-4">
            <div className="flex items-center gap-2 text-orange-200 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Duration
            </div>
            <div className="text-2xl font-bold text-white">
              {session.started_at ? 
                `${Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000)}m` : 
                '-'}
            </div>
            <div className="text-orange-200 text-sm mt-1">Elapsed</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Accuracy Over Rounds
            </h3>
            <div className="h-48 flex items-end gap-1">
              {round_metrics.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  Waiting for training data...
                </div>
              ) : (
                round_metrics.slice(-30).map((m: RoundMetric, i: number) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-green-600 to-green-400 rounded-t transition-all hover:from-green-500 hover:to-green-300"
                    style={{ height: `${Math.max(m.avg_accuracy * 100, 2)}%` }}
                    title={`Round ${m.round}: ${(m.avg_accuracy * 100).toFixed(2)}%`}
                  />
                ))
              )}
            </div>
            {round_metrics.length > 0 && (
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>Round {round_metrics[Math.max(0, round_metrics.length - 30)]?.round || 1}</span>
                <span>Round {round_metrics[round_metrics.length - 1]?.round || 1}</span>
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-red-400" />
              Loss Over Rounds
            </h3>
            <div className="h-48 flex items-end gap-1">
              {round_metrics.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  Waiting for training data...
                </div>
              ) : (
                round_metrics.slice(-30).map((m: RoundMetric, i: number) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-red-600 to-red-400 rounded-t transition-all hover:from-red-500 hover:to-red-300"
                    style={{ height: `${Math.min(m.avg_loss * 50, 100)}%` }}
                    title={`Round ${m.round}: ${m.avg_loss.toFixed(4)}`}
                  />
                ))
              )}
            </div>
            {round_metrics.length > 0 && (
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>Round {round_metrics[Math.max(0, round_metrics.length - 30)]?.round || 1}</span>
                <span>Round {round_metrics[round_metrics.length - 1]?.round || 1}</span>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {session.error_message && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
              <AlertCircle className="w-4 h-4" />
              Error
            </div>
            <p className="text-red-300 text-sm">{session.error_message}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {view === 'list' && renderSessionsList()}
      {view === 'create' && renderCreateSession()}
      {view === 'monitor' && renderMonitor()}
    </div>
  );
};

export default FederatedLearningDashboard;
