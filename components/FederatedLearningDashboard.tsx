/**
 * Federated Learning Dashboard Component
 * 
 * Beautiful UI for FL training with:
 * - Multiple FL algorithms selection
 * - Built-in datasets
 * - Dynamic configuration
 * - Real-time monitoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';
const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

interface FLSession {
  session_id: string;
  session_name: string;
  algorithm: string;
  status: string;
  progress: string;
  clients: number;
  best_accuracy: number;
  created_at: string;
}

interface Algorithm {
  id: string;
  name: string;
  description: string;
  pros?: string[];
  cons?: string[];
}

interface Dataset {
  id: string;
  name: string;
  description: string;
  num_classes: number;
  train_samples: number;
}

interface RoundMetric {
  round: number;
  avg_accuracy: number;
  avg_loss: number;
  participating_clients: number;
  fairness_index: number;
}

const FederatedLearningDashboard: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<'sessions' | 'create' | 'monitor'>('sessions');
  const [sessions, setSessions] = useState<FLSession[]>([]);
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create session form state
  const [formData, setFormData] = useState({
    session_name: '',
    algorithm: 'fedavg',
    model_architecture: 'cnn',
    dataset: 'cifar10',
    num_rounds: 100,
    num_partitions: 10,
    partition_strategy: 'iid',
    local_epochs: 5,
    local_batch_size: 32,
    learning_rate: 0.01,
    differential_privacy: false,
    noise_multiplier: 1.0,
    secure_aggregation: false,
    fraction_fit: 1.0,
    proximal_mu: 0.01,
    server_learning_rate: 1.0
  });

  // Load initial data
  useEffect(() => {
    loadSessions();
    loadAlgorithms();
    loadDatasets();
  }, []);

  // Auto-refresh session details
  useEffect(() => {
    if (selectedSession && activeTab === 'monitor') {
      const interval = setInterval(() => loadSessionDetails(selectedSession), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedSession, activeTab]);

  const loadSessions = async () => {
    try {
      const response = await api.get('/fl/sessions');
      setSessions(response.data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadAlgorithms = async () => {
    try {
      const response = await api.get('/fl/algorithms');
      setAlgorithms(response.data.algorithms || []);
    } catch (err) {
      console.error('Failed to load algorithms:', err);
    }
  };

  const loadDatasets = async () => {
    try {
      const response = await api.get('/fl/datasets');
      setDatasets(response.data.datasets || []);
    } catch (err) {
      console.error('Failed to load datasets:', err);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const response = await api.get(`/fl/sessions/${sessionId}`);
      setSessionDetails(response.data);
    } catch (err) {
      console.error('Failed to load session details:', err);
    }
  };

  const createSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        session_name: formData.session_name,
        algorithm: formData.algorithm,
        model_architecture: formData.model_architecture,
        server: {
          num_rounds: formData.num_rounds,
          fraction_fit: formData.fraction_fit
        },
        client: {
          local_epochs: formData.local_epochs,
          local_batch_size: formData.local_batch_size,
          learning_rate: formData.learning_rate
        },
        data: {
          dataset: formData.dataset,
          num_partitions: formData.num_partitions,
          partition_strategy: formData.partition_strategy
        },
        privacy: {
          differential_privacy: formData.differential_privacy,
          noise_multiplier: formData.noise_multiplier,
          secure_aggregation: formData.secure_aggregation
        },
        algorithm_params: {
          proximal_mu: formData.proximal_mu,
          server_learning_rate: formData.server_learning_rate
        }
      };

      await api.post('/fl/sessions', payload);
      await loadSessions();
      setActiveTab('sessions');
      setFormData({ ...formData, session_name: '' });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (sessionId: string) => {
    try {
      await api.post(`/fl/sessions/${sessionId}/start`);
      await loadSessions();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start session');
    }
  };

  const stopSession = async (sessionId: string) => {
    try {
      await api.post(`/fl/sessions/${sessionId}/stop`);
      await loadSessions();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to stop session');
    }
  };

  const addSimulatedClients = async (sessionId: string, count: number) => {
    for (let i = 0; i < count; i++) {
      try {
        await api.post(`/fl/sessions/${sessionId}/clients`, {
          device_id: `device_${Date.now()}_${i}`,
          data_samples: Math.floor(Math.random() * 900) + 100,
          compute_capability: Math.random() * 0.5 + 0.75
        });
      } catch (err) {
        console.error('Failed to add client:', err);
      }
    }
    if (selectedSession === sessionId) {
      await loadSessionDetails(sessionId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAlgorithmBadgeColor = (algo: string) => {
    const colors: Record<string, string> = {
      fedavg: 'bg-blue-500',
      fedprox: 'bg-purple-500',
      fedadam: 'bg-green-500',
      fedyogi: 'bg-yellow-500',
      scaffold: 'bg-pink-500',
      qfedavg: 'bg-indigo-500'
    };
    return colors[algo] || 'bg-gray-500';
  };

  // Render Sessions Tab
  const renderSessions = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">FL Sessions</h2>
        <button
          onClick={() => setActiveTab('create')}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
        >
          + New Session
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-6xl mb-4">🌐</div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">No FL Sessions</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Create your first federated learning session</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      {session.session_name}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAlgorithmBadgeColor(session.algorithm)} text-white`}>
                      {session.algorithm.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                      {session.status}
                    </span>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Progress</span>
                      <p className="font-medium text-gray-800 dark:text-white">{session.progress}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Clients</span>
                      <p className="font-medium text-gray-800 dark:text-white">{session.clients}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Best Accuracy</span>
                      <p className="font-medium text-gray-800 dark:text-white">
                        {(session.best_accuracy * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Created</span>
                      <p className="font-medium text-gray-800 dark:text-white">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {session.status === 'pending' && (
                    <>
                      <button
                        onClick={() => addSimulatedClients(session.session_id, 5)}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        +5 Clients
                      </button>
                      <button
                        onClick={() => startSession(session.session_id)}
                        className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        Start
                      </button>
                    </>
                  )}
                  {session.status === 'running' && (
                    <button
                      onClick={() => stopSession(session.session_id)}
                      className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Stop
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedSession(session.session_id);
                      loadSessionDetails(session.session_id);
                      setActiveTab('monitor');
                    }}
                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Monitor
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render Create Session Tab
  const renderCreateSession = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setActiveTab('sessions')} className="text-gray-500 hover:text-gray-700">
          ← Back
        </button>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Create FL Session</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Basic Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Basic Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session Name</label>
              <input
                type="text"
                value={formData.session_name}
                onChange={(e) => setFormData({ ...formData, session_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="My FL Experiment"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Algorithm</label>
              <select
                value={formData.algorithm}
                onChange={(e) => setFormData({ ...formData, algorithm: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {algorithms.map((algo) => (
                  <option key={algo.id} value={algo.id}>{algo.name}</option>
                ))}
              </select>
              {algorithms.find(a => a.id === formData.algorithm)?.description && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {algorithms.find(a => a.id === formData.algorithm)?.description}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model Architecture</label>
              <select
                value={formData.model_architecture}
                onChange={(e) => setFormData({ ...formData, model_architecture: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="cnn">CNN</option>
                <option value="resnet18">ResNet-18</option>
                <option value="resnet50">ResNet-50</option>
                <option value="mobilenet">MobileNet</option>
                <option value="lstm">LSTM</option>
                <option value="transformer">Transformer</option>
                <option value="mlp">MLP</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dataset</label>
              <select
                value={formData.dataset}
                onChange={(e) => setFormData({ ...formData, dataset: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Training Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Training Configuration</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rounds</label>
                <input
                  type="number"
                  value={formData.num_rounds}
                  onChange={(e) => setFormData({ ...formData, num_rounds: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Partitions</label>
                <input
                  type="number"
                  value={formData.num_partitions}
                  onChange={(e) => setFormData({ ...formData, num_partitions: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Local Epochs</label>
                <input
                  type="number"
                  value={formData.local_epochs}
                  onChange={(e) => setFormData({ ...formData, local_epochs: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Size</label>
                <input
                  type="number"
                  value={formData.local_batch_size}
                  onChange={(e) => setFormData({ ...formData, local_batch_size: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Learning Rate</label>
              <input
                type="number"
                step="0.001"
                value={formData.learning_rate}
                onChange={(e) => setFormData({ ...formData, learning_rate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Partition Strategy</label>
              <select
                value={formData.partition_strategy}
                onChange={(e) => setFormData({ ...formData, partition_strategy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value="iid">IID</option>
                <option value="non_iid_label">Non-IID by Label</option>
                <option value="non_iid_dirichlet">Non-IID Dirichlet</option>
                <option value="pathological">Pathological</option>
              </select>
            </div>
          </div>
        </div>

        {/* Algorithm-Specific Parameters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Algorithm Parameters</h3>
          
          <div className="space-y-4">
            {formData.algorithm === 'fedprox' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proximal μ (mu)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.proximal_mu}
                  onChange={(e) => setFormData({ ...formData, proximal_mu: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500">Controls the strength of the proximal term</p>
              </div>
            )}

            {['fedadam', 'fedyogi', 'fedadagrad'].includes(formData.algorithm) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Server Learning Rate
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.server_learning_rate}
                  onChange={(e) => setFormData({ ...formData, server_learning_rate: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Client Fraction (per round)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={formData.fraction_fit}
                onChange={(e) => setFormData({ ...formData, fraction_fit: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Privacy Settings</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Differential Privacy</label>
                <p className="text-xs text-gray-500">Add noise to protect individual data</p>
              </div>
              <button
                onClick={() => setFormData({ ...formData, differential_privacy: !formData.differential_privacy })}
                className={`relative w-12 h-6 rounded-full transition-colors ${formData.differential_privacy ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.differential_privacy ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {formData.differential_privacy && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Noise Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.noise_multiplier}
                  onChange={(e) => setFormData({ ...formData, noise_multiplier: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Secure Aggregation</label>
                <p className="text-xs text-gray-500">Encrypt model updates</p>
              </div>
              <button
                onClick={() => setFormData({ ...formData, secure_aggregation: !formData.secure_aggregation })}
                className={`relative w-12 h-6 rounded-full transition-colors ${formData.secure_aggregation ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.secure_aggregation ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={createSession}
          disabled={loading || !formData.session_name}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Session'}
        </button>
      </div>
    </div>
  );

  // Render Monitor Tab
  const renderMonitor = () => {
    if (!sessionDetails) {
      return (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-gray-500">Select a session to monitor</p>
        </div>
      );
    }

    const { session, clients, round_metrics } = sessionDetails;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('sessions')} className="text-gray-500 hover:text-gray-700">
            ← Back
          </button>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">{session.session_name}</h2>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
            {session.status}
          </span>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Progress</div>
            <div className="text-2xl font-bold">{session.current_round}/{session.total_rounds}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Best Accuracy</div>
            <div className="text-2xl font-bold">{(session.best_accuracy * 100).toFixed(2)}%</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Clients</div>
            <div className="text-2xl font-bold">{clients?.length || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80">Best Round</div>
            <div className="text-2xl font-bold">#{session.best_round}</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Accuracy Over Rounds</h3>
            <div className="h-64 flex items-end gap-1">
              {round_metrics?.slice(-20).map((m: RoundMetric, i: number) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t"
                  style={{ height: `${m.avg_accuracy * 100}%` }}
                  title={`Round ${m.round}: ${(m.avg_accuracy * 100).toFixed(2)}%`}
                />
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Loss Over Rounds</h3>
            <div className="h-64 flex items-end gap-1">
              {round_metrics?.slice(-20).map((m: RoundMetric, i: number) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-red-500 to-red-400 rounded-t"
                  style={{ height: `${Math.min(m.avg_loss * 100, 100)}%` }}
                  title={`Round ${m.round}: ${m.avg_loss.toFixed(4)}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Connected Clients</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="pb-3">Client ID</th>
                  <th className="pb-3">Device</th>
                  <th className="pb-3">Samples</th>
                  <th className="pb-3">Rounds</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {clients?.map((client: any) => (
                  <tr key={client.client_id} className="border-b dark:border-gray-700">
                    <td className="py-3 font-mono text-xs">{client.client_id.slice(0, 20)}...</td>
                    <td className="py-3">{client.device_id}</td>
                    <td className="py-3">{client.data_samples}</td>
                    <td className="py-3">{client.rounds_participated}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${client.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Federated Learning</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Privacy-preserving distributed training with Flower</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'sessions', label: 'Sessions', icon: '📋' },
          { id: 'create', label: 'Create', icon: '➕' },
          { id: 'monitor', label: 'Monitor', icon: '📊' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'sessions' && renderSessions()}
      {activeTab === 'create' && renderCreateSession()}
      {activeTab === 'monitor' && renderMonitor()}
    </div>
  );
};

export default FederatedLearningDashboard;
