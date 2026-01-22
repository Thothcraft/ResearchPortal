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

// Dataset types for model filtering
type DatasetType = 'image_rgb' | 'image_gray' | 'tabular' | 'text' | 'time_series';

interface DatasetConfig {
  id: string;
  name: string;
  description: string;
  num_classes: number;
  samples: string;
  type: DatasetType;
  input_shape: string;
}

const DATASETS: DatasetConfig[] = [
  // RGB Image datasets (32x32x3)
  { id: 'cifar10', name: 'CIFAR-10', description: '60K 32x32 color images', num_classes: 10, samples: '50K', type: 'image_rgb', input_shape: '32×32×3' },
  { id: 'cifar100', name: 'CIFAR-100', description: '60K images, 100 classes', num_classes: 100, samples: '50K', type: 'image_rgb', input_shape: '32×32×3' },
  { id: 'svhn', name: 'SVHN', description: 'Street View House Numbers', num_classes: 10, samples: '73K', type: 'image_rgb', input_shape: '32×32×3' },
  // Grayscale Image datasets (28x28x1)
  { id: 'mnist', name: 'MNIST', description: 'Handwritten digits', num_classes: 10, samples: '60K', type: 'image_gray', input_shape: '28×28×1' },
  { id: 'fashion_mnist', name: 'Fashion-MNIST', description: 'Fashion items', num_classes: 10, samples: '60K', type: 'image_gray', input_shape: '28×28×1' },
  { id: 'emnist', name: 'EMNIST', description: 'Extended MNIST (letters+digits)', num_classes: 62, samples: '814K', type: 'image_gray', input_shape: '28×28×1' },
];

// Model architectures with compatibility info
interface ModelConfig {
  id: string;
  name: string;
  description: string;
  compatible_types: DatasetType[];
}

const MODEL_ARCHITECTURES: ModelConfig[] = [
  { id: 'cnn', name: 'CNN', description: 'Convolutional Neural Network', compatible_types: ['image_rgb', 'image_gray'] },
  { id: 'resnet18', name: 'ResNet-18', description: 'Deep residual network', compatible_types: ['image_rgb', 'image_gray'] },
  { id: 'mlp', name: 'MLP', description: 'Multi-layer perceptron', compatible_types: ['image_rgb', 'image_gray', 'tabular', 'time_series'] },
];

// Get compatible models for a dataset
const getCompatibleModels = (datasetId: string): ModelConfig[] => {
  const dataset = DATASETS.find(d => d.id === datasetId);
  if (!dataset) return MODEL_ARCHITECTURES;
  return MODEL_ARCHITECTURES.filter(m => m.compatible_types.includes(dataset.type));
};

// Algorithm-specific default parameters
const ALGORITHM_DEFAULTS: Record<string, Record<string, number>> = {
  fedprox: { proximal_mu: 0.01 },
  fedadam: { server_learning_rate: 0.1, beta_1: 0.9, beta_2: 0.99 },
  fedyogi: { server_learning_rate: 0.1, beta_1: 0.9, beta_2: 0.99 },
  fedadagrad: { server_learning_rate: 0.1 },
  fedavgm: { server_learning_rate: 1.0, momentum: 0.9 },
  qfedavg: { q_param: 0.2 },
  dpfedavg_adaptive: { noise_multiplier: 1.0, clipping_norm: 1.0 },
  dpfedavg_fixed: { noise_multiplier: 1.0, clipping_norm: 1.0 },
  fedtrimmedavg: { trim_ratio: 0.1 },
  bulyan: { trim_ratio: 0.1 },
};

type FLTab = 'sessions' | 'models' | 'compare';

interface FLTrainedModel {
  model_id: string;
  session_id: string;
  session_name: string;
  algorithm: string;
  accuracy: number;
  loss: number;
  rounds_completed: number;
  created_at: string;
  dataset: string;
}

const FederatedLearningDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FLTab>('sessions');
  const [view, setView] = useState<'list' | 'create' | 'monitor'>('list');
  const [sessions, setSessions] = useState<FLSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [trainedModels, setTrainedModels] = useState<FLTrainedModel[]>([]);
  const [selectedModelsForCompare, setSelectedModelsForCompare] = useState<string[]>([]);

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
    // Additional algorithm-specific params
    q_param: 0.2,
    noise_multiplier: 1.0,
    clipping_norm: 1.0,
    trim_ratio: 0.1,
    momentum: 0.9,
  });

  // Update model architecture when dataset changes (ensure compatibility)
  useEffect(() => {
    const compatibleModels = getCompatibleModels(form.dataset);
    if (!compatibleModels.find(m => m.id === form.model_architecture)) {
      // Current model not compatible, switch to first compatible one
      setForm(prev => ({ ...prev, model_architecture: compatibleModels[0]?.id || 'mlp' }));
    }
  }, [form.dataset]);

  // Update algorithm-specific params when algorithm changes
  useEffect(() => {
    const defaults = ALGORITHM_DEFAULTS[form.algorithm];
    if (defaults) {
      setForm(prev => ({ ...prev, ...defaults }));
    }
  }, [form.algorithm]);

  useEffect(() => {
    loadSessions();
    loadTrainedModels();
  }, []);

  useEffect(() => {
    if (selectedSession && view === 'monitor') {
      loadSessionDetails(selectedSession);
      const interval = setInterval(() => loadSessionDetails(selectedSession), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedSession, view]);

  // Real-time polling for sessions list
  useEffect(() => {
    if (activeTab === 'sessions' && view === 'list') {
      const interval = setInterval(loadSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, view]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/fl/sessions`, { credentials: 'include' });
      const data = await res.json();
      setSessions(data.sessions || []);
      
      // Extract trained models from completed sessions
      const completedSessions = (data.sessions || []).filter((s: FLSession) => s.status === 'completed');
      const models: FLTrainedModel[] = completedSessions.map((s: FLSession) => ({
        model_id: `fl_model_${s.session_id}`,
        session_id: s.session_id,
        session_name: s.session_name,
        algorithm: s.algorithm,
        accuracy: s.best_accuracy,
        loss: 0,
        rounds_completed: s.current_round,
        created_at: s.created_at,
        dataset: 'cifar10', // Default, would come from session config
      }));
      setTrainedModels(models);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTrainedModels = async () => {
    // Models are derived from completed sessions in loadSessions
    // This could be extended to fetch from a dedicated endpoint
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
              <label className="block text-sm font-medium text-slate-300 mb-2">Dataset</label>
              <select
                value={form.dataset}
                onChange={(e) => setForm({ ...form, dataset: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <optgroup label="RGB Images (32×32×3)">
                  {DATASETS.filter(ds => ds.type === 'image_rgb').map(ds => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.num_classes} classes, {ds.samples})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Grayscale Images (28×28×1)">
                  {DATASETS.filter(ds => ds.type === 'image_gray').map(ds => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.num_classes} classes, {ds.samples})
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Input: {DATASETS.find(d => d.id === form.dataset)?.input_shape}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Model Architecture
                <span className="text-xs text-slate-500 ml-2">
                  ({getCompatibleModels(form.dataset).length} compatible)
                </span>
              </label>
              <select
                value={form.model_architecture}
                onChange={(e) => setForm({ ...form, model_architecture: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                {getCompatibleModels(form.dataset).map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
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
                <option value="non_iid_dirichlet">Non-IID (Dirichlet)</option>
                <option value="non_iid_label">Non-IID (Shard/Label)</option>
                <option value="pathological">Pathological</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Algorithm-Specific Parameters */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-orange-400" />
          Algorithm-Specific Parameters
          <span className="text-xs text-slate-400 font-normal ml-2">
            ({ALGORITHMS.find(a => a.id === form.algorithm)?.name || form.algorithm})
          </span>
        </h3>

        <div className="grid grid-cols-3 gap-4">
          {/* FedProx: mu parameter */}
          {form.algorithm === 'fedprox' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Proximal μ (mu)
                <span className="text-xs text-slate-500 ml-1">regularization strength</span>
              </label>
              <input
                type="number"
                step="0.001"
                value={form.proximal_mu}
                onChange={(e) => setForm({ ...form, proximal_mu: parseFloat(e.target.value) || 0.01 })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                min={0}
                max={1}
              />
              <p className="text-xs text-slate-500 mt-1">Higher values = stronger regularization toward global model</p>
            </div>
          )}

          {/* Adaptive algorithms: server learning rate */}
          {['fedadam', 'fedyogi', 'fedadagrad', 'fedavgm'].includes(form.algorithm) && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Server Learning Rate
                <span className="text-xs text-slate-500 ml-1">η (eta)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={form.server_learning_rate}
                onChange={(e) => setForm({ ...form, server_learning_rate: parseFloat(e.target.value) || 1.0 })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                min={0.001}
                max={10}
              />
              <p className="text-xs text-slate-500 mt-1">Server-side optimizer step size</p>
            </div>
          )}

          {/* QFedAvg: q parameter */}
          {form.algorithm === 'qfedavg' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Fairness q
                <span className="text-xs text-slate-500 ml-1">reweighting factor</span>
              </label>
              <input
                type="number"
                step="0.1"
                defaultValue={0.2}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                min={0}
                max={5}
              />
              <p className="text-xs text-slate-500 mt-1">Higher q = more weight to worse-performing clients</p>
            </div>
          )}

          {/* DP algorithms: noise/clipping */}
          {form.algorithm.startsWith('dpfedavg') && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Noise Multiplier
                  <span className="text-xs text-slate-500 ml-1">σ</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={1.0}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  min={0}
                />
                <p className="text-xs text-slate-500 mt-1">Gaussian noise scale for privacy</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Clipping Norm
                  <span className="text-xs text-slate-500 ml-1">C</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  defaultValue={1.0}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  min={0.1}
                />
                <p className="text-xs text-slate-500 mt-1">Max gradient norm before clipping</p>
              </div>
            </>
          )}

          {/* Byzantine-robust: trimming/selection params */}
          {['fedtrimmedavg', 'bulyan'].includes(form.algorithm) && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Trim Ratio
                <span className="text-xs text-slate-500 ml-1">β</span>
              </label>
              <input
                type="number"
                step="0.05"
                defaultValue={0.1}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                min={0}
                max={0.45}
              />
              <p className="text-xs text-slate-500 mt-1">Fraction of extreme updates to trim</p>
            </div>
          )}

          {/* Default message for algorithms without special params */}
          {!['fedprox', 'fedadam', 'fedyogi', 'fedadagrad', 'fedavgm', 'qfedavg', 'dpfedavg_adaptive', 'dpfedavg_fixed', 'fedtrimmedavg', 'bulyan'].includes(form.algorithm) && (
            <div className="col-span-3 text-center py-4 text-slate-500">
              <p>No additional parameters for {ALGORITHMS.find(a => a.id === form.algorithm)?.name || form.algorithm}</p>
            </div>
          )}
        </div>
      </div>

      {/* Model Architecture Preview */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          Model Architecture
          <span className="text-xs text-slate-400 font-normal ml-2">
            (for {DATASETS.find(d => d.id === form.dataset)?.input_shape} input)
          </span>
        </h3>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
          {(() => {
            const dataset = DATASETS.find(d => d.id === form.dataset);
            const isGray = dataset?.type === 'image_gray';
            const inputShape = dataset?.input_shape || '32×32×3';
            const numClasses = dataset?.num_classes || 10;
            const flattenSize = isGray ? 784 : 3072; // 28*28 or 32*32*3
            const cnnFlattenSize = isGray ? 1024 : 4096; // After conv layers
            
            if (form.model_architecture === 'cnn') {
              return (
                <div className="space-y-2 text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">Input:</span>
                    <span>{inputShape} ({isGray ? 'grayscale' : 'RGB'} image)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">Conv2D:</span>
                    <span>32 filters, 3×3, ReLU → {isGray ? '28×28×32' : '32×32×32'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">MaxPool:</span>
                    <span>2×2 → {isGray ? '14×14×32' : '16×16×32'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">Conv2D:</span>
                    <span>64 filters, 3×3, ReLU → {isGray ? '14×14×64' : '16×16×64'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">MaxPool:</span>
                    <span>2×2 → {isGray ? '7×7×64' : '8×8×64'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">Flatten:</span>
                    <span>→ {isGray ? '3136' : '4096'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400">Dense:</span>
                    <span>128, ReLU</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">Output:</span>
                    <span>{numClasses} classes (softmax)</span>
                  </div>
                </div>
              );
            }
            
            if (form.model_architecture === 'resnet18') {
              return (
                <div className="space-y-2 text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">Input:</span>
                    <span>{inputShape} ({isGray ? 'grayscale' : 'RGB'} image)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">Conv2D:</span>
                    <span>64 filters, {isGray ? '3×3' : '7×7'}, stride {isGray ? '1' : '2'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">ResBlock×2:</span>
                    <span>64 channels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">ResBlock×2:</span>
                    <span>128 channels (stride 2)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">ResBlock×2:</span>
                    <span>256 channels (stride 2)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">ResBlock×2:</span>
                    <span>512 channels (stride 2)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">AvgPool:</span>
                    <span>Global → 512</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">Output:</span>
                    <span>{numClasses} classes (softmax)</span>
                  </div>
                </div>
              );
            }
            
            if (form.model_architecture === 'mlp') {
              return (
                <div className="space-y-2 text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">Input:</span>
                    <span>{inputShape} = {flattenSize} (flattened)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400">Dense:</span>
                    <span>512, ReLU</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400">Dense:</span>
                    <span>256, ReLU</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400">Dense:</span>
                    <span>128, ReLU</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">Output:</span>
                    <span>{numClasses} classes (softmax)</span>
                  </div>
                </div>
              );
            }
            
            return null;
          })()}
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

  // Trained Models Tab
  const renderModelsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-green-400" />
            FL Trained Models
          </h2>
          <p className="text-sm text-slate-400 mt-1">Models from completed federated learning sessions</p>
        </div>
      </div>

      {trainedModels.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
          <Database className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Trained Models</h3>
          <p className="text-slate-400">Complete an FL session to see trained models here</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {trainedModels.map((model) => (
            <div
              key={model.model_id}
              className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{model.session_name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getAlgoColor(model.algorithm)}`}>
                      {model.algorithm.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Accuracy</span>
                      <p className="text-green-400 font-medium">{(model.accuracy * 100).toFixed(2)}%</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Rounds</span>
                      <p className="text-white">{model.rounds_completed}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Dataset</span>
                      <p className="text-white">{model.dataset}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Created</span>
                      <p className="text-white">{new Date(model.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedModelsForCompare.includes(model.model_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedModelsForCompare(prev => [...prev, model.model_id]);
                      } else {
                        setSelectedModelsForCompare(prev => prev.filter(id => id !== model.model_id));
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-xs text-slate-400">Compare</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedModelsForCompare.length >= 2 && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => setActiveTab('compare')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Compare {selectedModelsForCompare.length} Models
          </button>
        </div>
      )}
    </div>
  );

  // Compare Models Tab
  const renderCompareTab = () => {
    const modelsToCompare = trainedModels.filter(m => selectedModelsForCompare.includes(m.model_id));
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Compare FL Models
            </h2>
            <p className="text-sm text-slate-400 mt-1">Side-by-side comparison of selected models</p>
          </div>
          <button
            onClick={() => setSelectedModelsForCompare([])}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Clear Selection
          </button>
        </div>

        {modelsToCompare.length < 2 ? (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
            <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Select Models to Compare</h3>
            <p className="text-slate-400 mb-4">Go to the Models tab and select at least 2 models</p>
            <button
              onClick={() => setActiveTab('models')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Go to Models
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Comparison Table */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Metric</th>
                    {modelsToCompare.map(model => (
                      <th key={model.model_id} className="px-4 py-3 text-left text-sm font-medium text-white">
                        {model.session_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-700/50">
                    <td className="px-4 py-3 text-sm text-slate-400">Algorithm</td>
                    {modelsToCompare.map(model => (
                      <td key={model.model_id} className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getAlgoColor(model.algorithm)}`}>
                          {model.algorithm.toUpperCase()}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-700/50">
                    <td className="px-4 py-3 text-sm text-slate-400">Accuracy</td>
                    {modelsToCompare.map(model => {
                      const maxAcc = Math.max(...modelsToCompare.map(m => m.accuracy));
                      const isMax = model.accuracy === maxAcc;
                      return (
                        <td key={model.model_id} className={`px-4 py-3 text-sm font-medium ${isMax ? 'text-green-400' : 'text-white'}`}>
                          {(model.accuracy * 100).toFixed(2)}%
                          {isMax && <span className="ml-2 text-xs">🏆</span>}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-slate-700/50">
                    <td className="px-4 py-3 text-sm text-slate-400">Rounds</td>
                    {modelsToCompare.map(model => (
                      <td key={model.model_id} className="px-4 py-3 text-sm text-white">
                        {model.rounds_completed}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm text-slate-400">Dataset</td>
                    {modelsToCompare.map(model => (
                      <td key={model.model_id} className="px-4 py-3 text-sm text-white">
                        {model.dataset}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Visual Comparison */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Accuracy Comparison</h3>
              <div className="flex items-end gap-4 h-48">
                {modelsToCompare.map((model, index) => {
                  const colors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
                  return (
                    <div key={model.model_id} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full ${colors[index % colors.length]} rounded-t transition-all`}
                        style={{ height: `${model.accuracy * 100}%` }}
                      />
                      <div className="mt-2 text-center">
                        <p className="text-xs text-slate-400 truncate max-w-[100px]">{model.session_name}</p>
                        <p className="text-sm font-medium text-white">{(model.accuracy * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const activeSessionsCount = sessions.filter(s => s.status === 'running').length;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => { setActiveTab('sessions'); setView('list'); }}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'sessions' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Network className="w-4 h-4" />
          Sessions
          {activeSessionsCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
              {activeSessionsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('models')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'models' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          Trained Models
          {trainedModels.length > 0 && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
              {trainedModels.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'compare' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Compare
          {selectedModelsForCompare.length > 0 && (
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
              {selectedModelsForCompare.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'sessions' && (
        <>
          {view === 'list' && renderSessionsList()}
          {view === 'create' && renderCreateSession()}
          {view === 'monitor' && renderMonitor()}
        </>
      )}
      {activeTab === 'models' && renderModelsTab()}
      {activeTab === 'compare' && renderCompareTab()}
    </div>
  );
};

export default FederatedLearningDashboard;
