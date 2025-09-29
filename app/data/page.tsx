'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Calendar, Database, TrendingUp, RefreshCw } from 'lucide-react';
import SensorChart from '../components/SensorChart';
import apiService, { SensorData } from '../services/api';
import { format } from 'date-fns';

export default function DataPage() {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('thoth-001');
  const [timeRange, setTimeRange] = useState('1h');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);

  // Chart data
  const [temperatureChartData, setTemperatureChartData] = useState({
    labels: [] as string[],
    datasets: [{
      label: 'Temperature (°C)',
      data: [] as number[],
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
    }]
  });

  const [humidityChartData, setHumidityChartData] = useState({
    labels: [] as string[],
    datasets: [{
      label: 'Humidity (%)',
      data: [] as number[],
      borderColor: 'rgb(53, 162, 235)',
      backgroundColor: 'rgba(53, 162, 235, 0.5)',
    }]
  });

  const [pressureChartData, setPressureChartData] = useState({
    labels: [] as string[],
    datasets: [{
      label: 'Pressure (mbar)',
      data: [] as number[],
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
    }]
  });

  const [motionChartData, setMotionChartData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: 'Pitch',
        data: [] as number[],
        borderColor: 'rgb(255, 206, 86)',
        backgroundColor: 'rgba(255, 206, 86, 0.5)',
      },
      {
        label: 'Roll',
        data: [] as number[],
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
      },
      {
        label: 'Yaw',
        data: [] as number[],
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
      }
    ]
  });

  useEffect(() => {
    fetchCurrentData();
    fetchHistoricalData();
  }, [selectedDevice, timeRange]);

  useEffect(() => {
    if (isStreaming) {
      const socket = apiService.connectToSensorStream(selectedDevice, handleStreamData);
      return () => {
        apiService.disconnectSensorStream();
      };
    }
  }, [isStreaming, selectedDevice]);

  const fetchCurrentData = async () => {
    try {
      const data = await apiService.getCurrentSensorData(selectedDevice);
      setSensorData(data);
    } catch (error) {
      console.error('Failed to fetch sensor data:', error);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      setLoading(true);
      const history = await apiService.getSensorHistory({
        device_id: selectedDevice,
        limit: 100
      });
      
      if (history.data && history.data.length > 0) {
        setHistoricalData(history.data);
        updateCharts(history.data);
      }
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStreamData = (data: SensorData) => {
    setSensorData(data);
    
    // Update charts with streaming data
    const timestamp = format(new Date(data.timestamp), 'HH:mm:ss');
    
    // Update temperature chart
    setTemperatureChartData(prev => ({
      labels: [...prev.labels.slice(-19), timestamp],
      datasets: [{
        ...prev.datasets[0],
        data: [...prev.datasets[0].data.slice(-19), data.temperature]
      }]
    }));

    // Update humidity chart
    setHumidityChartData(prev => ({
      labels: [...prev.labels.slice(-19), timestamp],
      datasets: [{
        ...prev.datasets[0],
        data: [...prev.datasets[0].data.slice(-19), data.humidity]
      }]
    }));

    // Update pressure chart
    setPressureChartData(prev => ({
      labels: [...prev.labels.slice(-19), timestamp],
      datasets: [{
        ...prev.datasets[0],
        data: [...prev.datasets[0].data.slice(-19), data.pressure]
      }]
    }));

    // Update motion chart
    setMotionChartData(prev => ({
      labels: [...prev.labels.slice(-19), timestamp],
      datasets: [
        {
          ...prev.datasets[0],
          data: [...prev.datasets[0].data.slice(-19), data.orientation.pitch]
        },
        {
          ...prev.datasets[1],
          data: [...prev.datasets[1].data.slice(-19), data.orientation.roll]
        },
        {
          ...prev.datasets[2],
          data: [...prev.datasets[2].data.slice(-19), data.orientation.yaw]
        }
      ]
    }));
  };

  const updateCharts = (data: any[]) => {
    const labels = data.map(d => format(new Date(d.timestamp), 'HH:mm'));
    
    setTemperatureChartData({
      labels,
      datasets: [{
        label: 'Temperature (°C)',
        data: data.map(d => d.temperature),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      }]
    });

    setHumidityChartData({
      labels,
      datasets: [{
        label: 'Humidity (%)',
        data: data.map(d => d.humidity),
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      }]
    });

    setPressureChartData({
      labels,
      datasets: [{
        label: 'Pressure (mbar)',
        data: data.map(d => d.pressure),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      }]
    });

    setMotionChartData({
      labels,
      datasets: [
        {
          label: 'Pitch',
          data: data.map(d => d.orientation?.pitch || 0),
          borderColor: 'rgb(255, 206, 86)',
          backgroundColor: 'rgba(255, 206, 86, 0.5)',
        },
        {
          label: 'Roll',
          data: data.map(d => d.orientation?.roll || 0),
          borderColor: 'rgb(153, 102, 255)',
          backgroundColor: 'rgba(153, 102, 255, 0.5)',
        },
        {
          label: 'Yaw',
          data: data.map(d => d.orientation?.yaw || 0),
          borderColor: 'rgb(255, 159, 64)',
          backgroundColor: 'rgba(255, 159, 64, 0.5)',
        }
      ]
    });
  };

  const handleDownload = async (format: 'csv' | 'json') => {
    try {
      const data = historicalData;
      let content: string;
      let filename: string;
      let type: string;

      if (format === 'csv') {
        // Convert to CSV
        const headers = ['timestamp', 'temperature', 'humidity', 'pressure', 'pitch', 'roll', 'yaw'];
        const csv = [
          headers.join(','),
          ...data.map(d => [
            d.timestamp,
            d.temperature,
            d.humidity,
            d.pressure,
            d.orientation?.pitch || 0,
            d.orientation?.roll || 0,
            d.orientation?.yaw || 0
          ].join(','))
        ].join('\n');
        
        content = csv;
        filename = `sensor_data_${selectedDevice}_${Date.now()}.csv`;
        type = 'text/csv';
      } else {
        // JSON format
        content = JSON.stringify(data, null, 2);
        filename = `sensor_data_${selectedDevice}_${Date.now()}.json`;
        type = 'application/json';
      }

      // Create download link
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download data:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Sensor Data</h1>
          <p className="text-gray-300">Real-time monitoring and historical analysis</p>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-xl p-4 mb-6 border border-white/20"
        >
          <div className="flex flex-col md:flex-row gap-4">
            {/* Device Selector */}
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
            >
              <option value="thoth-001">Thoth Alpha</option>
              <option value="thoth-002">Thoth Beta</option>
              <option value="thoth-003">Thoth Gamma</option>
            </select>

            {/* Time Range */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>

            {/* Stream Toggle */}
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                isStreaming
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                  : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-red-400 animate-pulse' : 'bg-gray-400'}`} />
              {isStreaming ? 'Stop Stream' : 'Start Stream'}
            </button>

            {/* Refresh */}
            <button
              onClick={() => {
                fetchCurrentData();
                fetchHistoricalData();
              }}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            {/* Download */}
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload('csv')}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => handleDownload('json')}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
            </div>
          </div>
        </motion.div>

        {/* Current Values */}
        {sensorData && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6"
          >
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <p className="text-gray-400 text-sm mb-1">Temperature</p>
              <p className="text-2xl font-bold text-red-400">{sensorData.temperature.toFixed(1)}°C</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <p className="text-gray-400 text-sm mb-1">Humidity</p>
              <p className="text-2xl font-bold text-blue-400">{sensorData.humidity.toFixed(1)}%</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <p className="text-gray-400 text-sm mb-1">Pressure</p>
              <p className="text-2xl font-bold text-green-400">{sensorData.pressure.toFixed(0)} mb</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <p className="text-gray-400 text-sm mb-1">Pitch</p>
              <p className="text-2xl font-bold text-yellow-400">{sensorData.orientation.pitch.toFixed(1)}°</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <p className="text-gray-400 text-sm mb-1">Roll</p>
              <p className="text-2xl font-bold text-purple-400">{sensorData.orientation.roll.toFixed(1)}°</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <p className="text-gray-400 text-sm mb-1">Compass</p>
              <p className="text-2xl font-bold text-orange-400">{sensorData.compass.toFixed(0)}°</p>
            </div>
          </motion.div>
        )}

        {/* Charts */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <SensorChart
              data={temperatureChartData}
              title="Temperature Over Time"
              yAxisLabel="Temperature (°C)"
            />
            <SensorChart
              data={humidityChartData}
              title="Humidity Over Time"
              yAxisLabel="Humidity (%)"
            />
            <SensorChart
              data={pressureChartData}
              title="Pressure Over Time"
              yAxisLabel="Pressure (mbar)"
            />
            <SensorChart
              data={motionChartData}
              title="Motion (Orientation) Over Time"
              yAxisLabel="Degrees"
            />
          </motion.div>
        )}

        {/* Data Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20"
        >
          <h2 className="text-xl font-semibold text-white mb-4">Historical Data</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-300">
              <thead className="text-xs uppercase bg-black/20">
                <tr>
                  <th className="px-4 py-2">Timestamp</th>
                  <th className="px-4 py-2">Temperature</th>
                  <th className="px-4 py-2">Humidity</th>
                  <th className="px-4 py-2">Pressure</th>
                  <th className="px-4 py-2">Pitch</th>
                  <th className="px-4 py-2">Roll</th>
                  <th className="px-4 py-2">Yaw</th>
                </tr>
              </thead>
              <tbody>
                {historicalData.slice(0, 10).map((data, index) => (
                  <tr key={index} className="border-b border-white/10">
                    <td className="px-4 py-2">{format(new Date(data.timestamp), 'yyyy-MM-dd HH:mm:ss')}</td>
                    <td className="px-4 py-2">{data.temperature?.toFixed(1)}°C</td>
                    <td className="px-4 py-2">{data.humidity?.toFixed(1)}%</td>
                    <td className="px-4 py-2">{data.pressure?.toFixed(0)} mb</td>
                    <td className="px-4 py-2">{data.orientation?.pitch?.toFixed(1)}°</td>
                    <td className="px-4 py-2">{data.orientation?.roll?.toFixed(1)}°</td>
                    <td className="px-4 py-2">{data.orientation?.yaw?.toFixed(1)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
