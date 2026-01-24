'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, GitCompare, Layers, Target, Clock, Zap,
  ChevronDown, Download, Filter, ArrowUpDown
} from 'lucide-react';
import { TrainingJobGroup, TrainingJobInGroup, CENTRAL_MODELS, FL_ALGORITHMS } from './TrainingJobGroup';

interface JobGroupComparisonPlotsProps {
  groups: TrainingJobGroup[];
  selectedGroupId?: string;
}

type MetricType = 'accuracy' | 'loss' | 'val_accuracy' | 'val_loss' | 'training_time';
type ChartType = 'bar' | 'radar' | 'table';

const METRIC_OPTIONS: { id: MetricType; label: string; higherBetter: boolean }[] = [
  { id: 'accuracy', label: 'Accuracy', higherBetter: true },
  { id: 'val_accuracy', label: 'Validation Accuracy', higherBetter: true },
  { id: 'loss', label: 'Loss', higherBetter: false },
  { id: 'val_loss', label: 'Validation Loss', higherBetter: false },
  { id: 'training_time', label: 'Training Time', higherBetter: false },
];

const JobGroupComparisonPlots: React.FC<JobGroupComparisonPlotsProps> = ({
  groups,
  selectedGroupId,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>(selectedGroupId || groups[0]?.id || '');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('accuracy');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const currentGroup = groups.find(g => g.id === selectedGroup);
  const completedJobs = useMemo(() => 
    currentGroup?.jobs.filter(j => j.status === 'completed' && j.metrics) || [],
    [currentGroup]
  );

  const models = currentGroup?.type === 'central' ? CENTRAL_MODELS : FL_ALGORITHMS;
  const metricConfig = METRIC_OPTIONS.find(m => m.id === selectedMetric)!;

  const getMetricValue = (job: TrainingJobInGroup): number => {
    if (!job.metrics) return 0;
    switch (selectedMetric) {
      case 'accuracy': return job.metrics.accuracy || job.metrics.best_accuracy || 0;
      case 'val_accuracy': return job.metrics.val_accuracy || job.metrics.accuracy || 0;
      case 'loss': return job.metrics.loss || 0;
      case 'val_loss': return job.metrics.val_loss || job.metrics.loss || 0;
      case 'training_time': 
        if (job.started_at && job.completed_at) {
          return (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000;
        }
        return 0;
      default: return 0;
    }
  };

  const sortedJobs = useMemo(() => {
    return [...completedJobs].sort((a, b) => {
      const aVal = getMetricValue(a);
      const bVal = getMetricValue(b);
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      return (aVal - bVal) * multiplier;
    });
  }, [completedJobs, selectedMetric, sortOrder]);

  const maxValue = useMemo(() => 
    Math.max(...completedJobs.map(j => getMetricValue(j)), 0.001),
    [completedJobs, selectedMetric]
  );

  const minValue = useMemo(() => 
    Math.min(...completedJobs.map(j => getMetricValue(j))),
    [completedJobs, selectedMetric]
  );

  const avgValue = useMemo(() => {
    if (completedJobs.length === 0) return 0;
    return completedJobs.reduce((sum, j) => sum + getMetricValue(j), 0) / completedJobs.length;
  }, [completedJobs, selectedMetric]);

  const formatMetricValue = (value: number): string => {
    if (selectedMetric === 'training_time') {
      if (value < 60) return `${value.toFixed(1)}s`;
      if (value < 3600) return `${(value / 60).toFixed(1)}m`;
      return `${(value / 3600).toFixed(1)}h`;
    }
    if (selectedMetric.includes('accuracy')) {
      return `${(value * 100).toFixed(2)}%`;
    }
    return value.toFixed(4);
  };

  const getBestJob = () => {
    if (completedJobs.length === 0) return null;
    return completedJobs.reduce((best, job) => {
      const bestVal = getMetricValue(best);
      const jobVal = getMetricValue(job);
      if (metricConfig.higherBetter) {
        return jobVal > bestVal ? job : best;
      }
      return jobVal < bestVal ? job : best;
    });
  };

  const bestJob = getBestJob();

  // Bar Chart Rendering
  const renderBarChart = () => (
    <div className="space-y-3">
      {sortedJobs.map((job, index) => {
        const model = models.find(m => m.id === (job.config.model_type || job.config.algorithm));
        const value = getMetricValue(job);
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const isBest = bestJob?.id === job.id;
        const rank = index + 1;

        return (
          <div key={job.id} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                  isBest ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'
                }`}>
                  {rank}
                </span>
                {isBest && <TrendingUp className="w-4 h-4 text-green-400" />}
                <span className={`font-medium ${isBest ? 'text-green-400' : 'text-white'}`}>
                  {model?.name || job.config.model_type || job.config.algorithm}
                </span>
                <span className="text-xs text-slate-500 hidden group-hover:inline">
                  {model?.category}
                </span>
              </div>
              <span className={`font-mono text-sm ${isBest ? 'text-green-400 font-bold' : 'text-slate-300'}`}>
                {formatMetricValue(value)}
              </span>
            </div>
            <div className="h-4 bg-slate-700 rounded-full overflow-hidden relative">
              <div
                className={`h-full transition-all duration-500 ${
                  isBest
                    ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
              {/* Average line indicator */}
              {avgValue > 0 && (
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/50"
                  style={{ left: `${(avgValue / maxValue) * 100}%` }}
                  title={`Average: ${formatMetricValue(avgValue)}`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Radar Chart (simplified visual representation)
  const renderRadarChart = () => {
    const metrics: MetricType[] = ['accuracy', 'val_accuracy', 'loss'];
    const jobsToShow = sortedJobs.slice(0, 6); // Limit for readability

    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {jobsToShow.map(job => {
          const model = models.find(m => m.id === (job.config.model_type || job.config.algorithm));
          const isBest = bestJob?.id === job.id;

          return (
            <div 
              key={job.id}
              className={`p-4 rounded-lg border ${
                isBest ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                {isBest && <TrendingUp className="w-4 h-4 text-green-400" />}
                <span className={`font-medium ${isBest ? 'text-green-400' : 'text-white'}`}>
                  {model?.name}
                </span>
              </div>
              <div className="space-y-2">
                {metrics.map(metric => {
                  const metricOpt = METRIC_OPTIONS.find(m => m.id === metric)!;
                  const value = (() => {
                    switch (metric) {
                      case 'accuracy': return job.metrics?.accuracy || 0;
                      case 'val_accuracy': return job.metrics?.val_accuracy || 0;
                      case 'loss': return job.metrics?.loss || 0;
                      default: return 0;
                    }
                  })();
                  const displayValue = metric.includes('accuracy') 
                    ? `${(value * 100).toFixed(1)}%` 
                    : value.toFixed(4);

                  return (
                    <div key={metric} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{metricOpt.label}</span>
                      <span className="text-white font-mono">{displayValue}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Table View
  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Rank</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">
              {currentGroup?.type === 'central' ? 'Model' : 'Algorithm'}
            </th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Category</th>
            <th className="text-right py-3 px-4 text-slate-400 font-medium">Accuracy</th>
            <th className="text-right py-3 px-4 text-slate-400 font-medium">Val Acc</th>
            <th className="text-right py-3 px-4 text-slate-400 font-medium">Loss</th>
            <th className="text-right py-3 px-4 text-slate-400 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {sortedJobs.map((job, index) => {
            const model = models.find(m => m.id === (job.config.model_type || job.config.algorithm));
            const isBest = bestJob?.id === job.id;
            const trainingTime = job.started_at && job.completed_at
              ? (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000
              : 0;

            return (
              <tr 
                key={job.id}
                className={`border-b border-slate-700/50 ${isBest ? 'bg-green-500/10' : 'hover:bg-slate-800/50'}`}
              >
                <td className="py-3 px-4">
                  <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold ${
                    isBest ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {index + 1}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {isBest && <TrendingUp className="w-4 h-4 text-green-400" />}
                    <span className={isBest ? 'text-green-400 font-medium' : 'text-white'}>
                      {model?.name}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-400">{model?.category}</td>
                <td className="py-3 px-4 text-right font-mono text-white">
                  {job.metrics?.accuracy ? `${(job.metrics.accuracy * 100).toFixed(2)}%` : '-'}
                </td>
                <td className="py-3 px-4 text-right font-mono text-white">
                  {job.metrics?.val_accuracy ? `${(job.metrics.val_accuracy * 100).toFixed(2)}%` : '-'}
                </td>
                <td className="py-3 px-4 text-right font-mono text-white">
                  {job.metrics?.loss?.toFixed(4) || '-'}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-400">
                  {trainingTime > 0 ? formatMetricValue(trainingTime) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (groups.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
        <GitCompare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No Training Groups</h3>
        <p className="text-slate-400">Create a training job group to compare models</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Group Selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Training Group</label>
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.jobs.length} jobs)
                </option>
              ))}
            </select>
          </div>

          {/* Metric Selector */}
          <div className="min-w-[150px]">
            <label className="block text-xs text-slate-500 mb-1">Metric</label>
            <select
              value={selectedMetric}
              onChange={e => setSelectedMetric(e.target.value as MetricType)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              {METRIC_OPTIONS.map(metric => (
                <option key={metric.id} value={metric.id}>{metric.label}</option>
              ))}
            </select>
          </div>

          {/* Chart Type */}
          <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setChartType('bar')}
              className={`px-3 py-1.5 rounded text-sm ${
                chartType === 'bar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('radar')}
              className={`px-3 py-1.5 rounded text-sm ${
                chartType === 'radar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('table')}
              className={`px-3 py-1.5 rounded text-sm ${
                chartType === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortOrder === 'desc' ? 'Best First' : 'Worst First'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {completedJobs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Best {metricConfig.label}
            </div>
            <div className="text-2xl font-bold text-green-400">
              {formatMetricValue(metricConfig.higherBetter ? maxValue : minValue)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {models.find(m => m.id === (bestJob?.config.model_type || bestJob?.config.algorithm))?.name}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Average
            </div>
            <div className="text-2xl font-bold text-indigo-400">
              {formatMetricValue(avgValue)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Across {completedJobs.length} jobs
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Zap className="w-4 h-4 text-yellow-400" />
              Completed
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {completedJobs.length}/{currentGroup?.jobs.length || 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {currentGroup?.execution_mode === 'parallel' ? 'Parallel' : 'Sequential'} mode
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Clock className="w-4 h-4 text-purple-400" />
              Total Time
            </div>
            <div className="text-2xl font-bold text-purple-400">
              {formatMetricValue(
                completedJobs.reduce((sum, job) => {
                  if (job.started_at && job.completed_at) {
                    return sum + (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000;
                  }
                  return sum;
                }, 0)
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Combined training time
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-400" />
            {currentGroup?.name} - {metricConfig.label} Comparison
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-green-500 to-emerald-400" />
              Best
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-indigo-500 to-purple-500" />
              Others
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-yellow-400/50" />
              Average
            </div>
          </div>
        </div>

        {completedJobs.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No completed jobs yet</p>
            <p className="text-sm text-slate-500 mt-1">Start the training group to see comparison</p>
          </div>
        ) : (
          <>
            {chartType === 'bar' && renderBarChart()}
            {chartType === 'radar' && renderRadarChart()}
            {chartType === 'table' && renderTable()}
          </>
        )}
      </div>

      {/* Insights */}
      {completedJobs.length >= 2 && bestJob && (
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30 p-6">
          <h4 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Key Insights
          </h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Best Performer:</span>
              <span className="text-white ml-2 font-medium">
                {models.find(m => m.id === (bestJob.config.model_type || bestJob.config.algorithm))?.name}
              </span>
              <span className="text-green-400 ml-2">
                ({formatMetricValue(getMetricValue(bestJob))})
              </span>
            </div>
            <div>
              <span className="text-slate-400">Improvement over average:</span>
              <span className="text-green-400 ml-2 font-medium">
                {metricConfig.higherBetter
                  ? `+${(((getMetricValue(bestJob) - avgValue) / avgValue) * 100).toFixed(1)}%`
                  : `-${(((avgValue - getMetricValue(bestJob)) / avgValue) * 100).toFixed(1)}%`
                }
              </span>
            </div>
            <div>
              <span className="text-slate-400">Models compared:</span>
              <span className="text-white ml-2">{completedJobs.length}</span>
            </div>
            <div>
              <span className="text-slate-400">Execution mode:</span>
              <span className="text-white ml-2 capitalize">{currentGroup?.execution_mode}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobGroupComparisonPlots;
