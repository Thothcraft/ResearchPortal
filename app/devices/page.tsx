'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, Search, Filter, X } from 'lucide-react';
import { toast } from 'react-toastify';
import DeviceCard from '../components/DeviceCard';
import Navigation from '../components/Navigation';
import apiService from '../services/api';

interface Device {
  device_id: string;
  name: string;
  status: 'online' | 'offline' | 'idle';
  battery_level?: number;
  last_seen: string;
  sensors_enabled: boolean;
  hardware_info?: Record<string, any>;
  device_name?: string;
}

const DevicesPage = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    device_id: '',
    device_name: '',
    device_type: 'thoth',
  });
  const [isRegistering, setIsRegistering] = useState(false);

  // Fetch devices on component mount
  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDevices();
      
      const devices = (response.data || []).map((device: any) => ({
        device_id: device.device_id,
        name: device.device_name || `Device-${device.device_id.slice(-4)}`,
        status: (device.status?.toLowerCase() as 'online' | 'offline' | 'idle') || 'offline',
        battery_level: device.status_data?.battery_level || 0,
        last_seen: device.last_seen || new Date().toISOString(),
        sensors_enabled: device.status_data?.sensors_enabled || false,
        hardware_info: device.hardware_info || {},
        device_name: device.device_name
      }));
      
      setDevices(devices);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      toast.error('Failed to load devices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.device_id) return;
    
    try {
      setIsRegistering(true);
      await apiService.registerDevice({
        device_id: formData.device_id,
        device_name: formData.device_name || `Device-${formData.device_id.slice(-4)}`,
        device_type: formData.device_type,
        hardware_info: {}
      });
      
      toast.success('Device registered successfully!');
      setShowAddModal(false);
      setFormData({ device_id: '', device_name: '', device_type: 'thoth' });
      fetchDevices();
    } catch (error) {
      console.error('Failed to register device:', error);
      toast.error('Failed to register device. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    
    try {
      await apiService.deleteDevice(deviceId);
      toast.success('Device deleted successfully!');
      fetchDevices();
    } catch (error) {
      console.error('Failed to delete device:', error);
      toast.error('Failed to delete device. Please try again.');
    }
  };

  const handleToggleSensors = async (deviceId: string, enabled: boolean) => {
    try {
      await apiService.updateDevice(deviceId, {
        status_data: { sensors_enabled: enabled }
      });
      fetchDevices();
    } catch (error) {
      console.error('Failed to update device status:', error);
      toast.error('Failed to update device status');
    }
  };

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         device.device_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || device.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Thoth Devices</h1>
          <p className="text-gray-400">Manage and monitor your IoT devices</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Total Devices</p>
            <p className="text-2xl font-bold">{devices.length}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Online</p>
            <p className="text-2xl font-bold text-green-500">
              {devices.filter(d => d.status === 'online').length}
            </p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Active Sensors</p>
            <p className="text-2xl font-bold text-blue-500">
              {devices.filter(d => d.sensors_enabled).length}
            </p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Avg Battery</p>
            <p className="text-2xl font-bold text-yellow-500">
              {devices.length > 0 
                ? Math.round(devices.reduce((acc, d) => acc + (d.battery_level || 0), 0) / devices.length)
                : 0}%
            </p>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row gap-4 mb-8"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="idle">Idle</option>
              <option value="offline">Offline</option>
            </select>
            <button
              onClick={fetchDevices}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Device
            </button>
          </div>
        </motion.div>

        {/* Device Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredDevices.map((device, index) => (
              <motion.div
                key={device.device_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <DeviceCard
                  device={device}
                  onToggleSensors={(deviceId) => handleToggleSensors(deviceId, !device.sensors_enabled)}
                  onDelete={handleDeleteDevice}
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
            <p className="text-gray-500 text-sm mt-2">Try adjusting your search or add a new device</p>
          </motion.div>
        )}
      </main>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-xl p-6 w-full max-w-md"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Add New Device</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
                disabled={isRegistering}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddDevice}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Device ID *
                  </label>
                  <input
                    type="text"
                    value={formData.device_id}
                    onChange={(e) => setFormData({...formData, device_id: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter device ID"
                    required
                    disabled={isRegistering}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Device Name
                  </label>
                  <input
                    type="text"
                    value={formData.device_name}
                    onChange={(e) => setFormData({...formData, device_name: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter a friendly name"
                    disabled={isRegistering}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Device Type
                  </label>
                  <select
                    value={formData.device_type}
                    onChange={(e) => setFormData({...formData, device_type: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    disabled={isRegistering}
                  >
                    <option value="thoth">Thoth Device</option>
                    <option value="raspberrypi">Raspberry Pi</option>
                    <option value="arduino">Arduino</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
                    disabled={isRegistering}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRegistering || !formData.device_id.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isRegistering ? (
                      <>
                        <RefreshCw className="animate-spin w-4 h-4" />
                        Registering...
                      </>
                    ) : (
                      'Register Device'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DevicesPage;
