'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Battery, Activity, Settings } from 'lucide-react';

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
  onOpenSettings: (deviceId: string) => void;
}

export default function DeviceCard({ device, onToggleSensors, onOpenSettings }: DeviceCardProps) {
  const getBatteryColor = (level: number) => {
    if (level > 60) return 'text-green-500';
    if (level > 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'idle': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-xl"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{device.name}</h3>
          <p className="text-sm text-gray-300">{device.device_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(device.status)} animate-pulse`} />
          <span className="text-sm text-gray-300 capitalize">{device.status}</span>
        </div>
      </div>

      <div className="space-y-3">
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
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
        <button
          onClick={() => onOpenSettings(device.device_id)}
          className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Configure
        </button>
      </div>

      {/* 3D Model Embed (optional) */}
      <div className="mt-4">
        <iframe
          src="https://poly.cam/capture/ABE69FEA-A1DF-4CC5-BC65-CF1DB40BFEE8/embed"
          className="w-full h-48 rounded-lg"
          frameBorder="0"
          allowFullScreen
        />
      </div>
    </motion.div>
  );
}
