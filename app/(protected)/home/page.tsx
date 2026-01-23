'use client';

import { useEffect, useMemo } from 'react';
import { useCachedData, clearCache } from '@/hooks/useCachedApi';
import { StatCardsSkeleton, ActivitySkeleton } from '@/components/LoadingSkeleton';
import {
  Monitor,
  Database,
  Brain,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  File,
  MessageCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

type Stats = {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalDataFiles: number;
  trainingJobs: number;
  activeJobs: number;
  totalModels: number;
  bestAccuracy: number | null;
};

type ActivityItem = {
  type: string;
  action: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
  metadata?: Record<string, any>;
};

export default function HomePage() {
  // Use cached data hooks for better performance
  const { 
    data: statsRes, 
    isLoading: statsLoading,
    isValidating: statsValidating,
    refetch: refetchStats 
  } = useCachedData<{ success: boolean; stats: any }>('/activity/stats', {
    cacheTTL: 30000, // 30 seconds
    refreshInterval: 30000, // Auto-refresh every 30s
  });

  const { 
    data: activityRes, 
    isLoading: activityLoading,
    isValidating: activityValidating,
    refetch: refetchActivity 
  } = useCachedData<{ success: boolean; activities: ActivityItem[] }>('/activity/recent?limit=10&hours=48', {
    cacheTTL: 30000,
    refreshInterval: 30000,
  });

  // Memoize stats to prevent unnecessary re-renders
  const stats = useMemo<Stats>(() => {
    if (!statsRes?.success || !statsRes.stats) {
      return {
        totalDevices: 0,
        onlineDevices: 0,
        offlineDevices: 0,
        totalDataFiles: 0,
        trainingJobs: 0,
        activeJobs: 0,
        totalModels: 0,
        bestAccuracy: null,
      };
    }
    const s = statsRes.stats;
    return {
      totalDevices: s.devices?.total || 0,
      onlineDevices: s.devices?.online || 0,
      offlineDevices: s.devices?.offline || 0,
      totalDataFiles: s.files?.total || 0,
      trainingJobs: s.training?.total_jobs || 0,
      activeJobs: s.training?.active_jobs || 0,
      totalModels: s.models?.total || 0,
      bestAccuracy: s.models?.best_accuracy || null,
    };
  }, [statsRes]);

  const activities = useMemo(() => {
    return activityRes?.success ? activityRes.activities || [] : [];
  }, [activityRes]);

  const isLoading = statsLoading || activityLoading;
  const isRefreshing = statsValidating || activityValidating;

  const handleRefresh = async () => {
    clearCache('/activity');
    await Promise.all([refetchStats(), refetchActivity()]);
  };

  const getActivityIcon = (icon: string) => {
    switch (icon) {
      case 'wifi': return <Wifi className="w-4 h-4" />;
      case 'wifi-off': return <WifiOff className="w-4 h-4" />;
      case 'file': return <File className="w-4 h-4" />;
      case 'check-circle': return <CheckCircle className="w-4 h-4" />;
      case 'x-circle': return <XCircle className="w-4 h-4" />;
      case 'loader': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'brain': return <Brain className="w-4 h-4" />;
      case 'message-circle': return <MessageCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (color: string) => {
    switch (color) {
      case 'green': return 'bg-green-500';
      case 'red': return 'bg-red-500';
      case 'blue': return 'bg-blue-500';
      case 'purple': return 'bg-purple-500';
      case 'indigo': return 'bg-indigo-500';
      case 'orange': return 'bg-orange-500';
      default: return 'bg-slate-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const statCards = [
    {
      title: 'Total Devices',
      value: stats.totalDevices,
      icon: Monitor,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Online Devices',
      value: stats.onlineDevices,
      icon: CheckCircle,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Data Files',
      value: stats.totalDataFiles,
      icon: Database,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Training Jobs',
      value: stats.trainingJobs,
      subtitle: stats.activeJobs > 0 ? `${stats.activeJobs} active` : undefined,
      icon: Brain,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Trained Models',
      value: stats.totalModels,
      icon: Brain,
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-500/10',
    },
    {
      title: 'Best Accuracy',
      value: stats.bestAccuracy ? `${(stats.bestAccuracy * 100).toFixed(1)}%` : 'N/A',
      icon: TrendingUp,
      color: 'from-teal-500 to-teal-600',
      bgColor: 'bg-teal-500/10',
      isText: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Welcome to ThothCraft Research Portal</p>
        </div>
        <StatCardsSkeleton count={6} />
        <div className="mt-8 bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
          </div>
          <ActivitySkeleton count={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Welcome to ThothCraft Research Portal</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`} style={{ color: stat.color.includes('blue') ? '#3b82f6' : stat.color.includes('green') ? '#22c55e' : stat.color.includes('red') ? '#ef4444' : stat.color.includes('purple') ? '#a855f7' : stat.color.includes('orange') ? '#f97316' : '#14b8a6' }} />
                </div>
                <TrendingUp className="w-5 h-5 text-slate-500" />
              </div>
              <h3 className="text-slate-400 text-sm font-medium mb-1">{stat.title}</h3>
              <p className="text-3xl font-bold text-white">
                {stat.isText ? stat.value : stat.value.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No recent activity</p>
            </div>
          ) : (
            activities.map((activity, index) => (
              <div
                key={`${activity.type}-${activity.timestamp}-${index}`}
                className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full ${getActivityColor(activity.color)} flex items-center justify-center text-white`}>
                  {getActivityIcon(activity.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{activity.title}</p>
                  <p className="text-slate-400 text-xs truncate">{activity.description}</p>
                </div>
                <span className="text-slate-500 text-xs whitespace-nowrap">
                  {formatTimestamp(activity.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
