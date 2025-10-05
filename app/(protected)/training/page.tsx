'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Play, RefreshCw, Settings, TrendingUp } from 'lucide-react';
import TrainingMonitor from '../../components/TrainingMonitor';
import apiService from '../../services/api';

export default function TrainingPage() {
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [completedModels, setCompletedModels] = useState<any[]>([]);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Training setup form
  const [trainingConfig, setTrainingConfig] = useState({
    model: 'cnn',
    data: 'sensors',
    mode: 'on-device',
    epochs: 10,
    batch_size: 32,
    learning_rate: 0.001,
    validation_split: 0.2,
    device_id: 'thoth-001'
  });

  useEffect(() => {
    fetchTrainingJobs();
    fetchModels();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchTrainingJobs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchTrainingJobs = async () => {
    try {
      const response = await apiService.getTrainingStatus();
      if ('jobs' in response) {
        // Add mock metrics for demo
        const jobsWithMetrics = response.jobs.map((job: any) => ({
          ...job,
          current_epoch: parseInt(job.progress?.split('/')[0] || '0'),
          total_epochs: parseInt(job.progress?.split('/')[1] || '10'),
          metrics: {
            loss: [0.5, 0.4, 0.35, 0.3, 0.28],
            accuracy: [0.6, 0.7, 0.75, 0.78, 0.8],
            val_loss: [0.55, 0.45, 0.4, 0.38, 0.35],
            val_accuracy: [0.58, 0.68, 0.72, 0.74, 0.76]
          },
          best_metrics: {
            val_accuracy: 0.76,
            best_epoch: 5
          }
        }));
        setActiveJobs(jobsWithMetrics.filter((j: any) => 
          ['running', 'paused', 'pending'].includes(j.status)
        ));
      }
    } catch (error) {
      console.error('Failed to fetch training jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await apiService.getTrainedModels();
      if (response.models) {
        setCompletedModels(response.models);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const handleStartTraining = async () => {
    try {
      const response = await apiService.setupTraining(trainingConfig);
      if (response.success) {
        setShowSetupModal(false);
        fetchTrainingJobs();
      }
    } catch (error) {
      console.error('Failed to start training:', error);
    }
  };

  const handleControlJob = async (jobId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      await apiService.controlTraining(jobId, action);
      fetchTrainingJobs();
    } catch (error) {
      console.error(`Failed to ${action} job:`, error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Model Training</h1>
          <p className="text-gray-300">Train and deploy AI models on Thoth devices</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
            <p className="text-gray-400 text-sm mb-1">Active Jobs</p>
            <p className="text-2xl font-bold text-green-400">{activeJobs.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
            <p className="text-gray-400 text-sm mb-1">Trained Models</p>
            <p className="text-2xl font-bold text-blue-400">{completedModels.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
            <p className="text-gray-400 text-sm mb-1">Best Accuracy</p>
            <p className="text-2xl font-bold text-purple-400">
              {completedModels.length > 0 
                ? `${Math.max(...completedModels.map(m => m.accuracy || 0)).toFixed(1)}%`
                : 'N/A'}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
            <p className="text-gray-400 text-sm mb-1">Total GPU Hours</p>
            <p className="text-2xl font-bold text-orange-400">24.5</p>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-4 mb-6"
        >
          <button
            onClick={() => setShowSetupModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg"
          >
            <Brain className="w-5 h-5" />
            New Training Job
          </button>
          <button
            onClick={fetchTrainingJobs}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors flex items-center gap-2 border border-white/20"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
        </motion.div>

        {/* Active Training Jobs */}
        {activeJobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-semibold text-white mb-4">Active Training Jobs</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeJobs.map((job, index) => (
                <motion.div
                  key={job.job_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <TrainingMonitor job={job} onControl={handleControlJob} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Completed Models */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-semibold text-white mb-4">Trained Models</h2>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs uppercase bg-black/20">
                <tr>
                  <th className="px-6 py-3">Model Name</th>
                  <th className="px-6 py-3">Architecture</th>
                  <th className="px-6 py-3">Accuracy</th>
                  <th className="px-6 py-3">Size</th>
                  <th className="px-6 py-3">Device</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {completedModels.map((model, index) => (
                  <tr key={model.model_id} className="border-b border-white/10">
                    <td className="px-6 py-4 font-medium text-white">{model.model_name}</td>
                    <td className="px-6 py-4">{model.architecture}</td>
                    <td className="px-6 py-4">
                      <span className="text-green-400 font-medium">
                        {model.accuracy ? `${(model.accuracy * 100).toFixed(2)}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">{model.size_mb?.toFixed(1)} MB</td>
                    <td className="px-6 py-4">{model.device_id || model.num_clients ? `${model.num_clients} devices` : 'N/A'}</td>
                    <td className="px-6 py-4">
                      {model.created_at ? new Date(model.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-blue-400 hover:text-blue-300 mr-3">Deploy</button>
                      <button className="text-purple-400 hover:text-purple-300">Download</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {completedModels.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No trained models yet. Start a training job to create your first model.
              </div>
            )}
          </div>
        </motion.div>

        {/* Training Setup Modal */}
        {showSetupModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 border border-white/20"
            >
              <h3 className="text-xl font-semibold text-white mb-4">Setup Training Job</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Model Architecture</label>
                  <select
                    value={trainingConfig.model}
                    onChange={(e) => setTrainingConfig({...trainingConfig, model: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  >
                    <option value="cnn">CNN</option>
                    <option value="rnn">RNN</option>
                    <option value="lstm">LSTM</option>
                    <option value="transformer">Transformer</option>
                    <option value="linear">Linear</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Data Source</label>
                  <select
                    value={trainingConfig.data}
                    onChange={(e) => setTrainingConfig({...trainingConfig, data: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  >
                    <option value="sensors">Sensor Data</option>
                    <option value="images">Images</option>
                    <option value="audio">Audio</option>
                    <option value="text">Text</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Training Mode</label>
                  <select
                    value={trainingConfig.mode}
                    onChange={(e) => setTrainingConfig({...trainingConfig, mode: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  >
                    <option value="on-device">On Device</option>
                    <option value="cloud">Cloud</option>
                    <option value="edge">Edge</option>
                    <option value="federated">Federated</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Epochs</label>
                    <input
                      type="number"
                      value={trainingConfig.epochs}
                      onChange={(e) => setTrainingConfig({...trainingConfig, epochs: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Batch Size</label>
                    <input
                      type="number"
                      value={trainingConfig.batch_size}
                      onChange={(e) => setTrainingConfig({...trainingConfig, batch_size: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Learning Rate</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={trainingConfig.learning_rate}
                    onChange={(e) => setTrainingConfig({...trainingConfig, learning_rate: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleStartTraining}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-medium transition-all"
                >
                  Start Training
                </button>
                <button
                  onClick={() => setShowSetupModal(false)}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/20"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
