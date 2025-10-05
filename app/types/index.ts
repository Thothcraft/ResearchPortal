export interface Device {
  id: string;
  name: string;
  type: string;
  lastSeen: string;
  status: 'online' | 'offline' | 'maintenance';
  files: DataFile[];
}

export interface DataFile {
  id: string;
  name: string;
  type: 'csv' | 'json' | 'binary';
  size: string;
  createdAt: string;
  deviceId: string;
  description?: string;
}
