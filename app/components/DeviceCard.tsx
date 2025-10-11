'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Wifi, WifiOff, Battery, Activity } from 'lucide-react';

interface DeviceCardProps {
  device: {
    device_id: string;
    name: string;
    status: 'online' | 'offline' | 'idle';
    battery_level?: number;
    last_seen: string;
    sensors_enabled: boolean;
  };
  onToggleSensors: (deviceId: string) => void;
  onDelete: (deviceId: string) => void;
}

export default function DeviceCard({ device, onToggleSensors, onDelete }: DeviceCardProps) {
  const getBatteryColor = (level: number) => {
    if (level > 60) return 'text-green-500';
    if (level > 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500 shadow-[0_0_10px_rgba(74,222,128,0.7)]';
      case 'offline': return 'bg-red-500';
      case 'idle': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  // Calculate time since last seen
  const getLastSeen = (lastSeen: string) => {
    if (!lastSeen) return 'Never';
    
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - lastSeenDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return lastSeenDate.toLocaleDateString();
  };

  const motionProps: HTMLMotionProps<'div'> & { className?: string } = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    whileHover: { scale: 1.02 },
    className: 'bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-xl'
  };

  return (
    <motion.div {...motionProps}>
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{device.name}</h3>
            <p className="text-sm text-gray-300">{device.device_id}</p>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className={`w-3 h-3 rounded-full ${getStatusColor(device.status)} ${device.status === 'online' ? 'animate-pulse' : ''}`} 
              title={`Last seen: ${new Date(device.last_seen).toLocaleString()}`}
            />
            <span className="text-sm text-gray-300 capitalize">
              {device.status} • {getLastSeen(device.last_seen)}
            </span>
            <button
              onClick={() => onDelete(device.device_id)}
              className="p-2 text-red-500 hover:text-red-400 transition-colors"
              title="Delete device"
            >
              ×
            </button>
          </div>
        </div>

        <div className="space-y-3 flex-1">
          {/* Battery Status */}
          {device.battery_level !== undefined && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Battery className={`w-4 h-4 ${getBatteryColor(device.battery_level)}`} />
                <span className="text-sm text-gray-300">Battery</span>
              </div>
              <span className={`text-sm font-medium ${getBatteryColor(device.battery_level)}`}>
                {device.battery_level}%
              </span>
            </div>
          )}

        {/* Sensors Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${device.sensors_enabled ? 'text-green-500' : 'text-gray-500'}`} />
            <span className="text-sm text-gray-300">Sensors</span>
          </div>
          <button
            onClick={() => onToggleSensors(device.device_id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              device.sensors_enabled
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
            }`}
          >
            {device.sensors_enabled ? 'Active' : 'Inactive'}
          </button>
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {device.status === 'online' ? (
              <Wifi className="w-4 h-4 text-blue-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-sm text-gray-300">Connection</span>
          </div>
          <span className="text-xs text-gray-400">
            Last seen: {new Date(device.last_seen).toLocaleTimeString()}
          </span>
        </div>

        {/* Sensors Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${device.sensors_enabled ? 'text-green-500' : 'text-gray-500'}`} />
            <span className="text-sm text-gray-300">Sensors</span>
          </div>
          <button
            onClick={() => onToggleSensors(device.device_id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              device.sensors_enabled
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
            }`}
          >
            {device.sensors_enabled ? 'Active' : 'Inactive'}
          </button>
        </div>

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <button
            onClick={() => onToggleSensors(device.device_id)}
            className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4" />
            {device.sensors_enabled ? 'Disable Sensors' : 'Enable Sensors'}
          </button>
        </div>
      </div>
    </div>
    </motion.div>
  );
}
