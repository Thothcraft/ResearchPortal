'use client';

import React, { useState, useEffect } from 'react';
import { Download, FileText, Image, File, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface FigureExportProps {
  jobId: string;
  onError?: (error: string) => void;
}

interface AvailableFigure {
  type: string;
  name: string;
  description: string;
  has_latex?: boolean;
}

interface FigurePreview {
  figure_type: string;
  data_base64: string;
  width_inches: number;
  height_inches: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function FigureExport({ jobId, onError }: FigureExportProps) {
  const [availableFigures, setAvailableFigures] = useState<AvailableFigure[]>([]);
  const [selectedFigure, setSelectedFigure] = useState<string | null>(null);
  const [preview, setPreview] = useState<FigurePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [latexCode, setLatexCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  
  // Export settings
  const [exportFormat, setExportFormat] = useState<'pdf' | 'png' | 'svg'>('pdf');
  const [columnWidth, setColumnWidth] = useState<'single' | 'double'>('single');
  const [dpi, setDpi] = useState(300);

  // Fetch available figures on mount
  useEffect(() => {
    fetchAvailableFigures();
  }, [jobId]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchAvailableFigures = async () => {
    try {
      const response = await fetch(`${API_BASE}/figures/available/${jobId}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch available figures');
      }
      
      const data = await response.json();
      setAvailableFigures(data.available_figures || []);
      
      // Auto-select first figure
      if (data.available_figures?.length > 0) {
        setSelectedFigure(data.available_figures[0].type);
      }
    } catch (error) {
      console.error('Error fetching figures:', error);
      onError?.('Failed to load available figures');
    }
  };

  const fetchPreview = async (figureType: string) => {
    setLoading(true);
    setPreview(null);
    setLatexCode(null);
    
    try {
      const response = await fetch(`${API_BASE}/figures/preview/${figureType}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          job_id: jobId,
          figure_type: figureType,
          format: 'png',
          width: columnWidth,
          dpi: 150, // Lower DPI for preview
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }
      
      const data = await response.json();
      setPreview(data);
    } catch (error) {
      console.error('Error fetching preview:', error);
      onError?.('Failed to generate figure preview');
    } finally {
      setLoading(false);
    }
  };

  const handleFigureSelect = (figureType: string) => {
    setSelectedFigure(figureType);
    fetchPreview(figureType);
  };

  const handleExport = async () => {
    if (!selectedFigure) return;
    
    setExporting(true);
    
    try {
      const response = await fetch(`${API_BASE}/figures/export/${selectedFigure}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          job_id: jobId,
          figure_type: selectedFigure,
          format: exportFormat,
          width: columnWidth,
          dpi: dpi,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to export figure');
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedFigure}_${jobId.slice(0, 8)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting figure:', error);
      onError?.('Failed to export figure');
    } finally {
      setExporting(false);
    }
  };

  const handleExportLatex = async (tableType: string) => {
    try {
      const response = await fetch(`${API_BASE}/figures/latex/results-table`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          job_id: jobId,
          table_type: tableType,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate LaTeX');
      }
      
      const data = await response.json();
      setLatexCode(data.latex);
    } catch (error) {
      console.error('Error generating LaTeX:', error);
      onError?.('Failed to generate LaTeX table');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    
    try {
      const response = await fetch(`${API_BASE}/figures/export-all`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          job_id: jobId,
          formats: ['pdf', 'png'],
          width: columnWidth,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to export all figures');
      }
      
      const data = await response.json();
      
      // Download each figure
      for (const [figureName, formats] of Object.entries(data.figures)) {
        for (const [format, base64Data] of Object.entries(formats as Record<string, string>)) {
          if (format === 'latex') continue; // Skip LaTeX, handle separately
          
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: format === 'pdf' ? 'application/pdf' : 'image/png' });
          
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${figureName}.${format}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }
    } catch (error) {
      console.error('Error exporting all figures:', error);
      onError?.('Failed to export all figures');
    } finally {
      setExporting(false);
    }
  };

  if (availableFigures.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div 
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          <h4 className="text-white font-medium">Publication-Ready Figures</h4>
          <span className="text-xs text-slate-500 ml-2">IEEE Format</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleExportAll(); }}
            disabled={exporting}
            className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded flex items-center gap-1 disabled:opacity-50"
          >
            <Download className="w-3 h-3" />
            Export All
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Figure Type Selection */}
          <div className="flex flex-wrap gap-2">
            {availableFigures.map((fig) => (
              <button
                key={fig.type}
                onClick={() => handleFigureSelect(fig.type)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedFigure === fig.type
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {fig.name}
              </button>
            ))}
          </div>

          {/* Export Settings */}
          <div className="flex flex-wrap gap-4 p-3 bg-slate-900/50 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Format:</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'png' | 'svg')}
                className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
              >
                <option value="pdf">PDF (Vector)</option>
                <option value="png">PNG (Raster)</option>
                <option value="svg">SVG (Vector)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Column Width:</label>
              <select
                value={columnWidth}
                onChange={(e) => {
                  setColumnWidth(e.target.value as 'single' | 'double');
                  if (selectedFigure) fetchPreview(selectedFigure);
                }}
                className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
              >
                <option value="single">Single (3.5")</option>
                <option value="double">Double (7.16")</option>
              </select>
            </div>
            
            {exportFormat === 'png' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">DPI:</label>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(parseInt(e.target.value))}
                  className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                >
                  <option value="150">150 (Preview)</option>
                  <option value="300">300 (Print)</option>
                  <option value="600">600 (High Quality)</option>
                </select>
              </div>
            )}
          </div>

          {/* Preview Area */}
          <div className="relative min-h-[200px] bg-white rounded-lg p-4 flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-500 text-sm">Generating preview...</span>
              </div>
            ) : preview ? (
              <img
                src={`data:image/png;base64,${preview.data_base64}`}
                alt={preview.figure_type}
                className="max-w-full max-h-[400px] object-contain"
              />
            ) : (
              <div className="text-slate-400 text-sm">
                Select a figure type to preview
              </div>
            )}
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              disabled={!selectedFigure || exporting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportFormat === 'pdf' ? <File className="w-4 h-4" /> : <Image className="w-4 h-4" />}
              Download {exportFormat.toUpperCase()}
            </button>
            
            {availableFigures.find(f => f.type === selectedFigure)?.has_latex && (
              <button
                onClick={() => handleExportLatex('confusion_matrix')}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Get LaTeX Table
              </button>
            )}
          </div>

          {/* LaTeX Code Display */}
          {latexCode && (
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">LaTeX Code (IEEE Format)</span>
                <button
                  onClick={() => copyToClipboard(latexCode)}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 rounded-lg text-xs text-green-400 overflow-x-auto max-h-[200px]">
                {latexCode}
              </pre>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-slate-500 space-y-1">
            <p>• PDF format is recommended for publications (vector graphics, no quality loss)</p>
            <p>• Single column width (3.5") fits IEEE single-column figures</p>
            <p>• Double column width (7.16") spans the full page width</p>
            <p>• All figures use Times New Roman font and IEEE-compliant styling</p>
          </div>
        </div>
      )}
    </div>
  );
}
