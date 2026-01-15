/**
 * Database Health Monitor Component
 * 
 * Displays real-time database connection status and provides
 * manual health check capabilities.
 */

import React, { useState, useEffect } from 'react';
import { apiService } from './services/api';

interface DatabaseStatus {
  status: 'connected' | 'disconnected' | 'error';
  version?: string;
  timestamp: string;
  pool_size?: number;
  checked_in?: number;
  checked_out?: number;
  error?: string;
}

interface MonitorStatus {
  is_running: boolean;
  failure_count: number;
  last_check: string | null;
  recent_status: any[];
}

const DatabaseHealthMonitor: React.FC = () => {
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchHealthStatus = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const healthData = await apiService.getDatabaseHealth(forceRefresh);
      setDatabaseStatus(healthData.database);
      setMonitorStatus(healthData.monitor);
    } catch (error) {
      console.error('Failed to fetch database health:', error);
      setDatabaseStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    fetchHealthStatus();

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchHealthStatus();
      }, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600';
      case 'disconnected':
        return 'text-red-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return '✅';
      case 'disconnected':
        return '❌';
      case 'error':
        return '⚠️';
      default:
        return '❓';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Database Health Monitor</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>
          <button
            onClick={() => fetchHealthStatus(true)}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Force Check'}
          </button>
        </div>
      </div>

      {databaseStatus && (
        <div className="space-y-4">
          {/* Database Connection Status */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Database Connection</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Status:</span>
                <span className={`ml-2 ${getStatusColor(databaseStatus.status)}`}>
                  {getStatusIcon(databaseStatus.status)} {databaseStatus.status}
                </span>
              </div>
              <div>
                <span className="font-medium">Last Check:</span>
                <span className="ml-2 text-gray-600">
                  {new Date(databaseStatus.timestamp).toLocaleString()}
                </span>
              </div>
              {databaseStatus.version && (
                <div>
                  <span className="font-medium">Version:</span>
                  <span className="ml-2 text-gray-600">{databaseStatus.version}</span>
                </div>
              )}
              {databaseStatus.error && (
                <div className="col-span-2">
                  <span className="font-medium">Error:</span>
                  <span className="ml-2 text-red-600">{databaseStatus.error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Connection Pool Status */}
          {databaseStatus.pool_size !== undefined && (
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Connection Pool</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="font-medium">Pool Size:</span>
                  <span className="ml-2 text-gray-600">{databaseStatus.pool_size}</span>
                </div>
                <div>
                  <span className="font-medium">Checked In:</span>
                  <span className="ml-2 text-gray-600">{databaseStatus.checked_in}</span>
                </div>
                <div>
                  <span className="font-medium">Checked Out:</span>
                  <span className="ml-2 text-gray-600">{databaseStatus.checked_out}</span>
                </div>
              </div>
            </div>
          )}

          {/* Health Monitor Status */}
          {monitorStatus && (
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Health Monitor</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Monitor Status:</span>
                  <span className={`ml-2 ${monitorStatus.is_running ? 'text-green-600' : 'text-red-600'}`}>
                    {monitorStatus.is_running ? 'Running' : 'Stopped'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Failure Count:</span>
                  <span className={`ml-2 ${monitorStatus.failure_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {monitorStatus.failure_count}
                  </span>
                </div>
                {monitorStatus.last_check && (
                  <div>
                    <span className="font-medium">Last Monitor Check:</span>
                    <span className="ml-2 text-gray-600">
                      {new Date(monitorStatus.last_check).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Status History */}
          {monitorStatus?.recent_status && monitorStatus.recent_status.length > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Recent Status History</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {monitorStatus.recent_status.slice(-5).reverse().map((status, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className={getStatusColor(status.status)}>
                      {getStatusIcon(status.status)} {status.status}
                    </span>
                    <span className="text-gray-600">
                      {new Date(status.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!databaseStatus && !loading && (
        <div className="text-center text-gray-600 py-8">
          <p>Unable to load database health status</p>
          <button
            onClick={() => fetchHealthStatus()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default DatabaseHealthMonitor;
