'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, StopCircle, TrendingUp, Clock, Cpu } from 'lucide-react';

interface TrainingMonitorProps {
  job: {
    job_id: string;
    model: string;
    status: string;
    current_epoch: number;
    total_epochs: number;
    metrics: {
      loss: number[];
      accuracy: number[];
      val_loss?: number[];
      val_accuracy?: number[];
    };
    best_metrics?: {
      val_accuracy?: number;
      best_epoch?: number;
    };
  };
  onControl: (jobId: string, action: 'pause' | 'resume' | 'cancel') => void;
}

export default function TrainingMonitor({ job, onControl }: TrainingMonitorProps) {
  const progress = (job.current_epoch / job.total_epochs) * 100;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-500';
      case 'paused': return 'text-yellow-500';
      case 'completed': return 'text-blue-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getLatestMetrics = () => {
    const latest: any = {};
    if (job.metrics.loss?.length > 0) {
      latest.loss = job.metrics.loss[job.metrics.loss.length - 1].toFixed(4);
    }
    if (job.metrics.accuracy?.length > 0) {
      latest.accuracy = (job.metrics.accuracy[job.metrics.accuracy.length - 1] * 100).toFixed(2);
    }
    if (job.metrics.val_loss?.length > 0) {
      latest.val_loss = job.metrics.val_loss[job.metrics.val_loss.length - 1].toFixed(4);
    }
    if (job.metrics.val_accuracy?.length > 0) {
      latest.val_accuracy = (job.metrics.val_accuracy[job.metrics.val_accuracy.length - 1] * 100).toFixed(2);
    }
    return latest;
  };

  const latestMetrics = getLatestMetrics();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-xl"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Training Job</h3>
          <p className="text-sm text-gray-300">Model: {job.model}</p>
          <p className="text-xs text-gray-400 mt-1">ID: {job.job_id}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
          {job.status.toUpperCase()}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-300 mb-2">
          <span>Epoch {job.current_epoch} / {job.total_epochs}</span>
          <span>{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {latestMetrics.loss !== undefined && (
          <div className="bg-black/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Loss</span>
            </div>
            <p className="text-lg font-semibold text-white">{latestMetrics.loss}</p>
          </div>
        )}
        
        {latestMetrics.accuracy !== undefined && (
          <div className="bg-black/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Accuracy</span>
            </div>
            <p className="text-lg font-semibold text-white">{latestMetrics.accuracy}%</p>
          </div>
        )}
        
        {latestMetrics.val_loss !== undefined && (
          <div className="bg-black/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-gray-400">Val Loss</span>
            </div>
            <p className="text-lg font-semibold text-white">{latestMetrics.val_loss}</p>
          </div>
        )}
        
        {latestMetrics.val_accuracy !== undefined && (
          <div className="bg-black/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400">Val Accuracy</span>
            </div>
            <p className="text-lg font-semibold text-white">{latestMetrics.val_accuracy}%</p>
          </div>
        )}
      </div>

      {/* Best Metrics */}
      {job.best_metrics?.val_accuracy && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-green-400">
            Best Accuracy: {(job.best_metrics.val_accuracy * 100).toFixed(2)}% 
            {job.best_metrics.best_epoch && ` (Epoch ${job.best_metrics.best_epoch})`}
          </p>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-2">
        {job.status === 'running' && (
          <button
            onClick={() => onControl(job.job_id, 'pause')}
            className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
        )}
        
        {job.status === 'paused' && (
          <button
            onClick={() => onControl(job.job_id, 'resume')}
            className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        )}
        
        {(job.status === 'running' || job.status === 'paused') && (
          <button
            onClick={() => onControl(job.job_id, 'cancel')}
            className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <StopCircle className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>
    </motion.div>
  );
}
