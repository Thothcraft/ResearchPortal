'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Database, Server, HardDrive, Clock, ChevronDown, ChevronUp, FileText, FileJson } from 'lucide-react';
import { format } from 'date-fns';

interface DataFile {
  id: string;
  name: string;
  type: 'csv' | 'json' | 'binary';
  size: string;
  createdAt: string;
  deviceId: string;
  description?: string;
}

interface Device {
  id: string;
  name: string;
  type: string;
  lastSeen: string;
  status: 'online' | 'offline' | 'maintenance';
  files: DataFile[];
}

// Mock data - Replace with API calls in a real implementation
const mockDevices: Device[] = [
  {
    id: 'thoth-001',
    name: 'Thoth Device #1',
    type: 'Raspberry Pi 4',
    lastSeen: new Date().toISOString(),
    status: 'online',
    files: [
      {
        id: 'file-001',
        name: 'sensor_data_20231005.csv',
        type: 'csv',
        size: '2.4 MB',
        createdAt: '2023-10-05T10:30:00Z',
        deviceId: 'thoth-001',
        description: 'Full sensor data export'
      },
      {
        id: 'file-002',
        name: 'system_logs_20231004.json',
        type: 'json',
        size: '1.1 MB',
        createdAt: '2023-10-04T23:15:00Z',
        deviceId: 'thoth-001',
        description: 'System logs and events'
      }
    ]
  },
  {
    id: 'thoth-002',
    name: 'Thoth Device #2',
    type: 'Raspberry Pi 3B+',
    lastSeen: '2023-10-04T18:45:00Z',
    status: 'offline',
    files: [
      {
        id: 'file-003',
        name: 'sensor_data_20231003.csv',
        type: 'csv',
        size: '1.8 MB',
        createdAt: '2023-10-03T14:20:00Z',
        deviceId: 'thoth-002'
      }
    ]
  },
  {
    id: 'thoth-003',
    name: 'Thoth Device #3',
    type: 'Raspberry Pi 4',
    lastSeen: '2023-10-05T09:15:00Z',
    status: 'maintenance',
    files: []
  }
];

export default function DataPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDevices, setExpandedDevices] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // In a real app, fetch devices and their files from the API
    const fetchDevices = async () => {
      try {
        setLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDevices(mockDevices);
        
        // Expand the first device by default if there are any devices
        if (mockDevices.length > 0) {
          setExpandedDevices({ [mockDevices[0].id]: true });
        }
      } catch (error) {
        console.error('Error fetching devices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  const toggleDevice = (deviceId: string) => {
    setExpandedDevices(prev => ({
      ...prev,
      [deviceId]: !prev[deviceId]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-400';
      case 'maintenance':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'csv':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'json':
        return <FileJson className="w-4 h-4 text-yellow-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleDownloadFile = (file: DataFile) => {
    // In a real app, this would trigger a download from the server
    console.log('Downloading file:', file.name);
    // Create a download link
    const content = `This is a sample ${file.type} file for ${file.name}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredDevices = devices.filter(device => 
    device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.files.some(file => 
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    )
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Device Data</h1>
          <p className="mt-2 text-gray-600">View and manage your device data files</p>
        </div>

        {/* Search and Filter */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Search devices and files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Devices List */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <ul className="divide-y divide-gray-200">
            {filteredDevices.length > 0 ? (
              filteredDevices.map((device) => (
                <li key={device.id} className="bg-white">
                  <div 
                    className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleDevice(device.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`h-3 w-3 rounded-full ${getStatusColor(device.status)} mr-3`}></div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{device.name}</h3>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <HardDrive className="h-4 w-4 mr-1" />
                            <span>{device.type}</span>
                            <span className="mx-2">•</span>
                            <Clock className="h-4 w-4 mr-1" />
                            <span>Last seen {format(new Date(device.lastSeen), 'MMM d, yyyy HH:mm')}</span>
                            <span className="mx-2">•</span>
                            <span>{device.files.length} files</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-gray-400">
                        {expandedDevices[device.id] ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedDevices[device.id] && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-gray-200 px-4 py-4 sm:px-6">
                          {device.files.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      File Name
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Type
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Size
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Created
                                    </th>
                                    <th scope="col" className="relative px-6 py-3">
                                      <span className="sr-only">Actions</span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {device.files.map((file) => (
                                    <tr key={file.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center">
                                            {getFileIcon(file.type)}
                                          </div>
                                          <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{file.name}</div>
                                            {file.description && (
                                              <div className="text-sm text-gray-500">{file.description}</div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                          {file.type.toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {file.size}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {format(new Date(file.createdAt), 'MMM d, yyyy HH:mm')}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownloadFile(file);
                                          }}
                                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                                        >
                                          <Download className="h-5 w-5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              No files available for this device.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              ))
            ) : (
              <li className="px-4 py-12 text-center">
                <Database className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No devices found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery ? 'No devices match your search.' : 'No devices are currently registered.'}
                </p>
              </li>
            )}
          </ul>
        </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Device Files</h3>
              <ul className="space-y-4">
                {filteredDevices.map((device) => (
                  <li key={device.id} className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b">
                      <h4 className="font-medium text-gray-900">{device.name}</h4>
                      <p className="text-sm text-gray-500">{device.type}</p>
                    </div>
                    <ul className="divide-y divide-gray-200">
                      {device.files.map((file) => (
                        <li key={file.id} className="px-4 py-3 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center">
                                {getFileIcon(file.type)}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{file.name}</div>
                                <div className="text-sm text-gray-500">{file.size} • {new Date(file.createdAt).toLocaleDateString()}</div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadFile(file);
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Download file"
                            >
                              <Download className="h-5 w-5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
      </div>
    </div>
  );
}
