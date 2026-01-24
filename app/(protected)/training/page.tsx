'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { subscribeToTrainingJobs, parseRealtimeJob, isRealtimeConfigured, RealtimeTrainingJob } from '@/lib/supabase';
import {
  Brain, Cloud, Smartphone, Network, Play, RefreshCw, Plus, Tag, Database,
  FileText, Trash2, ChevronRight, ChevronDown, BarChart3, CheckCircle, Clock, AlertCircle,
  Download, Rocket, Loader2, X, XCircle, Edit2, TrendingUp, Layers, GitCompare,
  ListOrdered, Shuffle,
} from 'lucide-react';
import FigureExport from '@/components/FigureExport';
import PlotCustomizer from '@/components/PlotCustomizer';
import FederatedLearningDashboard from '@/components/FederatedLearningDashboard';
import { 
  TrainingJobGroup, 
  TrainingJobInGroup, 
  TrainingJobGroupCard, 
  CreateJobGroupModal,
  CENTRAL_MODELS,
  FL_ALGORITHMS,
} from '@/components/TrainingJobGroup';
import JobGroupComparisonPlots from '@/components/JobGroupComparisonPlots';

const PREPROCESSING_STEP_HELP: Record<string, { title: string; details: string }> = {
  csi_loader: {
    title: 'CSI Loader',
    details:
      'Reads CSI rows from the CSV and extracts the bracketed I/Q list from each line.\n' +
      'It also cleans malformed/ragged rows so downstream steps don\'t receive NaNs.\n' +
      'Output: numeric matrix shaped like [num_rows, 2*num_subcarriers].',
  },
  amplitude_extractor: {
    title: 'Amplitude Extractor',
    details:
      'Converts each complex subcarrier value (I, Q) into amplitude: sqrt(I^2 + Q^2).\n' +
      'Amplitude is typically more stable than raw I/Q and often works well for classification.',
  },
  phase_extractor: {
    title: 'Phase Extractor',
    details:
      'Converts each complex subcarrier value (I, Q) into phase: atan2(I, Q).\n' +
      'Phase can capture motion-induced changes but can be noisy; combining amplitude+phase increases feature count.',
  },
  subcarrier_filter: {
    title: 'Subcarrier Filter',
    details:
      'Removes guard-band / low-quality subcarriers by selecting two useful ranges and concatenating them.\n' +
      'This reduces noise and dimensionality while keeping the informative spectrum region.',
  },
  feature_concat: {
    title: 'Feature Combine',
    details:
      'Concatenates feature channels into a single per-row feature vector.\n' +
      'If Include Phase = ON, output is [amplitude | phase]. If OFF, output is amplitude only.',
  },
  data_portion_selector: {
    title: 'Windowing / Flattening',
    details:
      'Groups the time series into non-overlapping windows of Window Size rows.\n' +
      'If Output Shape = flattened, each window becomes one long feature vector (best for KNN/SVC/AdaBoost).\n' +
      'If Output Shape = sequence, each window stays [window_size, features] (best for DL sequence models).',
  },
  imu_loader: {
    title: 'IMU Loader',
    details:
      'Parses IMU JSON/JSONL/CSV into time-series windows.\n' +
      'Output: windows shaped like [window_size, 6] (accel+gyro).',
  },
};

type TrainingMode = 'cloud' | 'on-device' | 'federated';
type Dataset = {
  id: number;
  name: string;
  description: string | null;
  file_count: number;
  labels: string[];
  label_distribution?: Record<string, number>;
  stats?: Record<string, any>;
  created_at: string;
  files?: DatasetFile[];
};
type DatasetFile = { id: number; file_id: number; filename: string; label: string; size?: number; content_type?: string; created_at?: string; file_missing?: boolean };
type CloudFile = { file_id: number; filename: string; size: number; content_type: string; uploaded_at: string };
type ModelOption = { value: string; label: string; description: string; supported_data: string[] };
type PreprocessingPipelineSummary = {
  id: number;
  name: string;
  description?: string | null;
  data_type: string;
  output_shape: string;
  include_phase: boolean;
  window_size: number;
  filter_subcarriers: boolean;
  subcarrier_start: number;
  subcarrier_end: number;
  is_default: boolean;
};
type PreprocessingPreviewStage = {
  block: string;
  name: string;
  shape?: number[] | null;
  sample?: any;
  metadata?: any;
  error?: string;
};
type PreprocessingPreview = {
  dataset_id: number;
  file: {
    file_id: number;
    filename: string;
    size: number;
    content_type?: string | null;
  };
  data_type: 'csi' | 'imu' | string;
  effective_config: Record<string, any>;
  stages: PreprocessingPreviewStage[];
};
type BayesianTrialData = {
  trial: number;
  learning_rate: number;
  batch_size: number;
  weight_decay?: number;
  dropout?: number;
  optimizer?: string;
  architecture_size?: string;
  train_accuracy: number;
  val_accuracy: number;
  train_loss?: number;
  val_loss?: number;
  duration_seconds?: number;
  is_best: boolean;
};

type TrainingJob = {
  job_id: string; dataset_id: number; dataset_name: string; model_type: string;
  training_mode: string; status: string; current_epoch: number; total_epochs: number;
  metrics: { loss?: number[]; accuracy?: number[]; val_loss?: number[]; val_accuracy?: number[] };
  config?: string | Record<string, any>;
  best_metrics: { 
    val_accuracy?: number; 
    best_epoch?: number;
    per_class_metrics?: Record<string, { precision: number; recall: number; f1_score: number; support: number }>;
    confusion_matrix?: number[][];
    class_names?: string[];
    roc_curves?: Record<string, { points: { fpr: number; tpr: number }[]; auc: number }>;
    pr_curves?: Record<string, { points: { precision: number; recall: number }[] }>;
    model_architecture?: {
      layers: { type: string; units?: number; activation?: string; shape?: string; rate?: number; params: number }[];
      total_params: number;
      trainable_params: number;
      optimizer: string;
      learning_rate: number;
      batch_size: number;
    };
    learning_rate?: number;
    batch_size?: number;
    optimizer?: string;
    bayesian_config?: Record<string, any>;
  };
  created_at: string; started_at?: string; completed_at?: string;
};
type TrainedModel = { id: number; job_id: string; name: string; architecture: string; accuracy: number | null; size_mb: number | null; created_at: string };

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  pending: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Clock },
  running: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Loader2 },
};

// Model configurations for different data types
const MODEL_OPTIONS: ModelOption[] = [
  // Deep Learning - Time Series
  {
    value: 'dl_cnn_lstm',
    label: 'DL: CNN-LSTM',
    description: 'Deep learning CNN+LSTM for time-series classification',
    supported_data: ['imu', 'csi', 'sensor', 'other']
  },
  {
    value: 'dl_lstm',
    label: 'DL: LSTM',
    description: 'Long Short-Term Memory for sequential data',
    supported_data: ['imu', 'csi', 'sensor', 'other']
  },
  // Deep Learning - Images
  {
    value: 'dl_cnn',
    label: 'DL: CNN',
    description: 'Convolutional Neural Network for image classification',
    supported_data: ['image', 'img', 'timelapse']
  },
  {
    value: 'dl_resnet18',
    label: 'DL: ResNet-18',
    description: 'Deep residual network for image classification',
    supported_data: ['image', 'img', 'timelapse']
  },
  {
    value: 'dl_mobilenet',
    label: 'DL: MobileNet',
    description: 'Lightweight CNN for mobile/edge deployment',
    supported_data: ['image', 'img', 'timelapse']
  },
  // Deep Learning - General
  {
    value: 'dl_mlp',
    label: 'DL: MLP',
    description: 'Multi-layer perceptron (works with any data type)',
    supported_data: ['imu', 'csi', 'sensor', 'image', 'img', 'timelapse', 'other']
  },
  // Machine Learning - Classical
  {
    value: 'knn',
    label: 'ML: KNN',
    description: 'K-Nearest Neighbors (fast, interpretable)',
    supported_data: ['imu', 'csi', 'sensor', 'other']
  },
  {
    value: 'svc',
    label: 'ML: SVC',
    description: 'Support Vector Classifier (strong for smaller datasets)',
    supported_data: ['imu', 'csi', 'sensor', 'other']
  },
  {
    value: 'random_forest',
    label: 'ML: Random Forest',
    description: 'Ensemble of decision trees (robust, handles noise)',
    supported_data: ['imu', 'csi', 'sensor', 'other']
  },
  {
    value: 'adaboost',
    label: 'ML: AdaBoost',
    description: 'AdaBoost ensemble of weak learners',
    supported_data: ['imu', 'csi', 'sensor', 'other']
  },
  {
    value: 'xgboost',
    label: 'ML: XGBoost',
    description: 'Gradient boosting (high performance, handles missing data)',
    supported_data: ['imu', 'csi', 'sensor', 'other']
  },
];

// Detect data type from filename
function detectDataType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const name = filename.toLowerCase();
  
  // Check extension first
  if (ext === 'json') {
    if (name.includes('imu')) return 'imu';
    if (name.includes('csi')) return 'csi';
    if (name.includes('mfcw')) return 'mfcw';
  }
  
  // Check common image/video extensions
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'].includes(ext || '')) return 'img';
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext || '')) return 'vid';
  
  // Default to other
  return 'other';
};

const TRAINING_STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  completed: { color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
  failed: { color: 'text-red-400', bg: 'bg-red-500/20', icon: AlertCircle },
  cancelled: { color: 'text-slate-400', bg: 'bg-slate-500/20', icon: XCircle },
};

export default function TrainingPage() {
  const { get, post, delete: del, put } = useApi();
  const { user } = useAuth();
  const [selectedMode, setSelectedMode] = useState<TrainingMode>('cloud');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [showCreateDataset, setShowCreateDataset] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [newDatasetDesc, setNewDatasetDesc] = useState('');
  const [newDatasetLabel, setNewDatasetLabel] = useState('');
  const [newDatasetLabels, setNewDatasetLabels] = useState<string[]>([]);
  const [datasetLabelOverrides, setDatasetLabelOverrides] = useState<Record<number, string[]>>({});
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
  const [showAddFiles, setShowAddFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Map<number, string>>(new Map());
  const [availableLabels, setAvailableLabels] = useState<string[]>(['walking', 'sitting', 'standing', 'running']);
  const [newLabel, setNewLabel] = useState('');
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [trainedModels, setTrainedModels] = useState<TrainedModel[]>([]);
  const [showTrainingConfig, setShowTrainingConfig] = useState(false);
  const [preprocessingPipelines, setPreprocessingPipelines] = useState<PreprocessingPipelineSummary[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [trainingWizardStep, setTrainingWizardStep] = useState<0 | 1 | 2 | 3>(0);
  const [preprocessingPreview, setPreprocessingPreview] = useState<PreprocessingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [trainingConfig, setTrainingConfig] = useState({ 
    model_type: 'dl_cnn_lstm', 
    model_architecture: 'medium',
    epochs: 10, 
    batch_size: 32, 
    learning_rate: 0.001, 
    model_name: '', 
    test_dataset_id: null as number | null,
    window_size: 1000,
    test_split: 0.2,
    preprocessing_pipeline_id: null as number | null,
    data_type: 'auto' as 'auto' | 'csi' | 'imu',
    output_shape: 'flattened' as 'flattened' | 'sequence',
    optimization_method: 'none' as 'none' | 'bayesian' | 'grid',
    // File-to-pipeline assignments: { fileId: { pipeline_id, split: 'train'|'test'|'split', split_ratio: 0.8, selected_lines: number, total_lines: number } }
    file_assignments: {} as Record<number, { pipeline_id: number | null; split: 'train' | 'test' | 'split'; split_ratio: number; selected_lines?: number; total_lines?: number }>,
    // KNN parameters
    knn_params: {
      n_neighbors: 5,
      weights: 'uniform' as 'uniform' | 'distance',
      metric: 'euclidean' as 'euclidean' | 'manhattan' | 'minkowski' | 'chebyshev',
      algorithm: 'auto' as 'auto' | 'ball_tree' | 'kd_tree' | 'brute',
      p: 2,
      leaf_size: 30,
    },
    // SVC parameters
    svc_params: {
      C: 1.0,
      kernel: 'rbf' as 'rbf' | 'linear' | 'poly' | 'sigmoid',
      gamma: 'scale' as 'scale' | 'auto' | number,
      degree: 3,
      coef0: 0.0,
      shrinking: true,
      probability: true,
      tol: 0.001,
      max_iter: -1,
      class_weight: 'balanced' as 'balanced' | null,
    },
    // AdaBoost parameters
    adaboost_params: {
      n_estimators: 50,
      learning_rate: 1.0,
      algorithm: 'SAMME.R' as 'SAMME.R' | 'SAMME',
      max_depth: 1,
      min_samples_split: 2,
      min_samples_leaf: 1,
    },
    // XGBoost parameters
    xgboost_params: {
      n_estimators: 100,
      max_depth: 6,
      learning_rate: 0.3,
      subsample: 1.0,
      colsample_bytree: 1.0,
      gamma: 0,
      reg_alpha: 0,
      reg_lambda: 1,
      min_child_weight: 1,
      objective: 'multi:softprob' as 'multi:softprob' | 'multi:softmax' | 'binary:logistic',
      eval_metric: 'mlogloss' as 'mlogloss' | 'merror' | 'auc',
      use_label_encoder: false,
      verbosity: 0,
    },
    // Grid search parameters for each model
    grid_knn: {
      n_neighbors: [3, 5, 7, 9] as number[],
      weights: ['uniform', 'distance'] as string[],
      metric: ['euclidean', 'manhattan'] as string[],
    },
    grid_svc: {
      C: [0.1, 1.0, 10.0] as number[],
      kernel: ['rbf', 'linear', 'poly'] as string[],
      gamma: ['scale', 'auto'] as string[],
    },
    grid_adaboost: {
      n_estimators: [50, 100, 200] as number[],
      learning_rate: [0.5, 1.0, 1.5] as number[],
      max_depth: [1, 2, 3] as number[],
    },
    grid_xgboost: {
      n_estimators: [50, 100, 200] as number[],
      max_depth: [3, 6, 9] as number[],
      learning_rate: [0.01, 0.1, 0.3] as number[],
      subsample: [0.8, 1.0] as number[],
      colsample_bytree: [0.8, 1.0] as number[],
    },
    early_stopping: true,
    augment_data: false,
    use_transfer_learning: false,
    // Bayesian optimization settings
    use_bayesian_optimization: false,
    bayesian_trials: 20,
    bayesian_epochs_per_trial: 3,
    bayesian_lr_min: 0.00001,
    bayesian_lr_max: 0.01,
    bayesian_lr_scale: 'log' as 'log' | 'linear',
    bayesian_batch_sizes: [16, 32, 64, 128],
    bayesian_weight_decay_min: 0.0,
    bayesian_weight_decay_max: 0.01,
    bayesian_optimizers: ['adam', 'adamw', 'sgd'],
    bayesian_exploration_rate: 0.3,
    bayesian_search: false,
    bayesian_search_architecture: false,
  });
  const [showAdvancedBayesian, setShowAdvancedBayesian] = useState(false);
  const [fileLineCounts, setFileLineCounts] = useState<Record<number, { total_lines: number; data_lines: number; loading: boolean }>>({});
  const [compareModels, setCompareModels] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'datasets' | 'jobs' | 'models' | 'compare' | 'groups'>('datasets');
  const [renamingModel, setRenamingModel] = useState<TrainedModel | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  
  // Training Job Groups state
  const [jobGroups, setJobGroups] = useState<TrainingJobGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [createGroupType, setCreateGroupType] = useState<'central' | 'federated'>('central');
  
  // Granular loading states
  const [loadingStates, setLoadingStates] = useState({
    datasets: false,
    jobs: false,
    models: false,
    files: false,
    datasetDetail: false,
    training: false,
    deleting: false,
    downloading: false,
    renaming: false
  });
  const [operations, setOperations] = useState({
    creatingDataset: false,
    addingFiles: false,
    startingTraining: false,
    cancellingJob: false,
    deletingModel: null as number | null,
    downloadingModel: null as number | null,
    renamingModel: null as number | null
  });

  const fetchData = async (options?: { datasets?: boolean; jobs?: boolean; models?: boolean; files?: boolean }) => {
    const opts = { datasets: true, jobs: true, models: true, files: true, ...options };
    
    try {
      // Set loading states for specific operations
      if (opts.datasets) setLoadingStates(prev => ({ ...prev, datasets: true }));
      if (opts.jobs) setLoadingStates(prev => ({ ...prev, jobs: true }));
      if (opts.models) setLoadingStates(prev => ({ ...prev, models: true }));
      if (opts.files) setLoadingStates(prev => ({ ...prev, files: true }));
      
      setError(null);
      setLoading(true);
      
      // Only fetch the requested data
      const promises: { type: string; promise: Promise<any> }[] = [];
      if (opts.datasets) promises.push({ type: 'datasets', promise: get('/datasets/list').catch(() => null) });
      if (opts.jobs) promises.push({ type: 'jobs', promise: get('/datasets/train/jobs').catch(() => null) });
      if (opts.models) promises.push({ type: 'models', promise: get('/datasets/models').catch(() => null) });
      if (opts.files) promises.push({ type: 'files', promise: get('/file/files').catch(() => null) });
      
      const results = await Promise.all(promises.map(p => p.promise));
      
      promises.forEach((p, index) => {
        const result = results[index];
        if (!result) return;
        
        switch (p.type) {
          case 'datasets':
            if (result?.datasets) setDatasets(result.datasets);
            break;
          case 'jobs':
            if (result?.jobs) setTrainingJobs(result.jobs);
            break;
          case 'models':
            if (result?.models) setTrainedModels(result.models);
            break;
          case 'files':
            if (result?.files) setCloudFiles(result.files);
            break;
        }
      });
    } catch (err) {
      toast.error('Loading Failed', 'Failed to load training data');
    } finally {
      // Clear loading states
      setLoading(false);
      if (opts.datasets) setLoadingStates(prev => ({ ...prev, datasets: false }));
      if (opts.jobs) setLoadingStates(prev => ({ ...prev, jobs: false }));
      if (opts.models) setLoadingStates(prev => ({ ...prev, models: false }));
      if (opts.files) setLoadingStates(prev => ({ ...prev, files: false }));
    }
  };

  useEffect(() => {
    if (!showAddFiles) return;

    const loadCloudFiles = async () => {
      if (cloudFiles.length > 0) return;
      try {
        setLoadingStates(prev => ({ ...prev, files: true }));
        const res = await get('/file/files');
        if (res?.files) setCloudFiles(res.files);
      } catch {
        toast.error('Loading Failed', 'Failed to load cloud files');
      } finally {
        setLoadingStates(prev => ({ ...prev, files: false }));
      }
    };

    loadCloudFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddFiles]);

  useEffect(() => {
    if (!showCreateDataset) return;
    setNewDatasetLabel('');
    setNewDatasetLabels([]);
  }, [showCreateDataset]);

  useEffect(() => {
    fetchData({ datasets: true, jobs: false, models: false, files: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showTrainingConfig) return;

    const loadPipelines = async () => {
      setPipelinesLoading(true);
      try {
        const res = await get('/enhanced-processing/db-pipelines').catch(() => null);
        if (res?.pipelines) setPreprocessingPipelines(res.pipelines);
      } catch {}
      finally { setPipelinesLoading(false); }
    };

    loadPipelines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTrainingConfig]);

  useEffect(() => {
    if (!showTrainingConfig) return;
    setTrainingWizardStep(0);
    setPreprocessingPreview(null);
    setPreviewError(null);
  }, [showTrainingConfig]);

  // Update window_size based on data_type (1000 for CSI, 128 for IMU)
  useEffect(() => {
    const defaultWindowSize = trainingConfig.data_type === 'csi' ? 1000 : trainingConfig.data_type === 'imu' ? 128 : 1000;
    if (trainingConfig.window_size !== defaultWindowSize) {
      setTrainingConfig(prev => ({ ...prev, window_size: defaultWindowSize }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingConfig.data_type]);

  useEffect(() => {
    if (!showTrainingConfig || !selectedDataset) return;

    const t = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await post(`/datasets/${selectedDataset.id}/preprocessing/preview`, {
          preprocessing_pipeline_id: trainingConfig.preprocessing_pipeline_id,
          data_type: trainingConfig.data_type,
          output_shape: trainingConfig.output_shape,
          window_size: trainingConfig.window_size,
          max_preview_values: 32,
        }).catch(() => null);

        if (res?.preview) {
          setPreprocessingPreview(res.preview);
        } else {
          setPreprocessingPreview(null);
          setPreviewError('Failed to load preprocessing preview');
        }
      } catch (e) {
        setPreprocessingPreview(null);
        setPreviewError(e instanceof Error ? e.message : 'Failed to load preprocessing preview');
      } finally {
        setPreviewLoading(false);
      }
    }, 600);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showTrainingConfig,
    selectedDataset?.id,
    trainingConfig.preprocessing_pipeline_id,
    trainingConfig.data_type,
    trainingConfig.output_shape,
    trainingConfig.window_size,
  ]);

  useEffect(() => {
    if (activeTab === 'jobs') {
      fetchData({ datasets: false, jobs: true, models: false, files: false });
    }
    if (activeTab === 'models' || activeTab === 'compare') {
      fetchData({ datasets: false, jobs: false, models: true, files: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Check if there are any running jobs that need faster polling
  const hasRunningJobs = trainingJobs.some(j => j.status === 'running' || j.status === 'pending');
  
  // Track if realtime is active to avoid duplicate polling
  const realtimeActiveRef = useRef(false);

  // Supabase Realtime subscription for training jobs
  useEffect(() => {
    if (activeTab !== 'jobs') return;
    if (!user?.userId) return;
    
    // Try to set up realtime subscription
    const unsubscribe = subscribeToTrainingJobs(
      user.userId,
      // On job update
      (realtimeJob: RealtimeTrainingJob) => {
        const parsedJob = parseRealtimeJob(realtimeJob);
        setTrainingJobs(prev => prev.map(job => 
          job.job_id === parsedJob.job_id ? { ...job, ...parsedJob } : job
        ));
        console.log('[Realtime] Job updated:', parsedJob.job_id, parsedJob.status);
      },
      // On new job
      (realtimeJob: RealtimeTrainingJob) => {
        const parsedJob = parseRealtimeJob(realtimeJob);
        setTrainingJobs(prev => {
          // Avoid duplicates
          if (prev.some(j => j.job_id === parsedJob.job_id)) return prev;
          return [parsedJob as any, ...prev];
        });
        console.log('[Realtime] New job:', parsedJob.job_id);
      },
      // On job delete
      (jobId: string) => {
        setTrainingJobs(prev => prev.filter(job => job.job_id !== jobId));
        console.log('[Realtime] Job deleted:', jobId);
      }
    );
    
    if (unsubscribe) {
      realtimeActiveRef.current = true;
      console.log('[Realtime] Subscribed to training job updates');
      return () => {
        unsubscribe();
        realtimeActiveRef.current = false;
      };
    } else {
      realtimeActiveRef.current = false;
      console.log('[Realtime] Not available, using polling fallback');
    }
  }, [activeTab, user?.userId]);

  // Polling fallback (only when realtime is not active)
  useEffect(() => {
    if (activeTab !== 'jobs' && activeTab !== 'models' && activeTab !== 'compare') return;

    // If realtime is active for jobs tab, use slower polling (just for models/compare or as backup)
    const pollInterval = realtimeActiveRef.current && activeTab === 'jobs' 
      ? 30000  // 30s backup poll when realtime is active
      : (activeTab === 'jobs' && hasRunningJobs ? 3000 : 10000);  // Fast poll when no realtime

    const interval = setInterval(async () => {
      const hasActiveOperation = Object.values(operations).some(v => v === true || v !== null);
      if (hasActiveOperation) return;

      try {
        await fetchData({
          datasets: false,
          jobs: activeTab === 'jobs',
          models: activeTab === 'models' || activeTab === 'compare',
          files: false,
        });
      } catch {}
    }, pollInterval);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, operations, hasRunningJobs]);

  // Get available models based on dataset file types
  const getAvailableModels = useCallback((dataset: Dataset | null): ModelOption[] => {
    if (!dataset || !dataset.files || dataset.files.length === 0) {
      return MODEL_OPTIONS;
    }

    // Detect data types from files
    const dataTypes = new Set<string>();
    dataset.files.forEach(file => {
      const dataType = detectDataType(file.filename);
      dataTypes.add(dataType);
    });

    // Filter models that support any of the detected data types
    const availableModels = MODEL_OPTIONS.filter(model => 
      model.supported_data.some(type => dataTypes.has(type))
    );

    // If no specific models found, return general ones
    if (availableModels.length === 0) {
      return MODEL_OPTIONS;
    }

    return availableModels;
  }, []);

  const handleCreateDataset = async () => {
    if (!newDatasetName.trim()) return;
    
    setOperations(prev => ({ ...prev, creatingDataset: true }));
    try {
      const initialLabels = Array.from(
        new Set(newDatasetLabels.map(l => l.trim()).filter(Boolean))
      );

      const created = await post('/datasets/create', { name: newDatasetName.trim(), description: newDatasetDesc.trim() });
      setNewDatasetName('');
      setNewDatasetDesc('');
      setNewDatasetLabel('');
      setNewDatasetLabels([]);
      setShowCreateDataset(false);

      const createdDataset: Dataset | undefined = created?.dataset;
      if (createdDataset?.id && initialLabels.length > 0) {
        setDatasetLabelOverrides(prev => ({ ...prev, [createdDataset.id]: initialLabels }));
        setAvailableLabels(initialLabels);
      }

      await fetchData({ datasets: true }); // Only refresh datasets
    } catch { toast.error('Dataset Error', 'Failed to create dataset'); }
    finally { setOperations(prev => ({ ...prev, creatingDataset: false })); }
  };

  const handleSelectDataset = async (dataset: Dataset) => {
    try {
      setLoadingStates(prev => ({ ...prev, datasetDetail: true }));
      const res = await get(`/datasets/${dataset.id}`);
      if (res?.dataset) {
        setSelectedDataset(res.dataset);
        // Update available labels based on dataset
        const datasetLabels = res.dataset.labels || [];
        const overrideLabels = datasetLabelOverrides[res.dataset.id] || [];
        if (datasetLabels.length > 0) {
          const merged = Array.from(new Set([...overrideLabels, ...datasetLabels].map(l => l.trim()).filter(Boolean)));
          setAvailableLabels(merged);
          if (merged.length > 0) setDatasetLabelOverrides(prev => ({ ...prev, [res.dataset.id]: merged }));
        } else if (overrideLabels.length > 0) {
          setAvailableLabels(overrideLabels);
        }
        // Update training config with first available model
        const availableModels = getAvailableModels(res.dataset);
        if (availableModels.length > 0) {
          setTrainingConfig(prev => ({ 
            ...prev, 
            model_type: availableModels[0].value 
          }));
        }
      }
    } catch { toast.error('Loading Failed', 'Failed to load dataset details'); }
    finally {
      setLoadingStates(prev => ({ ...prev, datasetDetail: false }));
    }
  };

  const handleAddFilesToDataset = async () => {
    if (!selectedDataset || selectedFiles.size === 0) return;
    
    setOperations(prev => ({ ...prev, addingFiles: true }));
    setError(null);
    
    try {
      const files = Array.from(selectedFiles.entries()).map(([fileId, label]) => ({ file_id: fileId, label }));
      console.log(`Adding ${files.length} files to dataset ${selectedDataset.id}`);
      
      const result = await post(`/datasets/${selectedDataset.id}/files`, { files });
      console.log('Add files result:', result);
      
      setSelectedFiles(new Map());
      setShowAddFiles(false);
      
      // Refresh dataset to show updated file count
      await handleSelectDataset(selectedDataset);
      await fetchData({ datasets: true });
    } catch (err) {
      console.error('Failed to add files:', err);
      toast.error('Add Files Failed', err instanceof Error ? err.message : 'Failed to add files to dataset');
    } finally {
      setOperations(prev => ({ ...prev, addingFiles: false }));
    }
  };

  const handleRemoveFile = async (fileId: number) => {
    if (!selectedDataset) return;
    try { await del(`/datasets/${selectedDataset.id}/files/${fileId}`); handleSelectDataset(selectedDataset); toast.success('File Removed', 'File removed from dataset'); } catch { toast.error('Remove Failed', 'Failed to remove file from dataset'); }
  };

  const handleUpdateLabel = async (fileId: number, newLbl: string) => {
    if (!selectedDataset) return;
    try { await put(`/datasets/${selectedDataset.id}/files/${fileId}/label`, { label: newLbl }); handleSelectDataset(selectedDataset); } catch { toast.error('Update Failed', 'Failed to update file label'); }
  };

  const fetchFileLineCounts = async (files: any[]) => {
    // Fetch line counts for all files in parallel
    const fileIds = files.map((f: any) => f.file_id).filter(Boolean);
    
    // Set loading state for all files
    setFileLineCounts(prev => {
      const updated = { ...prev };
      fileIds.forEach(id => {
        updated[id] = { total_lines: 0, data_lines: 0, loading: true };
      });
      return updated;
    });
    
    // Fetch line counts in parallel
    const results = await Promise.all(
      fileIds.map(async (fileId: number) => {
        try {
          const res = await get(`/datasets/files/${fileId}/line-count`);
          return { fileId, data: res };
        } catch (err) {
          console.error(`Failed to fetch line count for file ${fileId}:`, err);
          return { fileId, data: { data_lines: 0, total_lines: 0 } };
        }
      })
    );
    
    // Update state with results
    setFileLineCounts(prev => {
      const updated = { ...prev };
      results.forEach(({ fileId, data }) => {
        updated[fileId] = {
          total_lines: data.total_lines || 0,
          data_lines: data.data_lines || 0,
          loading: false
        };
      });
      return updated;
    });
    
    // Initialize file_assignments with line counts
    setTrainingConfig(prev => {
      const newAssignments = { ...prev.file_assignments };
      results.forEach(({ fileId, data }) => {
        const dataLines = data.data_lines || 0;
        if (!newAssignments[fileId]) {
          newAssignments[fileId] = { 
            pipeline_id: null, 
            split: 'split', 
            split_ratio: 0.8,
            selected_lines: dataLines,
            total_lines: dataLines
          };
        } else {
          newAssignments[fileId] = {
            ...newAssignments[fileId],
            selected_lines: newAssignments[fileId].selected_lines ?? dataLines,
            total_lines: dataLines
          };
        }
      });
      return { ...prev, file_assignments: newAssignments };
    });
  };

  const handleOpenTrainingConfig = async () => {
    setShowTrainingConfig(true);
    if (selectedDataset?.files) {
      await fetchFileLineCounts(selectedDataset.files);
    }
  };

  const handleStartTraining = async () => {
    if (!selectedDataset) return;
    
    setOperations(prev => ({ ...prev, startingTraining: true }));
    try {
      const ml_params =
        trainingConfig.model_type === 'knn'
          ? trainingConfig.knn_params
          : trainingConfig.model_type === 'svc'
            ? trainingConfig.svc_params
            : trainingConfig.model_type === 'adaboost'
              ? trainingConfig.adaboost_params
              : trainingConfig.model_type === 'xgboost'
                ? trainingConfig.xgboost_params
                : {};

      const grid_search = (() => {
        if (trainingConfig.optimization_method !== 'grid') return null;
        if (trainingConfig.model_type === 'knn') {
          return { enabled: true, model_type: 'knn', params: trainingConfig.grid_knn };
        }
        if (trainingConfig.model_type === 'svc') {
          return { enabled: true, model_type: 'svc', params: trainingConfig.grid_svc };
        }
        if (trainingConfig.model_type === 'adaboost') {
          return { enabled: true, model_type: 'adaboost', params: trainingConfig.grid_adaboost };
        }
        if (trainingConfig.model_type === 'xgboost') {
          return { enabled: true, model_type: 'xgboost', params: trainingConfig.grid_xgboost };
        }
        return { enabled: true, model_type: trainingConfig.model_type, params: {} };
      })();

      console.log('[Training] Starting training with config:', {
        dataset_id: selectedDataset.id,
        model_type: trainingConfig.model_type,
        test_split: trainingConfig.test_split,
      });
      
      const result = await post('/datasets/train/cloud', {
        dataset_id: selectedDataset.id,
        test_dataset_id: trainingConfig.test_dataset_id,
        model_type: trainingConfig.model_type,
        model_architecture: trainingConfig.model_architecture,
        epochs: trainingConfig.epochs,
        batch_size: trainingConfig.batch_size,
        learning_rate: trainingConfig.learning_rate,
        test_split: trainingConfig.test_split,
        model_name: trainingConfig.model_name || undefined,
        window_size: trainingConfig.window_size,
        preprocessing_pipeline_id: trainingConfig.preprocessing_pipeline_id,
        data_type: trainingConfig.data_type,
        output_shape: trainingConfig.output_shape,
        ml_params,
        grid_search: grid_search || undefined,
        use_bayesian_optimization: trainingConfig.optimization_method === 'bayesian' && trainingConfig.use_bayesian_optimization,
        bayesian_trials: trainingConfig.bayesian_trials,
        bayesian_epochs_per_trial: trainingConfig.bayesian_epochs_per_trial,
        bayesian_lr_min: trainingConfig.bayesian_lr_min,
        bayesian_lr_max: trainingConfig.bayesian_lr_max,
        bayesian_lr_scale: trainingConfig.bayesian_lr_scale,
        bayesian_batch_sizes: trainingConfig.bayesian_batch_sizes,
        bayesian_weight_decay_min: trainingConfig.bayesian_weight_decay_min,
        bayesian_weight_decay_max: trainingConfig.bayesian_weight_decay_max,
        bayesian_optimizers: trainingConfig.bayesian_optimizers,
        bayesian_exploration_rate: trainingConfig.bayesian_exploration_rate,
        bayesian_search_architecture: trainingConfig.bayesian_search_architecture,
      });
      
      console.log('[Training] Training started successfully:', result);
      setShowTrainingConfig(false);
      await fetchData({ jobs: true });
    } catch (err) { 
      console.error('[Training] Failed to start training:', err);
      toast.error('Training Failed', err instanceof Error ? err.message : 'Failed to start training'); 
    }
    finally { setOperations(prev => ({ ...prev, startingTraining: false })); }
  };

  const handleCancelJob = async (jobId: string) => {
    setOperations(prev => ({ ...prev, cancellingJob: true }));
    try { await post(`/datasets/train/jobs/${jobId}/cancel`, {}); await fetchData({ jobs: true }); } 
    catch { toast.error('Cancel Failed', 'Failed to cancel training job'); }
    finally { setOperations(prev => ({ ...prev, cancellingJob: false })); }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await del(`/datasets/train/jobs/${jobId}`);
      await fetchData({ jobs: true }); // Only refresh jobs
      toast.success('Job Deleted', 'Training job has been deleted');
    } catch { toast.error('Delete Failed', 'Failed to delete training job'); }
  };

  const handleDeleteDataset = async (datasetId: number) => {
    try { 
      await del(`/datasets/${datasetId}`); 
      setSelectedDataset(null);
      await fetchData({ datasets: true, jobs: true }); // Refresh datasets and jobs
      toast.success('Dataset Deleted', 'Dataset has been deleted');
    } catch { toast.error('Delete Failed', 'Failed to delete dataset'); }
  };

  const handleDeleteModel = async (modelId: number) => {
    if (!confirm('Are you sure you want to delete this model?')) return;
    
    setOperations(prev => ({ ...prev, deletingModel: modelId }));
    try { 
      await del(`/datasets/models/${modelId}`); 
      await fetchData({ models: true }); // Only refresh models
      toast.success('Model Deleted', 'Model has been deleted');
    } catch { toast.error('Delete Failed', 'Failed to delete model'); }
    finally { setOperations(prev => ({ ...prev, deletingModel: null })); }
  };

  const handleRenameModel = async () => {
    if (!renamingModel || !newModelName.trim()) return;
    
    setOperations(prev => ({ ...prev, renamingModel: renamingModel.id }));
    try {
      await put(`/datasets/models/${renamingModel.id}/rename`, { name: newModelName.trim() });
      setRenamingModel(null);
      setNewModelName('');
      await fetchData({ models: true }); // Only refresh models
      toast.success('Model Renamed', `Model renamed to "${newModelName.trim()}"`);
    } catch { toast.error('Rename Failed', 'Failed to rename model'); }
    finally { setOperations(prev => ({ ...prev, renamingModel: null })); }
  };

  const handleDownloadModel = async (modelId: number, modelName: string) => {
    setOperations(prev => ({ ...prev, downloadingModel: modelId }));
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';
      console.log(`Downloading model ${modelId} from ${apiUrl}/datasets/models/${modelId}/download`);
      
      const response = await fetch(`${apiUrl}/datasets/models/${modelId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user?.token || ''}`,
          'Accept': 'application/octet-stream'
        }
      });

      console.log('Download response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication Failed', 'Please log in again to download models');
          return;
        }
        const errorText = await response.text();
        console.error('Download failed:', response.status, errorText);
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${modelName}.pth`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) { 
      console.error('Download error:', err);
      toast.error('Download Failed', 'Failed to download model. Please try again.'); 
    } finally {
      setOperations(prev => ({ ...prev, downloadingModel: null }));
    }
  };

  // Export functions for publication-quality outputs
  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = row[h.toLowerCase().replace(/\s+/g, '_')];
        return typeof val === 'number' ? val.toFixed(6) : `"${val || ''}"`;
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMetricsTable = (job: TrainingJob) => {
    if (!job.best_metrics?.per_class_metrics) return;
    
    const data = Object.entries(job.best_metrics.per_class_metrics).map(([className, metrics]) => ({
      class: className,
      precision: metrics.precision,
      recall: metrics.recall,
      f1_score: metrics.f1_score,
      support: metrics.support
    }));
    
    const headers = ['Class', 'Precision', 'Recall', 'F1_Score', 'Support'];
    exportToCSV(data, `${job.dataset_name}_metrics`, headers);
  };

  const exportConfusionMatrix = (job: TrainingJob) => {
    if (!job.best_metrics?.confusion_matrix || !job.best_metrics?.class_names) return;
    
    const classNames = job.best_metrics.class_names;
    const matrix = job.best_metrics.confusion_matrix;
    
    const headers = ['True/Predicted', ...classNames];
    const csvContent = [
      headers.join(','),
      ...matrix.map((row, i) => [classNames[i], ...row].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.dataset_name}_confusion_matrix.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBayesianTrials = (job: TrainingJob) => {
    try {
      const config = typeof job.config === 'string' ? JSON.parse(job.config) : job.config;
      const trials = config?.bayesian_trials_results as BayesianTrialData[];
      if (!trials || trials.length === 0) return;
      
      const headers = ['Trial', 'Learning_Rate', 'Batch_Size', 'Weight_Decay', 'Optimizer', 'Train_Acc', 'Val_Acc', 'Duration_s', 'Is_Best'];
      const csvContent = [
        headers.join(','),
        ...trials.map(t => [
          t.trial,
          t.learning_rate.toExponential(4),
          t.batch_size,
          (t.weight_decay || 0).toExponential(4),
          t.optimizer || 'adam',
          (t.train_accuracy * 100).toFixed(2),
          (t.val_accuracy * 100).toFixed(2),
          t.duration_seconds || '-',
          t.is_best ? 'Yes' : 'No'
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${job.dataset_name}_bayesian_trials.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export Bayesian trials:', e);
    }
  };

  const exportTrainingCurves = (job: TrainingJob) => {
    if (!job.metrics) return;
    
    const epochs = job.metrics.loss?.length || job.metrics.accuracy?.length || 0;
    const data = [];
    
    for (let i = 0; i < epochs; i++) {
      data.push({
        epoch: i + 1,
        train_loss: job.metrics.loss?.[i] || '',
        val_loss: job.metrics.val_loss?.[i] || '',
        train_accuracy: job.metrics.accuracy?.[i] || '',
        val_accuracy: job.metrics.val_accuracy?.[i] || ''
      });
    }
    
    const headers = ['Epoch', 'Train_Loss', 'Val_Loss', 'Train_Accuracy', 'Val_Accuracy'];
    exportToCSV(data, `${job.dataset_name}_training_curves`, headers);
  };

  const downloadGraph = async (svgElement: SVGSVGElement | null, filename: string) => {
    if (!svgElement) return;
    
    try {
      // Publication-quality dimensions (6x4 inches at 300 DPI)
      const width = 1800;
      const height = 1200;
      const margin = 120;
      const plotWidth = width - 2 * margin;
      const plotHeight = height - 2 * margin;
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      
      // Title
      const graphTitle = filename ? filename.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Graph';
      ctx.font = 'bold 28px Arial';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(graphTitle, width / 2, 60);
      
      // Draw axes
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(margin, margin);
      ctx.lineTo(margin, height - margin);
      ctx.lineTo(width - margin, height - margin);
      ctx.stroke();
      
      // Axis labels
      ctx.font = 'bold 22px Arial';
      ctx.fillText('Epoch', width / 2, height - 40);
      ctx.save();
      ctx.translate(45, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(filename.includes('loss') ? 'Loss' : 'Accuracy', 0, 0);
      ctx.restore();
      
      // Grid
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const y = margin + (plotHeight / 10) * i;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(width - margin, y);
        ctx.stroke();
        
        const x = margin + (plotWidth / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, margin);
        ctx.lineTo(x, height - margin);
        ctx.stroke();
      }
      
      // Tick labels
      ctx.font = '18px Arial';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'right';
      for (let i = 0; i <= 10; i++) {
        const y = margin + (plotHeight / 10) * i;
        const value = filename.includes('loss') ? (2.0 - i * 0.2).toFixed(1) : ((100 - i * 10).toString() + '%');
        ctx.fillText(value, margin - 15, y + 6);
      }
      
      ctx.textAlign = 'center';
      for (let i = 0; i <= 10; i++) {
        const x = margin + (plotWidth / 10) * i;
        ctx.fillText((i * 10).toString(), x, height - margin + 35);
      }
      
      // Draw data
      const polylines = svgElement.querySelectorAll('polyline');
      const colors = ['#2563eb', '#10b981', '#ef4444', '#a855f7'];
      polylines.forEach((polyline, index) => {
        const points = polyline.getAttribute('points');
        if (!points) return;
        
        const coords = points.trim().split(/\s+/).map(p => p.split(',').map(Number).filter(n => !isNaN(n)));
        if (coords.length === 0) return;
        
        const svgWidth = parseFloat(svgElement.getAttribute('viewBox')?.split(' ')[2] || '400');
        const svgHeight = parseFloat(svgElement.getAttribute('viewBox')?.split(' ')[3] || '150');
        
        ctx.strokeStyle = colors[index % colors.length];
        ctx.lineWidth = 4;
        ctx.beginPath();
        
        coords.forEach((coord, i) => {
          const x = margin + (coord[0] / svgWidth) * plotWidth;
          const y = margin + (coord[1] / svgHeight) * plotHeight;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
      });
      
      // Legend
      ctx.font = 'bold 20px Arial';
      const legendX = width - margin - 180;
      const legendY = margin + 40;
      
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(legendX, legendY, 35, 5);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText('Training', legendX + 45, legendY + 6);
      
      ctx.fillStyle = '#10b981';
      ctx.fillRect(legendX, legendY + 35, 35, 5);
      ctx.fillStyle = '#000000';
      ctx.fillText('Validation', legendX + 45, legendY + 41);
      
      // Convert canvas to PDF using jsPDF
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const imgData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [width, height] });
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save(`${filename}.pdf`);
      }, 'image/png', 1.0);
      
    } catch (err) {
      console.error('Failed to download graph:', err);
      toast.error('Export Failed', 'Failed to download graph');
    }
  };

  const handleAddLabel = () => {
    const trimmed = newLabel.trim();
    if (trimmed && !availableLabels.includes(trimmed)) { 
      setAvailableLabels([...availableLabels, trimmed]); 
      setNewLabel(''); 
      // Persist to dataset label overrides if a dataset is selected
      if (selectedDataset) {
        setDatasetLabelOverrides(prev => ({
          ...prev,
          [selectedDataset.id]: [...(prev[selectedDataset.id] || availableLabels), trimmed]
        }));
      }
      toast.success('Label Added', `"${trimmed}" is now available for tagging files`);
    }
  };

  const toggleFileSelection = (fileId: number, label: string) => {
    const newSelected = new Map(selectedFiles);
    if (newSelected.has(fileId)) newSelected.delete(fileId); else newSelected.set(fileId, label);
    setSelectedFiles(newSelected);
  };

  // Training Job Group handlers
  const handleCreateJobGroup = (group: TrainingJobGroup) => {
    setJobGroups(prev => [...prev, group]);
    toast.success('Group Created', `Training group "${group.name}" created with ${group.jobs.length} jobs`);
  };

  const handleUpdateJobGroup = (updatedGroup: TrainingJobGroup) => {
    setJobGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
  };

  const handleDeleteJobGroup = (groupId: string) => {
    const group = jobGroups.find(g => g.id === groupId);
    if (group?.status === 'running') {
      toast.error('Cannot Delete', 'Stop the running group before deleting');
      return;
    }
    setJobGroups(prev => prev.filter(g => g.id !== groupId));
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
    toast.success('Group Deleted', 'Training group deleted');
  };

  const handleStartJobGroup = async (groupId: string) => {
    const group = jobGroups.find(g => g.id === groupId);
    if (!group || group.jobs.length === 0) {
      toast.error('Cannot Start', 'Add jobs to the group first');
      return;
    }

    // Update group status to running
    setJobGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, status: 'running', started_at: new Date().toISOString() } : g
    ));

    toast.success('Group Started', `Starting ${group.jobs.length} training jobs in ${group.execution_mode} mode`);

    // Start jobs based on execution mode
    if (group.execution_mode === 'parallel') {
      // Start all jobs simultaneously
      const updatedJobs = group.jobs.map(job => ({ ...job, status: 'running' as const, progress: 0 }));
      setJobGroups(prev => prev.map(g => 
        g.id === groupId ? { ...g, jobs: updatedJobs } : g
      ));
      // TODO: Actually trigger backend training for each job
    } else {
      // Sequential: start first job, queue others
      const updatedJobs = group.jobs.map((job, idx) => ({
        ...job,
        status: idx === 0 ? 'running' as const : 'queued' as const,
        progress: 0,
      }));
      setJobGroups(prev => prev.map(g => 
        g.id === groupId ? { ...g, jobs: updatedJobs } : g
      ));
      // TODO: Actually trigger backend training for first job
    }
  };

  const handlePauseJobGroup = (groupId: string) => {
    setJobGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, status: 'paused' } : g
    ));
    toast.info('Group Paused', 'Training group paused');
  };

  const handleCancelJobGroup = (groupId: string) => {
    setJobGroups(prev => prev.map(g => 
      g.id === groupId ? { 
        ...g, 
        status: 'draft',
        jobs: g.jobs.map(j => ({ ...j, status: 'pending' as const, progress: 0 }))
      } : g
    ));
    toast.info('Group Cancelled', 'Training group cancelled');
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const activeJobsCount = trainingJobs.filter(j => ['pending', 'running'].includes(j.status)).length;
  const activeGroupsCount = jobGroups.filter(g => g.status === 'running').length;

  if (loading && datasets.length === 0) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Model Training</h1>
        <p className="text-slate-400">Train ML models using your collected data</p>
      </div>

      {/* Training Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button onClick={() => setSelectedMode('cloud')} className={`p-6 rounded-xl border-2 transition-all text-left ${selectedMode === 'cloud' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
          <Cloud className={`w-8 h-8 mb-3 ${selectedMode === 'cloud' ? 'text-indigo-400' : 'text-slate-400'}`} />
          <h3 className="text-lg font-semibold text-white mb-1">Cloud Training</h3>
          <p className="text-sm text-slate-400">Train models on cloud infrastructure with labeled datasets</p>
        </button>
        <button onClick={() => setSelectedMode('on-device')} className={`p-6 rounded-xl border-2 transition-all text-left ${selectedMode === 'on-device' ? 'border-green-500 bg-green-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
          <Smartphone className={`w-8 h-8 mb-3 ${selectedMode === 'on-device' ? 'text-green-400' : 'text-slate-400'}`} />
          <h3 className="text-lg font-semibold text-white mb-1">On-Device Training</h3>
          <p className="text-sm text-slate-400">Train directly on Thoth devices (requires online device)</p>
          <span className="inline-block mt-2 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">Coming Soon</span>
        </button>
        <button onClick={() => setSelectedMode('federated')} className={`p-6 rounded-xl border-2 transition-all text-left ${selectedMode === 'federated' ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
          <Network className={`w-8 h-8 mb-3 ${selectedMode === 'federated' ? 'text-purple-400' : 'text-slate-400'}`} />
          <h3 className="text-lg font-semibold text-white mb-1">Federated Learning</h3>
          <p className="text-sm text-slate-400">Privacy-preserving training using Flower framework</p>
          <span className="inline-block mt-2 px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">Flower FL</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center justify-between">
          <span className="text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300"><X className="w-5 h-5" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"><p className="text-slate-400 text-sm mb-1">Datasets</p><p className="text-2xl font-bold text-white">{datasets.length}</p></div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"><p className="text-slate-400 text-sm mb-1">Active Jobs</p><p className="text-2xl font-bold text-blue-400">{activeJobsCount}</p></div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"><p className="text-slate-400 text-sm mb-1">Trained Models</p><p className="text-2xl font-bold text-green-400">{trainedModels.length}</p></div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"><p className="text-slate-400 text-sm mb-1">Best Accuracy</p><p className="text-2xl font-bold text-purple-400">{trainedModels.length > 0 && trainedModels.some(m => m.accuracy) ? `${(Math.max(...trainedModels.filter(m => m.accuracy).map(m => m.accuracy || 0)) * 100).toFixed(1)}%` : 'N/A'}</p></div>
      </div>

      {selectedMode === 'federated' && (
        <FederatedLearningDashboard />
      )}

      {selectedMode === 'cloud' && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-slate-700">
            <button onClick={() => setActiveTab('datasets')} className={`px-4 py-2 font-medium transition-colors ${activeTab === 'datasets' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}><Database className="w-4 h-4 inline mr-2" />Datasets</button>
            <button onClick={() => setActiveTab('groups')} className={`px-4 py-2 font-medium transition-colors ${activeTab === 'groups' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}><Layers className="w-4 h-4 inline mr-2" />Job Groups{jobGroups.length > 0 && <span className="ml-2 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full">{jobGroups.length}</span>}</button>
            <button onClick={() => setActiveTab('jobs')} className={`px-4 py-2 font-medium transition-colors ${activeTab === 'jobs' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}><BarChart3 className="w-4 h-4 inline mr-2" />Training Jobs{activeJobsCount > 0 && <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">{activeJobsCount}</span>}</button>
            <button onClick={() => setActiveTab('models')} className={`px-4 py-2 font-medium transition-colors ${activeTab === 'models' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}><Brain className="w-4 h-4 inline mr-2" />Trained Models</button>
            <button onClick={() => setActiveTab('compare')} className={`px-4 py-2 font-medium transition-colors ${activeTab === 'compare' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}><GitCompare className="w-4 h-4 inline mr-2" />Compare{compareModels.length > 0 && <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">{compareModels.length}</span>}</button>
          </div>

          {/* Datasets Tab */}
          {activeTab === 'datasets' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Datasets</h2>
                  <button onClick={() => setShowCreateDataset(true)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"><Plus className="w-4 h-4" /> New</button>
                </div>
                <div className="space-y-2">
                  {loadingStates.datasets ? (
                    <div className="text-center py-8 bg-slate-800/50 rounded-xl border border-slate-700">
                      <Loader2 className="w-12 h-12 text-indigo-400 mx-auto mb-3 animate-spin" />
                      <p className="text-slate-400">Loading datasets...</p>
                    </div>
                  ) : datasets.length === 0 ? (
                    <div className="text-center py-8 bg-slate-800/50 rounded-xl border border-slate-700">
                      <Database className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                      <p className="text-slate-400">No datasets yet</p>
                      <button onClick={() => setShowCreateDataset(true)} className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm">Create your first dataset</button>
                    </div>
                  ) : datasets.map(dataset => (
                    <button key={dataset.id} onClick={() => handleSelectDataset(dataset)} className={`w-full p-4 rounded-xl border text-left transition-all ${selectedDataset?.id === dataset.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
                      <div className="flex items-center justify-between mb-2"><h3 className="font-medium text-white">{dataset.name}</h3><ChevronRight className="w-4 h-4 text-slate-400" /></div>
                      <div className="flex items-center gap-3 text-sm text-slate-400"><span className="flex items-center gap-1"><FileText className="w-3 h-3" />{dataset.file_count} files</span><span className="flex items-center gap-1"><Tag className="w-3 h-3" />{dataset.labels?.length || 0} labels</span></div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2">
                {loadingStates.datasetDetail ? (
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
                    <Loader2 className="w-16 h-16 text-indigo-400 mx-auto mb-4 animate-spin" />
                    <h3 className="text-xl font-medium text-white mb-2">Loading Dataset</h3>
                    <p className="text-slate-400">Fetching dataset details...</p>
                  </div>
                ) : selectedDataset ? (
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-semibold text-white">{selectedDataset.name}</h2>
                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded-full border border-indigo-500/30">Current Dataset</span>
                        </div>
                        {selectedDataset.description && <p className="text-slate-400 text-sm mt-1">{selectedDataset.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowAddFiles(true)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"><Plus className="w-4 h-4" /> Add Files</button>
                        <button onClick={() => handleOpenTrainingConfig()} disabled={!selectedDataset.files || selectedDataset.files.length < 2} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm"><Play className="w-4 h-4" /> Train</button>
                        <button onClick={() => handleDeleteDataset(selectedDataset.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {/* Labels Section - Always show with add capability */}
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-slate-300 mb-3">Labels</h3>
                      <div className="flex flex-wrap gap-2 items-center">
                        {(availableLabels || []).map((label) => {
                          const count = selectedDataset.label_distribution?.[label] || 0;
                          return (
                            <span key={label} className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${count > 0 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700/50 text-slate-400 border border-dashed border-slate-600'}`}>
                              {label}{count > 0 && `: ${count}`}
                            </span>
                          );
                        })}
                        {/* Add new label inline */}
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddLabel(); }}
                            placeholder="New label..."
                            className="w-24 px-2 py-1 bg-slate-800 border border-slate-600 rounded-full text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            onClick={handleAddLabel}
                            disabled={!newLabel.trim() || availableLabels.includes(newLabel.trim())}
                            className="p-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-full transition-colors"
                            title="Add label"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {availableLabels.length === 0 && (
                        <p className="text-slate-500 text-xs mt-2">Add labels to categorize your data files</p>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-300 mb-3">Files ({selectedDataset.files?.length || 0})</h3>
                      {!selectedDataset.files || selectedDataset.files.length === 0 ? (
                        <div className="text-center py-8 bg-slate-900/50 rounded-lg border border-slate-700"><FileText className="w-10 h-10 text-slate-500 mx-auto mb-2" /><p className="text-slate-400 text-sm">No files in this dataset</p><button onClick={() => setShowAddFiles(true)} className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm">Add files from cloud storage</button></div>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {(() => {
                            // Group files by filename
                            const groupedFiles: Record<string, DatasetFile[]> = selectedDataset.files.reduce((acc, file: DatasetFile) => {
                              if (!acc[file.filename]) acc[file.filename] = [];
                              acc[file.filename].push(file);
                              return acc;
                            }, {} as Record<string, DatasetFile[]>);
                            
                            return Object.entries(groupedFiles).map(([filename, files]: [string, DatasetFile[]]) => (
                              <div key={filename} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-slate-400" />
                                    <div>
                                      <p className="text-white text-sm font-medium">{filename}</p>
                                      <p className="text-slate-500 text-xs">
                                        {files.length > 0 && files[0]?.size ? `${(files[0].size / 1024).toFixed(1)} KB` : ''}
                                        {files.length > 1 && <span className="ml-2 text-indigo-400">({files.length} entries with different labels)</span>}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  {files.map((file: DatasetFile) => (
                                    <div key={file.id} className="flex items-center justify-between pl-8">
                                      <span className="text-slate-400 text-xs">Label:</span>
                                      <div className="flex items-center gap-2">
                                        <select value={file.label} onChange={(e) => handleUpdateLabel(file.file_id, e.target.value)} className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white">
                                          {(availableLabels || []).map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                        <button onClick={() => handleRemoveFile(file.file_id)} className="p-1 text-red-400 hover:text-red-300">
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center"><Database className="w-16 h-16 text-slate-500 mx-auto mb-4" /><h3 className="text-xl font-medium text-white mb-2">Select a Dataset</h3><p className="text-slate-400">Choose a dataset from the list to view and manage its files</p></div>
                )}
              </div>
            </div>
          )}

          {/* Job Groups Tab */}
          {activeTab === 'groups' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    Training Job Groups
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Create groups of ML/DL models to train and compare in parallel or sequentially
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCreateGroupType('central'); setShowCreateGroupModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New ML/DL Group
                  </button>
                </div>
              </div>

              {/* Groups List */}
              {jobGroups.length === 0 ? (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
                  <Layers className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Training Groups</h3>
                  <p className="text-slate-400 mb-4">
                    Create a job group to train multiple models and compare their performance
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => { setCreateGroupType('central'); setShowCreateGroupModal(true); }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                    >
                      <Plus className="w-4 h-4" />
                      Create ML/DL Group
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobGroups.map(group => (
                    <TrainingJobGroupCard
                      key={group.id}
                      group={group}
                      onUpdate={handleUpdateJobGroup}
                      onDelete={handleDeleteJobGroup}
                      onStartGroup={handleStartJobGroup}
                      onPauseGroup={handlePauseJobGroup}
                      onCancelGroup={handleCancelJobGroup}
                      isExpanded={expandedGroups.has(group.id)}
                      onToggleExpand={() => toggleGroupExpand(group.id)}
                    />
                  ))}
                </div>
              )}

              {/* Comparison Section */}
              {jobGroups.some(g => g.jobs.some(j => j.status === 'completed')) && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-purple-400" />
                    Group Comparison
                  </h3>
                  <JobGroupComparisonPlots groups={jobGroups} />
                </div>
              )}
            </div>
          )}

          {/* Jobs Tab */}
          {activeTab === 'jobs' && (
            <div className="space-y-4">
              {loadingStates.jobs ? (
                <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
                  <Loader2 className="w-16 h-16 text-indigo-400 mx-auto mb-4 animate-spin" />
                  <h3 className="text-xl font-medium text-white mb-2">Loading Training Jobs</h3>
                  <p className="text-slate-400">Fetching training jobs...</p>
                </div>
              ) : trainingJobs.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700"><BarChart3 className="w-16 h-16 text-slate-500 mx-auto mb-4" /><h3 className="text-xl font-medium text-white mb-2">No Training Jobs</h3><p className="text-slate-400">Start a training job from a dataset</p></div>
              ) : trainingJobs.map(job => {
                const prog = job.total_epochs > 0 ? (job.current_epoch / job.total_epochs) * 100 : 0;
                const isExpanded = expandedJobs.has(job.job_id);
                const isML = ['knn', 'svc', 'adaboost', 'xgboost'].includes(job.model_type);
                const config = typeof job.config === 'string' ? JSON.parse(job.config || '{}') : (job.config || {});
                const currentStage = config.current_stage || (job.status === 'completed' ? 'completed' : job.status === 'pending' ? 'pending' : job.status === 'failed' ? 'failed' : 'running');
                const filesLoaded = config.files_loaded || 0;
                const totalFiles = config.total_files || 0;
                const currentFile = config.current_file || '';
                const windowSize = config.window_size || 1000;
                const dataType = config.data_type || 'auto';
                const outputShape = config.output_shape || 'flattened';
                
                // Calculate overall progress for ML models based on stage
                const stageWeights: Record<string, number> = { 
                  pending: 0, 
                  loading_data: 0.3, 
                  preprocessing: 0.5,
                  initializing: 0.6, 
                  fitting: 0.85, 
                  computing_metrics: 0.95, 
                  completed: 1,
                  failed: 0
                };
                const baseProgress = stageWeights[currentStage] ?? 0.1;
                const fileProgress = currentStage === 'loading_data' && totalFiles > 0 ? (filesLoaded / totalFiles) * 0.3 : 0;
                const mlProgress = job.status === 'completed' ? 100 : job.status === 'pending' ? 0 : job.status === 'failed' ? 0 : Math.round((currentStage === 'loading_data' ? fileProgress : baseProgress) * 100);
                const displayProgress = isML ? mlProgress : prog;
                
                // Stage labels for display
                const stageLabels: Record<string, string> = {
                  pending: 'Queued - Waiting to start',
                  loading_data: totalFiles > 0 ? `Loading data (${filesLoaded}/${totalFiles} files)` : 'Loading dataset files...',
                  preprocessing: 'Preprocessing data...',
                  initializing: 'Initializing model...',
                  fitting: 'Training model...',
                  computing_metrics: 'Computing final metrics...',
                  completed: 'Training complete',
                  failed: 'Training failed',
                  running: 'Processing...'
                };
                
                // Build comprehensive terminal logs
                const terminalLogs: { time: string; level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'SUCCESS'; message: string }[] = [];
                const now = new Date();
                const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour12: false });
                
                // Job creation
                if (job.created_at) {
                  terminalLogs.push({ time: formatTime(new Date(job.created_at)), level: 'INFO', message: `Job created: ${job.job_id.slice(0, 8)}...` });
                }
                
                // Configuration info
                terminalLogs.push({ time: formatTime(now), level: 'DEBUG', message: `Model: ${job.model_type.toUpperCase()} | Mode: ${job.training_mode}` });
                terminalLogs.push({ time: formatTime(now), level: 'DEBUG', message: `Data type: ${dataType} | Window: ${windowSize} | Shape: ${outputShape}` });
                if (totalFiles > 0) {
                  terminalLogs.push({ time: formatTime(now), level: 'DEBUG', message: `Dataset: ${totalFiles} file(s) to process` });
                }
                
                // Job started
                if (job.started_at) {
                  terminalLogs.push({ time: formatTime(new Date(job.started_at)), level: 'INFO', message: 'Training job started' });
                }
                
                // Stage-specific logs
                if (currentStage === 'loading_data') {
                  if (currentFile) {
                    terminalLogs.push({ time: formatTime(now), level: 'DEBUG', message: `Loading: ${currentFile}` });
                  }
                  if (filesLoaded > 0) {
                    terminalLogs.push({ time: formatTime(now), level: 'INFO', message: `Progress: ${filesLoaded}/${totalFiles} files loaded` });
                  }
                }
                
                if (currentStage === 'preprocessing') {
                  terminalLogs.push({ time: formatTime(now), level: 'INFO', message: 'Applying preprocessing pipeline...' });
                }
                
                if (currentStage === 'initializing') {
                  terminalLogs.push({ time: formatTime(now), level: 'INFO', message: `Initializing ${job.model_type.toUpperCase()} classifier...` });
                }
                
                if (currentStage === 'fitting') {
                  terminalLogs.push({ time: formatTime(now), level: 'INFO', message: 'Model training in progress...' });
                  if (!isML && job.current_epoch > 0) {
                    terminalLogs.push({ time: formatTime(now), level: 'DEBUG', message: `Epoch ${job.current_epoch}/${job.total_epochs}` });
                  }
                }
                
                if (currentStage === 'computing_metrics') {
                  terminalLogs.push({ time: formatTime(now), level: 'INFO', message: 'Computing evaluation metrics...' });
                }
                
                // Metrics if available
                if (job.metrics?.accuracy?.length) {
                  const lastAcc = job.metrics.accuracy[job.metrics.accuracy.length - 1];
                  terminalLogs.push({ time: formatTime(now), level: 'DEBUG', message: `Current accuracy: ${(lastAcc * 100).toFixed(2)}%` });
                }
                
                // Completion
                if (job.status === 'completed') {
                  if (job.completed_at) {
                    terminalLogs.push({ time: formatTime(new Date(job.completed_at)), level: 'SUCCESS', message: 'Training completed successfully' });
                  }
                  if (job.best_metrics?.val_accuracy) {
                    terminalLogs.push({ time: formatTime(now), level: 'SUCCESS', message: `Final validation accuracy: ${(job.best_metrics.val_accuracy * 100).toFixed(2)}%` });
                  }
                }
                
                // Error
                if (job.status === 'failed') {
                  terminalLogs.push({ time: formatTime(now), level: 'ERROR', message: job.error_message || 'Training failed with unknown error' });
                }
                
                // Status color classes
                const statusColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
                  pending: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: '' },
                  running: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]' },
                  completed: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: '' },
                  failed: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', glow: '' },
                  cancelled: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', glow: '' },
                };
                const statusStyle = statusColors[job.status] || statusColors.pending;
                
                return (
                  <div key={job.job_id} className={`rounded-xl border overflow-hidden transition-all duration-300 ${statusStyle.bg} ${statusStyle.border} ${statusStyle.glow}`}>
                    {/* Header */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${job.status === 'running' ? 'bg-blue-500/20 ring-2 ring-blue-500/40' : job.status === 'completed' ? 'bg-emerald-500/20' : job.status === 'failed' ? 'bg-red-500/20' : 'bg-slate-700/50'}`}>
                          {job.status === 'running' ? <Loader2 className="w-6 h-6 text-blue-400 animate-spin" /> : 
                           job.status === 'completed' ? <CheckCircle className="w-6 h-6 text-emerald-400" /> :
                           job.status === 'failed' ? <AlertCircle className="w-6 h-6 text-red-400" /> :
                           job.status === 'cancelled' ? <XCircle className="w-6 h-6 text-slate-400" /> :
                           <Clock className="w-6 h-6 text-amber-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-semibold text-lg">{job.dataset_name || 'Training Job'}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                              {job.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-slate-400 text-sm font-mono bg-slate-800/50 px-2 py-0.5 rounded">{job.model_type.toUpperCase()}</span>
                            <span className="text-slate-500 text-xs">{job.started_at ? new Date(job.started_at).toLocaleString() : 'Queued'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {job.status === 'completed' && (
                          <button onClick={() => setSelectedJob(job)} className="p-2.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors" title="View Details">
                            <TrendingUp className="w-5 h-5" />
                          </button>
                        )}
                        {['pending', 'running'].includes(job.status) && (
                          <button onClick={() => handleCancelJob(job.job_id)} disabled={operations.cancellingJob} className="p-2.5 text-orange-400 hover:bg-orange-500/20 rounded-lg transition-colors" title="Cancel">
                            <XCircle className="w-5 h-5" />
                          </button>
                        )}
                        <button onClick={() => handleDeleteJob(job.job_id)} className="p-2.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setExpandedJobs(prev => {
                            const next = new Set(prev);
                            if (next.has(job.job_id)) next.delete(job.job_id);
                            else next.add(job.job_id);
                            return next;
                          })}
                          className="p-2.5 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-colors ml-1"
                          title={isExpanded ? 'Collapse' : 'Expand Debug Console'}
                        >
                          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Professional Progress Bar */}
                    <div className="px-4 pb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${statusStyle.text}`}>
                            {stageLabels[currentStage] || 'Processing...'}
                          </span>
                          {job.status === 'running' && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                            </span>
                          )}
                        </div>
                        <span className={`font-mono font-bold ${statusStyle.text}`}>{displayProgress.toFixed(0)}%</span>
                      </div>
                      {/* Multi-layer progress bar */}
                      <div className="relative w-full h-3 bg-slate-900/80 rounded-full overflow-hidden border border-slate-700/50">
                        {/* Background glow for running */}
                        {job.status === 'running' && (
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-blue-400/10 to-transparent animate-pulse"></div>
                        )}
                        {/* Progress fill */}
                        <div 
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                            job.status === 'completed' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 
                            job.status === 'failed' ? 'bg-gradient-to-r from-red-600 to-red-400' : 
                            job.status === 'running' ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400' : 
                            'bg-gradient-to-r from-amber-600 to-amber-400'
                          }`}
                          style={{ width: `${displayProgress}%` }}
                        >
                          {/* Shimmer effect for running */}
                          {job.status === 'running' && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                          )}
                        </div>
                        {/* Stage markers */}
                        <div className="absolute inset-0 flex items-center justify-between px-1">
                          {[25, 50, 75].map((mark) => (
                            <div key={mark} className="w-px h-1.5 bg-slate-600/50" style={{ marginLeft: `${mark}%` }}></div>
                          ))}
                        </div>
                      </div>
                      {/* Stage indicators */}
                      {isML && (
                        <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                          <span className={currentStage === 'loading_data' ? 'text-blue-400' : displayProgress >= 30 ? 'text-slate-400' : ''}>Load</span>
                          <span className={currentStage === 'preprocessing' ? 'text-blue-400' : displayProgress >= 50 ? 'text-slate-400' : ''}>Preprocess</span>
                          <span className={currentStage === 'fitting' ? 'text-blue-400' : displayProgress >= 85 ? 'text-slate-400' : ''}>Train</span>
                          <span className={currentStage === 'completed' ? 'text-emerald-400' : ''}>Done</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Expanded Debug Console */}
                    {isExpanded && (
                      <div className="border-t border-slate-700/50">
                        {/* Quick Stats Row */}
                        <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Model</p>
                            <p className="text-white font-mono font-semibold">{job.model_type.toUpperCase()}</p>
                          </div>
                          <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Data Type</p>
                            <p className="text-cyan-400 font-mono font-semibold">{dataType.toUpperCase()}</p>
                          </div>
                          <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Window</p>
                            <p className="text-purple-400 font-mono font-semibold">{windowSize}</p>
                          </div>
                          <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Val Accuracy</p>
                            <p className="text-emerald-400 font-mono font-semibold">{job.best_metrics?.val_accuracy ? `${(job.best_metrics.val_accuracy * 100).toFixed(1)}%` : '—'}</p>
                          </div>
                          <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">{isML ? 'Stage' : 'Epoch'}</p>
                            <p className="text-blue-400 font-mono font-semibold">{isML ? currentStage : `${job.current_epoch}/${job.total_epochs}`}</p>
                          </div>
                        </div>
                        
                        {/* Terminal-style Debug Console */}
                        <div className="p-4 pt-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                              </div>
                              <span className="text-slate-500 text-xs font-mono ml-2">training-console — {job.job_id.slice(0, 8)}</span>
                            </div>
                            <span className="text-slate-600 text-[10px] font-mono">{terminalLogs.length} entries</span>
                          </div>
                          <div className="bg-[#0d1117] rounded-lg border border-slate-800 overflow-hidden">
                            <div className="p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                              {terminalLogs.map((log, i) => (
                                <div key={i} className="flex items-start gap-2 hover:bg-slate-800/30 px-1 -mx-1 rounded">
                                  <span className="text-slate-600 select-none shrink-0">{log.time}</span>
                                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                                    log.level === 'WARN' ? 'bg-yellow-500/20 text-yellow-400' :
                                    log.level === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' :
                                    log.level === 'DEBUG' ? 'bg-slate-500/20 text-slate-400' :
                                    'bg-blue-500/20 text-blue-400'
                                  }`}>{log.level}</span>
                                  <span className={`${
                                    log.level === 'ERROR' ? 'text-red-300' :
                                    log.level === 'SUCCESS' ? 'text-emerald-300' :
                                    'text-slate-300'
                                  }`}>{log.message}</span>
                                </div>
                              ))}
                              {job.status === 'running' && (
                                <div className="flex items-center gap-2 text-slate-500 pt-2">
                                  <span className="animate-pulse">▋</span>
                                  <span>Waiting for updates...</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Metrics Grid (if completed) */}
                        {job.status === 'completed' && job.best_metrics && (
                          <div className="p-4 pt-0">
                            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">Final Metrics</p>
                            <div className="grid grid-cols-4 gap-2">
                              <div className="bg-slate-900/60 rounded-lg p-2.5 text-center border border-slate-700/50">
                                <p className="text-slate-500 text-[10px] uppercase">Loss</p>
                                <p className="text-white font-mono font-semibold text-sm">{job.metrics?.loss?.length ? job.metrics.loss[job.metrics.loss.length - 1]?.toFixed(4) : '—'}</p>
                              </div>
                              <div className="bg-slate-900/60 rounded-lg p-2.5 text-center border border-slate-700/50">
                                <p className="text-slate-500 text-[10px] uppercase">Train Acc</p>
                                <p className="text-white font-mono font-semibold text-sm">{job.metrics?.accuracy?.length ? `${(job.metrics.accuracy[job.metrics.accuracy.length - 1] * 100).toFixed(1)}%` : '—'}</p>
                              </div>
                              <div className="bg-slate-900/60 rounded-lg p-2.5 text-center border border-emerald-500/30">
                                <p className="text-emerald-500 text-[10px] uppercase">Val Acc</p>
                                <p className="text-emerald-400 font-mono font-bold text-sm">{job.best_metrics?.val_accuracy ? `${(job.best_metrics.val_accuracy * 100).toFixed(1)}%` : '—'}</p>
                              </div>
                              <div className="bg-slate-900/60 rounded-lg p-2.5 text-center border border-slate-700/50">
                                <p className="text-slate-500 text-[10px] uppercase">Best Epoch</p>
                                <p className="text-white font-mono font-semibold text-sm">{job.best_metrics?.best_epoch || '—'}</p>
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

          {/* Models Tab */}
          {activeTab === 'models' && (
            <div>
              {loadingStates.models ? (
                <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
                  <Loader2 className="w-16 h-16 text-indigo-400 mx-auto mb-4 animate-spin" />
                  <h3 className="text-xl font-medium text-white mb-2">Loading Trained Models</h3>
                  <p className="text-slate-400">Fetching your models...</p>
                </div>
              ) : trainedModels.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700"><Brain className="w-16 h-16 text-slate-500 mx-auto mb-4" /><h3 className="text-xl font-medium text-white mb-2">No Trained Models</h3><p className="text-slate-400">Complete a training job to see models here</p></div>
              ) : (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-900/50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Select</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Model</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Architecture</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Accuracy</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Size</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Created</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-700">
                      {trainedModels.map(m => (
                        <tr key={m.id} className="hover:bg-slate-700/30">
                          <td className="px-6 py-4"><input type="checkbox" checked={compareModels.includes(m.id)} onChange={(e) => {if (e.target.checked) setCompareModels([...compareModels, m.id]); else setCompareModels(compareModels.filter(id => id !== m.id));}} className="w-4 h-4" /></td>
                          <td className="px-6 py-4"><span className="text-white font-medium">{m.name}</span></td>
                          <td className="px-6 py-4"><span className="text-slate-300 uppercase">{m.architecture}</span></td>
                          <td className="px-6 py-4"><span className="text-green-400 font-medium">{m.accuracy !== null ? `${m.accuracy.toFixed(2)}%` : 'N/A'}</span></td>
                          <td className="px-6 py-4"><span className="text-slate-300">{m.size_mb !== null ? `${m.size_mb.toFixed(1)} MB` : 'N/A'}</span></td>
                          <td className="px-6 py-4"><span className="text-slate-400 text-sm">{new Date(m.created_at).toLocaleDateString()}</span></td>
                          <td className="px-6 py-4"><div className="flex gap-2">
                            <button 
                              onClick={() => handleDownloadModel(m.id, m.name)} 
                              disabled={operations.downloadingModel === m.id}
                              className="flex items-center gap-1 px-2 py-1 text-purple-400 hover:bg-purple-500/10 disabled:text-purple-600 disabled:hover:bg-purple-500/5 rounded text-sm"
                            >
                              {operations.downloadingModel === m.id ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</>
                              ) : (
                                <><Download className="w-4 h-4" /> Download</>
                              )}
                            </button>
                            <button 
                              onClick={() => { setRenamingModel(m); setNewModelName(m.name); }} 
                              disabled={operations.renamingModel === m.id}
                              className="flex items-center gap-1 px-2 py-1 text-blue-400 hover:bg-blue-500/10 disabled:text-blue-600 disabled:hover:bg-blue-500/5 rounded text-sm"
                            >
                              {operations.renamingModel === m.id ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Renaming...</>
                              ) : (
                                <><Edit2 className="w-4 h-4" /> Rename</>
                              )}
                            </button>
                            <button 
                              onClick={() => handleDeleteModel(m.id)} 
                              disabled={operations.deletingModel === m.id}
                              className="flex items-center gap-1 px-2 py-1 text-red-400 hover:bg-red-500/10 disabled:text-red-600 disabled:hover:bg-red-500/5 rounded text-sm"
                            >
                              {operations.deletingModel === m.id ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                              ) : (
                                <><Trash2 className="w-4 h-4" /> Delete</>
                              )}
                            </button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Compare Models Tab */}
          {activeTab === 'compare' && (
            <div>
              {compareModels.length < 2 ? (
                <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
                  <BarChart3 className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">Select Models to Compare</h3>
                  <p className="text-slate-400 mb-4">Go to the Trained Models tab and select at least 2 models</p>
                  <button onClick={() => setActiveTab('models')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Go to Models</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">Comparing {compareModels.length} Models</h2>
                    <button onClick={() => setCompareModels([])} className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm">Clear Selection</button>
                  </div>
                  
                  {/* Comparison Table */}
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-900/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Metric</th>
                          {compareModels.map(modelId => {
                            const model = trainedModels.find(m => m.id === modelId);
                            return <th key={modelId} className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">{model?.name || 'Unknown'}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        <tr><td className="px-6 py-4 text-slate-300 font-medium">Architecture</td>{compareModels.map(modelId => {const model = trainedModels.find(m => m.id === modelId); return <td key={modelId} className="px-6 py-4 text-white uppercase">{model?.architecture || 'N/A'}</td>;})}</tr>
                        <tr><td className="px-6 py-4 text-slate-300 font-medium">Accuracy</td>{compareModels.map(modelId => {const model = trainedModels.find(m => m.id === modelId); const isMax = model && model.accuracy === Math.max(...compareModels.map(id => trainedModels.find(m => m.id === id)?.accuracy || 0)); return <td key={modelId} className={`px-6 py-4 font-medium ${isMax ? 'text-green-400' : 'text-white'}`}>{model?.accuracy != null ? `${model.accuracy.toFixed(2)}%` : 'N/A'}</td>;})}</tr>
                        <tr><td className="px-6 py-4 text-slate-300 font-medium">Model Size</td>{compareModels.map(modelId => {const model = trainedModels.find(m => m.id === modelId); const isMin = model && model.size_mb === Math.min(...compareModels.map(id => trainedModels.find(m => m.id === id)?.size_mb || Infinity).filter(s => s !== Infinity)); return <td key={modelId} className={`px-6 py-4 ${isMin ? 'text-green-400 font-medium' : 'text-white'}`}>{model?.size_mb != null ? `${model.size_mb.toFixed(1)} MB` : 'N/A'}</td>;})}</tr>
                        <tr><td className="px-6 py-4 text-slate-300 font-medium">Created Date</td>{compareModels.map(modelId => {const model = trainedModels.find(m => m.id === modelId); return <td key={modelId} className="px-6 py-4 text-slate-400 text-sm">{model ? new Date(model.created_at).toLocaleDateString() : 'N/A'}</td>;})}</tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Visual Comparison Chart */}
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Accuracy Comparison</h3>
                    <div className="space-y-4">
                      {compareModels.map(modelId => {
                        const model = trainedModels.find(m => m.id === modelId);
                        const accuracy = model?.accuracy || 0;
                        return (
                          <div key={modelId}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-slate-300 text-sm">{model?.name || 'Unknown'}</span>
                              <span className="text-white font-medium">{accuracy.toFixed(2)}%</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-3">
                              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all" style={{width: `${accuracy}%`}}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Dataset Modal */}
      {showCreateDataset && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Create Dataset</h3>
            <div className="space-y-4">
              <div><label className="block text-sm text-slate-300 mb-1">Dataset Name</label><input type="text" value={newDatasetName} onChange={(e) => setNewDatasetName(e.target.value)} placeholder="e.g., Activity Recognition" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500" /></div>
              <div><label className="block text-sm text-slate-300 mb-1">Description</label><textarea value={newDatasetDesc} onChange={(e) => setNewDatasetDesc(e.target.value)} placeholder="Describe your dataset..." rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500" /></div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Labels</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDatasetLabel}
                    onChange={(e) => setNewDatasetLabel(e.target.value)}
                    placeholder="e.g., watch"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const lbl = newDatasetLabel.trim();
                      if (!lbl) return;
                      if (newDatasetLabels.includes(lbl)) return;
                      setNewDatasetLabels([...newDatasetLabels, lbl]);
                      setNewDatasetLabel('');
                    }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                  >
                    Add
                  </button>
                </div>
                {newDatasetLabels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {newDatasetLabels.map(l => (
                      <span key={l} className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm border border-indigo-500/30">
                        {l}
                        <button
                          type="button"
                          onClick={() => setNewDatasetLabels(newDatasetLabels.filter(x => x !== l))}
                          className="text-indigo-200 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreateDataset} disabled={!newDatasetName.trim() || operations.creatingDataset} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                {operations.creatingDataset ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                ) : (
                  'Create'
                )}
              </button>
              <button onClick={() => setShowCreateDataset(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Files Modal */}
      {showAddFiles && selectedDataset && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-2xl border border-slate-700 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Add Files to Dataset</h3>
              <button onClick={() => { setShowAddFiles(false); setSelectedFiles(new Map()); }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto mb-4">
              <label className="block text-sm text-slate-300 mb-2">Select Files & Assign Labels</label>
              {loadingStates.files ? (
                <div className="text-center py-8 bg-slate-800/50 rounded-xl border border-slate-700">
                  <Loader2 className="w-10 h-10 text-indigo-400 mx-auto mb-3 animate-spin" />
                  <p className="text-slate-400">Loading cloud files...</p>
                </div>
              ) : cloudFiles.length === 0 ? (
                <p className="text-slate-400 text-center py-4">No files in cloud storage</p>
              ) : (
                <div className="space-y-2">
                  {cloudFiles.map(file => (
                    <div key={file.file_id} className={`flex items-center justify-between p-3 rounded-lg border ${selectedFiles.has(file.file_id) ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                      <div className="flex items-center gap-3"><input type="checkbox" checked={selectedFiles.has(file.file_id)} onChange={() => toggleFileSelection(file.file_id, (availableLabels || [])[0] || '')} className="w-4 h-4" /><div><p className="text-white text-sm">{file.filename}</p><p className="text-slate-500 text-xs">{(file.size / 1024).toFixed(1)} KB</p></div></div>
                      {selectedFiles.has(file.file_id) && <select value={selectedFiles.get(file.file_id)} onChange={(e) => { const m = new Map(selectedFiles); m.set(file.file_id, e.target.value); setSelectedFiles(m); }} className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white">{(availableLabels || []).map(l => <option key={l} value={l}>{l}</option>)}</select>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleAddFilesToDataset} 
                disabled={selectedFiles.size === 0 || operations.addingFiles} 
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {operations.addingFiles ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}...
                  </>
                ) : (
                  `Add ${selectedFiles.size} file${selectedFiles.size !== 1 ? 's' : ''} to Dataset`
                )}
              </button>
              <button 
                onClick={() => { setShowAddFiles(false); setSelectedFiles(new Map()); }} 
                disabled={operations.addingFiles}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Training Config Modal */}
      {showTrainingConfig && selectedDataset && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-white mb-4">Configure Training</h3>
            <p className="text-slate-400 text-sm mb-4">Dataset: <span className="text-white">{selectedDataset.name}</span> ({selectedDataset.files?.length} files)</p>
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-2">
                {(['Preprocessing', 'Model', 'Optimization', 'Review'] as const).map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setTrainingWizardStep(idx as 0 | 1 | 2 | 3)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${trainingWizardStep === idx ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-800/40 text-slate-300 border-slate-700 hover:border-slate-600'}`}
                  >
                    {idx + 1}. {label}
                  </button>
                ))}
              </div>
            </div>

            {trainingWizardStep === 0 && (
              <div className="space-y-4">
                {/* File-to-Pipeline Assignment */}
                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-indigo-400">File → Pipeline → Split Assignment</h4>
                    {pipelinesLoading ? <span className="text-xs text-slate-500">Loading pipelines...</span> : 
                      <span className="text-xs text-slate-500">{preprocessingPipelines.length} saved pipeline(s)</span>
                    }
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    Assign a preprocessing pipeline and train/test split to each file.
                  </p>
                  <div className="p-2 bg-slate-900/50 rounded border border-slate-700 mb-4">
                    <p className="text-xs text-slate-400">
                      <span className="text-yellow-400 font-medium">Default (Auto-detect)</span>: Uses built-in preprocessing based on detected data type:
                    </p>
                    <ul className="text-xs text-slate-500 mt-1 ml-4 list-disc">
                      <li><span className="text-cyan-400">CSI</span>: Extract amplitude+phase → Filter subcarriers (5-32) → Window (1000 rows) → Flatten</li>
                      <li><span className="text-green-400">IMU</span>: Window (128 rows) → Flatten to feature vector</li>
                    </ul>
                    <p className="text-xs text-slate-500 mt-1">
                      For custom preprocessing, create a pipeline in the <span className="text-indigo-400">Processing</span> page.
                    </p>
                  </div>

                  {selectedDataset?.files && selectedDataset.files.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDataset.files.map((file: any) => {
                        const assignment = trainingConfig.file_assignments[file.file_id] || { pipeline_id: null, split: 'split' as const, split_ratio: 0.8 };
                        const lineCount = fileLineCounts[file.file_id];
                        const totalLines = lineCount?.data_lines || assignment.total_lines || 0;
                        const selectedLines = assignment.selected_lines ?? totalLines;
                        return (
                          <div key={file.file_id} className="p-3 rounded-lg border border-slate-700 bg-slate-900/30">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="text-sm text-white font-medium">{file.filename}</div>
                                <div className="text-xs text-slate-500">
                                  Label: <span className="text-indigo-300">{file.label}</span>
                                  {lineCount?.loading ? (
                                    <span className="ml-2 text-slate-400">· Loading lines...</span>
                                  ) : totalLines > 0 ? (
                                    <span className="ml-2 text-slate-400">· <span className="text-green-400">{selectedLines}</span>/{totalLines} lines</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              {/* Lines Selection */}
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">Lines to Use</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    max={totalLines || 1}
                                    value={selectedLines}
                                    onChange={(e) => {
                                      const newAssignments = { ...trainingConfig.file_assignments };
                                      const val = Math.max(1, Math.min(totalLines || 1, parseInt(e.target.value) || 1));
                                      newAssignments[file.file_id] = { ...assignment, selected_lines: val, total_lines: totalLines };
                                      setTrainingConfig({ ...trainingConfig, file_assignments: newAssignments });
                                    }}
                                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                                    disabled={lineCount?.loading || totalLines === 0}
                                  />
                                  <span className="text-xs text-slate-500 whitespace-nowrap">/ {totalLines}</span>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">Pipeline</label>
                                <select
                                  value={assignment.pipeline_id ?? ''}
                                  onChange={(e) => {
                                    const newAssignments = { ...trainingConfig.file_assignments };
                                    newAssignments[file.file_id] = { ...assignment, pipeline_id: e.target.value ? parseInt(e.target.value) : null };
                                    setTrainingConfig({ ...trainingConfig, file_assignments: newAssignments });
                                  }}
                                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                                >
                                  <option value="">Default (Auto-detect)</option>
                                  {preprocessingPipelines.length === 0 && !pipelinesLoading && (
                                    <option disabled>No saved pipelines - create in Processing page</option>
                                  )}
                                  {preprocessingPipelines.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.data_type}, {p.output_shape})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">Split</label>
                                <select
                                  value={assignment.split}
                                  onChange={(e) => {
                                    const newAssignments = { ...trainingConfig.file_assignments };
                                    newAssignments[file.file_id] = { ...assignment, split: e.target.value as 'train' | 'test' | 'split' };
                                    setTrainingConfig({ ...trainingConfig, file_assignments: newAssignments });
                                  }}
                                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                                >
                                  <option value="train">Train Only</option>
                                  <option value="test">Test Only</option>
                                  <option value="split">Train/Test Split</option>
                                </select>
                              </div>
                              {assignment.split === 'split' && (
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Train Ratio</label>
                                  <input
                                    type="number"
                                    min="0.1"
                                    max="0.9"
                                    step="0.1"
                                    value={assignment.split_ratio}
                                    onChange={(e) => {
                                      const newAssignments = { ...trainingConfig.file_assignments };
                                      newAssignments[file.file_id] = { ...assignment, split_ratio: parseFloat(e.target.value) || 0.8 };
                                      setTrainingConfig({ ...trainingConfig, file_assignments: newAssignments });
                                    }}
                                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No files in dataset. Add files to the dataset first.</div>
                  )}
                </div>

                {/* Train/Test Summary */}
                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h4 className="text-sm font-medium text-indigo-400 mb-3">Train/Test Summary</h4>
                  {(() => {
                    const files = selectedDataset?.files || [];
                    
                    // Calculate actual train/test data based on assignments
                    let trainOnlyFiles: any[] = [];
                    let testOnlyFiles: any[] = [];
                    let splitFiles: any[] = [];
                    
                    files.forEach((f: any) => {
                      const a = trainingConfig.file_assignments[f.file_id];
                      const lineInfo = fileLineCounts[f.file_id];
                      const totalLines = a?.total_lines || lineInfo?.data_lines || 0;
                      const selectedLines = a?.selected_lines ?? totalLines;
                      
                      if (!a || a.split === 'split') {
                        splitFiles.push({ ...f, ratio: a?.split_ratio || 0.8, totalLines, selectedLines });
                      } else if (a.split === 'train') {
                        trainOnlyFiles.push({ ...f, totalLines, selectedLines });
                      } else if (a.split === 'test') {
                        testOnlyFiles.push({ ...f, totalLines, selectedLines });
                      }
                    });
                    
                    // Calculate line counts
                    const trainOnlyLines = trainOnlyFiles.reduce((sum, f) => sum + (f.selectedLines || 0), 0);
                    const testOnlyLines = testOnlyFiles.reduce((sum, f) => sum + (f.selectedLines || 0), 0);
                    const splitTrainLines = splitFiles.reduce((sum, f) => sum + Math.floor((f.selectedLines || 0) * f.ratio), 0);
                    const splitTestLines = splitFiles.reduce((sum, f) => sum + Math.ceil((f.selectedLines || 0) * (1 - f.ratio)), 0);
                    
                    const totalTrainLines = trainOnlyLines + splitTrainLines;
                    const totalTestLines = testOnlyLines + splitTestLines;
                    const totalLines = totalTrainLines + totalTestLines;
                    
                    // Calculate sizes
                    const trainOnlySize = trainOnlyFiles.reduce((sum, f) => sum + (f.size || 0), 0);
                    const testOnlySize = testOnlyFiles.reduce((sum, f) => sum + (f.size || 0), 0);
                    const splitTrainSize = splitFiles.reduce((sum, f) => sum + ((f.size || 0) * f.ratio), 0);
                    const splitTestSize = splitFiles.reduce((sum, f) => sum + ((f.size || 0) * (1 - f.ratio)), 0);
                    
                    const totalTrainSize = trainOnlySize + splitTrainSize;
                    const totalTestSize = testOnlySize + splitTestSize;
                    
                    // Group by label for detailed breakdown
                    const trainLabelCounts: Record<string, { files: number; lines: number }> = {};
                    const testLabelCounts: Record<string, { files: number; lines: number }> = {};
                    
                    trainOnlyFiles.forEach((f: any) => {
                      if (!trainLabelCounts[f.label]) trainLabelCounts[f.label] = { files: 0, lines: 0 };
                      trainLabelCounts[f.label].files++;
                      trainLabelCounts[f.label].lines += f.selectedLines || 0;
                    });
                    splitFiles.forEach((f: any) => {
                      if (!trainLabelCounts[f.label]) trainLabelCounts[f.label] = { files: 0, lines: 0 };
                      trainLabelCounts[f.label].files++;
                      trainLabelCounts[f.label].lines += Math.floor((f.selectedLines || 0) * f.ratio);
                    });
                    
                    testOnlyFiles.forEach((f: any) => {
                      if (!testLabelCounts[f.label]) testLabelCounts[f.label] = { files: 0, lines: 0 };
                      testLabelCounts[f.label].files++;
                      testLabelCounts[f.label].lines += f.selectedLines || 0;
                    });
                    splitFiles.forEach((f: any) => {
                      if (!testLabelCounts[f.label]) testLabelCounts[f.label] = { files: 0, lines: 0 };
                      testLabelCounts[f.label].files++;
                      testLabelCounts[f.label].lines += Math.ceil((f.selectedLines || 0) * (1 - f.ratio));
                    });
                    
                    const formatSize = (bytes: number) => {
                      if (bytes === 0) return '0 B';
                      if (bytes < 1024) return `${bytes} B`;
                      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                    };
                    
                    const formatLines = (n: number) => n.toLocaleString();
                    
                    return (
                      <div className="space-y-4">
                        {/* Overall Stats */}
                        <div className="flex items-center gap-4 text-xs text-slate-400 pb-3 border-b border-slate-700">
                          <span>Total files: <span className="text-white font-medium">{files.length}</span></span>
                          <span>Total lines: <span className="text-white font-medium">{formatLines(totalLines)}</span></span>
                          <span>Train/Test ratio: <span className="text-white font-medium">{totalLines > 0 ? `${((totalTrainLines / totalLines) * 100).toFixed(0)}%` : '0%'} / {totalLines > 0 ? `${((totalTestLines / totalLines) * 100).toFixed(0)}%` : '0%'}</span></span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* Training Set */}
                          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <div className="text-sm font-medium text-green-400 mb-2">Training Set (First {totalLines > 0 ? `${((totalTrainLines / totalLines) * 100).toFixed(0)}%` : '0%'})</div>
                            <div className="text-xs text-slate-300 space-y-1">
                              <div className="flex justify-between">
                                <span>Total lines:</span>
                                <span className="text-white font-medium">{formatLines(totalTrainLines)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Train-only files:</span>
                                <span className="text-white font-medium">{trainOnlyFiles.length} ({formatLines(trainOnlyLines)} lines)</span>
                              </div>
                              <div className="flex justify-between">
                                <span>From split files:</span>
                                <span className="text-white font-medium">{splitFiles.length} ({formatLines(splitTrainLines)} lines)</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Est. size:</span>
                                <span className="text-white font-medium">{formatSize(totalTrainSize)}</span>
                              </div>
                              <div className="mt-2 pt-2 border-t border-green-500/20">
                                <div className="text-green-300 font-medium mb-1">Labels:</div>
                                {Object.entries(trainLabelCounts).map(([label, info]) => (
                                  <div key={label} className="flex justify-between text-slate-400">
                                    <span>{label}:</span>
                                    <span className="text-green-300">{info.files} files, {formatLines(info.lines)} lines</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {/* Test Set */}
                          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="text-sm font-medium text-blue-400 mb-2">Test Set (Last {totalLines > 0 ? `${((totalTestLines / totalLines) * 100).toFixed(0)}%` : '0%'})</div>
                            <div className="text-xs text-slate-300 space-y-1">
                              <div className="flex justify-between">
                                <span>Total lines:</span>
                                <span className="text-white font-medium">{formatLines(totalTestLines)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Test-only files:</span>
                                <span className="text-white font-medium">{testOnlyFiles.length} ({formatLines(testOnlyLines)} lines)</span>
                              </div>
                              <div className="flex justify-between">
                                <span>From split files:</span>
                                <span className="text-white font-medium">{splitFiles.length} ({formatLines(splitTestLines)} lines)</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Est. size:</span>
                                <span className="text-white font-medium">{formatSize(totalTestSize)}</span>
                              </div>
                              <div className="mt-2 pt-2 border-t border-blue-500/20">
                                <div className="text-blue-300 font-medium mb-1">Labels:</div>
                                {Object.entries(testLabelCounts).map(([label, info]) => (
                                  <div key={label} className="flex justify-between text-slate-400">
                                    <span>{label}:</span>
                                    <span className="text-blue-300">{info.files} files, {formatLines(info.lines)} lines</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Validation warnings and errors */}
                        {(() => {
                          const warnings: string[] = [];
                          const errors: string[] = [];
                          
                          // Check if we have at least 2 labels
                          const allLabelsArr = Array.from(new Set([...Object.keys(trainLabelCounts), ...Object.keys(testLabelCounts)]));
                          if (allLabelsArr.length < 2) {
                            errors.push(`Dataset needs at least 2 different labels for classification. Found: ${allLabelsArr.length}`);
                          }
                          
                          // Check if train and test have same labels
                          const trainLabelsArr = Object.keys(trainLabelCounts);
                          const testLabelsArr = Object.keys(testLabelCounts);
                          
                          const missingInTrain = allLabelsArr.filter(l => !trainLabelsArr.includes(l));
                          const missingInTest = allLabelsArr.filter(l => !testLabelsArr.includes(l));
                          
                          if (missingInTrain.length > 0) {
                            errors.push(`Training set is missing labels: ${missingInTrain.join(', ')}. All labels must be in training data.`);
                          }
                          if (missingInTest.length > 0) {
                            errors.push(`Test set is missing labels: ${missingInTest.join(', ')}. All labels must be in test data for proper evaluation.`);
                          }
                          
                          // Check for very low sample counts
                          Object.entries(trainLabelCounts).forEach(([label, info]) => {
                            if (info.lines < 100) {
                              warnings.push(`Label "${label}" has only ${info.lines} training lines. Consider adding more data for better results.`);
                            }
                          });
                          
                          // Check for imbalanced classes
                          const lineCounts = Object.values(trainLabelCounts).map(c => c.lines);
                          if (lineCounts.length >= 2) {
                            const maxLines = Math.max(...lineCounts);
                            const minLines = Math.min(...lineCounts);
                            if (maxLines > minLines * 5) {
                              warnings.push(`Class imbalance detected: largest class has ${maxLines} lines, smallest has ${minLines}. This may affect model performance.`);
                            }
                          }
                          
                          // Check total lines
                          if (totalLines < 100) {
                            warnings.push(`Total dataset has only ${totalLines} lines. Consider adding more data for better model performance.`);
                          }
                          
                          return (
                            <>
                              {errors.map((err, i) => (
                                <div key={`err-${i}`} className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
                                  ❌ Error: {err}
                                </div>
                              ))}
                              {warnings.map((warn, i) => (
                                <div key={`warn-${i}`} className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-300">
                                  ⚠️ Warning: {warn}
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {trainingWizardStep === 1 && (
              <div className="space-y-4">
                {/* Input/Output Shape Information from Preprocessing */}
                {preprocessingPreview && (
                  <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                    <h4 className="text-sm font-medium text-indigo-400 mb-3">Data Shape Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Data Type:</span>
                        <span className="ml-2 text-cyan-400 font-medium">{preprocessingPreview.data_type?.toUpperCase() || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Output Shape:</span>
                        <span className="ml-2 text-green-400 font-medium">{trainingConfig.output_shape}</span>
                      </div>
                      {preprocessingPreview.stages && preprocessingPreview.stages.length > 0 && (
                        <>
                          <div>
                            <span className="text-slate-400">Input Shape:</span>
                            <span className="ml-2 text-yellow-400 font-mono text-xs">
                              {preprocessingPreview.stages[0]?.shape ? `[${preprocessingPreview.stages[0].shape.join(', ')}]` : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Final Shape:</span>
                            <span className="ml-2 text-purple-400 font-mono text-xs">
                              {preprocessingPreview.stages[preprocessingPreview.stages.length - 1]?.shape 
                                ? `[${preprocessingPreview.stages[preprocessingPreview.stages.length - 1].shape?.join(', ')}]` 
                                : 'N/A'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    {preprocessingPreview.stages && preprocessingPreview.stages.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-500 mb-2">Preprocessing Pipeline Stages:</p>
                        <div className="flex flex-wrap gap-2">
                          {preprocessingPreview.stages.map((stage, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                                {stage.name}
                                {stage.shape && <span className="text-slate-500 ml-1">[{stage.shape.join('×')}]</span>}
                              </span>
                              {idx < preprocessingPreview.stages.length - 1 && <span className="text-slate-600">→</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-3">
                      {trainingConfig.output_shape === 'flattened' 
                        ? '✓ Flattened output is suitable for ML models (KNN, SVC, AdaBoost) and DL models'
                        : '✓ Sequence output is suitable for DL models (CNN-LSTM) that process temporal patterns'}
                    </p>
                  </div>
                )}
                
                {previewLoading && (
                  <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700 text-center">
                    <span className="text-slate-400 text-sm">Loading preprocessing preview...</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-slate-300 mb-1">Model Type</label>
                  <select 
                    value={trainingConfig.model_type} 
                    onChange={(e) => setTrainingConfig({ ...trainingConfig, model_type: e.target.value })} 
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  >
                    {getAvailableModels(selectedDataset).map(model => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {getAvailableModels(selectedDataset).find(m => m.value === trainingConfig.model_type)?.description}
                  </p>
                </div>

                {!['knn', 'svc', 'adaboost'].includes(trainingConfig.model_type) && (
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Model Architecture Size</label>
                    <select 
                      value={trainingConfig.model_architecture} 
                      onChange={(e) => setTrainingConfig({ ...trainingConfig, model_architecture: e.target.value })} 
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    >
                      <option value="small">Small (Fast, Lower Accuracy)</option>
                      <option value="medium">Medium (Balanced)</option>
                      <option value="large">Large (Slower, Higher Accuracy)</option>
                    </select>
                  </div>
                )}

                {/* DL-specific hyperparameters - hidden for ML models */}
                {!['knn', 'svc', 'adaboost', 'xgboost'].includes(trainingConfig.model_type) && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm text-slate-300 mb-1">Epochs</label><input type="number" value={trainingConfig.epochs} onChange={(e) => setTrainingConfig({ ...trainingConfig, epochs: parseInt(e.target.value) || 10 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" /></div>
                      <div><label className="block text-sm text-slate-300 mb-1">Batch Size</label><input type="number" value={trainingConfig.batch_size} onChange={(e) => setTrainingConfig({ ...trainingConfig, batch_size: parseInt(e.target.value) || 32 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" /></div>
                    </div>
                    <div><label className="block text-sm text-slate-300 mb-1">Learning Rate</label><input type="number" step="0.0001" value={trainingConfig.learning_rate} onChange={(e) => setTrainingConfig({ ...trainingConfig, learning_rate: parseFloat(e.target.value) || 0.001 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" /></div>
                  </>
                )}

                {(trainingConfig.model_type === 'knn' || trainingConfig.model_type === 'svc' || trainingConfig.model_type === 'adaboost' || trainingConfig.model_type === 'xgboost') && (
                  <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                    <h4 className="text-sm font-medium text-indigo-400 mb-3">ML Model Parameters</h4>
                    {trainingConfig.model_type === 'knn' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">n_neighbors</label>
                          <input type="number" min="1" value={trainingConfig.knn_params.n_neighbors} onChange={(e) => setTrainingConfig({ ...trainingConfig, knn_params: { ...trainingConfig.knn_params, n_neighbors: parseInt(e.target.value) || 1 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">weights</label>
                          <select value={trainingConfig.knn_params.weights} onChange={(e) => setTrainingConfig({ ...trainingConfig, knn_params: { ...trainingConfig.knn_params, weights: e.target.value as 'uniform' | 'distance' } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                            <option value="uniform">uniform</option>
                            <option value="distance">distance</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">metric</label>
                          <select value={trainingConfig.knn_params.metric} onChange={(e) => setTrainingConfig({ ...trainingConfig, knn_params: { ...trainingConfig.knn_params, metric: e.target.value as 'euclidean' | 'manhattan' | 'minkowski' | 'chebyshev' } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                            <option value="euclidean">euclidean</option>
                            <option value="manhattan">manhattan</option>
                            <option value="minkowski">minkowski</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">algorithm</label>
                          <select value={trainingConfig.knn_params.algorithm} onChange={(e) => setTrainingConfig({ ...trainingConfig, knn_params: { ...trainingConfig.knn_params, algorithm: e.target.value as 'auto' | 'ball_tree' | 'kd_tree' | 'brute' } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                            <option value="auto">auto</option>
                            <option value="ball_tree">ball_tree</option>
                            <option value="kd_tree">kd_tree</option>
                            <option value="brute">brute</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">p (Minkowski)</label>
                          <input type="number" min="1" value={trainingConfig.knn_params.p} onChange={(e) => setTrainingConfig({ ...trainingConfig, knn_params: { ...trainingConfig.knn_params, p: parseInt(e.target.value) || 2 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                      </div>
                    )}

                    {trainingConfig.model_type === 'svc' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">C</label>
                          <input type="number" step="0.1" value={trainingConfig.svc_params.C} onChange={(e) => setTrainingConfig({ ...trainingConfig, svc_params: { ...trainingConfig.svc_params, C: parseFloat(e.target.value) || 1 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">kernel</label>
                          <select value={trainingConfig.svc_params.kernel} onChange={(e) => setTrainingConfig({ ...trainingConfig, svc_params: { ...trainingConfig.svc_params, kernel: e.target.value as 'rbf' | 'linear' | 'poly' | 'sigmoid' } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                            <option value="rbf">rbf</option>
                            <option value="linear">linear</option>
                            <option value="poly">poly</option>
                            <option value="sigmoid">sigmoid</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">gamma</label>
                          <select value={String(trainingConfig.svc_params.gamma)} onChange={(e) => setTrainingConfig({ ...trainingConfig, svc_params: { ...trainingConfig.svc_params, gamma: e.target.value as 'scale' | 'auto' } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                            <option value="scale">scale</option>
                            <option value="auto">auto</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">degree</label>
                          <input type="number" min="1" value={trainingConfig.svc_params.degree} onChange={(e) => setTrainingConfig({ ...trainingConfig, svc_params: { ...trainingConfig.svc_params, degree: parseInt(e.target.value) || 3 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700 col-span-2">
                          <div>
                            <label className="block text-sm text-slate-300 font-medium">probability</label>
                            <p className="text-xs text-slate-500 mt-1">Needed for ROC/PR curves</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={trainingConfig.svc_params.probability} onChange={(e) => setTrainingConfig({ ...trainingConfig, svc_params: { ...trainingConfig.svc_params, probability: e.target.checked } })} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      </div>
                    )}

                    {trainingConfig.model_type === 'adaboost' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">n_estimators</label>
                          <input type="number" min="1" value={trainingConfig.adaboost_params.n_estimators} onChange={(e) => setTrainingConfig({ ...trainingConfig, adaboost_params: { ...trainingConfig.adaboost_params, n_estimators: parseInt(e.target.value) || 1 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">learning_rate</label>
                          <input type="number" step="0.1" value={trainingConfig.adaboost_params.learning_rate} onChange={(e) => setTrainingConfig({ ...trainingConfig, adaboost_params: { ...trainingConfig.adaboost_params, learning_rate: parseFloat(e.target.value) || 1 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">algorithm</label>
                          <select value={trainingConfig.adaboost_params.algorithm} onChange={(e) => setTrainingConfig({ ...trainingConfig, adaboost_params: { ...trainingConfig.adaboost_params, algorithm: e.target.value as 'SAMME.R' | 'SAMME' } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                            <option value="SAMME.R">SAMME.R</option>
                            <option value="SAMME">SAMME</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">base max_depth</label>
                          <input type="number" min="1" value={trainingConfig.adaboost_params.max_depth} onChange={(e) => setTrainingConfig({ ...trainingConfig, adaboost_params: { ...trainingConfig.adaboost_params, max_depth: parseInt(e.target.value) || 1 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                      </div>
                    )}

                    {trainingConfig.model_type === 'xgboost' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">n_estimators</label>
                          <input type="number" min="1" value={trainingConfig.xgboost_params.n_estimators} onChange={(e) => setTrainingConfig({ ...trainingConfig, xgboost_params: { ...trainingConfig.xgboost_params, n_estimators: parseInt(e.target.value) || 100 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">max_depth</label>
                          <input type="number" min="1" value={trainingConfig.xgboost_params.max_depth} onChange={(e) => setTrainingConfig({ ...trainingConfig, xgboost_params: { ...trainingConfig.xgboost_params, max_depth: parseInt(e.target.value) || 6 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">learning_rate</label>
                          <input type="number" step="0.01" min="0.001" max="1" value={trainingConfig.xgboost_params.learning_rate} onChange={(e) => setTrainingConfig({ ...trainingConfig, xgboost_params: { ...trainingConfig.xgboost_params, learning_rate: parseFloat(e.target.value) || 0.3 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">subsample</label>
                          <input type="number" step="0.1" min="0.1" max="1" value={trainingConfig.xgboost_params.subsample} onChange={(e) => setTrainingConfig({ ...trainingConfig, xgboost_params: { ...trainingConfig.xgboost_params, subsample: parseFloat(e.target.value) || 1 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">colsample_bytree</label>
                          <input type="number" step="0.1" min="0.1" max="1" value={trainingConfig.xgboost_params.colsample_bytree} onChange={(e) => setTrainingConfig({ ...trainingConfig, xgboost_params: { ...trainingConfig.xgboost_params, colsample_bytree: parseFloat(e.target.value) || 1 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">gamma (min_split_loss)</label>
                          <input type="number" step="0.1" min="0" value={trainingConfig.xgboost_params.gamma} onChange={(e) => setTrainingConfig({ ...trainingConfig, xgboost_params: { ...trainingConfig.xgboost_params, gamma: parseFloat(e.target.value) || 0 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">reg_alpha (L1)</label>
                          <input type="number" step="0.1" min="0" value={trainingConfig.xgboost_params.reg_alpha} onChange={(e) => setTrainingConfig({ ...trainingConfig, xgboost_params: { ...trainingConfig.xgboost_params, reg_alpha: parseFloat(e.target.value) || 0 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">reg_lambda (L2)</label>
                          <input type="number" step="0.1" min="0" value={trainingConfig.xgboost_params.reg_lambda} onChange={(e) => setTrainingConfig({ ...trainingConfig, xgboost_params: { ...trainingConfig.xgboost_params, reg_lambda: parseFloat(e.target.value) || 1 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">min_child_weight</label>
                          <input type="number" min="0" value={trainingConfig.xgboost_params.min_child_weight} onChange={(e) => setTrainingConfig({ ...trainingConfig, xgboost_params: { ...trainingConfig.xgboost_params, min_child_weight: parseInt(e.target.value) || 1 } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {trainingWizardStep === 2 && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h4 className="text-sm font-medium text-indigo-400 mb-3">Optimization Method</h4>
                  <p className="text-xs text-slate-500 mb-3">Selected model: <span className="text-indigo-300 font-medium">{trainingConfig.model_type}</span></p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {([
                      { key: 'none', label: 'None', desc: 'Use fixed hyperparameters from Model step' },
                      { key: 'bayesian', label: 'Bayesian', desc: 'Auto-tune hyperparameters (DL models)' },
                      { key: 'grid', label: 'Grid Search', desc: 'Exhaustive search over parameter grid (ML models)' },
                    ] as const).map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setTrainingConfig({ ...trainingConfig, optimization_method: opt.key })}
                        className={`px-3 py-3 rounded-lg border text-left ${trainingConfig.optimization_method === opt.key ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'}`}
                      >
                        <div className={`text-sm font-medium ${trainingConfig.optimization_method === opt.key ? 'text-indigo-300' : 'text-slate-300'}`}>{opt.label}</div>
                        <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                      </button>
                    ))}
                  </div>

                  {trainingConfig.optimization_method === 'bayesian' && (
                    <div className="mt-4 space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div>
                          <label className="block text-sm text-slate-300 font-medium">Enable Bayesian Optimization</label>
                          <p className="text-xs text-slate-500 mt-1">Auto-tune hyperparameters before training</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={trainingConfig.use_bayesian_optimization}
                            onChange={(e) => setTrainingConfig({ ...trainingConfig, use_bayesian_optimization: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                      {trainingConfig.use_bayesian_optimization && (
                        <div className="space-y-4 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-slate-300 mb-1">Number of Trials</label>
                              <input type="number" value={trainingConfig.bayesian_trials} onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_trials: parseInt(e.target.value) || 20 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-300 mb-1">Epochs per Trial</label>
                              <input type="number" value={trainingConfig.bayesian_epochs_per_trial} onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_epochs_per_trial: parseInt(e.target.value) || 3 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-slate-300 mb-1">Learning Rate Min</label>
                              <input type="number" step="0.00001" value={trainingConfig.bayesian_lr_min} onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_lr_min: parseFloat(e.target.value) || 0.00001 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-300 mb-1">Learning Rate Max</label>
                              <input type="number" step="0.001" value={trainingConfig.bayesian_lr_max} onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_lr_max: parseFloat(e.target.value) || 0.01 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">Batch Sizes to Try (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.bayesian_batch_sizes.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => Number.isFinite(v) && v > 0);
                                setTrainingConfig({ ...trainingConfig, bayesian_batch_sizes: vals.length ? vals : trainingConfig.bayesian_batch_sizes });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">Optimizers to Try</label>
                            <div className="flex flex-wrap gap-2">
                              {['adam', 'adamw', 'sgd'].map(opt => (
                                <label key={opt} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={trainingConfig.bayesian_optimizers.includes(opt)}
                                    onChange={(e) => {
                                      const newOpts = e.target.checked
                                        ? [...trainingConfig.bayesian_optimizers, opt]
                                        : trainingConfig.bayesian_optimizers.filter(o => o !== opt);
                                      setTrainingConfig({ ...trainingConfig, bayesian_optimizers: newOpts.length ? newOpts : ['adam'] });
                                    }}
                                    className="w-4 h-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                                  />
                                  <span className="text-sm text-slate-300">{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700">
                            <div>
                              <label className="block text-sm text-slate-300 font-medium">Search Architecture</label>
                              <p className="text-xs text-slate-500 mt-1">Also search model architecture size</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={trainingConfig.bayesian_search_architecture}
                                onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_search_architecture: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {trainingConfig.optimization_method === 'grid' && (
                    <div className="mt-4 space-y-4">
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                        <div className="text-sm text-indigo-300 font-medium">Grid Search for {trainingConfig.model_type.toUpperCase()}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Define parameter values to search. All combinations will be evaluated.
                        </div>
                      </div>

                      {trainingConfig.model_type === 'knn' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">n_neighbors (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.grid_knn.n_neighbors.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => Number.isFinite(v) && v > 0);
                                setTrainingConfig({ ...trainingConfig, grid_knn: { ...trainingConfig.grid_knn, n_neighbors: vals.length ? vals : trainingConfig.grid_knn.n_neighbors } });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">weights (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.grid_knn.weights.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => v.trim()).filter(Boolean);
                                setTrainingConfig({ ...trainingConfig, grid_knn: { ...trainingConfig.grid_knn, weights: vals.length ? vals : trainingConfig.grid_knn.weights } });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                        </div>
                      )}

                      {trainingConfig.model_type === 'svc' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">C (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.grid_svc.C.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => parseFloat(v.trim())).filter(v => Number.isFinite(v) && v > 0);
                                setTrainingConfig({ ...trainingConfig, grid_svc: { ...trainingConfig.grid_svc, C: vals.length ? vals : trainingConfig.grid_svc.C } });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">kernel (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.grid_svc.kernel.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => v.trim()).filter(Boolean);
                                setTrainingConfig({ ...trainingConfig, grid_svc: { ...trainingConfig.grid_svc, kernel: vals.length ? vals : trainingConfig.grid_svc.kernel } });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                        </div>
                      )}

                      {trainingConfig.model_type === 'adaboost' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">n_estimators (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.grid_adaboost.n_estimators.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => Number.isFinite(v) && v > 0);
                                setTrainingConfig({ ...trainingConfig, grid_adaboost: { ...trainingConfig.grid_adaboost, n_estimators: vals.length ? vals : trainingConfig.grid_adaboost.n_estimators } });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">learning_rate (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.grid_adaboost.learning_rate.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => parseFloat(v.trim())).filter(v => Number.isFinite(v) && v > 0);
                                setTrainingConfig({ ...trainingConfig, grid_adaboost: { ...trainingConfig.grid_adaboost, learning_rate: vals.length ? vals : trainingConfig.grid_adaboost.learning_rate } });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                        </div>
                      )}

                      {trainingConfig.model_type === 'xgboost' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">n_estimators (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.grid_xgboost.n_estimators.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => Number.isFinite(v) && v > 0);
                                setTrainingConfig({ ...trainingConfig, grid_xgboost: { ...trainingConfig.grid_xgboost, n_estimators: vals.length ? vals : trainingConfig.grid_xgboost.n_estimators } });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">max_depth (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.grid_xgboost.max_depth.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => Number.isFinite(v) && v > 0);
                                setTrainingConfig({ ...trainingConfig, grid_xgboost: { ...trainingConfig.grid_xgboost, max_depth: vals.length ? vals : trainingConfig.grid_xgboost.max_depth } });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">learning_rate (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.grid_xgboost.learning_rate.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => parseFloat(v.trim())).filter(v => Number.isFinite(v) && v > 0);
                                setTrainingConfig({ ...trainingConfig, grid_xgboost: { ...trainingConfig.grid_xgboost, learning_rate: vals.length ? vals : trainingConfig.grid_xgboost.learning_rate } });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-300 mb-1">subsample (comma-separated)</label>
                            <input
                              type="text"
                              value={trainingConfig.grid_xgboost.subsample.join(',')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(v => parseFloat(v.trim())).filter(v => Number.isFinite(v) && v > 0 && v <= 1);
                                setTrainingConfig({ ...trainingConfig, grid_xgboost: { ...trainingConfig.grid_xgboost, subsample: vals.length ? vals : trainingConfig.grid_xgboost.subsample } });
                              }}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {trainingWizardStep === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h4 className="text-sm font-medium text-indigo-400 mb-3">Review Configuration</h4>
                  
                  {/* Preprocessing Summary */}
                  <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-slate-500 uppercase tracking-wide">Preprocessing & Splits</div>
                      <button type="button" onClick={() => setTrainingWizardStep(0)} className="text-xs text-indigo-400 hover:text-indigo-300">Edit</button>
                    </div>
                    <div className="text-sm text-slate-200 space-y-1">
                      <div>Data Type: <span className="text-slate-300">{trainingConfig.data_type}</span> · Window: <span className="text-slate-300">{trainingConfig.window_size}</span> · Output: <span className="text-slate-300">{trainingConfig.output_shape}</span></div>
                      <div className="text-xs text-slate-400 mt-2">
                        Files assigned: {Object.keys(trainingConfig.file_assignments).length} · Test split: {(trainingConfig.test_split * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Model Summary */}
                  <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-slate-500 uppercase tracking-wide">Model</div>
                      <button type="button" onClick={() => setTrainingWizardStep(1)} className="text-xs text-indigo-400 hover:text-indigo-300">Edit</button>
                    </div>
                    <div className="text-sm text-slate-200 space-y-1">
                      <div>Type: <span className="text-indigo-300 font-medium">{trainingConfig.model_type}</span>
                        {!['knn', 'svc', 'adaboost', 'xgboost'].includes(trainingConfig.model_type) && <span className="text-slate-400"> ({trainingConfig.model_architecture})</span>}
                      </div>
                      {!['knn', 'svc', 'adaboost', 'xgboost'].includes(trainingConfig.model_type) && (
                        <div>Epochs: <span className="text-slate-300">{trainingConfig.epochs}</span> · Batch: <span className="text-slate-300">{trainingConfig.batch_size}</span> · LR: <span className="text-slate-300">{trainingConfig.learning_rate}</span></div>
                      )}
                      {trainingConfig.model_type === 'knn' && (
                        <div className="text-xs text-slate-400">KNN: n_neighbors={trainingConfig.knn_params.n_neighbors}, weights={trainingConfig.knn_params.weights}, metric={trainingConfig.knn_params.metric}</div>
                      )}
                      {trainingConfig.model_type === 'svc' && (
                        <div className="text-xs text-slate-400">SVC: C={trainingConfig.svc_params.C}, kernel={trainingConfig.svc_params.kernel}, gamma={String(trainingConfig.svc_params.gamma)}</div>
                      )}
                      {trainingConfig.model_type === 'adaboost' && (
                        <div className="text-xs text-slate-400">AdaBoost: n_estimators={trainingConfig.adaboost_params.n_estimators}, lr={trainingConfig.adaboost_params.learning_rate}</div>
                      )}
                      {trainingConfig.model_type === 'xgboost' && (
                        <div className="text-xs text-slate-400">XGBoost: n_estimators={trainingConfig.xgboost_params.n_estimators}, max_depth={trainingConfig.xgboost_params.max_depth}, lr={trainingConfig.xgboost_params.learning_rate}</div>
                      )}
                    </div>
                  </div>

                  {/* Optimization Summary */}
                  <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-slate-500 uppercase tracking-wide">Hyperparameter Search</div>
                      <button type="button" onClick={() => setTrainingWizardStep(2)} className="text-xs text-indigo-400 hover:text-indigo-300">Edit</button>
                    </div>
                    <div className="text-sm text-slate-200 space-y-1">
                      <div>Method: <span className={`font-medium ${trainingConfig.optimization_method === 'none' ? 'text-slate-400' : 'text-indigo-300'}`}>{trainingConfig.optimization_method === 'none' ? 'None (fixed params)' : trainingConfig.optimization_method === 'bayesian' ? 'Bayesian Optimization' : 'Grid Search'}</span></div>
                      {trainingConfig.optimization_method === 'bayesian' && trainingConfig.use_bayesian_optimization && (
                        <div className="text-xs text-slate-400">
                          Trials: {trainingConfig.bayesian_trials} · Epochs/trial: {trainingConfig.bayesian_epochs_per_trial} · LR: [{trainingConfig.bayesian_lr_min}, {trainingConfig.bayesian_lr_max}]
                        </div>
                      )}
                      {trainingConfig.optimization_method === 'grid' && trainingConfig.model_type === 'knn' && (
                        <div className="text-xs text-slate-400">Grid: n_neighbors=[{trainingConfig.grid_knn.n_neighbors.join(',')}], weights=[{trainingConfig.grid_knn.weights.join(',')}]</div>
                      )}
                      {trainingConfig.optimization_method === 'grid' && trainingConfig.model_type === 'svc' && (
                        <div className="text-xs text-slate-400">Grid: C=[{trainingConfig.grid_svc.C.join(',')}], kernel=[{trainingConfig.grid_svc.kernel.join(',')}]</div>
                      )}
                      {trainingConfig.optimization_method === 'grid' && trainingConfig.model_type === 'adaboost' && (
                        <div className="text-xs text-slate-400">Grid: n_estimators=[{trainingConfig.grid_adaboost.n_estimators.join(',')}], lr=[{trainingConfig.grid_adaboost.learning_rate.join(',')}]</div>
                      )}
                      {trainingConfig.optimization_method === 'grid' && trainingConfig.model_type === 'xgboost' && (
                        <div className="text-xs text-slate-400">Grid: n_estimators=[{trainingConfig.grid_xgboost.n_estimators.join(',')}], max_depth=[{trainingConfig.grid_xgboost.max_depth.join(',')}]</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm text-slate-300 mb-1">Model Name (optional)</label>
                    <input
                      type="text"
                      value={trainingConfig.model_name}
                      onChange={(e) => setTrainingConfig({ ...trainingConfig, model_name: e.target.value })}
                      placeholder="Auto-generated if empty"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>

                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setTrainingWizardStep((Math.max(0, trainingWizardStep - 1) as 0 | 1 | 2 | 3))}
                disabled={trainingWizardStep <= 0 || operations.startingTraining}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-medium"
              >
                Back
              </button>

              {trainingWizardStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setTrainingWizardStep(((trainingWizardStep + 1) as 0 | 1 | 2 | 3))}
                  disabled={operations.startingTraining}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-lg font-medium"
                >
                  Next
                </button>
              ) : (
                <button onClick={handleStartTraining} disabled={operations.startingTraining} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                  {operations.startingTraining ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Starting Training...</>
                  ) : (
                    <><Play className="w-4 h-4" /> Start Training</>
                  )}
                </button>
              )}

              <button onClick={() => setShowTrainingConfig(false)} disabled={operations.startingTraining} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Model Modal */}
      {renamingModel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Rename Model</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Model Name</label>
                <input type="text" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="Enter new name" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleRenameModel} disabled={!newModelName.trim() || operations.renamingModel === renamingModel.id} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                {operations.renamingModel === renamingModel.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Renaming...</>
                ) : (
                  'Rename'
                )}
              </button>
              <button onClick={() => { setRenamingModel(null); setNewModelName(''); }} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-4xl border border-slate-700 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Training Job Details</h3>
              <button onClick={() => setSelectedJob(null)} className="p-2 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold text-white">Training Statistics</h4>
                <button onClick={() => {
                  const content = document.getElementById('job-details-content');
                  if (content) {
                    const printWindow = window.open('', '', 'width=800,height=600');
                    if (printWindow) {
                      printWindow.document.write('<html><head><title>Training Report</title>');
                      printWindow.document.write('<style>body{font-family:Arial;padding:20px;}table{border-collapse:collapse;width:100%;margin:10px 0;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background:#333;color:white;}.stat{margin:10px 0;padding:10px;background:#f5f5f5;border-radius:5px;}</style>');
                      printWindow.document.write('</head><body>');
                      printWindow.document.write(`<h1>Training Job Report: ${selectedJob.dataset_name}</h1>`);
                      printWindow.document.write(content.innerHTML.replace(/class="[^"]*"/g, ''));
                      printWindow.document.write('</body></html>');
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }
                }} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm">
                  <Download className="w-4 h-4" /> Export PDF
                </button>
              </div>
              <div id="job-details-content">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Dataset</p>
                  <p className="text-white font-medium text-sm">{selectedJob.dataset_name}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Model Type</p>
                  <p className="text-white font-medium text-sm uppercase">{selectedJob.model_type}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Total Epochs</p>
                  <p className="text-white font-medium text-sm">{selectedJob.total_epochs}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Best Val Accuracy</p>
                  <p className="text-green-400 font-medium text-sm">{selectedJob.best_metrics?.val_accuracy ? `${(selectedJob.best_metrics.val_accuracy * 100).toFixed(2)}%` : 'N/A'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Final Train Loss</p>
                  <p className="text-blue-400 font-medium text-sm">{selectedJob.metrics?.loss && selectedJob.metrics.loss.length > 0 ? selectedJob.metrics.loss[selectedJob.metrics.loss.length - 1]?.toFixed(4) : 'N/A'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Final Val Loss</p>
                  <p className="text-purple-400 font-medium text-sm">{selectedJob.metrics?.val_loss && selectedJob.metrics.val_loss.length > 0 ? selectedJob.metrics.val_loss[selectedJob.metrics.val_loss.length - 1]?.toFixed(4) : 'N/A'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Best Epoch</p>
                  <p className="text-yellow-400 font-medium text-sm">{selectedJob.best_metrics?.best_epoch || 'N/A'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Training Duration</p>
                  <p className="text-slate-300 font-medium text-sm">
                    {selectedJob.started_at && selectedJob.completed_at 
                      ? `${Math.round((new Date(selectedJob.completed_at).getTime() - new Date(selectedJob.started_at).getTime()) / 1000)}s`
                      : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Learning Rate</p>
                  <p className="text-cyan-400 font-medium text-sm">{selectedJob.best_metrics?.learning_rate || 'N/A'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Batch Size</p>
                  <p className="text-orange-400 font-medium text-sm">{selectedJob.best_metrics?.batch_size || 'N/A'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Optimizer</p>
                  <p className="text-pink-400 font-medium text-sm uppercase">{selectedJob.best_metrics?.optimizer || 'N/A'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Total Parameters</p>
                  <p className="text-emerald-400 font-medium text-sm">{selectedJob.best_metrics?.model_architecture?.total_params?.toLocaleString() || 'N/A'}</p>
                </div>
              </div>
              
              {/* Bayesian Optimization Trials */}
              {(() => {
                try {
                  const config = typeof selectedJob.config === 'string' ? JSON.parse(selectedJob.config) : selectedJob.config;
                  const trials = config?.bayesian_trials_results;
                  if (trials && trials.length > 0) {
                    return (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-white font-medium">Bayesian Optimization Trials</h4>
                          <button onClick={() => exportBayesianTrials(selectedJob)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded">CSV</button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-900/50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Trial</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Learning Rate</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Batch Size</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Train Acc</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Val Acc</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                              {trials.map((trial: any) => (
                                <tr key={trial.trial} className={trial.is_best ? 'bg-green-500/10' : ''}>
                                  <td className="px-4 py-2 text-white font-medium">#{trial.trial}</td>
                                  <td className="px-4 py-2 text-slate-300 font-mono text-xs">{trial.learning_rate}</td>
                                  <td className="px-4 py-2 text-slate-300">{trial.batch_size}</td>
                                  <td className="px-4 py-2 text-blue-400">{(trial.train_accuracy * 100).toFixed(2)}%</td>
                                  <td className="px-4 py-2 text-green-400">{(trial.val_accuracy * 100).toFixed(2)}%</td>
                                  <td className="px-4 py-2">
                                    {trial.is_best ? (
                                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">Best</span>
                                    ) : (
                                      <span className="text-slate-500 text-xs">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-slate-500 text-xs mt-3">
                          Best trial was automatically selected for final training
                        </p>
                      </div>
                    );
                  }
                } catch (e) {
                  return null;
                }
                return null;
              })()}

              {/* ML Model Summary (for KNN, SVC, AdaBoost - no epochs) */}
              {['knn', 'svc', 'adaboost', 'xgboost'].includes(selectedJob.model_type) && selectedJob.metrics && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-4">Model Training Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                      <p className="text-slate-400 text-xs uppercase mb-1">Train Accuracy</p>
                      <p className="text-2xl font-bold text-green-400">
                        {selectedJob.metrics.accuracy?.[0] ? `${(selectedJob.metrics.accuracy[0] * 100).toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                      <p className="text-slate-400 text-xs uppercase mb-1">Validation Accuracy</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {selectedJob.best_metrics?.val_accuracy ? `${(selectedJob.best_metrics.val_accuracy * 100).toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                      <p className="text-slate-400 text-xs uppercase mb-1">Train Samples</p>
                      <p className="text-2xl font-bold text-white">
                        {selectedJob.best_metrics?.model_architecture?.num_train_samples || 
                         (typeof selectedJob.config === 'string' ? JSON.parse(selectedJob.config || '{}') : selectedJob.config)?.num_train_samples || '—'}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                      <p className="text-slate-400 text-xs uppercase mb-1">Val Samples</p>
                      <p className="text-2xl font-bold text-white">
                        {selectedJob.best_metrics?.model_architecture?.num_val_samples || 
                         (typeof selectedJob.config === 'string' ? JSON.parse(selectedJob.config || '{}') : selectedJob.config)?.num_val_samples || '—'}
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs mt-3">
                    ML models ({selectedJob.model_type.toUpperCase()}) train in a single pass without epochs
                  </p>
                </div>
              )}
              {/* Deep Learning Training Progress Charts (only for models with multiple epochs) */}
              {!['knn', 'svc', 'adaboost', 'xgboost'].includes(selectedJob.model_type) && selectedJob.metrics && (selectedJob.metrics.accuracy?.length > 1 || selectedJob.metrics.loss?.length > 1) && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-white font-medium">Training Progress Charts</h4>
                    <button onClick={() => exportTrainingCurves(selectedJob)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded">Export CSV</button>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    {selectedJob.metrics.accuracy && selectedJob.metrics.val_accuracy && selectedJob.metrics.accuracy.length > 1 && (
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-slate-400 text-sm font-medium">Accuracy Over Epochs</p>
                          <button onClick={() => downloadGraph(document.getElementById('accuracy-chart') as any, `${selectedJob.dataset_name}_accuracy`)} className="p-1 text-slate-400 hover:text-white">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="relative h-48 bg-slate-900/50 rounded-lg p-4">
                          <svg id="accuracy-chart" viewBox="0 0 400 150" className="w-full h-full">
                            <defs>
                              <linearGradient id="trainAccGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0"/>
                              </linearGradient>
                              <linearGradient id="valAccGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0"/>
                              </linearGradient>
                            </defs>
                            {(() => {
                              const trainAcc = selectedJob.metrics.accuracy || [];
                              const valAcc = selectedJob.metrics.val_accuracy || [];
                              const maxAcc = trainAcc.length > 0 || valAcc.length > 0 ? Math.max(...trainAcc, ...valAcc) : 1;
                              const minAcc = trainAcc.length > 0 || valAcc.length > 0 ? Math.min(...trainAcc, ...valAcc) : 0;
                              const range = maxAcc - minAcc || 0.1;
                              const xStep = 380 / (trainAcc.length - 1 || 1);
                              const trainPoints = trainAcc && trainAcc.length > 0 ? trainAcc.map((acc: number, i: number) => `${10 + i * xStep},${140 - ((acc - minAcc) / range) * 120}`).join(' ') : '';
                              const valPoints = valAcc && valAcc.length > 0 ? valAcc.map((acc: number, i: number) => `${10 + i * xStep},${140 - ((acc - minAcc) / range) * 120}`).join(' ') : '';
                              return (
                                <>
                                  <polyline points={trainPoints} fill="none" stroke="rgb(34, 197, 94)" strokeWidth="2"/>
                                  <polygon points={`${trainPoints} 390,140 10,140`} fill="url(#trainAccGrad)"/>
                                  <polyline points={valPoints} fill="none" stroke="rgb(59, 130, 246)" strokeWidth="2" strokeDasharray="4"/>
                                  <text x="10" y="10" fill="rgb(148, 163, 184)" fontSize="10">Train</text>
                                  <text x="10" y="22" fill="rgb(148, 163, 184)" fontSize="10">Val (dashed)</text>
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-slate-500">
                          <span>Epoch 1</span>
                          <span>Epoch {selectedJob.metrics.accuracy.length}</span>
                        </div>
                      </div>
                    )}
                    {selectedJob.metrics.loss && selectedJob.metrics.val_loss && selectedJob.metrics.loss.length > 1 && (
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-slate-400 text-sm font-medium">Loss Over Epochs</p>
                          <button onClick={() => downloadGraph(document.getElementById('loss-chart') as any, `${selectedJob.dataset_name}_loss`)} className="p-1 text-slate-400 hover:text-white">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="relative h-48 bg-slate-900/50 rounded-lg p-4">
                          <svg id="loss-chart" viewBox="0 0 400 150" className="w-full h-full">
                            <defs>
                              <linearGradient id="trainLossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity="0"/>
                              </linearGradient>
                              <linearGradient id="valLossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="rgb(168, 85, 247)" stopOpacity="0"/>
                              </linearGradient>
                            </defs>
                            {(() => {
                              const trainLoss = selectedJob.metrics.loss || [];
                              const valLoss = selectedJob.metrics.val_loss || [];
                              const maxLoss = trainLoss.length > 0 || valLoss.length > 0 ? Math.max(...trainLoss, ...valLoss) : 1;
                              const minLoss = trainLoss.length > 0 || valLoss.length > 0 ? Math.min(...trainLoss, ...valLoss) : 0;
                              const range = maxLoss - minLoss || 0.1;
                              const xStep = 380 / (trainLoss.length - 1 || 1);
                              const trainPoints = trainLoss && trainLoss.length > 0 ? trainLoss.map((loss: number, i: number) => `${10 + i * xStep},${140 - ((loss - minLoss) / range) * 120}`).join(' ') : '';
                              const valPoints = valLoss && valLoss.length > 0 ? valLoss.map((loss: number, i: number) => `${10 + i * xStep},${140 - ((loss - minLoss) / range) * 120}`).join(' ') : '';
                              return (
                                <>
                                  <polyline points={trainPoints} fill="none" stroke="rgb(239, 68, 68)" strokeWidth="2"/>
                                  <polygon points={`${trainPoints} 390,140 10,140`} fill="url(#trainLossGrad)"/>
                                  <polyline points={valPoints} fill="none" stroke="rgb(168, 85, 247)" strokeWidth="2" strokeDasharray="4"/>
                                  <text x="10" y="10" fill="rgb(148, 163, 184)" fontSize="10">Train</text>
                                  <text x="10" y="22" fill="rgb(148, 163, 184)" fontSize="10">Val (dashed)</text>
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-slate-500">
                          <span>Epoch 1</span>
                          <span>Epoch {selectedJob.metrics.loss.length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {selectedJob.best_metrics?.model_architecture && selectedJob.best_metrics.model_architecture.layers && Array.isArray(selectedJob.best_metrics.model_architecture.layers) && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-4">Model Architecture</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-slate-400">Layer Type</th>
                          <th className="px-4 py-2 text-left text-slate-400">Output Shape</th>
                          <th className="px-4 py-2 text-left text-slate-400">Activation</th>
                          <th className="px-4 py-2 text-right text-slate-400">Parameters</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {selectedJob.best_metrics.model_architecture.layers.map((layer: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-white font-medium">{layer.type}</td>
                            <td className="px-4 py-2 text-slate-300">{layer.shape || (layer.units ? `(${layer.units},)` : '-')}</td>
                            <td className="px-4 py-2 text-blue-400">{layer.activation || (layer.rate ? `rate=${layer.rate}` : '-')}</td>
                            <td className="px-4 py-2 text-right text-green-400">{layer.params?.toLocaleString() || '-'}</td>
                          </tr>
                        ))}
                        {selectedJob.best_metrics.model_architecture.total_params !== undefined && (
                          <tr className="bg-slate-900/50 font-bold">
                            <td className="px-4 py-2 text-white" colSpan={3}>Total Parameters</td>
                            <td className="px-4 py-2 text-right text-green-400">{selectedJob.best_metrics.model_architecture.total_params.toLocaleString()}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {selectedJob.best_metrics?.roc_curves && Object.keys(selectedJob.best_metrics.roc_curves).length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-4">ROC Curves (Receiver Operating Characteristic)</h4>
                  <div className="grid grid-cols-2 gap-6">
                    {selectedJob.best_metrics?.roc_curves && Object.entries(selectedJob.best_metrics.roc_curves).map(([className, rocData]: [string, any]) => {
                      if (!rocData || !rocData.points || !Array.isArray(rocData.points)) return null;
                      return (
                      <div key={className}>
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-slate-400 text-sm font-medium">{className} (AUC: {(rocData.auc * 100).toFixed(2)}%)</p>
                          <button onClick={() => downloadGraph(document.getElementById(`roc-${className}`) as any, `${selectedJob.dataset_name}_roc_${className}`)} className="p-1 text-slate-400 hover:text-white">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="relative h-48 bg-slate-900/50 rounded-lg p-4">
                          <svg id={`roc-${className}`} viewBox="0 0 400 150" className="w-full h-full">
                            <defs>
                              <linearGradient id={`rocGrad-${className}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0"/>
                              </linearGradient>
                            </defs>
                            {(() => {
                              const points = rocData.points && rocData.points.length > 0 ? rocData.points.map((p: any, i: number) => `${10 + p.fpr * 380},${140 - p.tpr * 120}`).join(' ') : '';
                              return (
                                <>
                                  <line x1="10" y1="140" x2="390" y2="20" stroke="rgb(100, 100, 100)" strokeWidth="1" strokeDasharray="4"/>
                                  <polyline points={points} fill="none" stroke="rgb(59, 130, 246)" strokeWidth="2"/>
                                  <polygon points={`${points} 390,140 10,140`} fill={`url(#rocGrad-${className})`}/>
                                  <text x="10" y="10" fill="rgb(148, 163, 184)" fontSize="10">TPR</text>
                                  <text x="360" y="145" fill="rgb(148, 163, 184)" fontSize="10">FPR</text>
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}
              {selectedJob.best_metrics?.pr_curves && Object.keys(selectedJob.best_metrics.pr_curves).length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-4">Precision-Recall Curves</h4>
                  <div className="grid grid-cols-2 gap-6">
                    {selectedJob.best_metrics?.pr_curves && Object.entries(selectedJob.best_metrics.pr_curves).map(([className, prData]: [string, any]) => {
                      if (!prData || !prData.points || !Array.isArray(prData.points)) return null;
                      return (
                      <div key={className}>
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-slate-400 text-sm font-medium">{className}</p>
                          <button onClick={() => downloadGraph(document.getElementById(`pr-${className}`) as any, `${selectedJob.dataset_name}_pr_${className}`)} className="p-1 text-slate-400 hover:text-white">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="relative h-48 bg-slate-900/50 rounded-lg p-4">
                          <svg id={`pr-${className}`} viewBox="0 0 400 150" className="w-full h-full">
                            <defs>
                              <linearGradient id={`prGrad-${className}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity="0.3"/>
                                <stop offset="100%" stopColor="rgb(168, 85, 247)" stopOpacity="0"/>
                              </linearGradient>
                            </defs>
                            {(() => {
                              const points = prData.points && prData.points.length > 0 ? prData.points.map((p: any, i: number) => `${10 + p.recall * 380},${140 - p.precision * 120}`).join(' ') : '';
                              return (
                                <>
                                  <polyline points={points} fill="none" stroke="rgb(168, 85, 247)" strokeWidth="2"/>
                                  <polygon points={`${points} 390,140 10,140`} fill={`url(#prGrad-${className})`}/>
                                  <text x="10" y="10" fill="rgb(148, 163, 184)" fontSize="10">Precision</text>
                                  <text x="350" y="145" fill="rgb(148, 163, 184)" fontSize="10">Recall</text>
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}
              {selectedJob.best_metrics?.per_class_metrics && Object.keys(selectedJob.best_metrics.per_class_metrics).length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-white font-medium">Per-Class Metrics</h4>
                    <button onClick={() => exportMetricsTable(selectedJob)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded">CSV</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-slate-400">Class</th>
                          <th className="px-4 py-2 text-left text-slate-400">Precision</th>
                          <th className="px-4 py-2 text-left text-slate-400">Recall</th>
                          <th className="px-4 py-2 text-left text-slate-400">F1-Score</th>
                          <th className="px-4 py-2 text-left text-slate-400">Support</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {selectedJob.best_metrics?.per_class_metrics && Object.entries(selectedJob.best_metrics.per_class_metrics).map(([className, metrics]: [string, any]) => (
                          <tr key={className}>
                            <td className="px-4 py-2 text-white font-medium">{className}</td>
                            <td className="px-4 py-2 text-blue-400">{(metrics.precision * 100).toFixed(2)}%</td>
                            <td className="px-4 py-2 text-green-400">{(metrics.recall * 100).toFixed(2)}%</td>
                            <td className="px-4 py-2 text-purple-400">{(metrics.f1_score * 100).toFixed(2)}%</td>
                            <td className="px-4 py-2 text-slate-300">{metrics.support}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {selectedJob.best_metrics?.confusion_matrix && selectedJob.best_metrics.confusion_matrix.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-white font-medium">Confusion Matrix</h4>
                    <button onClick={() => exportConfusionMatrix(selectedJob)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded">CSV</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2 text-slate-400 text-xs"></th>
                          {selectedJob.best_metrics.class_names?.map((name: string, idx: number) => (
                            <th key={idx} className="p-2 text-slate-400 text-xs font-medium">
                              {name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedJob.best_metrics?.confusion_matrix && selectedJob.best_metrics.confusion_matrix.map((row: number[], rowIdx: number) => (
                          <tr key={rowIdx}>
                            <td className="p-2 text-slate-400 text-xs font-medium">
                              {selectedJob.best_metrics.class_names?.[rowIdx] || `Class ${rowIdx}`}
                            </td>
                            {row.map((value: number, colIdx: number) => {
                              const maxVal = Math.max(...(selectedJob.best_metrics?.confusion_matrix?.flat() || [1]));
                              const intensity = maxVal > 0 ? value / maxVal : 0;
                              const isCorrect = rowIdx === colIdx;
                              return (
                                <td
                                  key={colIdx}
                                  className="p-2 text-center border border-slate-700"
                                  style={{
                                    backgroundColor: isCorrect
                                      ? `rgba(34, 197, 94, ${intensity * 0.5})`
                                      : `rgba(239, 68, 68, ${intensity * 0.3})`
                                  }}
                                >
                                  <span className="text-white font-medium">{value}</span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-slate-500 mt-2">Rows: True labels, Columns: Predicted labels</p>
                  </div>
                </div>
              )}
              
              {/* Publication-Ready Figure Export */}
              {selectedJob.status === 'completed' && (
                <FigureExport 
                  jobId={selectedJob.job_id} 
                  onError={(error) => console.error('Figure export error:', error)}
                />
              )}
              
              {/* Advanced Plot Customizer */}
              {selectedJob.status === 'completed' && (
                <PlotCustomizer 
                  jobId={selectedJob.job_id}
                  experimentData={{
                    metrics: selectedJob.metrics,
                    best_metrics: selectedJob.best_metrics,
                    model_type: selectedJob.model_type,
                    config: selectedJob.config,
                  }}
                />
              )}
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h4 className="text-white font-medium mb-4">Timeline</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Created</span>
                    <span className="text-white">{new Date(selectedJob.created_at).toLocaleString()}</span>
                  </div>
                  {selectedJob.started_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Started</span>
                      <span className="text-white">{new Date(selectedJob.started_at).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedJob.completed_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Completed</span>
                      <span className="text-white">{new Date(selectedJob.completed_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Job Group Modal */}
      <CreateJobGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreate={handleCreateJobGroup}
        type={createGroupType}
      />
    </div>
  );
}
