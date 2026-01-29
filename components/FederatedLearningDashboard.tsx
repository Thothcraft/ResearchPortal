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
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = '/api/proxy';

// Professional Line Chart Component
interface ChartDataPoint {
  x: number;
  y: number;
  label?: string;
}

const LineChart: React.FC<{
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  gradientId?: string;
  showGrid?: boolean;
  showDots?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
  formatY?: (v: number) => string;
  formatX?: (v: number) => string;
}> = ({
  data,
  width = 400,
  height = 200,
  color = '#22c55e',
  gradientId = 'chartGradient',
  showGrid = true,
  showDots = true,
  yAxisLabel,
  xAxisLabel,
  formatY = (v) => v.toFixed(2),
  formatX = (v) => v.toString(),
}) => {
  if (data.length === 0) return null;

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xMin = Math.min(...data.map(d => d.x));
  const xMax = Math.max(...data.map(d => d.x));
  const yMin = Math.min(...data.map(d => d.y), 0);
  const yMax = Math.max(...data.map(d => d.y)) * 1.1 || 1;

  const scaleX = (x: number) => padding.left + ((x - xMin) / (xMax - xMin || 1)) * chartWidth;
  const scaleY = (y: number) => padding.top + chartHeight - ((y - yMin) / (yMax - yMin || 1)) * chartHeight;

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.x)} ${scaleY(d.y)}`).join(' ');
  const areaD = `${pathD} L ${scaleX(data[data.length - 1].x)} ${scaleY(yMin)} L ${scaleX(data[0].x)} ${scaleY(yMin)} Z`;

  // Generate grid lines
  const yTicks = 5;
  const xTicks = Math.min(data.length, 6);

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {showGrid && (
        <g className="text-slate-700">
          {Array.from({ length: yTicks + 1 }).map((_, i) => {
            const y = padding.top + (chartHeight / yTicks) * i;
            const value = yMax - ((yMax - yMin) / yTicks) * i;
            return (
              <g key={`y-${i}`}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" strokeOpacity="0.2" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
                  {formatY(value)}
                </text>
              </g>
            );
          })}
          {Array.from({ length: xTicks }).map((_, i) => {
            const idx = Math.floor((data.length - 1) * (i / (xTicks - 1)));
            const x = scaleX(data[idx]?.x || 0);
            return (
              <g key={`x-${i}`}>
                <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="currentColor" strokeOpacity="0.1" />
                <text x={x} y={height - padding.bottom + 16} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {formatX(data[idx]?.x || 0)}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Area fill */}
      <path d={areaD} fill={`url(#${gradientId})`} />

      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {showDots && data.length <= 30 && data.map((d, i) => (
        <circle
          key={i}
          cx={scaleX(d.x)}
          cy={scaleY(d.y)}
          r="3"
          fill={color}
          className="hover:r-4 transition-all cursor-pointer"
        >
          <title>Round {d.x}: {formatY(d.y)}</title>
        </circle>
      ))}

      {/* Axis labels */}
      {yAxisLabel && (
        <text
          x={12}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90, 12, ${height / 2})`}
          className="fill-slate-400 text-[10px] font-medium"
        >
          {yAxisLabel}
        </text>
      )}
      {xAxisLabel && (
        <text x={width / 2} y={height - 4} textAnchor="middle" className="fill-slate-400 text-[10px] font-medium">
          {xAxisLabel}
        </text>
      )}
    </svg>
  );
};

// Professional Metric Card Component
const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  gradient: string;
  progress?: number;
}> = ({ icon, label, value, subValue, gradient, progress }) => (
  <div className={`${gradient} rounded-xl p-5 shadow-lg`}>
    <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
      {icon}
      <span className="font-medium">{label}</span>
    </div>
    <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
    {subValue && <div className="text-white/70 text-sm mt-1">{subValue}</div>}
    {progress !== undefined && (
      <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div 
          className="h-full bg-white/80 rounded-full transition-all duration-500" 
          style={{ width: `${Math.min(progress, 100)}%` }} 
        />
      </div>
    )}
  </div>
);

interface FLSession {
  session_id: string;
  session_name: string;
  algorithm: string;
  status: string;
  current_round: number;
  total_rounds: number;
  best_accuracy: number;
  best_round?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  // Configuration fields
  model?: string;
  dataset?: string;
  num_clients?: number;
  num_partitions?: number;
  local_epochs?: number;
  local_batch_size?: number;
  learning_rate?: number;
  partition_strategy?: string;
  proximal_mu?: number;
  server_learning_rate?: number;
  fraction_fit?: number;
  fraction_evaluate?: number;
  min_fit_clients?: number;
  min_evaluate_clients?: number;
}

interface RoundMetric {
  round: number;
  avg_accuracy: number;
  avg_loss: number;
  participating_clients: number;
  timestamp?: string;
  min_accuracy?: number;
  max_accuracy?: number;
  fairness_index?: number;
}

// Available FL algorithms (custom implementations, no Flower built-ins)
// References:
// - FedAvg: https://arxiv.org/abs/1602.05629
// - FedProx: https://arxiv.org/abs/1812.06127
// - FedAvgM: https://arxiv.org/abs/1909.06335
// - FedXgbBagging: https://flower.ai/docs/framework/tutorial-quickstart-xgboost.html
const ALGORITHMS = [
  { id: 'fedavg', name: 'FedAvg', description: 'Federated Averaging - weighted average of client updates', category: 'standard', color: 'bg-blue-500' },
  { id: 'fedprox', name: 'FedProx', description: 'FedAvg with proximal term for non-IID data', category: 'standard', color: 'bg-indigo-500' },
  { id: 'fedavgm', name: 'FedAvgM', description: 'FedAvg with server-side momentum', category: 'standard', color: 'bg-cyan-500' },
  { id: 'fedxgb_bagging', name: 'FedXgbBagging', description: 'Federated XGBoost with bagging aggregation', category: 'xgboost', color: 'bg-lime-500' },
];

// Dataset types for model filtering
type DatasetType = 'image_rgb' | 'image_gray' | 'tabular' | 'text' | 'time_series' | 'imu' | 'csi';

interface DatasetConfig {
  id: string;
  name: string;
  description: string;
  num_classes: number;
  samples: string;
  type: DatasetType;
  input_shape: string;
  isUserDataset?: boolean;
  dataset_id?: number;
}

// Built-in datasets
const BUILTIN_DATASETS: DatasetConfig[] = [
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
  // Image models
  { id: 'cnn', name: 'CNN', description: 'Convolutional Neural Network', compatible_types: ['image_rgb', 'image_gray'] },
  { id: 'resnet18', name: 'ResNet-18', description: 'Deep residual network', compatible_types: ['image_rgb', 'image_gray'] },
  // Time-series models
  { id: 'lstm', name: 'LSTM', description: 'Long Short-Term Memory', compatible_types: ['time_series', 'imu', 'csi'] },
  { id: 'gru', name: 'GRU', description: 'Gated Recurrent Unit', compatible_types: ['time_series', 'imu', 'csi'] },
  { id: 'cnn_lstm', name: 'CNN-LSTM', description: 'Hybrid CNN + LSTM', compatible_types: ['time_series', 'imu', 'csi'] },
  { id: 'tcn', name: 'TCN', description: 'Temporal Convolutional Network', compatible_types: ['time_series', 'imu', 'csi'] },
  // Universal models
  { id: 'mlp', name: 'MLP', description: 'Multi-layer perceptron', compatible_types: ['image_rgb', 'image_gray', 'tabular', 'time_series', 'imu', 'csi'] },
];

// Helper to get compatible models for a dataset from a datasets array
const getCompatibleModelsFromList = (datasetId: string, datasets: DatasetConfig[]): ModelConfig[] => {
  const dataset = datasets.find((d: DatasetConfig) => d.id === datasetId);
  if (!dataset) return MODEL_ARCHITECTURES;
  return MODEL_ARCHITECTURES.filter(m => m.compatible_types.includes(dataset.type));
};

// Algorithm-specific default parameters (only for supported algorithms)
const ALGORITHM_DEFAULTS: Record<string, Record<string, number>> = {
  fedprox: { proximal_mu: 0.01 },
  fedavgm: { server_learning_rate: 1.0, momentum: 0.9 },
};

type FLTab = 'sessions' | 'groups' | 'models' | 'compare';

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

// FL Job Group types
interface FLJobInGroup {
  id: string;
  algorithm: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  session_id?: string;
  metrics?: {
    accuracy?: number;
    loss?: number;
    current_round?: number;
    total_rounds?: number;
  };
}

interface FLJobGroup {
  id: string;
  name: string;
  execution_mode: 'parallel' | 'sequential';
  jobs: FLJobInGroup[];
  status: 'draft' | 'running' | 'completed' | 'paused';
  dataset: string;
  num_rounds: number;
  num_partitions: number;
  created_at: string;
}

const FederatedLearningDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FLTab>('sessions');
  const [view, setView] = useState<'list' | 'create' | 'monitor'>('list');
  const [sessions, setSessions] = useState<FLSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flUnavailable, setFlUnavailable] = useState(false);
  const [creating, setCreating] = useState(false);
  const [trainedModels, setTrainedModels] = useState<FLTrainedModel[]>([]);
  const [selectedModelsForCompare, setSelectedModelsForCompare] = useState<string[]>([]);
  const [userDatasets, setUserDatasets] = useState<DatasetConfig[]>([]);
  const [loadingUserDatasets, setLoadingUserDatasets] = useState(false);
  
  // Debug and connection state
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [lastApiCall, setLastApiCall] = useState<{ endpoint: string; status: number; time: string; error?: string } | null>(null);
  const [apiLogs, setApiLogs] = useState<Array<{ endpoint: string; status: number; time: string; error?: string }>>([])
  
  // FL Job Groups state
  const [flJobGroups, setFlJobGroups] = useState<FLJobGroup[]>([]);
  const [showCreateFLGroup, setShowCreateFLGroup] = useState(false);
  const [expandedFLGroups, setExpandedFLGroups] = useState<Set<string>>(new Set());

  // Combined datasets (built-in + user)
  const allDatasets = [...BUILTIN_DATASETS, ...userDatasets];

  // Load user datasets from API
  const loadUserDatasets = async () => {
    if (!user?.token) return;
    setLoadingUserDatasets(true);
    try {
      const res = await fetch(`${API_BASE_URL}/datasets/list`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        const datasets = data.datasets || [];
        // Convert to DatasetConfig format
        const userDs: DatasetConfig[] = datasets.map((ds: any) => ({
          id: `user_${ds.id}`,
          name: ds.name,
          description: ds.description || 'User dataset',
          num_classes: ds.label_counts ? Object.keys(ds.label_counts).length : 2,
          samples: ds.file_count ? `${ds.file_count} files` : 'N/A',
          type: 'time_series' as DatasetType, // Default to time_series for user data
          input_shape: 'variable',
          isUserDataset: true,
          dataset_id: ds.id,
        }));
        setUserDatasets(userDs);
      }
    } catch (err) {
      console.error('Failed to load user datasets:', err);
    } finally {
      setLoadingUserDatasets(false);
    }
  };

  const [form, setForm] = useState({
    session_name: '',
    algorithms: ['fedavg'] as string[], // Multi-select: creates one job per algorithm
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
    momentum: 0.9,
    // Advanced server params
    min_fit_clients: 2,
    min_evaluate_clients: 2,
    fraction_evaluate: 0.5,
    accept_failures: true,
    // Advanced client params
    weight_decay: 0.0001,
    optimizer: 'sgd',
    // Dirichlet alpha for non-IID
    dirichlet_alpha: 0.5,
  });

  // Update model architecture when dataset changes (ensure compatibility)
  useEffect(() => {
    const compatibleModels = getCompatibleModelsFromList(form.dataset, allDatasets);
    if (!compatibleModels.find((m: ModelConfig) => m.id === form.model_architecture)) {
      // Current model not compatible, switch to first compatible one
      setForm(prev => ({ ...prev, model_architecture: compatibleModels[0]?.id || 'mlp' }));
    }
  }, [form.dataset, allDatasets]);

  // Update algorithm-specific params when algorithms change
  useEffect(() => {
    // Apply defaults for the first selected algorithm
    if (form.algorithms.length > 0) {
      const defaults = ALGORITHM_DEFAULTS[form.algorithms[0]];
      if (defaults) {
        setForm(prev => ({ ...prev, ...defaults }));
      }
    }
  }, [form.algorithms]);

  // Toggle algorithm selection (checkbox behavior)
  const toggleAlgorithm = (algoId: string) => {
    setForm(prev => {
      const current = prev.algorithms;
      if (current.includes(algoId)) {
        // Don't allow deselecting if it's the only one
        if (current.length === 1) return prev;
        return { ...prev, algorithms: current.filter(a => a !== algoId) };
      } else {
        return { ...prev, algorithms: [...current, algoId] };
      }
    });
  };

  useEffect(() => {
    if (!flUnavailable) {
      loadSessions();
    }
    loadTrainedModels();
  }, [flUnavailable]);

  // Load user datasets when user token is available
  useEffect(() => {
    if (user?.token) {
      loadUserDatasets();
    }
  }, [user?.token]);

  useEffect(() => {
    if (selectedSession && view === 'monitor') {
      loadSessionDetails(selectedSession);
      const interval = setInterval(() => loadSessionDetails(selectedSession), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedSession, view]);

  // Real-time polling for sessions list
  // Use faster polling (3s) when there are running sessions, slower (10s) otherwise
  useEffect(() => {
    if (activeTab === 'sessions' && view === 'list' && !flUnavailable) {
      const hasRunningSessions = sessions.some(s => s.status === 'running');
      const pollInterval = hasRunningSessions ? 3000 : 10000;
      
      const interval = setInterval(() => {
        loadSessions();
      }, pollInterval);
      return () => clearInterval(interval);
    }
  }, [activeTab, view, flUnavailable, sessions]);

  // Log API call for debugging
  const logApiCall = (endpoint: string, status: number, error?: string) => {
    const logEntry = { endpoint, status, time: new Date().toLocaleTimeString(), error };
    setLastApiCall(logEntry);
    setApiLogs(prev => [logEntry, ...prev.slice(0, 49)]); // Keep last 50 logs
  };

  const loadSessions = async () => {
    setLoading(true);
    setConnectionStatus('checking');
    const startTime = Date.now();
    try {
      const res = await fetch(`${API_BASE_URL}/fl/sessions`, {
        headers: user?.token
          ? {
              Authorization: `Bearer ${user.token}`,
              'Content-Type': 'application/json',
            }
          : undefined,
      });
      
      const duration = Date.now() - startTime;
      logApiCall(`GET /fl/sessions (${duration}ms)`, res.status);
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        console.error(`[FL] Failed to load sessions: ${res.status} ${errorText}`);
        setError(`Failed to load sessions: ${res.status} - ${errorText}`);
        setSessions([]);
        setConnectionStatus('disconnected');
        if (res.status === 404 || res.status >= 500 || res.status === 503) {
          setFlUnavailable(true);
        }
        logApiCall(`GET /fl/sessions`, res.status, errorText);
        return;
      }
      
      setConnectionStatus('connected');
      let data: any = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error('[FL] Failed to parse sessions response:', parseErr);
        setError('Failed to load sessions: invalid JSON response from server');
        setSessions([]);
        logApiCall(`GET /fl/sessions`, res.status, 'JSON parse error');
        return;
      }
      const sessionsList = data.sessions || [];
      console.log(`[FL] Loaded ${sessionsList.length} sessions in ${duration}ms`);
      setSessions(sessionsList);
      setError(null);
      setFlUnavailable(false);
      
      // Extract trained models from completed sessions
      const completedSessions = sessionsList.filter((s: FLSession) => s.status === 'completed');
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
    } catch (err: any) {
      console.error('[FL] Failed to load sessions:', err);
      setConnectionStatus('disconnected');
      const errorMsg = err.message?.includes('fetch failed') 
        ? 'Cannot connect to backend server. Is it running?'
        : err.message || 'Failed to connect to server';
      setError(errorMsg);
      logApiCall(`GET /fl/sessions`, 0, errorMsg);
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
      const res = await fetch(`${API_BASE_URL}/fl/sessions/${sessionId}`, {
        headers: user?.token
          ? {
              Authorization: `Bearer ${user.token}`,
              'Content-Type': 'application/json',
            }
          : undefined,
      });

      if (!res.ok) {
        console.error(`Failed to load session details: ${res.status} ${res.statusText}`);
        setError(`Failed to load session details: ${res.status}`);
        setSessionDetails(null);
        if (res.status === 404 || res.status >= 500) {
          setFlUnavailable(true);
        }
        return;
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error('Failed to parse session details response:', parseErr);
        setError('Failed to load session details: invalid response');
        setSessionDetails(null);
        return;
      }

      setSessionDetails(data);
      setFlUnavailable(false);
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
    console.log('[FL] Creating session with config:', form);
    try {
      // Check if using a user dataset
      const isUserDataset = form.dataset.startsWith('user_');
      const userDatasetId = isUserDataset ? parseInt(form.dataset.replace('user_', '')) : null;
      const selectedDataset = allDatasets.find((d: DatasetConfig) => d.id === form.dataset);
      
      // Use multi-algorithm endpoint if multiple algorithms selected
      const useMultiEndpoint = form.algorithms.length > 1;
      
      const basePayload = {
        model_architecture: form.model_architecture,
        server: {
          num_rounds: form.num_rounds,
          fraction_fit: form.fraction_fit,
          fraction_evaluate: form.fraction_evaluate,
          min_fit_clients: form.min_fit_clients,
          min_evaluate_clients: form.min_evaluate_clients,
          min_available_clients: Math.max(form.min_fit_clients, form.min_evaluate_clients),
          accept_failures: form.accept_failures,
        },
        client: {
          local_epochs: form.local_epochs,
          local_batch_size: form.local_batch_size,
          learning_rate: form.learning_rate,
          weight_decay: form.weight_decay,
          optimizer: form.optimizer,
        },
        data: {
          dataset: isUserDataset ? 'custom' : form.dataset,
          dataset_id: userDatasetId,
          data_type: selectedDataset?.type || 'time_series',
          num_partitions: form.num_partitions,
          partition_strategy: form.partition_strategy,
          dirichlet_alpha: form.dirichlet_alpha,
        },
        algorithm_params: {
          proximal_mu: form.proximal_mu,
          server_learning_rate: form.server_learning_rate,
          server_momentum: form.momentum,
        },
      };

      let res;
      if (useMultiEndpoint) {
        // Multi-algorithm: creates one session per algorithm
        const multiPayload = {
          session_name_prefix: form.session_name,
          algorithms: form.algorithms,
          ...basePayload,
        };
        res = await fetch(`${API_BASE_URL}/fl/sessions/multi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(multiPayload),
        });
      } else {
        // Single algorithm
        const singlePayload = {
          session_name: form.session_name,
          algorithm: form.algorithms[0],
          ...basePayload,
        };
        res = await fetch(`${API_BASE_URL}/fl/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(singlePayload),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to create session');
      }

      const data = await res.json();
      
      if (useMultiEndpoint) {
        // Multi-algorithm: start all created sessions
        const sessions = data.data?.sessions || [];
        console.log(`[FL] Created ${sessions.length} sessions for algorithms: ${form.algorithms.join(', ')}`);
        for (const sess of sessions) {
          const startRes = await fetch(`${API_BASE_URL}/fl/sessions/${sess.session_id}/start`, {
            method: 'POST',
          });
          if (!startRes.ok) {
            console.error(`[FL] Failed to start session ${sess.session_id}: ${startRes.status}`);
          } else {
            console.log(`[FL] Session ${sess.session_id} (${sess.algorithm}) started`);
          }
        }
      } else {
        // Single algorithm
        const sessionId = data.data?.session_id;
        console.log(`[FL] Session created: ${sessionId}`);
        if (sessionId) {
          const startRes = await fetch(`${API_BASE_URL}/fl/sessions/${sessionId}/start`, {
            method: 'POST',
          });
          if (!startRes.ok) {
            console.error(`[FL] Failed to start session ${sessionId}: ${startRes.status}`);
          } else {
            console.log(`[FL] Session ${sessionId} started`);
          }
        }
      }

      await loadSessions();
      setForm({ ...form, session_name: '' });
      setView('list');
    } catch (err: any) {
      console.error('[FL] Create session error:', err);
      const errorMsg = err.message?.includes('fetch failed')
        ? 'Cannot connect to backend server. Please ensure the Python server is running.'
        : err.message || 'Failed to create session';
      setError(errorMsg);
      logApiCall('POST /fl/sessions', 0, errorMsg);
    } finally {
      setCreating(false);
    }
  };

  const startSession = async (sessionId: string) => {
    try {
      console.log(`[FL] Starting session ${sessionId}`);
      const res = await fetch(`${API_BASE_URL}/fl/sessions/${sessionId}/start`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error(`[FL] Failed to start session: ${res.status}`, errData);
        setError(`Failed to start session: ${errData.detail || res.statusText}`);
        return;
      }
      console.log(`[FL] Session ${sessionId} started successfully`);
      await loadSessions();
    } catch (err) {
      console.error('Failed to start session:', err);
      setError('Failed to start session');
    }
  };

  const stopSession = async (sessionId: string) => {
    try {
      await fetch(`${API_BASE_URL}/fl/sessions/${sessionId}/stop`, {
        method: 'POST',
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
      {/* Connection Status Banner */}
      {connectionStatus === 'disconnected' && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-red-400 font-medium">Backend Connection Failed</p>
              <p className="text-red-300/70 text-sm">Cannot connect to the FL server. Please ensure the Python backend is running.</p>
            </div>
          </div>
          <button
            onClick={() => { setFlUnavailable(false); loadSessions(); }}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-purple-400" />
            FL Sessions
            {/* Connection Status Indicator */}
            <span className={`ml-2 w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'checking' ? 'bg-yellow-400 animate-pulse' :
              'bg-red-400'
            }`} title={`Status: ${connectionStatus}`} />
          </h2>
          <p className="text-sm text-slate-400 mt-1">Manage your federated learning experiments</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className={`p-2 rounded-lg transition-colors ${showDebugPanel ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
            title="Toggle Debug Panel"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={loadSessions}
            disabled={loading}
            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
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

      {/* Debug Panel */}
      {showDebugPanel && (
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Debug Panel
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-1 rounded ${
                connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' :
                connectionStatus === 'checking' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {connectionStatus.toUpperCase()}
              </span>
              <span className="text-slate-500">Backend: {API_BASE_URL}</span>
            </div>
          </div>
          
          {/* API Logs */}
          <div className="bg-slate-800 rounded-lg p-3 max-h-32 overflow-y-auto font-mono text-xs space-y-1">
            {apiLogs.length === 0 ? (
              <p className="text-slate-500">No API calls logged yet</p>
            ) : (
              apiLogs.slice(0, 10).map((log, i) => (
                <div key={i} className={`flex items-center gap-2 ${log.error ? 'text-red-400' : log.status >= 200 && log.status < 300 ? 'text-green-400' : 'text-yellow-400'}`}>
                  <span className="text-slate-500">[{log.time}]</span>
                  <span className={`px-1 rounded ${log.status >= 200 && log.status < 300 ? 'bg-green-500/20' : log.status === 0 ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                    {log.status || 'ERR'}
                  </span>
                  <span>{log.endpoint}</span>
                  {log.error && <span className="text-red-300">- {log.error.slice(0, 50)}</span>}
                </div>
              ))
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setApiLogs([])}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs"
            >
              Clear Logs
            </button>
            <button
              onClick={() => { setFlUnavailable(false); setError(null); loadSessions(); }}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs"
            >
              Reset & Retry
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && !showDebugPanel && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && sessions.length === 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
          <Loader2 className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-white mb-2">Loading Sessions...</h3>
          <p className="text-slate-400">Connecting to FL server</p>
        </div>
      )}

      {/* Sessions Grid */}
      {!loading && sessions.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
          {connectionStatus === 'disconnected' ? (
            <>
              <XCircle className="w-16 h-16 text-red-400/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Cannot Connect to FL Server</h3>
              <p className="text-slate-400 mb-4">
                The backend server is not responding. Please ensure the Python server is running on port 8000.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => { setFlUnavailable(false); loadSessions(); }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Connection
                </button>
                <button
                  onClick={() => setShowDebugPanel(true)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  View Debug Info
                </button>
              </div>
            </>
          ) : (
            <>
              <Network className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No FL Sessions</h3>
              <p className="text-slate-400 mb-4">Create your first federated learning experiment</p>
              <button
                onClick={() => setView('create')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Create Session
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const isExpanded = expandedSessions.has(session.session_id);
            const toggleExpand = () => {
              setExpandedSessions(prev => {
                const next = new Set(prev);
                if (next.has(session.session_id)) {
                  next.delete(session.session_id);
                } else {
                  next.add(session.session_id);
                }
                return next;
              });
            };
            
            return (
              <div
                key={session.session_id}
                className={`bg-slate-800/50 rounded-xl border transition-all ${
                  session.status === 'running' 
                    ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' 
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                {/* Main Card Content */}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <button
                          onClick={toggleExpand}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                        >
                          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
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
                        {session.status === 'running' && (
                          <span className="text-xs text-blue-400 animate-pulse">● Live</span>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-6 text-sm">
                        <div>
                          <span className="text-slate-500">Progress</span>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  session.status === 'running' ? 'bg-blue-500' : 'bg-purple-500'
                                }`}
                                style={{ width: `${session.total_rounds > 0 ? (session.current_round / session.total_rounds) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-white font-medium min-w-[50px] text-right">
                              {session.current_round}/{session.total_rounds}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500">Best Accuracy</span>
                          <p className={`font-medium mt-1 ${session.best_accuracy > 0 ? 'text-green-400' : 'text-white'}`}>
                            {session.best_accuracy > 0 ? `${(session.best_accuracy * 100).toFixed(2)}%` : '-'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Model</span>
                          <p className="text-white font-medium mt-1">
                            {session.model?.toUpperCase() || 'CNN'}
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

                {/* Expanded Configuration Details */}
                {isExpanded && (
                  <div className="border-t border-slate-700 p-5 bg-slate-900/50">
                    <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-purple-400" />
                      Session Configuration
                    </h4>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Algorithm</span>
                        <p className="text-white font-medium">{session.algorithm.toUpperCase()}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Dataset</span>
                        <p className="text-white font-medium">{session.dataset?.toUpperCase() || 'CIFAR-10'}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Model</span>
                        <p className="text-white font-medium">{session.model?.toUpperCase() || 'CNN'}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Total Rounds</span>
                        <p className="text-white font-medium">{session.total_rounds}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Clients</span>
                        <p className="text-white font-medium">{session.num_clients || session.num_partitions || 5}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Local Epochs</span>
                        <p className="text-white font-medium">{session.local_epochs || 2}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Batch Size</span>
                        <p className="text-white font-medium">{session.local_batch_size || 32}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Learning Rate</span>
                        <p className="text-white font-medium">{session.learning_rate || 0.01}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Partition Strategy</span>
                        <p className="text-white font-medium">{session.partition_strategy?.toUpperCase() || 'IID'}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Fraction Fit</span>
                        <p className="text-white font-medium">{session.fraction_fit || 1.0}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <span className="text-slate-500 text-xs">Created</span>
                        <p className="text-white font-medium text-xs">{new Date(session.created_at).toLocaleString()}</p>
                      </div>
                      {session.started_at && (
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <span className="text-slate-500 text-xs">Started</span>
                          <p className="text-white font-medium text-xs">{new Date(session.started_at).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Additional algorithm-specific params */}
                    {session.algorithm === 'fedprox' && session.proximal_mu && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <h5 className="text-xs font-medium text-slate-400 mb-2">FedProx Parameters</h5>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <span className="text-slate-500 text-xs">Proximal μ</span>
                            <p className="text-white font-medium">{session.proximal_mu}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Algorithms <span className="text-xs text-slate-400">(select multiple to create one job per algorithm)</span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-700 border border-slate-600 rounded-lg">
                {ALGORITHMS.map(a => (
                  <label
                    key={a.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                      form.algorithms.includes(a.id)
                        ? 'bg-purple-600/30 border border-purple-500'
                        : 'hover:bg-slate-600 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.algorithms.includes(a.id)}
                      onChange={() => toggleAlgorithm(a.id)}
                      className="w-4 h-4 rounded border-slate-500 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 bg-slate-600"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium ${a.color.replace('bg-', 'text-').replace('-500', '-400')}`}>
                        {a.name}
                      </span>
                      <p className="text-xs text-slate-400 truncate">{a.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              {form.algorithms.length > 1 && (
                <p className="mt-1 text-xs text-purple-400">
                  {form.algorithms.length} algorithms selected → {form.algorithms.length} training jobs will be created
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Dataset</label>
              <select
                value={form.dataset}
                onChange={(e) => setForm({ ...form, dataset: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                <optgroup label="RGB Images (32×32×3)">
                  {BUILTIN_DATASETS.filter((ds: DatasetConfig) => ds.type === 'image_rgb').map((ds: DatasetConfig) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.num_classes} classes, {ds.samples})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Grayscale Images (28×28×1)">
                  {BUILTIN_DATASETS.filter((ds: DatasetConfig) => ds.type === 'image_gray').map((ds: DatasetConfig) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.num_classes} classes, {ds.samples})
                    </option>
                  ))}
                </optgroup>
                {userDatasets.length > 0 && (
                  <optgroup label="📁 Your Datasets (IMU/CSI/Sensor)">
                    {userDatasets.map((ds: DatasetConfig) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name} ({ds.num_classes} classes, {ds.samples})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Input: {allDatasets.find((d: DatasetConfig) => d.id === form.dataset)?.input_shape || 'variable'}
                {form.dataset.startsWith('user_') && (
                  <span className="ml-2 text-green-400">✓ Custom dataset</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Model Architecture
                <span className="text-xs text-slate-500 ml-2">
                  ({getCompatibleModelsFromList(form.dataset, allDatasets).length} compatible)
                </span>
              </label>
              <select
                value={form.model_architecture}
                onChange={(e) => setForm({ ...form, model_architecture: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                {getCompatibleModelsFromList(form.dataset, allDatasets).map((model: ModelConfig) => (
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
            ({form.algorithms.map(a => ALGORITHMS.find(al => al.id === a)?.name || a).join(', ')})
          </span>
        </h3>

        <div className="grid grid-cols-3 gap-4">
          {/* FedProx: mu parameter */}
          {form.algorithms.includes('fedprox') && (
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

          {/* FedAvgM: server learning rate and momentum */}
          {form.algorithms.includes('fedavgm') && (
            <>
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
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Server Momentum
                  <span className="text-xs text-slate-500 ml-1">β</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.momentum}
                  onChange={(e) => setForm({ ...form, momentum: parseFloat(e.target.value) || 0.9 })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  min={0}
                  max={0.99}
                />
                <p className="text-xs text-slate-500 mt-1">Momentum coefficient (0.9 recommended)</p>
              </div>
            </>
          )}

          {/* Default message for algorithms without special params */}
          {!form.algorithms.some(a => ['fedprox', 'fedavgm'].includes(a)) && (
            <div className="col-span-3 text-center py-4 text-slate-500">
              <p>No additional parameters needed for selected algorithms</p>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          Advanced Settings
        </h3>

        <div className="grid grid-cols-2 gap-6">
          {/* Server Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2">Server Configuration</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Min Fit Clients</label>
                <input
                  type="number"
                  value={form.min_fit_clients}
                  onChange={(e) => setForm({ ...form, min_fit_clients: parseInt(e.target.value) || 2 })}
                  className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Min Evaluate Clients</label>
                <input
                  type="number"
                  value={form.min_evaluate_clients}
                  onChange={(e) => setForm({ ...form, min_evaluate_clients: parseInt(e.target.value) || 2 })}
                  className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                  min={1}
                  max={100}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Fraction Evaluate</label>
              <input
                type="number"
                step="0.1"
                value={form.fraction_evaluate}
                onChange={(e) => setForm({ ...form, fraction_evaluate: parseFloat(e.target.value) || 0.5 })}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                min={0}
                max={1}
              />
              <p className="text-xs text-slate-500 mt-1">Fraction of clients for evaluation</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="accept_failures"
                checked={form.accept_failures}
                onChange={(e) => setForm({ ...form, accept_failures: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600"
              />
              <label htmlFor="accept_failures" className="text-sm text-slate-300">Accept client failures</label>
            </div>
          </div>

          {/* Client Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2">Client Configuration</h4>
            
            <div>
              <label className="block text-xs text-slate-400 mb-1">Optimizer</label>
              <select
                value={form.optimizer}
                onChange={(e) => setForm({ ...form, optimizer: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
              >
                <option value="sgd">SGD</option>
                <option value="adam">Adam</option>
                <option value="adamw">AdamW</option>
                <option value="rmsprop">RMSprop</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Weight Decay (L2)</label>
              <input
                type="number"
                step="0.0001"
                value={form.weight_decay}
                onChange={(e) => setForm({ ...form, weight_decay: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                min={0}
                max={0.1}
              />
            </div>

            {form.partition_strategy === 'non_iid_dirichlet' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Dirichlet Alpha (α)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.dirichlet_alpha}
                  onChange={(e) => setForm({ ...form, dirichlet_alpha: parseFloat(e.target.value) || 0.5 })}
                  className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                  min={0.01}
                  max={100}
                />
                <p className="text-xs text-slate-500 mt-1">Lower = more heterogeneous</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="differential_privacy"
                checked={form.differential_privacy}
                onChange={(e) => setForm({ ...form, differential_privacy: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600"
              />
              <label htmlFor="differential_privacy" className="text-sm text-slate-300">Enable Differential Privacy</label>
            </div>

            {form.differential_privacy && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Privacy Delta (δ)</label>
                <input
                  type="number"
                  step="0.00001"
                  value={form.delta}
                  onChange={(e) => setForm({ ...form, delta: parseFloat(e.target.value) || 1e-5 })}
                  className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Model Architecture Preview */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          Model Architecture
          <span className="text-xs text-slate-400 font-normal ml-2">
            (for {BUILTIN_DATASETS.find((d: DatasetConfig) => d.id === form.dataset)?.input_shape} input)
          </span>
        </h3>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
          {(() => {
            const dataset = BUILTIN_DATASETS.find((d: DatasetConfig) => d.id === form.dataset);
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

    const session: FLSession | undefined = sessionDetails?.session;
    const round_metrics: RoundMetric[] = Array.isArray(sessionDetails?.round_metrics)
      ? sessionDetails.round_metrics
      : [];
    const clients: any[] = Array.isArray(sessionDetails?.clients) ? sessionDetails.clients : [];

    if (!session) {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
            <span className="text-red-400">Failed to load session details</span>
            <button onClick={() => setView('list')} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    const totalRounds = Number(session.total_rounds) || 0;
    const currentRound = Number(session.current_round) || 0;
    const progress = totalRounds > 0 ? (currentRound / totalRounds) * 100 : 0;

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

        {/* Professional Charts */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Accuracy Over Rounds
              {round_metrics.length > 0 && (
                <span className="ml-auto text-sm font-normal text-green-400">
                  Latest: {((round_metrics[round_metrics.length - 1]?.avg_accuracy || 0) * 100).toFixed(2)}%
                </span>
              )}
            </h3>
            <div className="h-52">
              {round_metrics.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-purple-400" />
                    <p>Waiting for training data...</p>
                  </div>
                </div>
              ) : (
                <LineChart
                  data={round_metrics.map((m: RoundMetric) => ({ x: m.round, y: m.avg_accuracy * 100 }))}
                  width={380}
                  height={200}
                  color="#22c55e"
                  gradientId="accuracyGradient"
                  yAxisLabel="Accuracy (%)"
                  xAxisLabel="Round"
                  formatY={(v) => `${v.toFixed(1)}%`}
                  formatX={(v) => `R${v}`}
                />
              )}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-red-400" />
              Loss Over Rounds
              {round_metrics.length > 0 && (
                <span className="ml-auto text-sm font-normal text-red-400">
                  Latest: {(round_metrics[round_metrics.length - 1]?.avg_loss || 0).toFixed(4)}
                </span>
              )}
            </h3>
            <div className="h-52">
              {round_metrics.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-purple-400" />
                    <p>Waiting for training data...</p>
                  </div>
                </div>
              ) : (
                <LineChart
                  data={round_metrics.map((m: RoundMetric) => ({ x: m.round, y: m.avg_loss }))}
                  width={380}
                  height={200}
                  color="#ef4444"
                  gradientId="lossGradient"
                  yAxisLabel="Loss"
                  xAxisLabel="Round"
                  formatY={(v) => v.toFixed(3)}
                  formatX={(v) => `R${v}`}
                />
              )}
            </div>
          </div>
        </div>

        {/* Training Activity Log */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            Training Activity Log
          </h3>
          <div className="bg-slate-900 rounded-lg p-4 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
            {round_metrics.length === 0 ? (
              <div className="text-slate-500">
                {session.status === 'running' ? (
                  <>
                    <div className="text-green-400">[{new Date().toLocaleTimeString()}] Session started</div>
                    <div className="text-blue-400">[{new Date().toLocaleTimeString()}] Initializing {session.algorithm.toUpperCase()} strategy...</div>
                    <div className="text-yellow-400">[{new Date().toLocaleTimeString()}] Loading dataset partitions...</div>
                    <div className="animate-pulse text-purple-400">[{new Date().toLocaleTimeString()}] Waiting for first round to complete...</div>
                  </>
                ) : (
                  <div className="text-slate-500">No training activity yet</div>
                )}
              </div>
            ) : (
              <>
                <div className="text-green-400">[{session.started_at ? new Date(session.started_at).toLocaleTimeString() : '-'}] Training started with {session.algorithm.toUpperCase()}</div>
                {round_metrics.slice(-10).map((m: RoundMetric, i: number) => (
                  <div key={i} className={m.avg_accuracy > session.best_accuracy * 0.99 ? 'text-green-400' : 'text-slate-300'}>
                    [{m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '--:--:--'}] Round {m.round}: acc={((m.avg_accuracy || 0) * 100).toFixed(2)}%, loss={m.avg_loss?.toFixed(4) || 'N/A'}, clients={m.participating_clients}
                    {m.avg_accuracy === session.best_accuracy && ' ⭐ Best'}
                  </div>
                ))}
                {session.status === 'running' && (
                  <div className="animate-pulse text-purple-400">[{new Date().toLocaleTimeString()}] Round {session.current_round + 1} in progress...</div>
                )}
                {session.status === 'completed' && (
                  <div className="text-green-400">[{session.completed_at ? new Date(session.completed_at).toLocaleTimeString() : '-'}] ✓ Training completed! Best accuracy: {(session.best_accuracy * 100).toFixed(2)}%</div>
                )}
              </>
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
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'groups' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          Algorithm Groups
          {flJobGroups.length > 0 && (
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
              {flJobGroups.length}
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
      
      {/* FL Algorithm Groups Tab */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                FL Algorithm Groups
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Compare multiple FL algorithms on the same dataset in parallel or sequentially
              </p>
            </div>
            <button
              onClick={() => setShowCreateFLGroup(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Algorithm Group
            </button>
          </div>

          {/* Groups List */}
          {flJobGroups.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
              <Layers className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No FL Algorithm Groups</h3>
              <p className="text-slate-400 mb-4">
                Create a group to train and compare multiple FL algorithms
              </p>
              <button
                onClick={() => setShowCreateFLGroup(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create Algorithm Group
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {flJobGroups.map(group => {
                const completedJobs = group.jobs.filter(j => j.status === 'completed').length;
                const progress = group.jobs.length > 0 ? (completedJobs / group.jobs.length) * 100 : 0;
                const isExpanded = expandedFLGroups.has(group.id);

                return (
                  <div key={group.id} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                    {/* Group Header */}
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/30"
                      onClick={() => {
                        setExpandedFLGroups(prev => {
                          const next = new Set(prev);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <div className="p-2 rounded-lg bg-purple-500/20">
                          <Layers className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-medium">{group.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>{group.jobs.length} algorithms</span>
                            <span>•</span>
                            <span>{group.execution_mode === 'parallel' ? 'Parallel' : 'Sequential'}</span>
                            <span>•</span>
                            <span>{group.num_rounds} rounds</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{completedJobs}/{group.jobs.length}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          group.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                          group.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {group.status}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-700 p-4 space-y-3">
                        {group.jobs.map((job, idx) => {
                          const algo = ALGORITHMS.find(a => a.id === job.algorithm);
                          return (
                            <div key={job.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500 w-6">#{idx + 1}</span>
                                {job.status === 'running' ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> :
                                 job.status === 'completed' ? <CheckCircle className="w-4 h-4 text-green-400" /> :
                                 job.status === 'failed' ? <XCircle className="w-4 h-4 text-red-400" /> :
                                 <Clock className="w-4 h-4 text-slate-400" />}
                                <span className="text-white font-medium">{algo?.name || job.algorithm}</span>
                                <span className="text-xs text-slate-500">{algo?.category}</span>
                              </div>
                              {job.metrics?.accuracy !== undefined && (
                                <span className="text-sm text-green-400">
                                  {(job.metrics.accuracy * 100).toFixed(1)}% acc
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'models' && renderModelsTab()}
      {activeTab === 'compare' && renderCompareTab()}

      {/* Create FL Group Modal */}
      {showCreateFLGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateFLGroup(false)}>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Layers className="w-6 h-6 text-purple-400" />
                Create FL Algorithm Group
              </h2>
              <button onClick={() => setShowCreateFLGroup(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Group Name</label>
                <input
                  type="text"
                  placeholder="My FL Algorithm Comparison"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select Algorithms to Compare</label>
                <p className="text-xs text-slate-500 mb-3">Choose multiple FL algorithms to train on the same dataset</p>
                
                {Object.entries(
                  ALGORITHMS.reduce((acc, algo) => {
                    if (!acc[algo.category]) acc[algo.category] = [];
                    acc[algo.category].push(algo);
                    return acc;
                  }, {} as Record<string, typeof ALGORITHMS>)
                ).map(([category, algos]) => (
                  <div key={category} className="mb-4">
                    <h4 className="text-sm font-medium text-slate-400 mb-2">{category}</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {algos.map(algo => (
                        <button
                          key={algo.id}
                          className="p-3 rounded-lg border bg-slate-700/50 border-slate-600 hover:border-purple-500/40 text-left"
                        >
                          <span className="text-white font-medium text-sm">{algo.name}</span>
                          <p className="text-xs text-slate-400 mt-1">{algo.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Execution Mode</label>
                  <select className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
                    <option value="sequential">Sequential (Queue)</option>
                    <option value="parallel">Parallel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Rounds</label>
                  <input type="number" defaultValue={10} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => setShowCreateFLGroup(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateFLGroup(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FederatedLearningDashboard;
