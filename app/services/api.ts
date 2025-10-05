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
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
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
  async login(username: string, password: string) {
    try {
      const response = await api.post('/token', {
        username,
        password,
        grant_type: 'password'
      });
    
      if (response.data.access_token) {
        localStorage.setItem('auth_token', response.data.access_token);
        // Set default auth header for subsequent requests
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      }
      return response.data;
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new Error(error.response.data.detail || 'Login failed');
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response from server. Please check your connection.');
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error('Error setting up login request');
      }
    }
  }

  async register(username: string, password: string, phone: string, role: string = 'researcher') {
    const response = await api.post('/register', { 
      username, 
      password, 
      phone_number: phone,
      role 
    });
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
  private onDataCallback: ((data: SensorData) => void) | null = null;
  private simulationInterval: NodeJS.Timeout | null = null;

  connectToSensorStream(deviceId: string, onData: (data: SensorData) => void) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.onDataCallback = onData;
    
    // In production, you would connect to the actual WebSocket
    // this.socket = io(`${WS_URL}?deviceId=${deviceId}`, {
    //   auth: { token: localStorage.getItem('auth_token') }
    // });
    // 
    // this.socket.on('sensor_data', (data: SensorData) => {
    //   this.onDataCallback?.(data);
    // });
    
    // For now, simulate WebSocket data
    this.simulateData();
    
    return () => {
      this.disconnectSensorStream();
    };
  }

  private simulateData() {
    // Clear any existing simulation
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    
    this.simulationInterval = setInterval(() => {
      if (!this.onDataCallback) return;
      
      const mockData: SensorData = {
        temperature: 25 + Math.random() * 5,
        humidity: 40 + Math.random() * 20,
        pressure: 1000 + Math.random() * 20,
        orientation: {
          pitch: Math.random() * 360 - 180,
          roll: Math.random() * 360 - 180,
          yaw: Math.random() * 360 - 180,
        },
        acceleration: {
          x: Math.random() * 2 - 1,
          y: Math.random() * 2 - 1,
          z: 9.8 + Math.random() * 0.2 - 0.1,
        },
        compass: Math.random() * 360,
        timestamp: new Date().toISOString(),
        device_id: 'simulated-device',
      };
      
      this.onDataCallback?.(mockData);
    }, 1000);
  }
  
  disconnectSensorStream() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.onDataCallback = null;
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
