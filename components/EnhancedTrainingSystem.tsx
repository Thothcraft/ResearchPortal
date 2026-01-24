/**
 * Enhanced Training System Component
 * 
 * Provides comprehensive training interface with:
 * - Deep Learning (DL) and Machine Learning (ML) sections
 * - CSI data upload and preprocessing
 * - Extensive configuration options
 * - Real-time training monitoring
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

// API Configuration
const API_BASE_URL = '/api/proxy';
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,  // Must be false when backend uses allow_origins=["*"]
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Types
interface TrainingSection {
  id: string;
  name: string;
  description: string;
  models: string[];
}

interface CSIConfig {
  include_phase: boolean;
  filter_subcarriers: boolean;
  subcarrier_range: [number, number];
  sample_size: number;
  preprocessing_methods: string[];
  moving_average_window: number;
  statistical_threshold: number;
  frequency_cutoff: number;
  wavelet_type: string;
  wavelet_level: number;
  baseband_cutoff: number;
  baseband_order: number;
  pca_components?: number;
}

interface DLConfig {
  model_type: string;
  input_size: number;
  hidden_layers: number[];
  dropout_rate: number;
  activation: string;
  batch_norm: boolean;
  optimizer: string;
  learning_rate: number;
  weight_decay: number;
  loss_function: string;
  epochs: number;
  batch_size: number;
  early_stopping_patience: number;
  scheduler?: string;
  scheduler_params: Record<string, any>;
}

interface MLConfig {
  model_type: string;
  n_neighbors: number;
  weights: string;
  algorithm: string;
  kernel: string;
  C: number;
  gamma: string;
  probability: boolean;
  n_estimators: number;
  max_depth?: number;
  min_samples_split: number;
  min_samples_leaf: number;
  bootstrap: boolean;
  random_state: number;
  cross_validation_folds: number;
  grid_search: boolean;
  grid_search_params: Record<string, any>;
}

interface TrainingJob {
  job_id: string;
  config: {
    section: string;
    data_source: string;
    csi_config?: CSIConfig;
    dl_config?: DLConfig;
    ml_config?: MLConfig;
    validation_split: number;
    test_split: number;
    metrics: string[];
    save_model: boolean;
    model_name?: string;
    device_id: string;
  };
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  current_epoch: number;
  total_epochs: number;
  metrics: Record<string, number[]>;
  best_metrics: Record<string, number>;
  error_message?: string;
  model_path?: string;
  data_shape?: [number, number];
  preprocessing_info: Record<string, any>;
}

const EnhancedTrainingSystem: React.FC = () => {
  // State management
  const [activeSection, setActiveSection] = useState<'dl' | 'ml'>('dl');
  const [csiDataFile, setCsiDataFile] = useState<File | null>(null);
  const [dataId, setDataId] = useState<string>('');
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelConfigs, setModelConfigs] = useState<any>(null);
  const [preprocessingMethods, setPreprocessingMethods] = useState<any>(null);

  // Configuration states
  const [csiConfig, setCsiConfig] = useState<CSIConfig>({
    include_phase: true,
    filter_subcarriers: true,
    subcarrier_range: [5, 32],
    sample_size: 1000,
    preprocessing_methods: ['amplitude_phase'],
    moving_average_window: 5,
    statistical_threshold: 2.0,
    frequency_cutoff: 0.1,
    wavelet_type: 'db4',
    wavelet_level: 1,
    baseband_cutoff: 0.1,
    baseband_order: 5
  });

  const [dlConfig, setDlConfig] = useState<DLConfig>({
    model_type: 'cnn',
    input_size: 10800,
    hidden_layers: [512, 256, 128],
    dropout_rate: 0.1,
    activation: 'relu',
    batch_norm: true,
    optimizer: 'adam',
    learning_rate: 0.001,
    weight_decay: 1e-4,
    loss_function: 'crossentropy',
    epochs: 100,
    batch_size: 32,
    early_stopping_patience: 20,
    scheduler_params: {}
  });

  const [mlConfig, setMlConfig] = useState<MLConfig>({
    model_type: 'random_forest',
    n_neighbors: 5,
    weights: 'uniform',
    algorithm: 'auto',
    kernel: 'rbf',
    C: 1.0,
    gamma: 'scale',
    probability: true,
    n_estimators: 100,
    min_samples_split: 2,
    min_samples_leaf: 1,
    bootstrap: true,
    random_state: 42,
    cross_validation_folds: 5,
    grid_search: false,
    grid_search_params: {}
  });

  // Load initial data
  useEffect(() => {
    loadModelConfigs();
    loadPreprocessingMethods();
    loadTrainingJobs();
  }, []);

  const loadModelConfigs = async () => {
    try {
      const response = await api.get('/enhanced-training/model-configs');
      setModelConfigs(response.data);
    } catch (error) {
      console.error('Failed to load model configs:', error);
    }
  };

  const loadPreprocessingMethods = async () => {
    try {
      const response = await api.get('/enhanced-processing/preprocessing-methods');
      setPreprocessingMethods(response.data.methods);
    } catch (error) {
      console.error('Failed to load preprocessing methods:', error);
    }
  };

  const loadTrainingJobs = async () => {
    try {
      const response = await api.get('/enhanced-training/training-status');
      if (response.data.jobs) {
        setTrainingJobs(response.data.jobs);
      }
    } catch (error) {
      console.error('Failed to load training jobs:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsiDataFile(file);
      await uploadCSIData(file);
    }
  };

  const uploadCSIData = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/enhanced-training/upload-csi-data', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setDataId(response.data.data_id);
      alert('CSI data uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload CSI data:', error);
      alert('Failed to upload CSI data');
    } finally {
      setLoading(false);
    }
  };

  const preprocessCSIData = async () => {
    if (!dataId) {
      alert('Please upload CSI data first');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/enhanced-training/preprocess-csi-data', csiConfig, {
        params: { dataId }
      });
      
      alert('CSI data preprocessed successfully!');
      console.log('Preprocessing result:', response.data);
    } catch (error) {
      console.error('Failed to preprocess CSI data:', error);
      alert('Failed to preprocess CSI data');
    } finally {
      setLoading(false);
    }
  };

  const startTraining = async () => {
    if (!dataId) {
      alert('Please upload and preprocess CSI data first');
      return;
    }

    setLoading(true);
    try {
      const config = {
        section: activeSection,
        data_source: 'csi_data',
        csi_config: csiConfig,
        dl_config: activeSection === 'dl' ? dlConfig : undefined,
        ml_config: activeSection === 'ml' ? mlConfig : undefined,
        validation_split: 0.2,
        test_split: 0.1,
        metrics: ['accuracy', 'precision', 'recall', 'f1'],
        save_model: true,
        device_id: 'thoth-001'
      };

      const response = await api.post('/enhanced-training/start-training', config, {
        params: { dataId }
      });
      
      alert('Training started successfully!');
      loadTrainingJobs(); // Refresh jobs list
    } catch (error) {
      console.error('Failed to start training:', error);
      alert('Failed to start training');
    } finally {
      setLoading(false);
    }
  };

  const getJobStatus = async (jobId: string) => {
    try {
      const response = await api.get('/enhanced-training/training-status', {
        params: { job_id: jobId }
      });
      setSelectedJob(response.data);
    } catch (error) {
      console.error('Failed to get job status:', error);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await api.delete(`/enhanced-training/training-job/${jobId}`);
      alert('Training job cancelled');
      loadTrainingJobs();
    } catch (error) {
      console.error('Failed to cancel job:', error);
      alert('Failed to cancel job');
    }
  };

  // Render helpers
  const renderCSIConfig = () => (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">CSI Data Configuration</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Include Phase</label>
          <input
            type="checkbox"
            checked={csiConfig.include_phase}
            onChange={(e) => setCsiConfig({...csiConfig, include_phase: e.target.checked})}
            className="mr-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Filter Subcarriers</label>
          <input
            type="checkbox"
            checked={csiConfig.filter_subcarriers}
            onChange={(e) => setCsiConfig({...csiConfig, filter_subcarriers: e.target.checked})}
            className="mr-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Sample Size</label>
          <input
            type="number"
            value={csiConfig.sample_size}
            onChange={(e) => setCsiConfig({...csiConfig, sample_size: parseInt(e.target.value)})}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Moving Average Window</label>
          <input
            type="number"
            value={csiConfig.moving_average_window}
            onChange={(e) => setCsiConfig({...csiConfig, moving_average_window: parseInt(e.target.value)})}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      </div>
      
      <div className="mt-4">
        <label className="block text-sm font-medium mb-2">Preprocessing Methods</label>
        <div className="space-y-2">
          {preprocessingMethods && Object.entries(preprocessingMethods).map(([key, method]: [string, any]) => (
            <label key={key} className="flex items-center">
              <input
                type="checkbox"
                checked={csiConfig.preprocessing_methods.includes(key)}
                onChange={(e) => {
                  const methods = e.target.checked
                    ? [...csiConfig.preprocessing_methods, key]
                    : csiConfig.preprocessing_methods.filter(m => m !== key);
                  setCsiConfig({...csiConfig, preprocessing_methods: methods});
                }}
                className="mr-2"
              />
              <span className="text-sm">{method.name}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDLConfig = () => (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Deep Learning Configuration</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Model Type</label>
          <select
            value={dlConfig.model_type}
            onChange={(e) => setDlConfig({...dlConfig, model_type: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="cnn">CNN</option>
            <option value="lstm">LSTM</option>
            <option value="gru">GRU</option>
            <option value="transformer">Transformer</option>
            <option value="cnn_lstm">CNN-LSTM</option>
            <option value="autoencoder">Autoencoder</option>
            <option value="vae">VAE</option>
            <option value="resnet">ResNet</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Optimizer</label>
          <select
            value={dlConfig.optimizer}
            onChange={(e) => setDlConfig({...dlConfig, optimizer: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="adam">Adam</option>
            <option value="sgd">SGD</option>
            <option value="rmsprop">RMSprop</option>
            <option value="adamw">AdamW</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Learning Rate</label>
          <input
            type="number"
            step="0.0001"
            value={dlConfig.learning_rate}
            onChange={(e) => setDlConfig({...dlConfig, learning_rate: parseFloat(e.target.value)})}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Batch Size</label>
          <input
            type="number"
            value={dlConfig.batch_size}
            onChange={(e) => setDlConfig({...dlConfig, batch_size: parseInt(e.target.value)})}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Epochs</label>
          <input
            type="number"
            value={dlConfig.epochs}
            onChange={(e) => setDlConfig({...dlConfig, epochs: parseInt(e.target.value)})}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Dropout Rate</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={dlConfig.dropout_rate}
            onChange={(e) => setDlConfig({...dlConfig, dropout_rate: parseFloat(e.target.value)})}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      </div>
      
      <div className="mt-4">
        <label className="block text-sm font-medium mb-2">Hidden Layers</label>
        <div className="flex space-x-2">
          {dlConfig.hidden_layers.map((size, index) => (
            <input
              key={index}
              type="number"
              value={size}
              onChange={(e) => {
                const newLayers = [...dlConfig.hidden_layers];
                newLayers[index] = parseInt(e.target.value);
                setDlConfig({...dlConfig, hidden_layers: newLayers});
              }}
              className="w-20 px-2 py-1 border rounded-md"
            />
          ))}
          <button
            onClick={() => setDlConfig({...dlConfig, hidden_layers: [...dlConfig.hidden_layers, 128]})}
            className="px-3 py-1 bg-blue-500 text-white rounded-md"
          >
            Add Layer
          </button>
        </div>
      </div>
    </div>
  );

  const renderMLConfig = () => (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Machine Learning Configuration</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Algorithm</label>
          <select
            value={mlConfig.model_type}
            onChange={(e) => setMlConfig({...mlConfig, model_type: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="knn">KNN</option>
            <option value="svc">SVC</option>
            <option value="random_forest">Random Forest</option>
            <option value="gradient_boosting">Gradient Boosting</option>
            <option value="xgboost">XGBoost</option>
            <option value="lightgbm">LightGBM</option>
            <option value="ada_boost">Ada Boost</option>
            <option value="decision_tree">Decision Tree</option>
            <option value="naive_bayes">Naive Bayes</option>
            <option value="logistic_regression">Logistic Regression</option>
          </select>
        </div>
        
        {mlConfig.model_type === 'knn' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">N Neighbors</label>
              <input
                type="number"
                value={mlConfig.n_neighbors}
                onChange={(e) => setMlConfig({...mlConfig, n_neighbors: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Weights</label>
              <select
                value={mlConfig.weights}
                onChange={(e) => setMlConfig({...mlConfig, weights: e.target.value})}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="uniform">Uniform</option>
                <option value="distance">Distance</option>
              </select>
            </div>
          </>
        )}
        
        {mlConfig.model_type === 'svc' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Kernel</label>
              <select
                value={mlConfig.kernel}
                onChange={(e) => setMlConfig({...mlConfig, kernel: e.target.value})}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="linear">Linear</option>
                <option value="poly">Polynomial</option>
                <option value="rbf">RBF</option>
                <option value="sigmoid">Sigmoid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">C (Regularization)</label>
              <input
                type="number"
                step="0.1"
                value={mlConfig.C}
                onChange={(e) => setMlConfig({...mlConfig, C: parseFloat(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </>
        )}
        
        {mlConfig.model_type === 'random_forest' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">N Estimators</label>
              <input
                type="number"
                value={mlConfig.n_estimators}
                onChange={(e) => setMlConfig({...mlConfig, n_estimators: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Max Depth</label>
              <input
                type="number"
                value={mlConfig.max_depth || ''}
                onChange={(e) => setMlConfig({...mlConfig, max_depth: e.target.value ? parseInt(e.target.value) : undefined})}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="None"
              />
            </div>
          </>
        )}
        
        <div>
          <label className="block text-sm font-medium mb-2">Cross Validation Folds</label>
          <input
            type="number"
            value={mlConfig.cross_validation_folds}
            onChange={(e) => setMlConfig({...mlConfig, cross_validation_folds: parseInt(e.target.value)})}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Grid Search</label>
          <input
            type="checkbox"
            checked={mlConfig.grid_search}
            onChange={(e) => setMlConfig({...mlConfig, grid_search: e.target.checked})}
            className="mr-2"
          />
        </div>
      </div>
    </div>
  );

  const renderTrainingJobs = () => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Training Jobs</h3>
      
      <div className="space-y-4">
        {trainingJobs.map((job) => (
          <div key={job.job_id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium">{job.config.section.toUpperCase()} Training</h4>
                <p className="text-sm text-gray-600">Model: {job.config.dl_config?.model_type || job.config.ml_config?.model_type}</p>
                <p className="text-sm text-gray-600">Status: <span className={`font-medium ${
                  job.status === 'completed' ? 'text-green-600' :
                  job.status === 'running' ? 'text-blue-600' :
                  job.status === 'failed' ? 'text-red-600' : 'text-gray-600'
                }`}>{job.status}</span></p>
                <p className="text-sm text-gray-600">Progress: {job.current_epoch}/{job.total_epochs}</p>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => getJobStatus(job.job_id)}
                  className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm"
                >
                  Details
                </button>
                {job.status === 'running' && (
                  <button
                    onClick={() => cancelJob(job.job_id)}
                    className="px-3 py-1 bg-red-500 text-white rounded-md text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            
            {job.metrics && Object.entries(job.metrics).length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium text-sm mb-2">Latest Metrics:</h5>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  {Object.entries(job.metrics).map(([metric, values]) => (
                    <div key={metric}>
                      <span className="font-medium">{metric}:</span>
                      <span className="ml-2">{values && values.length > 0 ? values[values.length - 1]?.toFixed(4) : 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Enhanced Training System</h1>
      
      {/* Section Selector */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveSection('dl')}
          className={`px-4 py-2 rounded-md font-medium ${
            activeSection === 'dl' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Deep Learning (DL)
        </button>
        <button
          onClick={() => setActiveSection('ml')}
          className={`px-4 py-2 rounded-md font-medium ${
            activeSection === 'ml' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          Machine Learning (ML)
        </button>
      </div>
      
      {/* CSI Data Upload */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">CSI Data Upload</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Upload CSI CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          {dataId && (
            <div className="text-sm text-green-600">
              ✓ Data uploaded successfully (ID: {dataId})
            </div>
          )}
          
          <button
            onClick={preprocessCSIData}
            disabled={!dataId || loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Preprocess Data'}
          </button>
        </div>
      </div>
      
      {/* Configuration Sections */}
      {renderCSIConfig()}
      {activeSection === 'dl' ? renderDLConfig() : renderMLConfig()}
      
      {/* Training Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Training Controls</h3>
        
        <div className="flex space-x-4">
          <button
            onClick={startTraining}
            disabled={!dataId || loading}
            className="px-6 py-2 bg-green-500 text-white rounded-md disabled:opacity-50"
          >
            {loading ? 'Starting...' : 'Start Training'}
          </button>
          
          <button
            onClick={loadTrainingJobs}
            className="px-6 py-2 bg-gray-500 text-white rounded-md"
          >
            Refresh Jobs
          </button>
        </div>
      </div>
      
      {/* Training Jobs */}
      {renderTrainingJobs()}
      
      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Training Job Details</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Job Information</h4>
                <p>Job ID: {selectedJob.job_id}</p>
                <p>Status: {selectedJob.status}</p>
                <p>Section: {selectedJob.config.section}</p>
                <p>Model: {selectedJob.config.dl_config?.model_type || selectedJob.config.ml_config?.model_type}</p>
              </div>
              
              {selectedJob.metrics && (
                <div>
                  <h4 className="font-medium">Metrics History</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedJob.metrics).map(([metric, values]) => (
                      <div key={metric}>
                        <span className="font-medium">{metric}:</span>
                        <span className="ml-2">{values && Array.isArray(values) ? values.map(v => v.toFixed(4)).join(', ') : 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedJob.best_metrics && (
                <div>
                  <h4 className="font-medium">Best Metrics</h4>
                  <div className="space-y-1">
                    {Object.entries(selectedJob.best_metrics).map(([metric, value]) => (
                      <div key={metric}>
                        <span className="font-medium">{metric}:</span>
                        <span className="ml-2">{typeof value === 'number' ? value.toFixed(4) : 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedTrainingSystem;
