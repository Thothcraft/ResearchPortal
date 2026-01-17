'use client';

import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import {
  Brain, Cloud, Smartphone, Network, Play, RefreshCw, Plus, Tag, Database,
  FileText, Trash2, ChevronRight, BarChart3, CheckCircle, Clock, AlertCircle,
  Download, Rocket, Loader2, X, XCircle, Edit2, TrendingUp,
} from 'lucide-react';

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
  {
    value: 'dl_cnn_lstm',
    label: 'DL: CNN-LSTM (IMU)',
    description: 'Deep learning CNN+LSTM for IMU time-series classification',
    supported_data: ['imu', 'other']
  },
  {
    value: 'knn',
    label: 'ML: KNN',
    description: 'K-Nearest Neighbors baseline (fast, interpretable)',
    supported_data: ['imu', 'other']
  },
  {
    value: 'svc',
    label: 'ML: SVC',
    description: 'Support Vector Classifier baseline (strong for smaller datasets)',
    supported_data: ['imu', 'other']
  },
  {
    value: 'adaboost',
    label: 'ML: AdaBoost',
    description: 'AdaBoost baseline (ensemble of weak learners)',
    supported_data: ['imu', 'other']
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
  const [trainingConfig, setTrainingConfig] = useState({ 
    model_type: 'dl_cnn_lstm', 
    model_architecture: 'medium',
    epochs: 10, 
    batch_size: 32, 
    learning_rate: 0.001, 
    validation_split: 0.2, 
    model_name: '', 
    test_dataset_id: null as number | null,
    window_size: 128,
    test_split: 0.2,
    preprocessing_pipeline_id: null as number | null,
    data_type: 'auto' as 'auto' | 'csi' | 'imu',
    include_phase: true,
    filter_subcarriers: true,
    subcarrier_start: 5,
    subcarrier_end: 32,
    output_shape: 'flattened' as 'flattened' | 'sequence',
    knn_params: {
      n_neighbors: 5,
      weights: 'uniform',
      metric: 'euclidean',
      algorithm: 'auto',
      p: 2,
    },
    svc_params: {
      C: 1.0,
      kernel: 'rbf',
      gamma: 'scale',
      degree: 3,
      probability: true,
      max_iter: -1,
    },
    adaboost_params: {
      n_estimators: 50,
      learning_rate: 1.0,
      algorithm: 'SAMME.R',
      max_depth: 1,
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
    bayesian_search_architecture: false
  });
  const [showAdvancedBayesian, setShowAdvancedBayesian] = useState(false);
  const [compareModels, setCompareModels] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'datasets' | 'jobs' | 'models' | 'compare'>('datasets');
  const [renamingModel, setRenamingModel] = useState<TrainedModel | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(null);
  
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
      setError('Failed to load training data');
    } finally {
      // Clear loading states
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
        setError('Failed to load cloud files');
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
    if (activeTab === 'jobs') {
      fetchData({ datasets: false, jobs: true, models: false, files: false });
    }
    if (activeTab === 'models' || activeTab === 'compare') {
      fetchData({ datasets: false, jobs: false, models: true, files: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'jobs' && activeTab !== 'models' && activeTab !== 'compare') return;

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
    }, 10000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, operations]);

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
    } catch { setError('Failed to create dataset'); }
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
    } catch { setError('Failed to load dataset'); }
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
      setError(`Failed to add files to dataset: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setOperations(prev => ({ ...prev, addingFiles: false }));
    }
  };

  const handleRemoveFile = async (fileId: number) => {
    if (!selectedDataset) return;
    try { await del(`/datasets/${selectedDataset.id}/files/${fileId}`); handleSelectDataset(selectedDataset); } catch { setError('Failed to remove file'); }
  };

  const handleUpdateLabel = async (fileId: number, newLbl: string) => {
    if (!selectedDataset) return;
    try { await put(`/datasets/${selectedDataset.id}/files/${fileId}/label`, { label: newLbl }); handleSelectDataset(selectedDataset); } catch { setError('Failed to update label'); }
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
              : {};

      await post('/datasets/train/cloud', {
        dataset_id: selectedDataset.id,
        test_dataset_id: trainingConfig.test_dataset_id,
        model_type: trainingConfig.model_type,
        model_architecture: trainingConfig.model_architecture,
        epochs: trainingConfig.epochs,
        batch_size: trainingConfig.batch_size,
        learning_rate: trainingConfig.learning_rate,
        validation_split: trainingConfig.validation_split,
        test_split: trainingConfig.test_split,
        model_name: trainingConfig.model_name || undefined,
        window_size: trainingConfig.window_size,
        preprocessing_pipeline_id: trainingConfig.preprocessing_pipeline_id,
        data_type: trainingConfig.data_type,
        include_phase: trainingConfig.include_phase,
        filter_subcarriers: trainingConfig.filter_subcarriers,
        subcarrier_start: trainingConfig.subcarrier_start,
        subcarrier_end: trainingConfig.subcarrier_end,
        output_shape: trainingConfig.output_shape,
        ml_params,
        use_bayesian_optimization: trainingConfig.use_bayesian_optimization,
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
      setShowTrainingConfig(false);
      await fetchData({ jobs: true }); // Only refresh jobs
    } catch { setError('Failed to start training'); }
    finally { setOperations(prev => ({ ...prev, startingTraining: false })); }
  };

  const handleCancelJob = async (jobId: string) => {
    setOperations(prev => ({ ...prev, cancellingJob: true }));
    try { await post(`/datasets/train/jobs/${jobId}/cancel`, {}); await fetchData({ jobs: true }); } 
    catch { setError('Failed to cancel job'); }
    finally { setOperations(prev => ({ ...prev, cancellingJob: false })); }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await del(`/datasets/train/jobs/${jobId}`);
      await fetchData({ jobs: true }); // Only refresh jobs
    } catch { setError('Failed to delete job'); }
  };

  const handleDeleteDataset = async (datasetId: number) => {
    try { 
      await del(`/datasets/${datasetId}`); 
      setSelectedDataset(null);
      await fetchData({ datasets: true, jobs: true }); // Refresh datasets and jobs
    } catch { setError('Failed to delete dataset'); }
  };

  const handleDeleteModel = async (modelId: number) => {
    if (!confirm('Are you sure you want to delete this model?')) return;
    
    setOperations(prev => ({ ...prev, deletingModel: modelId }));
    try { 
      await del(`/datasets/models/${modelId}`); 
      await fetchData({ models: true }); // Only refresh models
    } catch { setError('Failed to delete model'); }
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
    } catch { setError('Failed to rename model'); }
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
        },
        credentials: 'include'
      });

      console.log('Download response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
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
      setError('Failed to download model. Please try again.'); 
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
      setError('Failed to download graph');
    }
  };

  const handleAddLabel = () => {
    if (newLabel.trim() && !availableLabels.includes(newLabel.trim())) { setAvailableLabels([...availableLabels, newLabel.trim()]); setNewLabel(''); }
  };

  const toggleFileSelection = (fileId: number, label: string) => {
    const newSelected = new Map(selectedFiles);
    if (newSelected.has(fileId)) newSelected.delete(fileId); else newSelected.set(fileId, label);
    setSelectedFiles(newSelected);
  };

  const activeJobsCount = trainingJobs.filter(j => ['pending', 'running'].includes(j.status)).length;

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
          <span className="inline-block mt-2 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">Coming Soon</span>
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

      {selectedMode === 'cloud' && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-slate-700">
            <button onClick={() => setActiveTab('datasets')} className={`px-4 py-2 font-medium transition-colors ${activeTab === 'datasets' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}><Database className="w-4 h-4 inline mr-2" />Datasets</button>
            <button onClick={() => setActiveTab('jobs')} className={`px-4 py-2 font-medium transition-colors ${activeTab === 'jobs' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}><BarChart3 className="w-4 h-4 inline mr-2" />Training Jobs{activeJobsCount > 0 && <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">{activeJobsCount}</span>}</button>
            <button onClick={() => setActiveTab('models')} className={`px-4 py-2 font-medium transition-colors ${activeTab === 'models' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}><Brain className="w-4 h-4 inline mr-2" />Trained Models</button>
            <button onClick={() => setActiveTab('compare')} className={`px-4 py-2 font-medium transition-colors ${activeTab === 'compare' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}><BarChart3 className="w-4 h-4 inline mr-2" />Compare Models{compareModels.length > 0 && <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">{compareModels.length}</span>}</button>
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
                        <button onClick={() => setShowTrainingConfig(true)} disabled={!selectedDataset.files || selectedDataset.files.length < 2} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm"><Play className="w-4 h-4" /> Train</button>
                        <button onClick={() => handleDeleteDataset(selectedDataset.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {selectedDataset.label_distribution && Object.keys(selectedDataset.label_distribution).length > 0 && (
                      <div className="mb-6"><h3 className="text-sm font-medium text-slate-300 mb-3">Label Distribution</h3><div className="flex flex-wrap gap-2">{Object.entries(selectedDataset.label_distribution).map(([label, count]) => <span key={label} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm">{label}: {count}</span>)}</div></div>
                    )}
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
                const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                const Icon = sc.icon;
                const prog = job.total_epochs > 0 ? (job.current_epoch / job.total_epochs) * 100 : 0;
                return (
                  <div key={job.job_id} className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div><h3 className="text-lg font-semibold text-white">{job.dataset_name || 'Training Job'}</h3><p className="text-slate-400 text-sm">{job.model_type.toUpperCase()} • {job.started_at ? new Date(job.started_at).toLocaleString() : 'Pending'}</p></div>
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${sc.bg} ${sc.color}`}><Icon className={`w-4 h-4 ${job.status === 'running' ? 'animate-spin' : ''}`} />{job.status}</span>
                        {job.status === 'completed' && (
                          <button onClick={() => setSelectedJob(job)} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg">
                            <TrendingUp className="w-5 h-5" />
                          </button>
                        )}
                        {['pending', 'running'].includes(job.status) && (
                          <button onClick={() => handleCancelJob(job.job_id)} disabled={operations.cancellingJob} className="p-2 text-red-400 hover:bg-red-500/10 disabled:text-red-600 disabled:hover:bg-red-500/5 rounded-lg">
                            {operations.cancellingJob ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <XCircle className="w-5 h-5" />
                            )}
                          </button>
                        )}
                        <button onClick={() => handleDeleteJob(job.job_id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="mb-4"><div className="flex justify-between text-sm text-slate-400 mb-1"><span>Epoch {job.current_epoch}/{job.total_epochs}</span><span>{prog.toFixed(0)}%</span></div><div className="w-full bg-slate-700 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${prog}%` }} /></div></div>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-slate-900/50 rounded-lg p-3"><p className="text-slate-500 text-xs mb-1">Loss</p><p className="text-white font-medium">{job.metrics?.loss && job.metrics.loss.length > 0 ? job.metrics.loss[job.metrics.loss.length - 1]?.toFixed(4) : 'N/A'}</p></div>
                      <div className="bg-slate-900/50 rounded-lg p-3"><p className="text-slate-500 text-xs mb-1">Accuracy</p><p className="text-white font-medium">{job.metrics?.accuracy && job.metrics.accuracy.length > 0 ? `${(job.metrics.accuracy[job.metrics.accuracy.length - 1] * 100).toFixed(2)}%` : 'N/A'}</p></div>
                      <div className="bg-slate-900/50 rounded-lg p-3"><p className="text-slate-500 text-xs mb-1">Best Val Acc</p><p className="text-green-400 font-medium">{job.best_metrics?.val_accuracy ? `${(job.best_metrics.val_accuracy * 100).toFixed(2)}%` : 'N/A'}</p></div>
                      <div className="bg-slate-900/50 rounded-lg p-3"><p className="text-slate-500 text-xs mb-1">Best Epoch</p><p className="text-white font-medium">{job.best_metrics?.best_epoch || 'N/A'}</p></div>
                    </div>
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
            <div className="space-y-4">
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
                <p className="text-xs text-slate-500 mt-1">
                  {trainingConfig.model_architecture === 'small' && 'Fewer layers, faster training, good for simple patterns'}
                  {trainingConfig.model_architecture === 'medium' && 'Balanced architecture for most use cases'}
                  {trainingConfig.model_architecture === 'large' && 'Deep architecture for complex patterns'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-slate-300 mb-1">Epochs</label><input type="number" value={trainingConfig.epochs} onChange={(e) => setTrainingConfig({ ...trainingConfig, epochs: parseInt(e.target.value) || 10 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" /></div>
                <div><label className="block text-sm text-slate-300 mb-1">Batch Size</label><input type="number" value={trainingConfig.batch_size} onChange={(e) => setTrainingConfig({ ...trainingConfig, batch_size: parseInt(e.target.value) || 32 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" /></div>
              </div>
              <div><label className="block text-sm text-slate-300 mb-1">Learning Rate</label><input type="number" step="0.0001" value={trainingConfig.learning_rate} onChange={(e) => setTrainingConfig({ ...trainingConfig, learning_rate: parseFloat(e.target.value) || 0.001 })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" /></div>
              {(trainingConfig.model_type === 'knn' || trainingConfig.model_type === 'svc' || trainingConfig.model_type === 'adaboost') && (
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
                        <select value={trainingConfig.knn_params.weights} onChange={(e) => setTrainingConfig({ ...trainingConfig, knn_params: { ...trainingConfig.knn_params, weights: e.target.value } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                          <option value="uniform">uniform</option>
                          <option value="distance">distance</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-300 mb-1">metric</label>
                        <select value={trainingConfig.knn_params.metric} onChange={(e) => setTrainingConfig({ ...trainingConfig, knn_params: { ...trainingConfig.knn_params, metric: e.target.value } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                          <option value="euclidean">euclidean</option>
                          <option value="manhattan">manhattan</option>
                          <option value="minkowski">minkowski</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-300 mb-1">algorithm</label>
                        <select value={trainingConfig.knn_params.algorithm} onChange={(e) => setTrainingConfig({ ...trainingConfig, knn_params: { ...trainingConfig.knn_params, algorithm: e.target.value } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
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
                        <select value={trainingConfig.svc_params.kernel} onChange={(e) => setTrainingConfig({ ...trainingConfig, svc_params: { ...trainingConfig.svc_params, kernel: e.target.value } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
                          <option value="rbf">rbf</option>
                          <option value="linear">linear</option>
                          <option value="poly">poly</option>
                          <option value="sigmoid">sigmoid</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-300 mb-1">gamma</label>
                        <select value={trainingConfig.svc_params.gamma} onChange={(e) => setTrainingConfig({ ...trainingConfig, svc_params: { ...trainingConfig.svc_params, gamma: e.target.value } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
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
                        <select value={trainingConfig.adaboost_params.algorithm} onChange={(e) => setTrainingConfig({ ...trainingConfig, adaboost_params: { ...trainingConfig.adaboost_params, algorithm: e.target.value } })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white">
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
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Validation Split</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="0.9"
                    value={trainingConfig.validation_split}
                    onChange={(e) => setTrainingConfig({ ...trainingConfig, validation_split: Math.max(0, Math.min(0.9, parseFloat(e.target.value) || 0)) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Test Split</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="0.9"
                    value={trainingConfig.test_split}
                    onChange={(e) => setTrainingConfig({ ...trainingConfig, test_split: Math.max(0, Math.min(0.9, parseFloat(e.target.value) || 0)) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Train split: {Math.max(0, 1 - trainingConfig.validation_split - trainingConfig.test_split).toFixed(2)}
                {trainingConfig.validation_split + trainingConfig.test_split >= 1 ? ' (invalid: must be < 1)' : ''}
              </p>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div>
                  <label className="block text-sm text-slate-300 font-medium">Bayesian Optimization</label>
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
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-indigo-400">Bayesian Optimization Settings</h4>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedBayesian(!showAdvancedBayesian)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      {showAdvancedBayesian ? 'Hide Advanced' : 'Show Advanced'}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Number of Trials</label>
                      <input 
                        type="number" 
                        value={trainingConfig.bayesian_trials} 
                        onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_trials: parseInt(e.target.value) || 20 })} 
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" 
                        min="5"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-1">Epochs per Trial</label>
                      <input 
                        type="number" 
                        value={trainingConfig.bayesian_epochs_per_trial} 
                        onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_epochs_per_trial: parseInt(e.target.value) || 3 })} 
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white" 
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>

                  {showAdvancedBayesian && (
                    <>
                      <div className="border-t border-slate-700 pt-4">
                        <h5 className="text-xs font-medium text-slate-400 mb-3">LEARNING RATE SEARCH SPACE</h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Min LR</label>
                            <input 
                              type="number" 
                              step="0.00001"
                              value={trainingConfig.bayesian_lr_min} 
                              onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_lr_min: parseFloat(e.target.value) || 0.00001 })} 
                              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Max LR</label>
                            <input 
                              type="number" 
                              step="0.001"
                              value={trainingConfig.bayesian_lr_max} 
                              onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_lr_max: parseFloat(e.target.value) || 0.01 })} 
                              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Scale</label>
                            <select 
                              value={trainingConfig.bayesian_lr_scale} 
                              onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_lr_scale: e.target.value as 'log' | 'linear' })} 
                              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                            >
                              <option value="log">Logarithmic</option>
                              <option value="linear">Linear</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-700 pt-4">
                        <h5 className="text-xs font-medium text-slate-400 mb-3">WEIGHT DECAY SEARCH SPACE</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Min Weight Decay</label>
                            <input 
                              type="number" 
                              step="0.001"
                              value={trainingConfig.bayesian_weight_decay_min} 
                              onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_weight_decay_min: parseFloat(e.target.value) || 0 })} 
                              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Max Weight Decay</label>
                            <input 
                              type="number" 
                              step="0.001"
                              value={trainingConfig.bayesian_weight_decay_max} 
                              onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_weight_decay_max: parseFloat(e.target.value) || 0.01 })} 
                              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm" 
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-700 pt-4">
                        <h5 className="text-xs font-medium text-slate-400 mb-3">OPTIMIZERS TO TRY</h5>
                        <div className="flex flex-wrap gap-2">
                          {['adam', 'adamw', 'sgd'].map(opt => (
                            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded border border-slate-600 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={trainingConfig.bayesian_optimizers.includes(opt)}
                                onChange={(e) => {
                                  const newOpts = e.target.checked 
                                    ? [...trainingConfig.bayesian_optimizers, opt]
                                    : trainingConfig.bayesian_optimizers.filter(o => o !== opt);
                                  setTrainingConfig({ ...trainingConfig, bayesian_optimizers: newOpts.length > 0 ? newOpts : ['adam'] });
                                }}
                                className="w-3 h-3"
                              />
                              <span className="text-sm text-white uppercase">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-slate-700 pt-4">
                        <h5 className="text-xs font-medium text-slate-400 mb-3">BATCH SIZES TO TRY</h5>
                        <div className="flex flex-wrap gap-2">
                          {[8, 16, 32, 64, 128, 256].map(bs => (
                            <label key={bs} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded border border-slate-600 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={trainingConfig.bayesian_batch_sizes.includes(bs)}
                                onChange={(e) => {
                                  const newBs = e.target.checked 
                                    ? [...trainingConfig.bayesian_batch_sizes, bs].sort((a, b) => a - b)
                                    : trainingConfig.bayesian_batch_sizes.filter(b => b !== bs);
                                  setTrainingConfig({ ...trainingConfig, bayesian_batch_sizes: newBs.length > 0 ? newBs : [32] });
                                }}
                                className="w-3 h-3"
                              />
                              <span className="text-sm text-white">{bs}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-slate-700 pt-4">
                        <label className="block text-xs text-slate-400 mb-2">Exploration Rate: {(trainingConfig.bayesian_exploration_rate * 100).toFixed(0)}%</label>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={trainingConfig.bayesian_exploration_rate * 100}
                          onChange={(e) => setTrainingConfig({ ...trainingConfig, bayesian_exploration_rate: parseInt(e.target.value) / 100 })}
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <p className="text-xs text-slate-500 mt-1">Higher = more random exploration, Lower = exploit best found params</p>
                      </div>
                    </>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Test Dataset (optional)</label>
                <select 
                  value={trainingConfig.test_dataset_id || ''} 
                  onChange={(e) => setTrainingConfig({ ...trainingConfig, test_dataset_id: e.target.value ? parseInt(e.target.value) : null })} 
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                >
                  <option value="">None (use validation split)</option>
                  {datasets.map(dataset => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.file_count} files)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Separate dataset for final evaluation (can be same as training dataset)
                </p>
              </div>
              <div><label className="block text-sm text-slate-300 mb-1">Model Name (optional)</label><input type="text" value={trainingConfig.model_name} onChange={(e) => setTrainingConfig({ ...trainingConfig, model_name: e.target.value })} placeholder="Auto-generated if empty" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleStartTraining} disabled={operations.startingTraining} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                {operations.startingTraining ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Starting Training...</>
                ) : (
                  <><Play className="w-4 h-4" /> Start Training</>
                )}
              </button>
              <button onClick={() => setShowTrainingConfig(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium">Cancel</button>
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

              {selectedJob.metrics && (selectedJob.metrics.accuracy || selectedJob.metrics.loss) && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-white font-medium">Training Progress Charts</h4>
                    <button onClick={() => exportTrainingCurves(selectedJob)} className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded">Export CSV</button>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    {selectedJob.metrics.accuracy && selectedJob.metrics.val_accuracy && (
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
                              const trainPoints = trainAcc && trainAcc.length > 0 ? trainAcc.map((acc, i) => `${10 + i * xStep},${140 - ((acc - minAcc) / range) * 120}`).join(' ') : '';
                              const valPoints = valAcc && valAcc.length > 0 ? valAcc.map((acc, i) => `${10 + i * xStep},${140 - ((acc - minAcc) / range) * 120}`).join(' ') : '';
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
                    {selectedJob.metrics.loss && selectedJob.metrics.val_loss && (
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
                              const trainPoints = trainLoss && trainLoss.length > 0 ? trainLoss.map((loss, i) => `${10 + i * xStep},${140 - ((loss - minLoss) / range) * 120}`).join(' ') : '';
                              const valPoints = valLoss && valLoss.length > 0 ? valLoss.map((loss, i) => `${10 + i * xStep},${140 - ((loss - minLoss) / range) * 120}`).join(' ') : '';
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
              {selectedJob.best_metrics?.model_architecture && (
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
                        {selectedJob.best_metrics.model_architecture.layers.map((layer, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-white font-medium">{layer.type}</td>
                            <td className="px-4 py-2 text-slate-300">{layer.shape || (layer.units ? `(${layer.units},)` : '-')}</td>
                            <td className="px-4 py-2 text-blue-400">{layer.activation || (layer.rate ? `rate=${layer.rate}` : '-')}</td>
                            <td className="px-4 py-2 text-right text-green-400">{layer.params.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-900/50 font-bold">
                          <td className="px-4 py-2 text-white" colSpan={3}>Total Parameters</td>
                          <td className="px-4 py-2 text-right text-green-400">{selectedJob.best_metrics.model_architecture.total_params.toLocaleString()}</td>
                        </tr>
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
    </div>
  );
}
