'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, Play, Pause, Square, RefreshCw, Plus, Trash2, ChevronDown, ChevronRight,
  BarChart3, CheckCircle, Clock, AlertCircle, Loader2, Settings, X, Copy,
  TrendingUp, Zap, GitCompare, ListOrdered, Shuffle
} from 'lucide-react';

// Types for Training Job Groups
export interface TrainingJobConfig {
  id: string;
  model_type?: string;  // For central training
  model_architecture?: string;
  epochs?: number;
  batch_size?: number;
  learning_rate?: number;
  // ML params
  ml_params?: Record<string, any>;
  // FL-specific
  algorithm?: string;  // For federated training
  num_rounds?: number;
  num_partitions?: number;
  // Common
  dataset_id?: number;
  preprocessing_pipeline_id?: number | null;
}

export interface TrainingJobInGroup {
  id: string;
  config: TrainingJobConfig;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  metrics?: {
    accuracy?: number;
    loss?: number;
    val_accuracy?: number;
    val_loss?: number;
    current_epoch?: number;
    total_epochs?: number;
    // FL metrics
    current_round?: number;
    total_rounds?: number;
    best_accuracy?: number;
  };
  error?: string;
  started_at?: string;
  completed_at?: string;
  job_id?: string; // Backend job ID once started
}

export interface TrainingJobGroup {
  id: string;
  name: string;
  type: 'central' | 'federated';
  execution_mode: 'parallel' | 'sequential';
  max_parallel?: number; // For parallel mode, max concurrent jobs
  jobs: TrainingJobInGroup[];
  status: 'draft' | 'running' | 'completed' | 'paused' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// Available ML/DL models for central training
export const CENTRAL_MODELS = [
  { id: 'dl_cnn_lstm', name: 'CNN-LSTM', category: 'Deep Learning', description: 'Hybrid CNN+LSTM for time-series' },
  { id: 'dl_lstm', name: 'LSTM', category: 'Deep Learning', description: 'Long Short-Term Memory' },
  { id: 'dl_cnn', name: 'CNN', category: 'Deep Learning', description: 'Convolutional Neural Network' },
  { id: 'dl_resnet18', name: 'ResNet-18', category: 'Deep Learning', description: 'Deep residual network' },
  { id: 'dl_mobilenet', name: 'MobileNet', category: 'Deep Learning', description: 'Lightweight CNN' },
  { id: 'dl_mlp', name: 'MLP', category: 'Deep Learning', description: 'Multi-layer perceptron' },
  { id: 'knn', name: 'KNN', category: 'Machine Learning', description: 'K-Nearest Neighbors' },
  { id: 'svc', name: 'SVC', category: 'Machine Learning', description: 'Support Vector Classifier' },
  { id: 'random_forest', name: 'Random Forest', category: 'Machine Learning', description: 'Ensemble of decision trees' },
  { id: 'adaboost', name: 'AdaBoost', category: 'Machine Learning', description: 'Adaptive boosting' },
  { id: 'xgboost', name: 'XGBoost', category: 'Machine Learning', description: 'Gradient boosting' },
];

// Available FL algorithms
export const FL_ALGORITHMS = [
  { id: 'fedavg', name: 'FedAvg', category: 'Standard', description: 'Federated Averaging' },
  { id: 'fedprox', name: 'FedProx', category: 'Standard', description: 'Proximal term for non-IID' },
  { id: 'fedadam', name: 'FedAdam', category: 'Adaptive', description: 'Adam optimizer' },
  { id: 'fedyogi', name: 'FedYogi', category: 'Adaptive', description: 'Controlled adaptivity' },
  { id: 'fedadagrad', name: 'FedAdagrad', category: 'Adaptive', description: 'Adagrad optimizer' },
  { id: 'fedavgm', name: 'FedAvgM', category: 'Standard', description: 'Server momentum' },
  { id: 'fedmedian', name: 'FedMedian', category: 'Byzantine-Robust', description: 'Median aggregation' },
  { id: 'fedtrimmedavg', name: 'FedTrimmedAvg', category: 'Byzantine-Robust', description: 'Trimmed mean' },
  { id: 'krum', name: 'Krum', category: 'Byzantine-Robust', description: 'Byzantine-robust selection' },
  { id: 'multikrum', name: 'Multi-Krum', category: 'Byzantine-Robust', description: 'Multi-Krum selection' },
  { id: 'bulyan', name: 'Bulyan', category: 'Byzantine-Robust', description: 'Krum + trimmed mean' },
  { id: 'qfedavg', name: 'QFedAvg', category: 'Fair', description: 'Fair federated learning' },
  { id: 'dpfedavg_adaptive', name: 'DP-FedAvg (Adaptive)', category: 'Privacy', description: 'Differential privacy' },
  { id: 'dpfedavg_fixed', name: 'DP-FedAvg (Fixed)', category: 'Privacy', description: 'Fixed clipping DP' },
];

interface TrainingJobGroupProps {
  group: TrainingJobGroup;
  onUpdate: (group: TrainingJobGroup) => void;
  onDelete: (groupId: string) => void;
  onStartGroup: (groupId: string) => void;
  onPauseGroup: (groupId: string) => void;
  onCancelGroup: (groupId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const TrainingJobGroupCard: React.FC<TrainingJobGroupProps> = ({
  group,
  onUpdate,
  onDelete,
  onStartGroup,
  onPauseGroup,
  onCancelGroup,
  isExpanded = false,
  onToggleExpand,
}) => {
  const [showAddJob, setShowAddJob] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  
  const completedJobs = group.jobs.filter(j => j.status === 'completed').length;
  const runningJobs = group.jobs.filter(j => j.status === 'running').length;
  const failedJobs = group.jobs.filter(j => j.status === 'failed').length;
  const progress = group.jobs.length > 0 ? (completedJobs / group.jobs.length) * 100 : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'paused': return <Pause className="w-4 h-4 text-yellow-400" />;
      case 'queued': return <Clock className="w-4 h-4 text-slate-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'completed': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'failed': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'paused': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  const handleAddJobs = () => {
    const models = group.type === 'central' ? CENTRAL_MODELS : FL_ALGORITHMS;
    const newJobs: TrainingJobInGroup[] = selectedModels.map(modelId => {
      const model = models.find(m => m.id === modelId);
      return {
        id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        config: group.type === 'central' 
          ? { id: modelId, model_type: modelId, epochs: 10, batch_size: 32, learning_rate: 0.001 }
          : { id: modelId, algorithm: modelId, num_rounds: 10, num_partitions: 5 },
        status: 'pending',
        progress: 0,
      };
    });
    
    onUpdate({
      ...group,
      jobs: [...group.jobs, ...newJobs],
    });
    setSelectedModels([]);
    setShowAddJob(false);
  };

  const handleRemoveJob = (jobId: string) => {
    onUpdate({
      ...group,
      jobs: group.jobs.filter(j => j.id !== jobId),
    });
  };

  const handleToggleExecutionMode = () => {
    onUpdate({
      ...group,
      execution_mode: group.execution_mode === 'parallel' ? 'sequential' : 'parallel',
    });
  };

  const models = group.type === 'central' ? CENTRAL_MODELS : FL_ALGORITHMS;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <button className="p-1 hover:bg-slate-700 rounded">
            {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
          <div className={`p-2 rounded-lg ${group.type === 'central' ? 'bg-indigo-500/20' : 'bg-purple-500/20'}`}>
            <Layers className={`w-5 h-5 ${group.type === 'central' ? 'text-indigo-400' : 'text-purple-400'}`} />
          </div>
          <div>
            <h3 className="text-white font-medium">{group.name}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`px-1.5 py-0.5 rounded ${group.type === 'central' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'}`}>
                {group.type === 'central' ? 'Central Training' : 'Federated Learning'}
              </span>
              <span className="flex items-center gap-1">
                {group.execution_mode === 'parallel' ? <Shuffle className="w-3 h-3" /> : <ListOrdered className="w-3 h-3" />}
                {group.execution_mode === 'parallel' ? 'Parallel' : 'Sequential'}
              </span>
              <span>{group.jobs.length} jobs</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-slate-400">{completedJobs}/{group.jobs.length}</span>
          </div>

          {/* Status Badge */}
          <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(group.status)}`}>
            {getStatusIcon(group.status)}
            <span className="ml-1">{group.status}</span>
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {group.status === 'draft' && (
              <button
                onClick={() => onStartGroup(group.id)}
                className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                title="Start Group"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            {group.status === 'running' && (
              <button
                onClick={() => onPauseGroup(group.id)}
                className="p-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                title="Pause Group"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            {(group.status === 'running' || group.status === 'paused') && (
              <button
                onClick={() => onCancelGroup(group.id)}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                title="Cancel Group"
              >
                <Square className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onDelete(group.id)}
              className="p-2 bg-slate-700 hover:bg-red-600 text-white rounded-lg transition-colors"
              title="Delete Group"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          {/* Execution Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">Execution Mode</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleExecutionMode}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  group.execution_mode === 'sequential' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <ListOrdered className="w-4 h-4 inline mr-1" />
                Sequential (Queue)
              </button>
              <button
                onClick={handleToggleExecutionMode}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  group.execution_mode === 'parallel' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Shuffle className="w-4 h-4 inline mr-1" />
                Parallel
              </button>
            </div>
          </div>

          {/* Jobs List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-300">Training Jobs</h4>
              <button
                onClick={() => setShowAddJob(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add {group.type === 'central' ? 'Models' : 'Algorithms'}
              </button>
            </div>

            {group.jobs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No jobs added yet</p>
                <button
                  onClick={() => setShowAddJob(true)}
                  className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm"
                >
                  Add {group.type === 'central' ? 'ML/DL models' : 'FL algorithms'}
                </button>
              </div>
            ) : (
              <div className="grid gap-2">
                {group.jobs.map((job, index) => {
                  const model = models.find(m => m.id === (job.config.model_type || job.config.algorithm));
                  return (
                    <div 
                      key={job.id}
                      className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-6">#{index + 1}</span>
                        {getStatusIcon(job.status)}
                        <div>
                          <span className="text-white font-medium">{model?.name || job.config.model_type || job.config.algorithm}</span>
                          <span className="text-xs text-slate-500 ml-2">{model?.category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {job.metrics?.accuracy !== undefined && (
                          <span className="text-xs text-green-400">
                            {(job.metrics.accuracy * 100).toFixed(1)}% acc
                          </span>
                        )}
                        {job.status === 'running' && (
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        )}
                        <button
                          onClick={() => handleRemoveJob(job.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          disabled={job.status === 'running'}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Jobs Modal */}
          {showAddJob && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddJob(false)}>
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Add {group.type === 'central' ? 'ML/DL Models' : 'FL Algorithms'}
                  </h3>
                  <button onClick={() => setShowAddJob(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-sm text-slate-400 mb-4">
                  Select multiple {group.type === 'central' ? 'models' : 'algorithms'} to add to this training group
                </p>

                {/* Group by category */}
                {Object.entries(
                  models.reduce((acc, model) => {
                    if (!acc[model.category]) acc[model.category] = [];
                    acc[model.category].push(model);
                    return acc;
                  }, {} as Record<string, typeof models>)
                ).map(([category, categoryModels]) => (
                  <div key={category} className="mb-4">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">{category}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {categoryModels.map(model => {
                        const isSelected = selectedModels.includes(model.id);
                        const alreadyAdded = group.jobs.some(j => (j.config.model_type || j.config.algorithm) === model.id);
                        return (
                          <button
                            key={model.id}
                            onClick={() => {
                              if (alreadyAdded) return;
                              setSelectedModels(prev => 
                                isSelected ? prev.filter(id => id !== model.id) : [...prev, model.id]
                              );
                            }}
                            disabled={alreadyAdded}
                            className={`p-3 rounded-lg border text-left transition-colors ${
                              alreadyAdded 
                                ? 'bg-slate-700/30 border-slate-600 opacity-50 cursor-not-allowed'
                                : isSelected 
                                  ? 'bg-indigo-600/20 border-indigo-500/40' 
                                  : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-white font-medium">{model.name}</span>
                              {isSelected && <CheckCircle className="w-4 h-4 text-indigo-400" />}
                              {alreadyAdded && <span className="text-xs text-slate-500">Added</span>}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{model.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => setShowAddJob(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddJobs}
                    disabled={selectedModels.length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add {selectedModels.length} {group.type === 'central' ? 'Model' : 'Algorithm'}{selectedModels.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Job Group Comparison Chart Component
interface JobGroupComparisonProps {
  group: TrainingJobGroup;
  metricType: 'accuracy' | 'loss';
}

export const JobGroupComparison: React.FC<JobGroupComparisonProps> = ({ group, metricType }) => {
  const completedJobs = group.jobs.filter(j => j.status === 'completed' && j.metrics);
  
  if (completedJobs.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 text-center">
        <GitCompare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-white font-medium mb-1">No Completed Jobs</h3>
        <p className="text-sm text-slate-400">Complete training jobs to see comparison</p>
      </div>
    );
  }

  const models = group.type === 'central' ? CENTRAL_MODELS : FL_ALGORITHMS;
  const maxValue = Math.max(...completedJobs.map(j => 
    metricType === 'accuracy' ? (j.metrics?.accuracy || 0) : (j.metrics?.loss || 0)
  ));

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-indigo-400" />
          {group.name} - {metricType === 'accuracy' ? 'Accuracy' : 'Loss'} Comparison
        </h3>
      </div>

      <div className="space-y-3">
        {completedJobs
          .sort((a, b) => {
            const aVal = metricType === 'accuracy' ? (a.metrics?.accuracy || 0) : (a.metrics?.loss || 0);
            const bVal = metricType === 'accuracy' ? (b.metrics?.accuracy || 0) : (b.metrics?.loss || 0);
            return metricType === 'accuracy' ? bVal - aVal : aVal - bVal;
          })
          .map((job, index) => {
            const model = models.find(m => m.id === (job.config.model_type || job.config.algorithm));
            const value = metricType === 'accuracy' ? (job.metrics?.accuracy || 0) : (job.metrics?.loss || 0);
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const isTop = index === 0;

            return (
              <div key={job.id} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {isTop && <TrendingUp className="w-4 h-4 text-green-400" />}
                    <span className={`font-medium ${isTop ? 'text-green-400' : 'text-white'}`}>
                      {model?.name || job.config.model_type || job.config.algorithm}
                    </span>
                    <span className="text-xs text-slate-500">{model?.category}</span>
                  </div>
                  <span className={`font-mono text-sm ${isTop ? 'text-green-400' : 'text-slate-300'}`}>
                    {metricType === 'accuracy' ? `${(value * 100).toFixed(2)}%` : value.toFixed(4)}
                  </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      isTop 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400' 
                        : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">
            {metricType === 'accuracy' 
              ? `${(Math.max(...completedJobs.map(j => j.metrics?.accuracy || 0)) * 100).toFixed(1)}%`
              : Math.min(...completedJobs.map(j => j.metrics?.loss || Infinity)).toFixed(4)
            }
          </div>
          <div className="text-xs text-slate-400">Best {metricType === 'accuracy' ? 'Accuracy' : 'Loss'}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-400">
            {metricType === 'accuracy'
              ? `${(completedJobs.reduce((sum, j) => sum + (j.metrics?.accuracy || 0), 0) / completedJobs.length * 100).toFixed(1)}%`
              : (completedJobs.reduce((sum, j) => sum + (j.metrics?.loss || 0), 0) / completedJobs.length).toFixed(4)
            }
          </div>
          <div className="text-xs text-slate-400">Average</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">{completedJobs.length}</div>
          <div className="text-xs text-slate-400">Completed Jobs</div>
        </div>
      </div>
    </div>
  );
};

// Create Job Group Modal
interface CreateJobGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (group: TrainingJobGroup) => void;
  type: 'central' | 'federated';
}

export const CreateJobGroupModal: React.FC<CreateJobGroupModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  type,
}) => {
  const [name, setName] = useState('');
  const [executionMode, setExecutionMode] = useState<'parallel' | 'sequential'>('sequential');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const models = type === 'central' ? CENTRAL_MODELS : FL_ALGORITHMS;

  const handleCreate = () => {
    if (!name.trim()) return;

    const newGroup: TrainingJobGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      type,
      execution_mode: executionMode,
      jobs: selectedModels.map(modelId => ({
        id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        config: type === 'central'
          ? { id: modelId, model_type: modelId, epochs: 10, batch_size: 32, learning_rate: 0.001 }
          : { id: modelId, algorithm: modelId, num_rounds: 10, num_partitions: 5 },
        status: 'pending',
        progress: 0,
      })),
      status: 'draft',
      created_at: new Date().toISOString(),
    };

    onCreate(newGroup);
    setName('');
    setSelectedModels([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Layers className={`w-6 h-6 ${type === 'central' ? 'text-indigo-400' : 'text-purple-400'}`} />
            Create {type === 'central' ? 'Central Training' : 'Federated Learning'} Job Group
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`My ${type === 'central' ? 'ML/DL' : 'FL'} Experiment`}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Execution Mode */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Execution Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setExecutionMode('sequential')}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  executionMode === 'sequential'
                    ? 'bg-indigo-600/20 border-indigo-500/40'
                    : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ListOrdered className="w-5 h-5 text-indigo-400" />
                  <span className="text-white font-medium">Sequential (Queue)</span>
                </div>
                <p className="text-xs text-slate-400">Jobs run one after another in order</p>
              </button>
              <button
                onClick={() => setExecutionMode('parallel')}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  executionMode === 'parallel'
                    ? 'bg-indigo-600/20 border-indigo-500/40'
                    : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shuffle className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-medium">Parallel</span>
                </div>
                <p className="text-xs text-slate-400">Jobs run simultaneously (resource permitting)</p>
              </button>
            </div>
          </div>

          {/* Model/Algorithm Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select {type === 'central' ? 'Models' : 'Algorithms'} to Compare
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Choose multiple {type === 'central' ? 'ML/DL models' : 'FL algorithms'} to train and compare
            </p>

            {Object.entries(
              models.reduce((acc, model) => {
                if (!acc[model.category]) acc[model.category] = [];
                acc[model.category].push(model);
                return acc;
              }, {} as Record<string, typeof models>)
            ).map(([category, categoryModels]) => (
              <div key={category} className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-400">{category}</h4>
                  <button
                    onClick={() => {
                      const categoryIds = categoryModels.map(m => m.id);
                      const allSelected = categoryIds.every(id => selectedModels.includes(id));
                      if (allSelected) {
                        setSelectedModels(prev => prev.filter(id => !categoryIds.includes(id)));
                      } else {
                        setSelectedModels(prev => Array.from(new Set([...prev, ...categoryIds])));
                      }
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    {categoryModels.every(m => selectedModels.includes(m.id)) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {categoryModels.map(model => {
                    const isSelected = selectedModels.includes(model.id);
                    return (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModels(prev =>
                            isSelected ? prev.filter(id => id !== model.id) : [...prev, model.id]
                          );
                        }}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500/40'
                            : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium text-sm">{model.name}</span>
                          {isSelected && <CheckCircle className="w-4 h-4 text-indigo-400" />}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{model.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-700">
          <span className="text-sm text-slate-400">
            {selectedModels.length} {type === 'central' ? 'model' : 'algorithm'}{selectedModels.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingJobGroupCard;
