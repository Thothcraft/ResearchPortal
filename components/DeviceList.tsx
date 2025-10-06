'use client';

import { useState, useEffect } from 'react';

type Device = {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  battery: number;
  lastSeen: string;
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

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/devices', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch devices');
        }

        const data = await response.json();
        setDevices(data);
      } catch (err) {
        console.error('Error fetching devices:', err);
        setError('Failed to load devices. Using demo data.');
        // Mock data for demo purposes
        setDevices([
          {
            id: '1',
            name: 'PiSugar 1',
            status: 'online',
            battery: 85,
            lastSeen: new Date().toISOString(),
          },
        ]);
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
    <div style={{ marginTop: '1rem' }}>
      {devices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No devices found. Connect a device to get started.</p>
          <Button>Add Device</Button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          {devices.map((device) => {
            const statusStyles = {
              online: { bg: '#dcfce7', text: '#166534' },
              offline: { bg: '#f3f4f6', text: '#4b5563' },
              error: { bg: '#fee2e2', text: '#991b1b' }
            };
            
            const statusStyle = statusStyles[device.status] || statusStyles.offline;

            return (
              <div 
                key={device.id} 
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  transition: 'box-shadow 0.2s',
                  backgroundColor: 'white'
                }}
                onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 600,
                    margin: 0 
                  }}>
                    {device.name}
                  </h3>
                  <span style={{
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.text,
                    padding: '0.25rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    textTransform: 'capitalize'
                  }}>
                    {device.status}
                  </span>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Battery:</span>
                    <span style={{ fontWeight: 500 }}>{device.battery}%</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Last Seen:</span>
                    <span style={{ fontSize: '0.875rem' }}>
                      {new Date(device.lastSeen).toLocaleString()}
                    </span>
                  </div>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem',
                  marginTop: '1rem'
                }}>
                  <button style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    View Details
                  </button>
                  <button style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    Settings
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
