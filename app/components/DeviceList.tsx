'use client';

import { useEffect, useState } from 'react';
import DeviceCard from './DeviceCard';
import { apiService } from '@/app/services/api';

export default function DeviceList() {
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.getDevices();
      
      // API returns { success, count, devices, message }
      if (response && response.devices) {
        // Filter out any null or undefined devices and ensure we have an array
        const validDevices = Array.isArray(response.devices) 
          ? response.devices.filter((device: any) => device && (device.device_id || device.device_uuid))
          : [];
          
        setDevices(validDevices);
      } else if (response && response.data) {
        // Fallback for legacy response format
        const validDevices = Array.isArray(response.data) 
          ? response.data.filter((device: any) => device && (device.device_id || device.device_uuid))
          : [];
        setDevices(validDevices);
      } else {
        setDevices([]);
      }
    } catch (err: any) {
      console.error('Error fetching devices:', err);
      setError(err.message || 'Failed to load devices. Please try again later.');
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    
    // Set up polling to refresh device status every 30 seconds
    const intervalId = setInterval(fetchDevices, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const handleToggleSensors = async (deviceId: string) => {
    try {
      const device = devices.find(d => d.device_id === deviceId);
      if (device) {
        await apiService.controlSensors(deviceId, { enabled: !device.sensors_enabled });
        fetchDevices(); // Refresh the device list
      }
    } catch (err) {
      console.error('Error toggling sensors:', err);
      setError('Failed to update device settings');
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      try {
        await apiService.deleteDevice(deviceId);
        setDevices(devices.filter(device => device.device_id !== deviceId));
      } catch (err) {
        console.error('Error deleting device:', err);
        setError('Failed to delete device');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
        {error}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No devices are connected</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {devices.map((device) => (
        <DeviceCard
          key={device.device_id || device.device_uuid}
          device={{
            device_id: device.device_id || device.device_uuid,
            name: device.device_name || device.name || 'Unknown Device',
            status: device.online ? 'online' : (device.status || 'offline'),
            battery_level: device.battery_level,
            sensors_enabled: device.sensors_enabled || device.collection_active || false,
            last_seen: device.last_seen || new Date().toISOString(),
          }}
          onToggleSensors={handleToggleSensors}
          onDelete={handleDeleteDevice}
        />
      ))}
    </div>
  );
}
