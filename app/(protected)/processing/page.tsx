'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import {
  Workflow,
  Plus,
  Play,
  Save,
  Trash2,
  Download,
  Upload,
  Settings,
  ArrowRight,
  Database,
  Activity,
  Wifi,
  Radio,
  Filter,
  TrendingUp,
  Shuffle,
  Maximize2,
  Minimize2,
  Zap,
  BarChart3,
  X,
} from 'lucide-react';

type DataType = 'imu' | 'csi' | 'mfcw' | 'image' | 'video';

type ProcessingBlock = {
  id: string;
  type: string;
  name: string;
  dataType: DataType;
  inputShape: number[];
  outputShape: number[];
  config: Record<string, any>;
  position: { x: number; y: number };
};

type Pipeline = {
  id: number;
  name: string;
  description: string;
  blocks: ProcessingBlock[];
  connections: Array<{ from: string; to: string }>;
  created_at: string;
};

const BLOCK_TYPES = {
  // IMU Preprocessing
  normalize: {
    name: 'Normalize',
    icon: TrendingUp,
    color: 'blue',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Normalize data to [0, 1] or [-1, 1]',
    config: { method: 'minmax', range: [0, 1] },
    transformShape: (input: number[]) => input,
  },
  lowpass_filter: {
    name: 'Low-Pass Filter',
    icon: Filter,
    color: 'green',
    dataTypes: ['imu', 'csi'],
    description: 'Remove high-frequency noise',
    config: { cutoff_freq: 20, order: 4 },
    transformShape: (input: number[]) => input,
  },
  highpass_filter: {
    name: 'High-Pass Filter',
    icon: Filter,
    color: 'purple',
    dataTypes: ['imu', 'csi'],
    description: 'Remove low-frequency drift',
    config: { cutoff_freq: 0.5, order: 4 },
    transformShape: (input: number[]) => input,
  },
  window_segmentation: {
    name: 'Window Segmentation',
    icon: Maximize2,
    color: 'yellow',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Split into fixed-size windows',
    config: { window_size: 128, overlap: 0.5 },
    transformShape: (input: number[]) => [input[0] * 2, 128, input[2] || 1],
  },
  fft_transform: {
    name: 'FFT Transform',
    icon: Zap,
    color: 'red',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Convert to frequency domain',
    config: { n_fft: 256 },
    transformShape: (input: number[]) => [input[0], Math.floor((input[1] || 128) / 2) + 1, input[2] || 1],
  },
  feature_extraction: {
    name: 'Feature Extraction',
    icon: BarChart3,
    color: 'indigo',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Extract statistical features',
    config: { features: ['mean', 'std', 'min', 'max', 'rms'] },
    transformShape: (input: number[]) => [input[0], 5 * (input[2] || 1)],
  },
  data_augmentation: {
    name: 'Data Augmentation',
    icon: Shuffle,
    color: 'pink',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Add noise, scale, rotate',
    config: { noise_level: 0.01, scale_range: [0.9, 1.1] },
    transformShape: (input: number[]) => input,
  },
  downsample: {
    name: 'Downsample',
    icon: Minimize2,
    color: 'orange',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Reduce sampling rate',
    config: { factor: 2 },
    transformShape: (input: number[]) => [input[0], Math.floor((input[1] || 128) / 2), input[2] || 1],
  },
  standardize: {
    name: 'Standardize',
    icon: TrendingUp,
    color: 'teal',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Zero mean, unit variance',
    config: { method: 'zscore' },
    transformShape: (input: number[]) => input,
  },
};

export default function ProcessingPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [blocks, setBlocks] = useState<ProcessingBlock[]>([]);
  const [connections, setConnections] = useState<Array<{ from: string; to: string }>>([]);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [selectedDataType, setSelectedDataType] = useState<DataType>('imu');
  const [error, setError] = useState<string | null>(null);
  const [showCreatePipeline, setShowCreatePipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineDesc, setNewPipelineDesc] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<ProcessingBlock | null>(null);
  const [showBlockConfig, setShowBlockConfig] = useState(false);
  const { get, post, put } = useApi();

  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    try {
      const res = await get('/processing/pipelines');
      if (res?.pipelines) setPipelines(res.pipelines);
    } catch (err) {
      console.error('Failed to fetch pipelines:', err);
    }
  };

  const handleCreatePipeline = async () => {
    if (!newPipelineName.trim()) return;
    try {
      const res = await post('/processing/pipelines', {
        name: newPipelineName,
        description: newPipelineDesc,
      });
      if (res?.success) {
        setShowCreatePipeline(false);
        setNewPipelineName('');
        setNewPipelineDesc('');
        fetchPipelines();
      }
    } catch (err) {
      setError('Failed to create pipeline');
    }
  };

  const handleAddBlock = (blockType: string) => {
    const blockDef = BLOCK_TYPES[blockType as keyof typeof BLOCK_TYPES];
    if (!blockDef) return;

    const newBlock: ProcessingBlock = {
      id: `block_${Date.now()}`,
      type: blockType,
      name: blockDef.name,
      dataType: selectedDataType,
      inputShape: selectedDataType === 'imu' ? [1, 128, 6] : [1, 256, 52],
      outputShape: blockDef.transformShape(selectedDataType === 'imu' ? [1, 128, 6] : [1, 256, 52]),
      config: { ...blockDef.config },
      position: { x: 100 + blocks.length * 50, y: 100 + blocks.length * 50 },
    };

    setBlocks([...blocks, newBlock]);
    setShowBlockMenu(false);
  };

  const handleDeleteBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId));
    setConnections(connections.filter(c => c.from !== blockId && c.to !== blockId));
  };

  const handleSavePipeline = async () => {
    if (!selectedPipeline) return;
    try {
      await put(`/processing/pipelines/${selectedPipeline.id}`, {
        blocks,
        connections,
      });
      fetchPipelines();
    } catch (err) {
      setError('Failed to save pipeline');
    }
  };

  const getBlockIcon = (type: string) => {
    const blockDef = BLOCK_TYPES[type as keyof typeof BLOCK_TYPES];
    return blockDef?.icon || Settings;
  };

  const getBlockColor = (type: string) => {
    const blockDef = BLOCK_TYPES[type as keyof typeof BLOCK_TYPES];
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-500/20 border-blue-500 text-blue-400',
      green: 'bg-green-500/20 border-green-500 text-green-400',
      purple: 'bg-purple-500/20 border-purple-500 text-purple-400',
      yellow: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
      red: 'bg-red-500/20 border-red-500 text-red-400',
      indigo: 'bg-indigo-500/20 border-indigo-500 text-indigo-400',
      pink: 'bg-pink-500/20 border-pink-500 text-pink-400',
      orange: 'bg-orange-500/20 border-orange-500 text-orange-400',
      teal: 'bg-teal-500/20 border-teal-500 text-teal-400',
    };
    return colorMap[blockDef?.color || 'blue'] || colorMap.blue;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Data Processing Pipelines</h1>
          <p className="text-slate-400">Build preprocessing and postprocessing workflows</p>
        </div>
        <button
          onClick={() => setShowCreatePipeline(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Pipeline
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center justify-between">
          <span className="text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Pipelines List */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold text-white mb-4">Pipelines</h2>
          <div className="space-y-2">
            {pipelines.length === 0 ? (
              <div className="text-center py-8 bg-slate-800/50 rounded-xl border border-slate-700">
                <Workflow className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No pipelines yet</p>
              </div>
            ) : (
              pipelines.map(pipeline => (
                <button
                  key={pipeline.id}
                  onClick={() => {
                    setSelectedPipeline(pipeline);
                    setBlocks(pipeline.blocks || []);
                    setConnections(pipeline.connections || []);
                  }}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    selectedPipeline?.id === pipeline.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <h3 className="font-medium text-white mb-1">{pipeline.name}</h3>
                  <p className="text-slate-400 text-sm">{pipeline.blocks?.length || 0} blocks</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Pipeline Canvas */}
        <div className="lg:col-span-3">
          {selectedPipeline ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">{selectedPipeline.name}</h2>
                  <p className="text-slate-400 text-sm">{selectedPipeline.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBlockMenu(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Block
                  </button>
                  <button
                    onClick={handleSavePipeline}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                </div>
              </div>

              {/* Data Type Selector */}
              <div className="mb-6">
                <label className="block text-sm text-slate-300 mb-2">Input Data Type</label>
                <div className="flex gap-2">
                  {(['imu', 'csi', 'mfcw'] as DataType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedDataType(type)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedDataType === type
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pipeline Blocks */}
              <div className="min-h-[400px] bg-slate-900/50 rounded-lg border border-slate-700 p-6 relative">
                {blocks.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Workflow className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                      <p className="text-slate-400">Add blocks to build your pipeline</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-4">
                    {blocks.map((block, index) => {
                      const Icon = getBlockIcon(block.type);
                      const colorClass = getBlockColor(block.type);
                      return (
                        <div key={block.id} className="flex items-center gap-2">
                          <div className={`relative p-4 rounded-xl border-2 ${colorClass} min-w-[200px]`}>
                            <button
                              onClick={() => handleDeleteBlock(block.id)}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <div className="flex items-center gap-2 mb-3">
                              <Icon className="w-5 h-5" />
                              <span className="font-medium text-white">{block.name}</span>
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Input:</span>
                                <span className="text-white font-mono">{block.inputShape.join(' × ')}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Output:</span>
                                <span className="text-white font-mono">{block.outputShape.join(' × ')}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedBlock(block);
                                setShowBlockConfig(true);
                              }}
                              className="mt-3 w-full px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                            >
                              Configure
                            </button>
                          </div>
                          {index < blocks.length - 1 && (
                            <ArrowRight className="w-6 h-6 text-slate-500" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
              <Workflow className="w-20 h-20 text-slate-500 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">No Pipeline Selected</h3>
              <p className="text-slate-400">Select a pipeline from the list or create a new one</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Block Menu Modal */}
      {showBlockMenu && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-3xl border border-slate-700 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-white mb-4">Add Processing Block</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(BLOCK_TYPES).map(([key, block]) => {
                const Icon = block.icon;
                const colorClass = getBlockColor(key);
                const isCompatible = block.dataTypes.includes(selectedDataType);
                return (
                  <button
                    key={key}
                    onClick={() => isCompatible && handleAddBlock(key)}
                    disabled={!isCompatible}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isCompatible
                        ? `${colorClass} hover:opacity-80`
                        : 'bg-slate-800/30 border-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{block.name}</span>
                    </div>
                    <p className="text-xs opacity-80">{block.description}</p>
                    {!isCompatible && (
                      <p className="text-xs text-red-400 mt-2">Not compatible with {selectedDataType.toUpperCase()}</p>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBlockMenu(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Pipeline Modal */}
      {showCreatePipeline && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Create Pipeline</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Pipeline Name</label>
                <input
                  type="text"
                  value={newPipelineName}
                  onChange={(e) => setNewPipelineName(e.target.value)}
                  placeholder="e.g., IMU Preprocessing"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Description</label>
                <textarea
                  value={newPipelineDesc}
                  onChange={(e) => setNewPipelineDesc(e.target.value)}
                  placeholder="Describe your pipeline..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreatePipeline}
                disabled={!newPipelineName.trim()}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-lg font-medium"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreatePipeline(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Configuration Modal */}
      {showBlockConfig && selectedBlock && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Configure {selectedBlock.name}</h3>
            <div className="space-y-4">
              {Object.entries(selectedBlock.config).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm text-slate-300 mb-1 capitalize">{key.replace(/_/g, ' ')}</label>
                  <input
                    type={typeof value === 'number' ? 'number' : 'text'}
                    value={Array.isArray(value) ? JSON.stringify(value) : value}
                    onChange={(e) => {
                      const newConfig = { ...selectedBlock.config };
                      newConfig[key] = typeof value === 'number' ? parseFloat(e.target.value) : e.target.value;
                      setSelectedBlock({ ...selectedBlock, config: newConfig });
                      setBlocks(blocks.map(b => b.id === selectedBlock.id ? { ...selectedBlock, config: newConfig } : b));
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBlockConfig(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
