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

// Block categories for organization
const BLOCK_CATEGORIES = {
  loaders: { name: 'Data Loaders', icon: Database, color: 'cyan' },
  extractors: { name: 'Feature Extractors', icon: Activity, color: 'green' },
  filters: { name: 'Filters', icon: Filter, color: 'purple' },
  transforms: { name: 'Transforms', icon: Zap, color: 'yellow' },
  combiners: { name: 'Combiners', icon: Shuffle, color: 'pink' },
};

const BLOCK_TYPES = {
  // Data Loaders (starting blocks)
  csi_loader: {
    name: 'CSI Loader',
    icon: Wifi,
    color: 'cyan',
    category: 'loaders',
    dataTypes: ['csi'],
    description: 'Load CSI data from file',
    config: { file_type: 'csv' },
    transformShape: (input: number[]) => [1, 256, 52],
    isSource: true,
  },
  imu_loader: {
    name: 'IMU Loader',
    icon: Activity,
    color: 'cyan',
    category: 'loaders',
    dataTypes: ['imu'],
    description: 'Load IMU sensor data from file',
    config: { file_type: 'json' },
    transformShape: (input: number[]) => [1, 128, 6],
    isSource: true,
  },
  mfcw_loader: {
    name: 'MFCW Loader',
    icon: Radio,
    color: 'cyan',
    category: 'loaders',
    dataTypes: ['mfcw'],
    description: 'Load MFCW radar data',
    config: { file_type: 'bin' },
    transformShape: (input: number[]) => [1, 512, 8],
    isSource: true,
  },
  // CSI-specific extractors
  amplitude_extractor: {
    name: 'Amplitude Extractor',
    icon: TrendingUp,
    color: 'green',
    category: 'extractors',
    dataTypes: ['csi'],
    description: 'Extract amplitude from complex CSI',
    config: {},
    transformShape: (input: number[]) => input,
  },
  phase_extractor: {
    name: 'Phase Extractor',
    icon: Activity,
    color: 'green',
    category: 'extractors',
    dataTypes: ['csi'],
    description: 'Extract phase from complex CSI',
    config: { unwrap: true },
    transformShape: (input: number[]) => input,
  },
  subcarrier_filter: {
    name: 'Subcarrier Filter',
    icon: Filter,
    color: 'purple',
    category: 'filters',
    dataTypes: ['csi'],
    description: 'Select specific subcarrier range',
    config: { start_idx: 5, end_idx: 32 },
    transformShape: (input: number[]) => [input[0], input[1], 27],
  },
  // General preprocessing
  normalize: {
    name: 'Normalize',
    icon: TrendingUp,
    color: 'blue',
    category: 'transforms',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Normalize data to [0, 1] or [-1, 1]',
    config: { method: 'minmax', range: [0, 1] },
    transformShape: (input: number[]) => input,
  },
  lowpass_filter: {
    name: 'Low-Pass Filter',
    icon: Filter,
    color: 'green',
    category: 'filters',
    dataTypes: ['imu', 'csi'],
    description: 'Remove high-frequency noise',
    config: { cutoff_freq: 20, order: 4 },
    transformShape: (input: number[]) => input,
  },
  highpass_filter: {
    name: 'High-Pass Filter',
    icon: Filter,
    color: 'purple',
    category: 'filters',
    dataTypes: ['imu', 'csi'],
    description: 'Remove low-frequency drift',
    config: { cutoff_freq: 0.5, order: 4 },
    transformShape: (input: number[]) => input,
  },
  moving_average: {
    name: 'Moving Average',
    icon: TrendingUp,
    color: 'teal',
    category: 'filters',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Smooth data with moving average',
    config: { window_size: 5 },
    transformShape: (input: number[]) => input,
  },
  window_segmentation: {
    name: 'Windowing',
    icon: Maximize2,
    color: 'yellow',
    category: 'transforms',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Split into fixed-size windows',
    config: { window_size: 128, overlap: 0.5 },
    transformShape: (input: number[]) => [input[0] * 2, 128, input[2] || 1],
  },
  flatten: {
    name: 'Flatten',
    icon: Minimize2,
    color: 'orange',
    category: 'transforms',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Flatten to 1D feature vector',
    config: {},
    transformShape: (input: number[]) => [input[0], (input[1] || 1) * (input[2] || 1)],
  },
  fft_transform: {
    name: 'FFT Transform',
    icon: Zap,
    color: 'red',
    category: 'transforms',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Convert to frequency domain',
    config: { n_fft: 256 },
    transformShape: (input: number[]) => [input[0], Math.floor((input[1] || 128) / 2) + 1, input[2] || 1],
  },
  feature_extraction: {
    name: 'Feature Extraction',
    icon: BarChart3,
    color: 'indigo',
    category: 'extractors',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Extract statistical features',
    config: { features: ['mean', 'std', 'min', 'max', 'rms'] },
    transformShape: (input: number[]) => [input[0], 5 * (input[2] || 1)],
  },
  // Combiners (multi-input)
  feature_concat: {
    name: 'Feature Concat',
    icon: Shuffle,
    color: 'pink',
    category: 'combiners',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Concatenate multiple feature streams',
    config: { axis: -1 },
    transformShape: (input: number[]) => input,
    acceptsMultipleInputs: true,
  },
  data_augmentation: {
    name: 'Data Augmentation',
    icon: Shuffle,
    color: 'pink',
    category: 'transforms',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Add noise, scale, rotate',
    config: { noise_level: 0.01, scale_range: [0.9, 1.1] },
    transformShape: (input: number[]) => input,
  },
  downsample: {
    name: 'Downsample',
    icon: Minimize2,
    color: 'orange',
    category: 'transforms',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Reduce sampling rate',
    config: { factor: 2 },
    transformShape: (input: number[]) => [input[0], Math.floor((input[1] || 128) / 2), input[2] || 1],
  },
  standardize: {
    name: 'Standardize',
    icon: TrendingUp,
    color: 'teal',
    category: 'transforms',
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
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'edit' | 'create'>('edit');
  const [blockMenuCategory, setBlockMenuCategory] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<ProcessingBlock | null>(null);
  const [showBlockConfig, setShowBlockConfig] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [shapeErrors, setShapeErrors] = useState<Record<string, string>>({});
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

  const handleStartNewPipeline = () => {
    // Clear current state and enter canvas creation mode
    setBlocks([]);
    setConnections([]);
    setSelectedPipeline(null);
    setIsCreatingNew(true);
    setCanvasMode('create');
    setNewPipelineName('');
    setNewPipelineDesc('');
  };

  const handleSaveNewPipeline = async () => {
    if (!newPipelineName.trim()) {
      setError('Please enter a pipeline name');
      return;
    }
    try {
      const res = await post('/processing/pipelines', {
        name: newPipelineName,
        description: newPipelineDesc,
        blocks,
        connections,
      });
      if (res?.success || res?.pipeline) {
        setIsCreatingNew(false);
        setCanvasMode('edit');
        setNewPipelineName('');
        setNewPipelineDesc('');
        await fetchPipelines();
        // Select the newly created pipeline
        if (res.pipeline) {
          setSelectedPipeline(res.pipeline);
        }
      }
    } catch (err) {
      setError('Failed to create pipeline');
    }
  };

  const handleCancelNewPipeline = () => {
    setIsCreatingNew(false);
    setCanvasMode('edit');
    setBlocks([]);
    setConnections([]);
    setNewPipelineName('');
    setNewPipelineDesc('');
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

  // Calculate input shape based on previous block in chain
  const getInputShapeForNewBlock = (): number[] => {
    if (blocks.length === 0) {
      // Default input shapes by data type
      const defaultShapes: Record<DataType, number[]> = {
        imu: [1, 128, 6],      // batch, time_steps, channels (accel_xyz + gyro_xyz)
        csi: [1, 256, 52],     // batch, subcarriers, antennas
        mfcw: [1, 512, 8],     // batch, range_bins, doppler_bins
        image: [1, 224, 224],  // batch, height, width
        video: [1, 30, 224],   // batch, frames, height
      };
      return defaultShapes[selectedDataType];
    }
    // Use output shape of last block as input
    return [...blocks[blocks.length - 1].outputShape];
  };

  // Validate shape compatibility between blocks
  const validateShapes = (updatedBlocks: ProcessingBlock[]) => {
    const errors: Record<string, string> = {};
    
    for (let i = 1; i < updatedBlocks.length; i++) {
      const prevBlock = updatedBlocks[i - 1];
      const currBlock = updatedBlocks[i];
      
      // Check if output shape of previous matches input shape of current
      const prevOutput = prevBlock.outputShape;
      const currInput = currBlock.inputShape;
      
      if (prevOutput.length !== currInput.length) {
        errors[currBlock.id] = `Shape mismatch: expected ${prevOutput.length}D, got ${currInput.length}D`;
      } else {
        for (let j = 0; j < prevOutput.length; j++) {
          if (prevOutput[j] !== currInput[j] && currInput[j] !== -1) { // -1 means any size
            errors[currBlock.id] = `Shape mismatch at dim ${j}: expected ${prevOutput[j]}, got ${currInput[j]}`;
            break;
          }
        }
      }
    }
    
    setShapeErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Recalculate shapes through the pipeline
  const recalculateShapes = (updatedBlocks: ProcessingBlock[]): ProcessingBlock[] => {
    if (updatedBlocks.length === 0) return updatedBlocks;
    
    const result = [...updatedBlocks];
    
    // First block uses default input shape
    const defaultShapes: Record<DataType, number[]> = {
      imu: [1, 128, 6],
      csi: [1, 256, 52],
      mfcw: [1, 512, 8],
      image: [1, 224, 224],
      video: [1, 30, 224],
    };
    
    for (let i = 0; i < result.length; i++) {
      const block = result[i];
      const blockDef = BLOCK_TYPES[block.type as keyof typeof BLOCK_TYPES];
      
      if (i === 0) {
        block.inputShape = defaultShapes[block.dataType];
      } else {
        block.inputShape = [...result[i - 1].outputShape];
      }
      
      // Apply transform based on block config
      if (blockDef) {
        block.outputShape = blockDef.transformShape(block.inputShape);
      }
    }
    
    validateShapes(result);
    return result;
  };

  const handleAddBlock = (blockType: string) => {
    const blockDef = BLOCK_TYPES[blockType as keyof typeof BLOCK_TYPES];
    if (!blockDef) return;

    const inputShape = getInputShapeForNewBlock();
    const outputShape = blockDef.transformShape(inputShape);

    const newBlock: ProcessingBlock = {
      id: `block_${Date.now()}`,
      type: blockType,
      name: blockDef.name,
      dataType: selectedDataType,
      inputShape,
      outputShape,
      config: { ...blockDef.config },
      position: { x: 150 + blocks.length * 220, y: 200 },
    };

    const updatedBlocks = [...blocks, newBlock];
    setBlocks(recalculateShapes(updatedBlocks));
    setShowBlockMenu(false);
  };

  const handleDeleteBlock = (blockId: string) => {
    const updatedBlocks = blocks.filter(b => b.id !== blockId);
    setBlocks(recalculateShapes(updatedBlocks));
    setConnections(connections.filter(c => c.from !== blockId && c.to !== blockId));
  };

  // Drag handlers for blocks
  const handleBlockMouseDown = (e: React.MouseEvent, blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    setDraggedBlock(blockId);
    setDragOffset({
      x: e.clientX - block.position.x,
      y: e.clientY - block.position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedBlock) return;
    
    const updatedBlocks = blocks.map(block => {
      if (block.id === draggedBlock) {
        return {
          ...block,
          position: {
            x: Math.max(0, e.clientX - dragOffset.x),
            y: Math.max(0, e.clientY - dragOffset.y),
          },
        };
      }
      return block;
    });
    
    setBlocks(updatedBlocks);
  };

  const handleMouseUp = () => {
    setDraggedBlock(null);
  };

  // Update block config and recalculate shapes
  const handleUpdateBlockConfig = (blockId: string, newConfig: Record<string, any>) => {
    const updatedBlocks = blocks.map(block => {
      if (block.id === blockId) {
        return { ...block, config: newConfig };
      }
      return block;
    });
    setBlocks(recalculateShapes(updatedBlocks));
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
          onClick={handleStartNewPipeline}
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
          {(selectedPipeline || isCreatingNew) ? (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
              {/* Header - different for create vs edit mode */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1">
                  {isCreatingNew ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newPipelineName}
                        onChange={(e) => setNewPipelineName(e.target.value)}
                        placeholder="Pipeline Name"
                        className="text-xl font-semibold bg-transparent border-b border-slate-600 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none w-full pb-1"
                      />
                      <input
                        type="text"
                        value={newPipelineDesc}
                        onChange={(e) => setNewPipelineDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className="text-sm bg-transparent border-b border-slate-700 text-slate-400 placeholder-slate-600 focus:border-slate-500 focus:outline-none w-full pb-1"
                      />
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-xl font-semibold text-white">{selectedPipeline?.name}</h2>
                      <p className="text-slate-400 text-sm">{selectedPipeline?.description}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setShowBlockMenu(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Block
                  </button>
                  {isCreatingNew ? (
                    <>
                      <button
                        onClick={handleSaveNewPipeline}
                        disabled={!newPipelineName.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg text-sm"
                      >
                        <Save className="w-4 h-4" />
                        Save Pipeline
                      </button>
                      <button
                        onClick={handleCancelNewPipeline}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleSavePipeline}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                  )}
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

              {/* Shape Validation Summary */}
              {Object.keys(shapeErrors).length > 0 && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-red-400 text-sm font-medium mb-1">⚠️ Shape Validation Errors</p>
                  <p className="text-red-300 text-xs">Some blocks have incompatible shapes. Check the highlighted blocks below.</p>
                </div>
              )}

              {/* Pipeline Blocks */}
              <div 
                className="min-h-[400px] bg-slate-900/50 rounded-lg border border-slate-700 p-6 relative overflow-auto"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {blocks.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Workflow className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                      <p className="text-slate-400">Add blocks to build your pipeline</p>
                      <p className="text-slate-500 text-sm mt-2">Click "Add Block" to start building your pipeline</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-4 items-start">
                    {blocks.map((block, index) => {
                      const Icon = getBlockIcon(block.type);
                      const colorClass = getBlockColor(block.type);
                      const hasError = shapeErrors[block.id];
                      const isDragging = draggedBlock === block.id;
                      
                      return (
                        <div key={block.id} className="flex items-center gap-2">
                          <div 
                            className={`relative p-4 rounded-xl border-2 min-w-[200px] transition-all cursor-move select-none ${
                              hasError 
                                ? 'border-red-500 bg-red-500/10' 
                                : colorClass
                            } ${isDragging ? 'opacity-70 scale-105 shadow-xl' : ''}`}
                            onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
                          >
                            {/* Block number badge */}
                            <div className="absolute -top-3 -left-3 w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-xs text-white font-bold">
                              {index + 1}
                            </div>
                            
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full z-10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            
                            <div className="flex items-center gap-2 mb-3">
                              <Icon className="w-5 h-5" />
                              <span className="font-medium text-white">{block.name}</span>
                            </div>
                            
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-400">Input:</span>
                                <span className="text-white font-mono bg-slate-800/50 px-2 py-0.5 rounded">
                                  ({block.inputShape.join(', ')})
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-400">Output:</span>
                                <span className="text-green-400 font-mono bg-slate-800/50 px-2 py-0.5 rounded">
                                  ({block.outputShape.join(', ')})
                                </span>
                              </div>
                            </div>
                            
                            {/* Shape error message */}
                            {hasError && (
                              <div className="mt-2 p-2 bg-red-500/20 rounded text-xs text-red-300">
                                {hasError}
                              </div>
                            )}
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBlock(block);
                                setShowBlockConfig(true);
                              }}
                              className="mt-3 w-full px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium"
                            >
                              ⚙️ Configure
                            </button>
                          </div>
                          
                          {/* Connection arrow */}
                          {index < blocks.length - 1 && (
                            <div className="flex flex-col items-center">
                              <ArrowRight className="w-8 h-8 text-indigo-400" />
                              <span className="text-xs text-slate-500 mt-1">→</span>
                            </div>
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

      {/* Add Block Menu Modal - Organized by Category */}
      {showBlockMenu && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-4xl border border-slate-700 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Add Processing Block</h3>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>Data type:</span>
                <span className="px-2 py-1 bg-indigo-600 text-white rounded font-medium">{selectedDataType.toUpperCase()}</span>
              </div>
            </div>
            
            {/* Category Tabs */}
            <div className="flex gap-2 mb-4 pb-4 border-b border-slate-700 overflow-x-auto">
              <button
                onClick={() => setBlockMenuCategory(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  blockMenuCategory === null
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                All Blocks
              </button>
              {Object.entries(BLOCK_CATEGORIES).map(([key, cat]) => {
                const CatIcon = cat.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setBlockMenuCategory(key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      blockMenuCategory === key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <CatIcon className="w-4 h-4" />
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Blocks Grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(BLOCK_TYPES)
                  .filter(([_, block]) => !blockMenuCategory || (block as any).category === blockMenuCategory)
                  .map(([key, block]) => {
                    const Icon = block.icon;
                    const colorClass = getBlockColor(key);
                    const isCompatible = block.dataTypes.includes(selectedDataType);
                    const isSource = (block as any).isSource;
                    return (
                      <button
                        key={key}
                        onClick={() => isCompatible && handleAddBlock(key)}
                        disabled={!isCompatible}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          isCompatible
                            ? `${colorClass} hover:opacity-80 hover:scale-[1.02]`
                            : 'bg-slate-800/30 border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{block.name}</span>
                          {isSource && (
                            <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">SOURCE</span>
                          )}
                        </div>
                        <p className="text-xs opacity-80 line-clamp-2">{block.description}</p>
                      </button>
                    );
                  })}
              </div>
            </div>
            
            <div className="flex gap-3 mt-4 pt-4 border-t border-slate-700">
              <button
                onClick={() => { setShowBlockMenu(false); setBlockMenuCategory(null); }}
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
              {selectedBlock?.config && Object.entries(selectedBlock.config).map(([key, value]) => (
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
