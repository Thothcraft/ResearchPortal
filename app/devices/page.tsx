'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, Search, Filter } from 'lucide-react';
import DeviceCard from '../components/DeviceCard';
import Navigation from '../components/Navigation';
import apiService from '../services/api';

export default function DevicesPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      // Mock data for now - replace with actual API call
      const mockDevices = [
        {
          device_id: 'thoth-001',
          name: 'Thoth Alpha',
          status: 'online',
          battery_level: 85,
          last_seen: new Date().toISOString(),
          sensors_enabled: true
        },
        {
          device_id: 'thoth-002',
          name: 'Thoth Beta',
          status: 'idle',
          battery_level: 62,
          last_seen: new Date(Date.now() - 300000).toISOString(),
          sensors_enabled: false
        },
        {
          device_id: 'thoth-003',
          name: 'Thoth Gamma',
          status: 'offline',
          battery_level: 15,
          last_seen: new Date(Date.now() - 3600000).toISOString(),
          sensors_enabled: false
        }
      ];
      setDevices(mockDevices);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSensors = async (deviceId: string) => {
    try {
      const device = devices.find(d => d.device_id === deviceId);
      if (device) {
        await apiService.controlSensors(deviceId, {
          temperature: !device.sensors_enabled,
          humidity: !device.sensors_enabled,
          pressure: !device.sensors_enabled,
          motion: !device.sensors_enabled,
          compass: !device.sensors_enabled
        });
        
        // Update local state
        setDevices(devices.map(d => 
          d.device_id === deviceId 
            ? { ...d, sensors_enabled: !d.sensors_enabled }
            : d
        ));
      }
    } catch (error) {
      console.error('Failed to toggle sensors:', error);
    }
  };

  const handleOpenSettings = (deviceId: string) => {
    // Open device settings modal
    console.log('Open settings for device:', deviceId);
  };

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          device.device_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || device.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Thoth Devices</h1>
          <p className="text-gray-300">Manage and monitor your Thoth IoT devices</p>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-xl p-4 mb-6 border border-white/20"
        >
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="idle">Idle</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={fetchDevices}
                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Device
              </button>
            </div>
          </div>
        </motion.div>

        {/* Device Stats */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
            <p className="text-gray-400 text-sm mb-1">Total Devices</p>
            <p className="text-2xl font-bold text-white">{devices.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
            <p className="text-gray-400 text-sm mb-1">Online</p>
            <p className="text-2xl font-bold text-green-400">
              {devices.filter(d => d.status === 'online').length}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
            <p className="text-gray-400 text-sm mb-1">Active Sensors</p>
            <p className="text-2xl font-bold text-blue-400">
              {devices.filter(d => d.sensors_enabled).length}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
            <p className="text-gray-400 text-sm mb-1">Avg Battery</p>
            <p className="text-2xl font-bold text-yellow-400">
              {devices.length > 0 
                ? Math.round(devices.reduce((acc, d) => acc + (d.battery_level || 0), 0) / devices.length)
                : 0}%
            </p>
          </div>
        </motion.div>

        {/* Device Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredDevices.map((device, index) => (
              <motion.div
                key={device.device_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <DeviceCard
                  device={device}
                  onToggleSensors={handleToggleSensors}
                  onOpenSettings={handleOpenSettings}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {filteredDevices.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-gray-400 text-lg">No devices found</p>
            <p className="text-gray-500 text-sm mt-2">Try adjusting your search or filters</p>
          </motion.div>
        )}
        </div>
      </div>
    </>
  );
}
