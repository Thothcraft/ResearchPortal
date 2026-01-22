'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  RefreshCw,
  GripVertical,
  ZoomIn,
  ZoomOut,
  Move,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
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
  config?: {
    blocks?: ProcessingBlock[];
    connections?: Array<{ from: string; to: string }>;
    [key: string]: any;
  };
  data_type?: string;
  output_shape?: string;
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
  // CSI raw data: each row has 128 values (64 complex pairs: [imag, real, imag, real, ...])
  csi_loader: {
    name: 'CSI Loader',
    icon: Wifi,
    color: 'cyan',
    category: 'loaders',
    dataTypes: ['csi'],
    description: 'Load raw CSI data from CSV (128 values per row: 64 I/Q pairs)',
    config: { file_type: 'csv' },
    transformShape: (input: number[], config: any) => [config?.num_rows || 1000, 128],
    isSource: true,
  },
  // IMU data: typically 6 channels (accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z)
  imu_loader: {
    name: 'IMU Loader',
    icon: Activity,
    color: 'cyan',
    category: 'loaders',
    dataTypes: ['imu'],
    description: 'Load IMU sensor data (6 channels: 3-axis accel + 3-axis gyro)',
    config: { file_type: 'json', num_rows: 1000 },
    transformShape: (input: number[], config: any) => [config?.num_rows || 1000, 6],
    isSource: true,
  },
  mfcw_loader: {
    name: 'MFCW Loader',
    icon: Radio,
    color: 'cyan',
    category: 'loaders',
    dataTypes: ['mfcw'],
    description: 'Load MFCW radar data',
    config: { file_type: 'bin', num_rows: 1000 },
    transformShape: (input: number[], config: any) => [config?.num_rows || 1000, 256],
    isSource: true,
  },
  // CSI-specific extractors
  // Amplitude extraction: 128 raw values → 64 amplitude values (sqrt(I² + Q²))
  amplitude_extractor: {
    name: 'Amplitude Extractor',
    icon: TrendingUp,
    color: 'green',
    category: 'extractors',
    dataTypes: ['csi'],
    description: 'Extract amplitude from I/Q pairs: sqrt(I² + Q²) → 64 subcarriers',
    config: {},
    transformShape: (input: number[]) => [input[0], Math.floor((input[1] || 128) / 2)],
  },
  // Phase extraction: 128 raw values → 64 phase values (atan2(I, Q))
  phase_extractor: {
    name: 'Phase Extractor',
    icon: Activity,
    color: 'green',
    category: 'extractors',
    dataTypes: ['csi'],
    description: 'Extract phase from I/Q pairs: atan2(I, Q) → 64 subcarriers',
    config: { unwrap: true },
    transformShape: (input: number[]) => [input[0], Math.floor((input[1] || 128) / 2)],
  },
  // Subcarrier filter: removes null guard subcarriers (first 4-6 and last 4-6)
  // For 802.11n: keeps subcarriers 5-32 and 33-60 → 54 total
  subcarrier_filter: {
    name: 'Subcarrier Filter',
    icon: Filter,
    color: 'purple',
    category: 'filters',
    dataTypes: ['csi'],
    description: 'Remove null guard subcarriers (keeps 54 of 64)',
    config: { start1: 5, end1: 32, start2: 33, end2: 60 },
    transformShape: (input: number[], config: any) => {
      const range1 = (config?.end1 || 32) - (config?.start1 || 5);
      const range2 = (config?.end2 || 60) - (config?.start2 || 33);
      return [input[0], range1 + range2];
    },
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
  // Windowing: splits data into fixed-size windows
  // E.g., [1000, 54] with window_size=100, overlap=0.5 → [~20 windows, 100, 54]
  window_segmentation: {
    name: 'Windowing',
    icon: Maximize2,
    color: 'yellow',
    category: 'transforms',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Split into fixed-size windows (creates 3D output)',
    config: { window_size: 100, overlap: 0.5 },
    transformShape: (input: number[], config: any) => {
      const windowSize = config?.window_size || 100;
      const overlap = config?.overlap || 0.5;
      const step = Math.floor(windowSize * (1 - overlap));
      const numWindows = Math.floor((input[0] - windowSize) / step) + 1;
      return [numWindows, windowSize, input[1] || 1];
    },
  },
  // Flatten: converts multi-dimensional to 1D per sample
  // E.g., [20, 100, 54] → [20, 5400]
  flatten: {
    name: 'Flatten',
    icon: Minimize2,
    color: 'orange',
    category: 'transforms',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Flatten each window to 1D feature vector',
    config: {},
    transformShape: (input: number[]) => {
      if (input.length === 3) return [input[0], input[1] * input[2]];
      return [input[0], input[1] || 1];
    },
  },
  // FFT: converts time domain to frequency domain
  fft_transform: {
    name: 'FFT Transform',
    icon: Zap,
    color: 'red',
    category: 'transforms',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Convert to frequency domain (per column)',
    config: { n_fft: 256 },
    transformShape: (input: number[], config: any) => {
      const nfft = config?.n_fft || input[1] || 128;
      return [input[0], Math.floor(nfft / 2) + 1];
    },
  },
  // Feature extraction: computes statistical features per column
  feature_extraction: {
    name: 'Feature Extraction',
    icon: BarChart3,
    color: 'indigo',
    category: 'extractors',
    dataTypes: ['imu', 'csi', 'mfcw'],
    description: 'Extract statistical features (mean, std, min, max, rms)',
    config: { features: ['mean', 'std', 'min', 'max', 'rms'] },
    transformShape: (input: number[], config: any) => {
      const numFeatures = config?.features?.length || 5;
      const numCols = input[1] || 1;
      return [input[0], numFeatures * numCols];
    },
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

// Default template pipelines for new users
const DEFAULT_TEMPLATE_PIPELINES: Pipeline[] = [
  {
    id: -1,
    name: 'CSI Basic Processing',
    description: 'Standard CSI preprocessing: amplitude extraction, subcarrier filtering, and normalization',
    data_type: 'csi',
    output_shape: 'flattened',
    created_at: new Date().toISOString(),
    config: {
      blocks: [
        { id: 'csi_loader_1', type: 'csi_loader', name: 'CSI Loader', dataType: 'csi', inputShape: [], outputShape: [1000, 128], config: {}, position: { x: 50, y: 100 } },
        { id: 'amp_ext_1', type: 'amplitude_extractor', name: 'Amplitude Extractor', dataType: 'csi', inputShape: [1000, 128], outputShape: [1000, 64], config: {}, position: { x: 320, y: 100 } },
        { id: 'sub_filter_1', type: 'subcarrier_filter', name: 'Subcarrier Filter', dataType: 'csi', inputShape: [1000, 64], outputShape: [1000, 27], config: { start: 5, end: 32 }, position: { x: 590, y: 100 } },
      ],
      connections: [
        { from: 'csi_loader_1', to: 'amp_ext_1' },
        { from: 'amp_ext_1', to: 'sub_filter_1' },
      ]
    }
  },
  {
    id: -2,
    name: 'IMU Activity Recognition',
    description: 'IMU preprocessing for activity recognition: windowing, feature extraction',
    data_type: 'imu',
    output_shape: 'features',
    created_at: new Date().toISOString(),
    config: {
      blocks: [
        { id: 'imu_loader_1', type: 'imu_loader', name: 'IMU Loader', dataType: 'imu', inputShape: [], outputShape: [1000, 6], config: {}, position: { x: 50, y: 100 } },
        { id: 'moving_avg_1', type: 'moving_average', name: 'Moving Average', dataType: 'imu', inputShape: [1000, 6], outputShape: [1000, 6], config: { window_size: 5 }, position: { x: 320, y: 100 } },
        { id: 'stat_filter_1', type: 'statistical_filter', name: 'Outlier Removal', dataType: 'imu', inputShape: [1000, 6], outputShape: [1000, 6], config: { method: 'zscore', threshold: 3 }, position: { x: 590, y: 100 } },
      ],
      connections: [
        { from: 'imu_loader_1', to: 'moving_avg_1' },
        { from: 'moving_avg_1', to: 'stat_filter_1' },
      ]
    }
  },
  {
    id: -3,
    name: 'CSI Advanced Denoising',
    description: 'Advanced CSI pipeline with wavelet denoising and PCA reduction',
    data_type: 'csi',
    output_shape: 'reduced',
    created_at: new Date().toISOString(),
    config: {
      blocks: [
        { id: 'csi_loader_2', type: 'csi_loader', name: 'CSI Loader', dataType: 'csi', inputShape: [], outputShape: [1000, 128], config: {}, position: { x: 50, y: 100 } },
        { id: 'amp_ext_2', type: 'amplitude_extractor', name: 'Amplitude Extractor', dataType: 'csi', inputShape: [1000, 128], outputShape: [1000, 64], config: {}, position: { x: 320, y: 100 } },
        { id: 'wavelet_1', type: 'wavelet_denoise', name: 'Wavelet Denoise', dataType: 'csi', inputShape: [1000, 64], outputShape: [1000, 64], config: { wavelet: 'db4', level: 3 }, position: { x: 590, y: 100 } },
        { id: 'pca_1', type: 'pca_reduction', name: 'PCA Reduction', dataType: 'csi', inputShape: [1000, 64], outputShape: [1000, 10], config: { n_components: 10 }, position: { x: 860, y: 100 } },
      ],
      connections: [
        { from: 'csi_loader_2', to: 'amp_ext_2' },
        { from: 'amp_ext_2', to: 'wavelet_1' },
        { from: 'wavelet_1', to: 'pca_1' },
      ]
    }
  },
];

export default function ProcessingPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [templatePipelines, setTemplatePipelines] = useState<Pipeline[]>(DEFAULT_TEMPLATE_PIPELINES);
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
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const { get, post, put } = useApi();

  // Connection drawing state (Obsidian-like)
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState<{ blockId: string; port: 'input' | 'output' } | null>(null);
  const [connectionEnd, setConnectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  // Block dimensions for arrow calculations
  const BLOCK_WIDTH = 220;
  const BLOCK_HEIGHT = 140;

  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    try {
      const res = await get('/enhanced-processing/db-pipelines');
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
      const res = await post('/enhanced-processing/db-pipelines', {
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

  // Use a template pipeline - loads it into the canvas for editing
  const handleUseTemplate = (template: Pipeline) => {
    if (template.config?.blocks) {
      setBlocks(template.config.blocks);
    }
    if (template.config?.connections) {
      setConnections(template.config.connections);
    }
    setNewPipelineName(`${template.name} (Copy)`);
    setNewPipelineDesc(template.description || '');
    setIsCreatingNew(true);
    setCanvasMode('create');
    setSelectedPipeline(null);
  };

  const handleCreatePipeline = async () => {
    if (!newPipelineName.trim()) return;
    try {
      const res = await post('/enhanced-processing/db-pipelines', {
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
      // Default shapes for each data type (before any loader)
      const defaultShapes: Record<DataType, number[]> = {
        imu: [1000, 6],       // [#rows, 6 channels]
        csi: [1000, 128],     // [#rows, 128 raw I/Q values]
        mfcw: [1000, 256],    // [#rows, 256 range bins]
        image: [1, 224, 224], // [batch, height, width]
        video: [1, 30, 224],  // [batch, frames, height]
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

  // Default input shapes for source blocks (before any processing)
  const defaultShapes: Record<DataType, number[]> = {
    imu: [1000, 6],      // [#rows, 6 channels]
    csi: [1000, 128],    // [#rows, 128 raw I/Q values]
    mfcw: [1000, 256],   // [#rows, 256 range bins]
    image: [1, 224, 224],
    video: [1, 30, 224],
  };

  // Recalculate shapes through the pipeline (linear chain)
  const recalculateShapes = (updatedBlocks: ProcessingBlock[]): ProcessingBlock[] => {
    if (updatedBlocks.length === 0) return updatedBlocks;
    
    const result = [...updatedBlocks];
    
    for (let i = 0; i < result.length; i++) {
      const block = result[i];
      const blockDef = BLOCK_TYPES[block.type as keyof typeof BLOCK_TYPES];
      
      if (i === 0) {
        // For source blocks, use their config to determine output shape
        if ((blockDef as any)?.isSource) {
          block.inputShape = [0]; // Source blocks have no input
        } else {
          block.inputShape = defaultShapes[block.dataType];
        }
      } else {
        block.inputShape = [...result[i - 1].outputShape];
      }
      
      // Apply transform based on block config - pass config to transformShape
      if (blockDef) {
        block.outputShape = (blockDef.transformShape as any)(block.inputShape, block.config);
      }
    }
    
    validateShapes(result);
    return result;
  };

  // Recalculate shapes based on connections (graph-based)
  const recalculateShapesFromConnections = (
    blocksToUpdate: ProcessingBlock[],
    conns: Array<{ from: string; to: string }>
  ): ProcessingBlock[] => {
    if (blocksToUpdate.length === 0) return blocksToUpdate;
    
    const result = blocksToUpdate.map(b => ({ ...b }));
    const blockMap = new Map(result.map(b => [b.id, b]));
    
    // Build incoming connections map (block -> list of source blocks)
    const incomingConnections = new Map<string, string[]>();
    for (const conn of conns) {
      const existing = incomingConnections.get(conn.to) || [];
      existing.push(conn.from);
      incomingConnections.set(conn.to, existing);
    }
    
    // Topological sort to process blocks in dependency order
    const visited = new Set<string>();
    const processed = new Set<string>();
    const order: string[] = [];
    
    const visit = (blockId: string) => {
      if (processed.has(blockId)) return;
      if (visited.has(blockId)) return; // Cycle detected, skip
      
      visited.add(blockId);
      
      // Visit all source blocks first
      const sources = incomingConnections.get(blockId) || [];
      for (const sourceId of sources) {
        visit(sourceId);
      }
      
      processed.add(blockId);
      order.push(blockId);
    };
    
    // Visit all blocks
    for (const block of result) {
      visit(block.id);
    }
    
    // Process blocks in topological order
    for (const blockId of order) {
      const block = blockMap.get(blockId);
      if (!block) continue;
      
      const blockDef = BLOCK_TYPES[block.type as keyof typeof BLOCK_TYPES];
      const isSource = (blockDef as any)?.isSource;
      const sources = incomingConnections.get(blockId) || [];
      
      if (isSource) {
        // Source blocks have no input
        block.inputShape = [0];
      } else if (sources.length === 0) {
        // No incoming connections - use default shape
        block.inputShape = defaultShapes[block.dataType] || [1000, 128];
      } else if (sources.length === 1) {
        // Single input - use source's output shape
        const sourceBlock = blockMap.get(sources[0]);
        block.inputShape = sourceBlock ? [...sourceBlock.outputShape] : defaultShapes[block.dataType];
      } else {
        // Multiple inputs (e.g., feature_concat) - combine shapes
        // For now, use the first source's shape as base
        const sourceBlock = blockMap.get(sources[0]);
        block.inputShape = sourceBlock ? [...sourceBlock.outputShape] : defaultShapes[block.dataType];
        
        // For concat blocks, sum the feature dimensions
        if (block.type === 'feature_concat') {
          let totalFeatures = 0;
          for (const srcId of sources) {
            const src = blockMap.get(srcId);
            if (src && src.outputShape.length >= 2) {
              totalFeatures += src.outputShape[src.outputShape.length - 1];
            }
          }
          if (totalFeatures > 0 && block.inputShape.length >= 2) {
            block.inputShape[block.inputShape.length - 1] = totalFeatures;
          }
        }
      }
      
      // Calculate output shape
      if (blockDef) {
        block.outputShape = (blockDef.transformShape as any)(block.inputShape, block.config);
      }
    }
    
    // Validate shapes
    const errors: Record<string, string> = {};
    for (const conn of conns) {
      const fromBlock = blockMap.get(conn.from);
      const toBlock = blockMap.get(conn.to);
      if (fromBlock && toBlock) {
        const fromOutput = fromBlock.outputShape;
        const toInput = toBlock.inputShape;
        
        // Check dimension compatibility (allow -1 as wildcard)
        if (fromOutput.length !== toInput.length && toInput[0] !== 0) {
          errors[toBlock.id] = `Shape mismatch: ${fromOutput.length}D → ${toInput.length}D`;
        }
      }
    }
    setShapeErrors(errors);
    
    return result;
  };

  const handleAddBlock = (blockType: string) => {
    const blockDef = BLOCK_TYPES[blockType as keyof typeof BLOCK_TYPES];
    if (!blockDef) return;

    const config = { ...blockDef.config };
    const isSource = (blockDef as any)?.isSource;
    const inputShape = isSource ? [0] : getInputShapeForNewBlock();
    const outputShape = (blockDef.transformShape as any)(inputShape, config);

    const newBlock: ProcessingBlock = {
      id: `block_${Date.now()}`,
      type: blockType,
      name: blockDef.name,
      dataType: selectedDataType,
      inputShape,
      outputShape,
      config,
      position: { x: 50 + blocks.length * 260, y: 80 },
    };

    const updatedBlocks = [...blocks, newBlock];
    // Use connection-based recalculation
    setBlocks(recalculateShapesFromConnections(updatedBlocks, connections));
    setShowBlockMenu(false);
  };

  const handleDeleteBlock = (blockId: string) => {
    const updatedBlocks = blocks.filter(b => b.id !== blockId);
    // Remove connections involving this block
    const newConnections = connections.filter(c => c.from !== blockId && c.to !== blockId);
    setConnections(newConnections);
    // Recalculate shapes with updated connections
    setBlocks(recalculateShapesFromConnections(updatedBlocks, newConnections));
  };

  // Drag handlers for blocks - improved with canvas-relative positioning
  const handleBlockMouseDown = (e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const block = blocks.find(b => b.id === blockId);
    if (!block || !canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    setDraggedBlock(blockId);
    setDragOffset({
      x: e.clientX - canvasRect.left - block.position.x,
      y: e.clientY - canvasRect.top - block.position.y,
    });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedBlock || !canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(10, Math.min(e.clientX - canvasRect.left - dragOffset.x, canvasRect.width - BLOCK_WIDTH - 10));
    const newY = Math.max(10, Math.min(e.clientY - canvasRect.top - dragOffset.y, canvasRect.height - BLOCK_HEIGHT - 10));
    
    setBlocks(prevBlocks => prevBlocks.map(block => {
      if (block.id === draggedBlock) {
        return {
          ...block,
          position: { x: newX, y: newY },
        };
      }
      return block;
    }));
  }, [draggedBlock, dragOffset, BLOCK_WIDTH, BLOCK_HEIGHT]);

  const handleMouseUp = useCallback(() => {
    if (draggedBlock) {
      setDraggedBlock(null);
      // Recalculate shapes after drag ends
      setBlocks(prevBlocks => recalculateShapes(prevBlocks));
    }
  }, [draggedBlock]);

  // Generate SVG path for connection arrow between two blocks
  const getConnectionPath = (fromBlock: ProcessingBlock, toBlock: ProcessingBlock) => {
    const fromX = fromBlock.position.x + BLOCK_WIDTH;
    const fromY = fromBlock.position.y + BLOCK_HEIGHT / 2;
    const toX = toBlock.position.x;
    const toY = toBlock.position.y + BLOCK_HEIGHT / 2;
    
    // Bezier curve control points
    const controlOffset = Math.min(80, Math.abs(toX - fromX) / 3);
    
    return `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;
  };

  // Get connection path from block ID to coordinates (for drawing in-progress connection)
  const getConnectionPathFromBlockToPoint = (blockId: string, port: 'input' | 'output', endX: number, endY: number) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return '';
    
    const startX = port === 'output' ? block.position.x + BLOCK_WIDTH : block.position.x;
    const startY = block.position.y + BLOCK_HEIGHT / 2;
    
    const controlOffset = Math.min(80, Math.abs(endX - startX) / 3);
    
    if (port === 'output') {
      return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
    } else {
      return `M ${endX} ${endY} C ${endX + controlOffset} ${endY}, ${startX - controlOffset} ${startY}, ${startX} ${startY}`;
    }
  };

  // Handle starting a connection from a port
  const handlePortMouseDown = (e: React.MouseEvent, blockId: string, port: 'input' | 'output') => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    setIsDrawingConnection(true);
    setConnectionStart({ blockId, port });
    setConnectionEnd({
      x: e.clientX - canvasRect.left,
      y: e.clientY - canvasRect.top,
    });
  };

  // Handle mouse move while drawing connection
  const handleConnectionMouseMove = (e: React.MouseEvent) => {
    if (!isDrawingConnection || !canvasRef.current) return;
    
    const canvasRect = canvasRef.current.getBoundingClientRect();
    setConnectionEnd({
      x: e.clientX - canvasRect.left,
      y: e.clientY - canvasRect.top,
    });
  };

  // Handle completing a connection on a port
  const handlePortMouseUp = (e: React.MouseEvent, blockId: string, port: 'input' | 'output') => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isDrawingConnection || !connectionStart) {
      setIsDrawingConnection(false);
      setConnectionStart(null);
      setConnectionEnd(null);
      return;
    }
    
    // Validate connection: output -> input only, no self-connections
    const fromPort = connectionStart.port;
    const toPort = port;
    
    if (connectionStart.blockId === blockId) {
      // Can't connect to self
      setIsDrawingConnection(false);
      setConnectionStart(null);
      setConnectionEnd(null);
      return;
    }
    
    if (fromPort === toPort) {
      // Can't connect output to output or input to input
      setIsDrawingConnection(false);
      setConnectionStart(null);
      setConnectionEnd(null);
      return;
    }
    
    // Determine from and to based on port types
    const fromBlockId = fromPort === 'output' ? connectionStart.blockId : blockId;
    const toBlockId = fromPort === 'output' ? blockId : connectionStart.blockId;
    
    // Check if connection already exists
    const connectionExists = connections.some(c => c.from === fromBlockId && c.to === toBlockId);
    if (!connectionExists) {
      const newConnections = [...connections, { from: fromBlockId, to: toBlockId }];
      setConnections(newConnections);
      // Recalculate shapes based on new connections
      setBlocks(prev => recalculateShapesFromConnections(prev, newConnections));
    }
    
    setIsDrawingConnection(false);
    setConnectionStart(null);
    setConnectionEnd(null);
  };

  // Handle canceling connection drawing
  const handleConnectionMouseUp = () => {
    if (isDrawingConnection) {
      setIsDrawingConnection(false);
      setConnectionStart(null);
      setConnectionEnd(null);
    }
  };

  // Delete a connection
  const handleDeleteConnection = (fromId: string, toId: string) => {
    const newConnections = connections.filter(c => !(c.from === fromId && c.to === toId));
    setConnections(newConnections);
    // Recalculate shapes after removing connection
    setBlocks(prev => recalculateShapesFromConnections(prev, newConnections));
    setSelectedConnection(null);
    setHoveredConnection(null);
  };

  // Get connection ID for hover/select
  const getConnectionId = (fromId: string, toId: string) => `${fromId}->${toId}`;

  // Refresh pipeline shapes based on current connections
  const handleRefreshShapes = () => {
    setBlocks(prev => recalculateShapesFromConnections(prev, connections));
  };

  // Update block config and recalculate shapes
  const handleUpdateBlockConfig = (blockId: string, newConfig: Record<string, any>) => {
    const updatedBlocks = blocks.map(block => {
      if (block.id === blockId) {
        return { ...block, config: newConfig };
      }
      return block;
    });
    // Use connection-based recalculation
    setBlocks(recalculateShapesFromConnections(updatedBlocks, connections));
  };

  const handleSavePipeline = async () => {
    if (!selectedPipeline) return;
    try {
      await put(`/enhanced-processing/db-pipelines/${selectedPipeline.id}`, {
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

  // Zoom and pan controls
  const handleZoomIn = () => setCanvasZoom(prev => Math.min(prev + 0.25, 2));
  const handleZoomOut = () => setCanvasZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleResetView = () => {
    setCanvasZoom(1);
    setCanvasPan({ x: 0, y: 0 });
  };
  const handlePanDirection = (direction: 'up' | 'down' | 'left' | 'right') => {
    const step = 50;
    setCanvasPan(prev => {
      switch (direction) {
        case 'up': return { ...prev, y: prev.y + step };
        case 'down': return { ...prev, y: prev.y - step };
        case 'left': return { ...prev, x: prev.x + step };
        case 'right': return { ...prev, x: prev.x - step };
        default: return prev;
      }
    });
  };

  // Handle middle mouse button panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasPan.x, y: e.clientY - canvasPan.y });
    }
  };

  const handleCanvasPanMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setCanvasPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleCanvasPanEnd = () => {
    setIsPanning(false);
  };

  // Handle mouse wheel zoom
  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setCanvasZoom(prev => Math.max(0.25, Math.min(2, prev + delta)));
    }
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
          <h2 className="text-xl font-semibold text-white mb-4">My Pipelines</h2>
          <div className="space-y-2 mb-6">
            {pipelines.length === 0 ? (
              <div className="text-center py-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-slate-400 text-sm">No saved pipelines yet</p>
              </div>
            ) : (
              pipelines.map(pipeline => {
                // Extract blocks and connections from config
                const pipelineBlocks = pipeline.config?.blocks || [];
                const pipelineConnections = pipeline.config?.connections || [];
                
                return (
                  <button
                    key={pipeline.id}
                    onClick={() => {
                      setSelectedPipeline(pipeline);
                      // Load blocks and connections from config
                      const loadedBlocks = pipeline.config?.blocks || [];
                      const loadedConnections = pipeline.config?.connections || [];
                      setBlocks(loadedBlocks);
                      setConnections(loadedConnections);
                      // Recalculate shapes based on connections
                      if (loadedBlocks.length > 0) {
                        setTimeout(() => {
                          setBlocks(prev => recalculateShapesFromConnections(prev, loadedConnections));
                        }, 0);
                      }
                    }}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      selectedPipeline?.id === pipeline.id
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <h3 className="font-medium text-white mb-1">{pipeline.name}</h3>
                    <p className="text-slate-400 text-sm">{pipelineBlocks.length} blocks</p>
                  </button>
                );
              })
            )}
          </div>

          {/* Template Pipelines */}
          <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Templates
          </h3>
          <div className="space-y-2">
            {templatePipelines.map(template => {
              const templateBlocks = template.config?.blocks || [];
              return (
                <button
                  key={template.id}
                  onClick={() => handleUseTemplate(template)}
                  className="w-full p-3 rounded-xl border border-dashed border-slate-600 bg-slate-800/30 hover:border-yellow-500/50 hover:bg-yellow-500/5 text-left transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-300 group-hover:text-white text-sm">{template.name}</h4>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">{template.data_type}</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1 line-clamp-2">{template.description}</p>
                  <p className="text-slate-600 text-xs mt-1">{templateBlocks.length} blocks</p>
                </button>
              );
            })}
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
                  <button
                    onClick={handleRefreshShapes}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm"
                    title="Recalculate data shapes"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
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

              {/* Pipeline Canvas - SVG-based with draggable blocks (Obsidian-like) */}
              <div 
                ref={canvasRef}
                className="min-h-[500px] bg-slate-900/50 rounded-lg border border-slate-700 relative overflow-hidden"
                onMouseMove={(e) => {
                  handleMouseMove(e);
                  handleConnectionMouseMove(e);
                  handleCanvasPanMove(e);
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={() => {
                  handleMouseUp();
                  handleConnectionMouseUp();
                  handleCanvasPanEnd();
                }}
                onMouseLeave={() => {
                  handleMouseUp();
                  handleConnectionMouseUp();
                  handleCanvasPanEnd();
                }}
                onWheel={handleCanvasWheel}
                onClick={() => setSelectedConnection(null)}
                style={{ cursor: isPanning ? 'grabbing' : isDrawingConnection ? 'crosshair' : draggedBlock ? 'grabbing' : 'default' }}
              >
                {/* Zoom/Pan Controls */}
                <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 bg-slate-800/90 rounded-lg p-2 border border-slate-600">
                  {/* Zoom controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleZoomOut}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                      title="Zoom Out (Ctrl+Scroll)"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-400 w-12 text-center">{Math.round(canvasZoom * 100)}%</span>
                    <button
                      onClick={handleZoomIn}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                      title="Zoom In (Ctrl+Scroll)"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Direction controls */}
                  <div className="flex flex-col items-center gap-0.5 mt-1">
                    <button
                      onClick={() => handlePanDirection('up')}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                      title="Pan Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handlePanDirection('left')}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        title="Pan Left"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleResetView}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        title="Reset View"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePanDirection('right')}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        title="Pan Right"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => handlePanDirection('down')}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                      title="Pan Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <p className="text-[10px] text-slate-500 text-center mt-1">Alt+Drag to pan</p>
                </div>

                {/* Grid background */}
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)',
                  backgroundSize: `${20 * canvasZoom}px ${20 * canvasZoom}px`,
                  transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)`
                }} />

                {blocks.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Workflow className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                      <p className="text-slate-400">Add blocks to build your pipeline</p>
                      <p className="text-slate-500 text-sm mt-2">Start with a data loader block (CSI, IMU, or MFCW)</p>
                      <p className="text-slate-600 text-xs mt-1">Drag from output ports (green) to input ports (indigo) to connect</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* SVG Layer for connection arrows */}
                    <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1, transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`, transformOrigin: '0 0' }}>
                      <defs>
                        <marker
                          id="arrowhead"
                          markerWidth="10"
                          markerHeight="7"
                          refX="9"
                          refY="3.5"
                          orient="auto"
                        >
                          <polygon points="0 0, 10 3.5, 0 7" fill="#818cf8" />
                        </marker>
                        <marker
                          id="arrowhead-hover"
                          markerWidth="10"
                          markerHeight="7"
                          refX="9"
                          refY="3.5"
                          orient="auto"
                        >
                          <polygon points="0 0, 10 3.5, 0 7" fill="#f87171" />
                        </marker>
                        <marker
                          id="arrowhead-drawing"
                          markerWidth="10"
                          markerHeight="7"
                          refX="9"
                          refY="3.5"
                          orient="auto"
                        >
                          <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
                        </marker>
                        <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#818cf8" />
                        </linearGradient>
                        <linearGradient id="connectionGradientHover" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#ef4444" />
                          <stop offset="100%" stopColor="#f87171" />
                        </linearGradient>
                        <linearGradient id="connectionGradientDrawing" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#22c55e" />
                          <stop offset="100%" stopColor="#4ade80" />
                        </linearGradient>
                      </defs>
                      
                      {/* Draw existing connections from connections array */}
                      {connections.map((conn) => {
                        const fromBlock = blocks.find(b => b.id === conn.from);
                        const toBlock = blocks.find(b => b.id === conn.to);
                        if (!fromBlock || !toBlock) return null;
                        
                        const path = getConnectionPath(fromBlock, toBlock);
                        const connId = getConnectionId(conn.from, conn.to);
                        const isHovered = hoveredConnection === connId;
                        const isSelected = selectedConnection === connId;
                        
                        return (
                          <g key={connId}>
                            {/* Invisible wider path for easier clicking */}
                            <path
                              d={path}
                              fill="none"
                              stroke="transparent"
                              strokeWidth="20"
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={() => setHoveredConnection(connId)}
                              onMouseLeave={() => setHoveredConnection(null)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedConnection(connId);
                              }}
                            />
                            {/* Visible connection path */}
                            <path
                              d={path}
                              fill="none"
                              stroke={isHovered || isSelected ? 'url(#connectionGradientHover)' : 'url(#connectionGradient)'}
                              strokeWidth={isHovered || isSelected ? 4 : 3}
                              strokeLinecap="round"
                              markerEnd={isHovered || isSelected ? 'url(#arrowhead-hover)' : 'url(#arrowhead)'}
                              className="transition-all duration-150"
                              style={{ pointerEvents: 'none' }}
                            />
                            {/* Animated flow indicator */}
                            {!isHovered && !isSelected && (
                              <circle r="4" fill="#818cf8">
                                <animateMotion dur="2s" repeatCount="indefinite" path={path} />
                              </circle>
                            )}
                            {/* Delete button when hovered/selected */}
                            {(isHovered || isSelected) && (
                              <g
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteConnection(conn.from, conn.to);
                                }}
                              >
                                <circle
                                  cx={(fromBlock.position.x + BLOCK_WIDTH + toBlock.position.x) / 2}
                                  cy={(fromBlock.position.y + toBlock.position.y) / 2 + BLOCK_HEIGHT / 2}
                                  r="12"
                                  fill="#ef4444"
                                  className="transition-all"
                                />
                                <text
                                  x={(fromBlock.position.x + BLOCK_WIDTH + toBlock.position.x) / 2}
                                  y={(fromBlock.position.y + toBlock.position.y) / 2 + BLOCK_HEIGHT / 2 + 4}
                                  textAnchor="middle"
                                  fill="white"
                                  fontSize="14"
                                  fontWeight="bold"
                                >
                                  ×
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                      
                      {/* Drawing in-progress connection */}
                      {isDrawingConnection && connectionStart && connectionEnd && (
                        <path
                          d={getConnectionPathFromBlockToPoint(
                            connectionStart.blockId,
                            connectionStart.port,
                            connectionEnd.x,
                            connectionEnd.y
                          )}
                          fill="none"
                          stroke="url(#connectionGradientDrawing)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray="8 4"
                          markerEnd="url(#arrowhead-drawing)"
                          style={{ pointerEvents: 'none' }}
                        />
                      )}
                    </svg>

                    {/* Blocks Layer - with zoom/pan transform */}
                    <div 
                      className="absolute inset-0" 
                      style={{ 
                        transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`, 
                        transformOrigin: '0 0',
                        zIndex: 10 
                      }}
                    >
                    {blocks.map((block, index) => {
                      const Icon = getBlockIcon(block.type);
                      const colorClass = getBlockColor(block.type);
                      const hasError = shapeErrors[block.id];
                      const isDragging = draggedBlock === block.id;
                      const blockDef = BLOCK_TYPES[block.type as keyof typeof BLOCK_TYPES];
                      const isSource = (blockDef as any)?.isSource;
                      
                      return (
                        <div
                          key={block.id}
                          className={`absolute transition-shadow duration-150 ${isDragging ? 'z-50' : 'z-10'}`}
                          style={{
                            left: block.position.x,
                            top: block.position.y,
                            width: BLOCK_WIDTH,
                          }}
                        >
                          <div 
                            className={`relative p-3 rounded-xl border-2 transition-all select-none ${
                              hasError 
                                ? 'border-red-500 bg-red-500/10' 
                                : colorClass
                            } ${isDragging ? 'shadow-2xl shadow-indigo-500/30 scale-105' : 'hover:shadow-lg'}`}
                          >
                            {/* Drag handle */}
                            <div 
                              className="absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing flex items-center justify-center"
                              onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
                            >
                              <GripVertical className="w-4 h-4 text-slate-500" />
                            </div>

                            {/* Block number badge */}
                            <div className="absolute -top-3 -left-3 w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-xs text-white font-bold border-2 border-slate-600">
                              {index + 1}
                            </div>
                            
                            {/* Source badge */}
                            {isSource && (
                              <div className="absolute -top-2 left-6 px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-500/50 rounded text-[10px] text-cyan-400 font-medium">
                                SOURCE
                              </div>
                            )}
                            
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full z-10 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            
                            <div className="flex items-center gap-2 mb-2 mt-4">
                              <Icon className="w-5 h-5" />
                              <span className="font-medium text-white text-sm">{block.name}</span>
                            </div>
                            
                            {/* Data shape info */}
                            <div className="space-y-1 text-xs bg-slate-800/50 rounded-lg p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400">In:</span>
                                <span className="text-white font-mono text-[11px]">
                                  [{block.inputShape.join(' × ')}]
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400">Out:</span>
                                <span className="text-green-400 font-mono text-[11px]">
                                  [{block.outputShape.join(' × ')}]
                                </span>
                              </div>
                            </div>
                            
                            {/* Shape error message */}
                            {hasError && (
                              <div className="mt-2 p-1.5 bg-red-500/20 rounded text-[10px] text-red-300">
                                {hasError}
                              </div>
                            )}
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBlock(block);
                                setShowBlockConfig(true);
                              }}
                              className="mt-2 w-full px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors"
                            >
                              ⚙️ Configure
                            </button>

                            {/* Connection ports - Interactive for drag-to-connect */}
                            {/* Input port (left side) - not shown for source blocks */}
                            {!isSource && (
                              <div 
                                className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-indigo-500 rounded-full border-2 border-slate-800 cursor-crosshair hover:scale-150 hover:bg-indigo-400 transition-all z-20 ${
                                  isDrawingConnection && connectionStart?.port === 'output' ? 'scale-150 bg-indigo-400 animate-pulse' : ''
                                }`}
                                onMouseDown={(e) => handlePortMouseDown(e, block.id, 'input')}
                                onMouseUp={(e) => handlePortMouseUp(e, block.id, 'input')}
                                title="Input port - drag here to connect"
                              />
                            )}
                            {/* Output port (right side) - always shown */}
                            <div 
                              className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800 cursor-crosshair hover:scale-150 hover:bg-green-400 transition-all z-20 ${
                                isDrawingConnection && connectionStart?.port === 'input' ? 'scale-150 bg-green-400 animate-pulse' : ''
                              }`}
                              onMouseDown={(e) => handlePortMouseDown(e, block.id, 'output')}
                              onMouseUp={(e) => handlePortMouseUp(e, block.id, 'output')}
                              title="Output port - drag from here to connect"
                            />
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </>
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
