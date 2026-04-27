'use client';
import { X, FileText, HardDrive, Tag } from 'lucide-react';

interface DatasetFile {
  id: number;
  filename: string;
  size_bytes: number;
  label: string;
}

interface DatasetStatsProps {
  datasetName: string;
  files: DatasetFile[];
  onClose: () => void;
}

export function DatasetStats({ datasetName, files, onClose }: DatasetStatsProps) {
  const totalFiles = files.length;
  const totalSize = files.reduce((sum, f) => sum + (f.size_bytes || 0), 0);
  const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  
  // Label distribution
  const labelCounts = files.reduce((acc, f) => {
    const label = f.label || 'unlabeled';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const labelEntries = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = labelEntries[0]?.[1] || 0;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl p-6 w-full max-w-2xl border border-slate-700 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">{datasetName} - Statistics</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <FileText className="w-4 h-4" />
              <span>Total Files</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalFiles}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <HardDrive className="w-4 h-4" />
              <span>Total Size</span>
            </div>
            <p className="text-2xl font-bold text-white">{sizeMB} MB</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Tag className="w-4 h-4" />
              <span>Labels</span>
            </div>
            <p className="text-2xl font-bold text-white">{labelEntries.length}</p>
          </div>
        </div>
        
        {/* Label Distribution */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Label Distribution
          </h4>
          {labelEntries.length === 0 ? (
            <p className="text-slate-500 text-sm">No labeled files</p>
          ) : (
            <div className="space-y-3">
              {labelEntries.map(([label, count]) => {
                const percentage = (count / totalFiles) * 100;
                const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{label}</span>
                      <span className="text-slate-400">{count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
