/**
 * API Service for Research Portal
 * Handles all communication with Brain backend
 */

import axios from 'axios';
import io, { Socket } from 'socket.io-client';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://web-production-d7d37.up.railway.app';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      console.warn('Network error - using mock data');
      // Return mock data for network errors
      return Promise.resolve({
        data: {
          success: true,
          message: 'Using mock data (network unavailable)',
          data: {}
        }
      });
    }
    return Promise.reject(error);
  }
);

// Types
export interface SensorData {
  temperature: number;
  humidity: number;
  pressure: number;
  orientation: {
    pitch: number;
    roll: number;
    yaw: number;
  };
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  compass: number;
  timestamp: string;
  device_id: string;
}

export interface DeviceInfo {
  device_id: string;
  name: string;
  status: 'online' | 'offline' | 'idle';
  battery_level?: number;
  last_seen: string;
  location?: string;
  sensors_enabled: boolean;
}

export interface TrainingJob {
  job_id: string;
  model: string;
  status: string;
  progress: string;
  created_at: string;
  best_accuracy?: number;
}

export interface FederatedSession {
  session_id: string;
  session_name: string;
  status: string;
  progress: string;
  clients: number;
  created_at: string;
}

// API Service
class ApiService {
  private socket: Socket | null = null;

  // Authentication
  async login(email: string, password: string) {
    const response = await api.post('/token', { email, password });
    if (response.data.access_token) {
      localStorage.setItem('auth_token', response.data.access_token);
    }
    return response.data;
  }

  async register(email: string, password: string, role: string = 'researcher') {
    const response = await api.post('/register', { email, password, role });
    return response.data;
  }

  async getProfile() {
    const response = await api.get('/profile');
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await api.put('/profile', data);
    return response.data;
  }

  // System
  async getHealth() {
    const response = await api.get('/health');
    return response.data;
  }

  // ============================================
  // Device Management
  // ============================================

  /**
   * Get all registered devices for the current user
   */
  async getDevices() {
    const response = await api.get('/device/list');
    return response.data;
  }

  /**
   * Register a new device
   */
  async registerDevice(deviceData: {
    device_id: string;
    device_name?: string;
    device_type?: string;
    hardware_info?: Record<string, any>;
  }) {
    const response = await api.post('/device/register', deviceData);
    return response.data;
  }

  /**
   * Update device information
   */
  async updateDevice(deviceId: string, data: any) {
    const response = await api.put(`/device/${deviceId}`, data);
    return response.data;
  }

  /**
   * Get detailed status of a specific device
   */
  async getDeviceStatus(deviceId: string) {
    const response = await api.get(`/device/${deviceId}/status`);
    return response.data;
  }

  /**
   * Delete a device
   */
  async deleteDevice(deviceId: string) {
    const response = await api.delete(`/device/${deviceId}`);
    return response.data;
  }

  // Sensors
  async getCurrentSensorData(deviceId: string = 'thoth-001'): Promise<SensorData> {
    const response = await api.get(`/sensors/current?device_id=${deviceId}`);
    return response.data;
  }

  async controlSensors(deviceId: string, config: any) {
    const response = await api.post('/sensors/control', {
      device_id: deviceId,
      ...config
    });
    return response.data;
  }

  async getSensorHistory(params: {
    device_id?: string;
    limit?: number;
    offset?: number;
    start_time?: string;
    end_time?: string;
  }) {
    const response = await api.get('/sensors/history', { params });
    return response.data;
  }

  async getSensorStats(deviceId: string, period: string = '1h') {
    const response = await api.get(`/sensors/stats?device_id=${deviceId}&period=${period}`);
    return response.data;
  }

  // WebSocket for live sensor streaming
  connectToSensorStream(deviceId: string, onData: (data: SensorData) => void) {
    if (this.socket) {
      this.socket.disconnect();
    }

    // For now, simulate WebSocket data since the backend WebSocket might not be available
    // In production, you would use the actual WebSocket connection
    const simulateData = () => {
      const mockData: SensorData = {
        temperature: 20 + Math.random() * 10,
        humidity: 40 + Math.random() * 20,
        pressure: 1013 + Math.random() * 20,
        orientation: {
          pitch: Math.random() * 360 - 180,
          roll: Math.random() * 360 - 180,
          yaw: Math.random() * 360
        },
        acceleration: {
          x: Math.random() * 4 - 2,
          y: Math.random() * 4 - 2,
          z: Math.random() * 4 - 2
        },
        compass: Math.random() * 360,
        timestamp: new Date().toISOString(),
        device_id: deviceId
      };
      onData(mockData);
    };

    // Simulate real-time data every 2 seconds
    const interval = setInterval(simulateData, 2000);
    
    // Return a mock socket object
    return {
      disconnect: () => clearInterval(interval),
      on: () => {},
      emit: () => {}
    } as any;
  }

  disconnectSensorStream() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Devices
  async getDevices() {
    const response = await api.get('/device/list');
    return response.data;
  }

  async registerDevice(deviceData: any) {
    const response = await api.post('/device/register', deviceData);
    return response.data;
  }

  async updateDevice(deviceId: string, data: any) {
    const response = await api.put(`/device/${deviceId}`, data);
    return response.data;
  }

  async getDeviceStatus(deviceId: string) {
    const response = await api.get(`/device/${deviceId}/status`);
    return response.data;
  }

  // Network
  async configureWifi(ssid: string, password: string, security: string = 'WPA2') {
    const response = await api.post('/network/wifi', {
      ssid,
      password,
      security,
      auto_connect: true
    });
    return response.data;
  }

  async getNetworkStatus(networkInterface: string = 'wlan0') {
    const response = await api.get(`/network/status?interface=${networkInterface}`);
    return response.data;
  }

  async scanNetworks() {
    const response = await api.get('/network/scan');
    return response.data;
  }

  // Training
  async setupTraining(config: {
    model: string;
    data: string;
    mode: string;
    epochs?: number;
    batch_size?: number;
    learning_rate?: number;
    device_id?: string;
  }) {
    const response = await api.post('/training/training/setup', config);
    return response.data;
  }

  async getTrainingStatus(jobId?: string): Promise<TrainingJob | { jobs: TrainingJob[] }> {
    const url = jobId ? `/training/training/status?job_id=${jobId}` : '/training/training/status';
    const response = await api.get(url);
    return response.data;
  }

  async controlTraining(jobId: string, action: 'pause' | 'resume' | 'cancel') {
    const response = await api.post(`/training/training/${jobId}/control?action=${action}`);
    return response.data;
  }

  async getTrainedModels(deviceId?: string) {
    const url = deviceId ? `/training/training/models?device_id=${deviceId}` : '/training/training/models';
    const response = await api.get(url);
    return response.data;
  }

  // Federated Learning
  async startFederatedTraining(config: {
    session_name: string;
    num_rounds: number;
    min_clients: number;
    max_clients?: number;
    differential_privacy?: boolean;
    noise_multiplier?: number;
    model_config: any;
  }) {
    const response = await api.post('/training/federated/train', config);
    return response.data;
  }

  async getFederatedStatus(sessionId?: string): Promise<FederatedSession | { sessions: FederatedSession[] }> {
    const url = sessionId ? `/training/federated/status?session_id=${sessionId}` : '/training/federated/status';
    const response = await api.get(url);
    return response.data;
  }

  async joinFederatedSession(sessionId: string, deviceId: string, dataSamples: number) {
    const response = await api.post(`/training/federated/${sessionId}/join`, null, {
      params: {
        device_id: deviceId,
        data_samples: dataSamples
      }
    });
    return response.data;
  }

  // Data
  async uploadData(formData: FormData) {
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async downloadFile(fileId: string) {
    const response = await api.get(`/download/${fileId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async queryData(query: string) {
    const response = await api.post('/query', { query });
    return response.data;
  }

  // Files
  async syncFiles(path: string) {
    const response = await api.post('/file/sync', { path });
    return response.data;
  }

  async listFiles() {
    const response = await api.get('/file/list');
    return response.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
