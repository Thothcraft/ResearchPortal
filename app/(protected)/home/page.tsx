'use client';

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import {
  Monitor,
  Database,
  Brain,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

type Stats = {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalDataFiles: number;
  trainingJobs: number;
  lastActivity: string;
};

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    totalDataFiles: 0,
    trainingJobs: 0,
    lastActivity: 'N/A',
  });
  const [isLoading, setIsLoading] = useState(true);
  const { get } = useApi();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        
        // Fetch devices
        const deviceData = await get('/device/list?include_offline=true');
        const devices = deviceData?.devices || [];
        const onlineCount = devices.filter((d: any) => d.online).length;
        
        // Fetch data files
        let dataFileCount = 0;
        try {
          const dataFiles = await get('/data/files');
          dataFileCount = dataFiles?.files?.length || 0;
        } catch {
          dataFileCount = 0;
        }

        setStats({
          totalDevices: devices.length,
          onlineDevices: onlineCount,
          offlineDevices: devices.length - onlineCount,
          totalDataFiles: dataFileCount,
          trainingJobs: 0,
          lastActivity: new Date().toLocaleString(),
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

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
      title: 'Offline Devices',
      value: stats.offlineDevices,
      icon: XCircle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-500/10',
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
      icon: Brain,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'System Status',
      value: 'Active',
      icon: Activity,
      color: 'from-teal-500 to-teal-600',
      bgColor: 'bg-teal-500/10',
      isText: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
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
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-white text-sm">System initialized</p>
              <p className="text-slate-500 text-xs">{stats.lastActivity}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-white text-sm">Dashboard loaded</p>
              <p className="text-slate-500 text-xs">Just now</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
