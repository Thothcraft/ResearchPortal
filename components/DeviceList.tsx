'use client';

import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

type Device = {
  device_id: string;
  device_name: string;
  device_type: string;
  online: boolean;
  battery_level: number | null;
  last_seen: string;
  ip_address: string;
  mac_address: string | null;
  device_uuid: string;
  user_id: number;
};

const Button = ({ children, onClick, className = '', ...props }: any) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { get } = useApi();

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const data = await get('/device/list?include_offline=true');
        
        if (data && Array.isArray(data.devices)) {
          setDevices(data.devices);
        } else {
          throw new Error('Invalid response format from server');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch devices';
        console.error('Error fetching devices:', errorMessage, err);
        setError(`Failed to load devices: ${errorMessage}`);
        setDevices([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDevices();
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '256px' }}>
        <div style={{ 
          width: '48px', 
          height: '48px', 
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }}></div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: '#fee2e2',
        borderLeft: '4px solid #ef4444',
        color: '#b91c1c',
        padding: '1rem',
        marginBottom: '1rem',
        borderRadius: '0.25rem'
      }}>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h2 className="text-2xl font-bold mb-6">Connected Devices</h2>
      {devices.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No devices found. Connect a device to get started.</p>
          <Button>Add Device</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => {
            const getStatusInfo = (device: Device) => {
              if (!device.online) {
                return { bg: 'bg-gray-100 text-gray-800', text: 'Offline' };
              }
              return { bg: 'bg-green-100 text-green-800', text: 'Online' };
            };
            
            return (
              <div 
                key={device.device_id}
                className="flex flex-col p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-full bg-blue-50">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusInfo(device).bg}`}>
                    {getStatusInfo(device).text}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <span className="w-24 text-gray-500">Device ID:</span>
                      <span className="font-mono">{device.device_id}</span>
                    </div>
                    {device.battery_level !== null && (
                      <div className="flex items-center">
                        <span className="w-24 text-gray-500">Battery:</span>
                        <div className="w-full max-w-[120px] bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              device.battery_level > 50 ? 'bg-green-500' : 
                              device.battery_level > 20 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${device.battery_level}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm font-medium">{device.battery_level}%</span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <span className="w-24 text-gray-500">IP Address:</span>
                      <span>{device.ip_address || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-24 text-gray-500">Last Seen:</span>
                      <span>{new Date(device.last_seen).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end space-x-3">
                  <Button>View Details</Button>
                  <Button>Settings</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
