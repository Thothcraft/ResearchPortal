import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Mock device data - in a real app, this would come from your database
    const mockDevices = [
      {
        id: '1',
        name: 'PiSugar 1',
        status: 'online',
        battery: 85,
        lastSeen: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'PiSugar 2',
        status: 'offline',
        battery: 42,
        lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      },
    ];

    return NextResponse.json(mockDevices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
