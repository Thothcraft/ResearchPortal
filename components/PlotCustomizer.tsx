'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download, Settings, RefreshCw, Maximize2, Minimize2,
  BarChart2, LineChart, PieChart, Activity, Cpu, HardDrive,
  Clock, Layers, GitBranch, Target, Zap, Eye, EyeOff,
  ChevronDown, ChevronUp, Copy, Check, FileText, Image,
  Palette, Grid, Type, Save, Share2, Filter
} from 'lucide-react';

const API_BASE = '/api/proxy';

// ============================================================================
// TYPES
// ============================================================================

interface PlotConfig {
  title: string;
  xlabel: string;
  ylabel: string;
  figsize: [number, number];
  dpi: number;
  grid: boolean;
  legend: boolean;
  legendLoc: string;
  lineWidth: number;
  markerSize: number;
  alpha: number;
  showCI: boolean;
  ciLevel: number;
  annotateValues: boolean;
  annotateBest: boolean;
}

interface ExportConfig {
  format: 'png' | 'pdf' | 'svg' | 'eps' | 'tikz';
  dpi: number;
  transparent: boolean;
  width: 'single' | 'double' | 'custom';
  customWidth: number;
}

interface PlotCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  plots: PlotTypeInfo[];
}

interface PlotTypeInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  requiresData: string[];
}

interface PlotData {
  type: string;
  base64: string;
  config: PlotConfig;
}

// ============================================================================
// PLOT CATEGORIES AND TYPES
// ============================================================================

const PLOT_CATEGORIES: PlotCategory[] = [
  {
    id: 'performance',
    name: 'Performance',
    icon: <Activity className="w-4 h-4" />,
    plots: [
      { id: 'learning_curves', name: 'Learning Curves', description: 'Loss and accuracy over epochs', category: 'performance', requiresData: ['train_loss', 'val_loss'] },
      { id: 'metrics_bar', name: 'Metrics Bar Chart', description: 'Final metrics comparison', category: 'performance', requiresData: ['accuracy', 'precision', 'recall', 'f1'] },
      { id: 'confusion_matrix', name: 'Confusion Matrix', description: 'Classification confusion matrix', category: 'performance', requiresData: ['confusion_matrix'] },
      { id: 'roc_curves', name: 'ROC Curves', description: 'Receiver Operating Characteristic', category: 'performance', requiresData: ['roc_data'] },
      { id: 'pr_curves', name: 'PR Curves', description: 'Precision-Recall curves', category: 'performance', requiresData: ['pr_data'] },
      { id: 'class_metrics', name: 'Per-Class Metrics', description: 'Metrics breakdown by class', category: 'performance', requiresData: ['class_metrics'] },
    ]
  },
  {
    id: 'resources',
    name: 'Resources',
    icon: <Cpu className="w-4 h-4" />,
    plots: [
      { id: 'resource_timeline', name: 'Resource Timeline', description: 'CPU, GPU, Memory over time', category: 'resources', requiresData: ['cpu_percent', 'memory_percent'] },
      { id: 'cpu_usage', name: 'CPU Usage', description: 'CPU utilization by core', category: 'resources', requiresData: ['cpu_per_core'] },
      { id: 'gpu_usage', name: 'GPU Usage', description: 'GPU utilization and memory', category: 'resources', requiresData: ['gpu_data'] },
      { id: 'memory_usage', name: 'Memory Usage', description: 'Memory breakdown and timeline', category: 'resources', requiresData: ['memory_data'] },
    ]
  },
  {
    id: 'timing',
    name: 'Timing',
    icon: <Clock className="w-4 h-4" />,
    plots: [
      { id: 'timing_breakdown', name: 'Timing Breakdown', description: 'Time distribution by component', category: 'timing', requiresData: ['timing_components'] },
      { id: 'epoch_timing', name: 'Epoch Timing', description: 'Per-epoch time analysis', category: 'timing', requiresData: ['epoch_times'] },
      { id: 'throughput', name: 'Throughput', description: 'Samples/batches per second', category: 'timing', requiresData: ['throughput_data'] },
    ]
  },
  {
    id: 'model',
    name: 'Model Analysis',
    icon: <Layers className="w-4 h-4" />,
    plots: [
      { id: 'parameter_distribution', name: 'Parameter Distribution', description: 'Parameters by layer', category: 'model', requiresData: ['layer_info'] },
      { id: 'layer_complexity', name: 'Layer Complexity', description: 'FLOPs and memory by layer', category: 'model', requiresData: ['layer_complexity'] },
      { id: 'gradient_norm', name: 'Gradient Norms', description: 'Gradient magnitude over training', category: 'model', requiresData: ['grad_norms'] },
      { id: 'gradient_flow', name: 'Gradient Flow', description: 'Gradient flow through layers', category: 'model', requiresData: ['layer_gradients'] },
    ]
  },
  {
    id: 'data',
    name: 'Data Analysis',
    icon: <BarChart2 className="w-4 h-4" />,
    plots: [
      { id: 'class_distribution', name: 'Class Distribution', description: 'Sample count per class', category: 'data', requiresData: ['class_counts'] },
      { id: 'feature_correlation', name: 'Feature Correlation', description: 'Feature correlation matrix', category: 'data', requiresData: ['correlation_matrix'] },
      { id: 'embedding_2d', name: '2D Embedding', description: 't-SNE/UMAP/PCA visualization', category: 'data', requiresData: ['embeddings'] },
    ]
  },
  {
    id: 'comparison',
    name: 'Comparison',
    icon: <GitBranch className="w-4 h-4" />,
    plots: [
      { id: 'trial_comparison', name: 'Trial Comparison', description: 'Compare multiple trials', category: 'comparison', requiresData: ['trials'] },
      { id: 'model_comparison', name: 'Model Comparison', description: 'Compare different models', category: 'comparison', requiresData: ['models'] },
      { id: 'ablation_study', name: 'Ablation Study', description: 'Component contribution analysis', category: 'comparison', requiresData: ['ablation_data'] },
      { id: 'pareto_front', name: 'Pareto Front', description: 'Multi-objective optimization', category: 'comparison', requiresData: ['pareto_points'] },
    ]
  },
  {
    id: 'calibration',
    name: 'Calibration',
    icon: <Target className="w-4 h-4" />,
    plots: [
      { id: 'reliability_diagram', name: 'Reliability Diagram', description: 'Model calibration analysis', category: 'calibration', requiresData: ['calibration_data'] },
      { id: 'confidence_histogram', name: 'Confidence Histogram', description: 'Prediction confidence distribution', category: 'calibration', requiresData: ['confidences'] },
    ]
  },
];

const THEMES = [
  { id: 'default', name: 'Default', description: 'Standard styling' },
  { id: 'neurips', name: 'NeurIPS', description: 'NeurIPS conference style' },
  { id: 'icml', name: 'ICML', description: 'ICML conference style' },
  { id: 'cvpr', name: 'CVPR', description: 'CVPR conference style' },
  { id: 'ieee', name: 'IEEE', description: 'IEEE journal style' },
  { id: 'nature', name: 'Nature', description: 'Nature journal style' },
  { id: 'presentation', name: 'Presentation', description: 'Large fonts for slides' },
  { id: 'poster', name: 'Poster', description: 'Extra large for posters' },
];

const EXPORT_FORMATS = [
  { id: 'png', name: 'PNG', description: 'Raster image (web/preview)', icon: <Image className="w-4 h-4" /> },
  { id: 'pdf', name: 'PDF', description: 'Vector (publications)', icon: <FileText className="w-4 h-4" /> },
  { id: 'svg', name: 'SVG', description: 'Vector (web/editing)', icon: <FileText className="w-4 h-4" /> },
  { id: 'eps', name: 'EPS', description: 'Vector (LaTeX)', icon: <FileText className="w-4 h-4" /> },
  { id: 'tikz', name: 'TikZ', description: 'Native LaTeX code', icon: <FileText className="w-4 h-4" /> },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface PlotCustomizerProps {
  jobId?: string;
  experimentData?: any;
  onExport?: (plots: PlotData[]) => void;
}

export default function PlotCustomizer({ jobId, experimentData, onExport }: PlotCustomizerProps) {
  // State
  const [selectedCategory, setSelectedCategory] = useState<string>('performance');
  const [selectedPlots, setSelectedPlots] = useState<string[]>(['learning_curves']);
  const [generatedPlots, setGeneratedPlots] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [fullscreenPlot, setFullscreenPlot] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Theme and styling
  const [theme, setTheme] = useState('neurips');
  
  // Plot configuration
  const [plotConfig, setPlotConfig] = useState<PlotConfig>({
    title: '',
    xlabel: '',
    ylabel: '',
    figsize: [8, 6],
    dpi: 150,
    grid: true,
    legend: true,
    legendLoc: 'best',
    lineWidth: 2.0,
    markerSize: 6,
    alpha: 0.8,
    showCI: true,
    ciLevel: 0.95,
    annotateValues: false,
    annotateBest: true,
  });
  
  // Export configuration
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'pdf',
    dpi: 300,
    transparent: false,
    width: 'single',
    customWidth: 6,
  });

  // ============================================================================
  // API CALLS
  // ============================================================================

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const generatePlot = useCallback(async (plotType: string) => {
    setLoading(prev => ({ ...prev, [plotType]: true }));
    
    try {
      const response = await fetch(`${API_BASE}/plotting/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          job_id: jobId,
          plot_type: plotType,
          theme: theme,
          config: plotConfig,
          data: experimentData,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate plot');
      }
      
      const data = await response.json();
      setGeneratedPlots(prev => ({ ...prev, [plotType]: data.base64 }));
    } catch (error) {
      console.error(`Error generating ${plotType}:`, error);
      // Generate placeholder for demo
      setGeneratedPlots(prev => ({ ...prev, [plotType]: '' }));
    } finally {
      setLoading(prev => ({ ...prev, [plotType]: false }));
    }
  }, [jobId, theme, plotConfig, experimentData]);

  const exportPlot = async (plotType: string) => {
    try {
      const response = await fetch(`${API_BASE}/plotting/export`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          job_id: jobId,
          plot_type: plotType,
          theme: theme,
          config: plotConfig,
          export_config: exportConfig,
          data: experimentData,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to export plot');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plotType}_${theme}.${exportConfig.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const exportAllPlots = async () => {
    for (const plotType of selectedPlots) {
      await exportPlot(plotType);
    }
  };

  const generateAllSelected = useCallback(() => {
    selectedPlots.forEach(plotType => generatePlot(plotType));
  }, [selectedPlots, generatePlot]);

  // Generate plots when selection changes
  useEffect(() => {
    if (selectedPlots.length > 0 && (jobId || experimentData)) {
      generateAllSelected();
    }
  }, [selectedPlots, theme]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const togglePlotSelection = (plotId: string) => {
    setSelectedPlots(prev => 
      prev.includes(plotId) 
        ? prev.filter(p => p !== plotId)
        : [...prev, plotId]
    );
  };

  const selectAllInCategory = (categoryId: string) => {
    const category = PLOT_CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      const plotIds = category.plots.map(p => p.id);
      setSelectedPlots(prev => {
        const combined = [...prev, ...plotIds];
        return combined.filter((id, index) => combined.indexOf(id) === index);
      });
    }
  };

  const copyLatexCode = async (plotType: string) => {
    try {
      const response = await fetch(`${API_BASE}/plotting/latex-code`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          plot_type: plotType,
          theme: theme,
          width: exportConfig.width,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        await navigator.clipboard.writeText(data.latex);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy LaTeX:', error);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const currentCategory = PLOT_CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700">
      {/* Header */}
      <div 
        className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/30 rounded-lg">
            <BarChart2 className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Plot Customizer</h3>
            <p className="text-xs text-slate-400">Publication-ready visualizations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-purple-600/30 rounded text-xs text-purple-300">
            {selectedPlots.length} selected
          </span>
          {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Theme and Settings Bar */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
            {/* Theme Selector */}
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-slate-400" />
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-purple-500"
              >
                {THEMES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Export Format */}
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-slate-400" />
              <select
                value={exportConfig.format}
                onChange={(e) => setExportConfig(prev => ({ ...prev, format: e.target.value as any }))}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white"
              >
                {EXPORT_FORMATS.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Column Width */}
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-slate-400" />
              <select
                value={exportConfig.width}
                onChange={(e) => setExportConfig(prev => ({ ...prev, width: e.target.value as any }))}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white"
              >
                <option value="single">Single Column (3.5")</option>
                <option value="double">Double Column (7.16")</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* DPI for raster */}
            {exportConfig.format === 'png' && (
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-slate-400" />
                <select
                  value={exportConfig.dpi}
                  onChange={(e) => setExportConfig(prev => ({ ...prev, dpi: parseInt(e.target.value) }))}
                  className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white"
                >
                  <option value="150">150 DPI</option>
                  <option value="300">300 DPI</option>
                  <option value="600">600 DPI</option>
                </select>
              </div>
            )}

            {/* Settings Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Refresh All */}
            <button
              onClick={generateAllSelected}
              className="p-2 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Export All */}
            <button
              onClick={exportAllPlots}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export All
            </button>
          </div>

          {/* Advanced Settings Panel */}
          {showSettings && (
            <div className="p-4 bg-slate-900/50 rounded-lg space-y-4">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Plot Configuration
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Line Width</label>
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.5"
                    value={plotConfig.lineWidth}
                    onChange={(e) => setPlotConfig(prev => ({ ...prev, lineWidth: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <span className="text-xs text-slate-500">{plotConfig.lineWidth}</span>
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Marker Size</label>
                  <input
                    type="range"
                    min="2"
                    max="12"
                    step="1"
                    value={plotConfig.markerSize}
                    onChange={(e) => setPlotConfig(prev => ({ ...prev, markerSize: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <span className="text-xs text-slate-500">{plotConfig.markerSize}</span>
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Alpha</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={plotConfig.alpha}
                    onChange={(e) => setPlotConfig(prev => ({ ...prev, alpha: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <span className="text-xs text-slate-500">{plotConfig.alpha}</span>
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 mb-1">CI Level</label>
                  <select
                    value={plotConfig.ciLevel}
                    onChange={(e) => setPlotConfig(prev => ({ ...prev, ciLevel: parseFloat(e.target.value) }))}
                    className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                  >
                    <option value="0.90">90%</option>
                    <option value="0.95">95%</option>
                    <option value="0.99">99%</option>
                  </select>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={plotConfig.grid}
                    onChange={(e) => setPlotConfig(prev => ({ ...prev, grid: e.target.checked }))}
                    className="rounded"
                  />
                  Show Grid
                </label>
                
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={plotConfig.legend}
                    onChange={(e) => setPlotConfig(prev => ({ ...prev, legend: e.target.checked }))}
                    className="rounded"
                  />
                  Show Legend
                </label>
                
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={plotConfig.showCI}
                    onChange={(e) => setPlotConfig(prev => ({ ...prev, showCI: e.target.checked }))}
                    className="rounded"
                  />
                  Show Confidence Interval
                </label>
                
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={plotConfig.annotateValues}
                    onChange={(e) => setPlotConfig(prev => ({ ...prev, annotateValues: e.target.checked }))}
                    className="rounded"
                  />
                  Annotate Values
                </label>
                
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={plotConfig.annotateBest}
                    onChange={(e) => setPlotConfig(prev => ({ ...prev, annotateBest: e.target.checked }))}
                    className="rounded"
                  />
                  Highlight Best
                </label>
                
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={exportConfig.transparent}
                    onChange={(e) => setExportConfig(prev => ({ ...prev, transparent: e.target.checked }))}
                    className="rounded"
                  />
                  Transparent Background
                </label>
              </div>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {PLOT_CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {category.icon}
                {category.name}
              </button>
            ))}
          </div>

          {/* Plot Type Selection */}
          {currentCategory && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-slate-300">{currentCategory.name} Plots</h4>
                <button
                  onClick={() => selectAllInCategory(currentCategory.id)}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  Select All
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {currentCategory.plots.map(plot => (
                  <button
                    key={plot.id}
                    onClick={() => togglePlotSelection(plot.id)}
                    className={`p-3 rounded-lg text-left transition-all ${
                      selectedPlots.includes(plot.id)
                        ? 'bg-purple-600/30 border-2 border-purple-500'
                        : 'bg-slate-700/50 border-2 border-transparent hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{plot.name}</span>
                      {selectedPlots.includes(plot.id) && (
                        <Check className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{plot.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generated Plots Grid */}
          {selectedPlots.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-300">Generated Plots</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPlots.map(plotId => {
                  const plotInfo = PLOT_CATEGORIES
                    .flatMap(c => c.plots)
                    .find(p => p.id === plotId);
                  
                  return (
                    <div key={plotId} className="bg-slate-900/50 rounded-lg overflow-hidden">
                      {/* Plot Header */}
                      <div className="flex justify-between items-center p-3 border-b border-slate-700">
                        <span className="text-sm font-medium text-white">{plotInfo?.name || plotId}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => generatePlot(plotId)}
                            className="p-1.5 hover:bg-slate-700 rounded"
                            title="Regenerate"
                          >
                            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading[plotId] ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={() => setFullscreenPlot(plotId)}
                            className="p-1.5 hover:bg-slate-700 rounded"
                            title="Fullscreen"
                          >
                            <Maximize2 className="w-4 h-4 text-slate-400" />
                          </button>
                          <button
                            onClick={() => exportPlot(plotId)}
                            className="p-1.5 hover:bg-slate-700 rounded"
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-slate-400" />
                          </button>
                          <button
                            onClick={() => copyLatexCode(plotId)}
                            className="p-1.5 hover:bg-slate-700 rounded"
                            title="Copy LaTeX"
                          >
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                          </button>
                        </div>
                      </div>
                      
                      {/* Plot Content */}
                      <div className="p-4 bg-white min-h-[200px] flex items-center justify-center">
                        {loading[plotId] ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-slate-500 text-sm">Generating...</span>
                          </div>
                        ) : generatedPlots[plotId] ? (
                          <img
                            src={`data:image/png;base64,${generatedPlots[plotId]}`}
                            alt={plotInfo?.name}
                            className="max-w-full max-h-[300px] object-contain"
                          />
                        ) : (
                          <div className="text-center text-slate-400">
                            <BarChart2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Click refresh to generate</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info Footer */}
          <div className="p-3 bg-slate-900/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-yellow-500 mt-0.5" />
              <div className="text-xs text-slate-400 space-y-1">
                <p><strong>Tips:</strong></p>
                <p>• Use <strong>PDF</strong> format for publications (vector graphics, infinite scaling)</p>
                <p>• <strong>NeurIPS/ICML</strong> themes follow official conference guidelines</p>
                <p>• <strong>Single column</strong> (3.5") fits most journal figures</p>
                <p>• <strong>TikZ</strong> export generates native LaTeX code for perfect font matching</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      {fullscreenPlot && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8">
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setFullscreenPlot(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg"
            >
              <Minimize2 className="w-6 h-6 text-white" />
            </button>
            
            {generatedPlots[fullscreenPlot] ? (
              <img
                src={`data:image/png;base64,${generatedPlots[fullscreenPlot]}`}
                alt="Fullscreen plot"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-white">No plot generated</div>
            )}
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <button
                onClick={() => exportPlot(fullscreenPlot)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download {exportConfig.format.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
