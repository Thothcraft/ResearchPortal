import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Path to thoth/data directory (relative to ResearchPortal)
    const dataDir = path.join(process.cwd(), '..', 'thoth', 'data');
    
    console.log('Looking for data files in:', dataDir);
    console.log('Directory exists:', fs.existsSync(dataDir));
    
    const files: { name: string; size: number; modified: string }[] = [];
    
    if (fs.existsSync(dataDir)) {
      const items = fs.readdirSync(dataDir);
      console.log('Found items:', items);
      
      for (const item of items) {
        const itemPath = path.join(dataDir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isFile()) {
          // Only include files with recognized prefixes
          const nameLower = item.toLowerCase();
          if (['imu_', 'csi_', 'mfcw_', 'img_', 'vid_'].some(prefix => nameLower.startsWith(prefix))) {
            files.push({
              name: item,
              size: stat.size,
              modified: stat.mtime.toISOString(),
            });
          }
        }
      }
    } else {
      console.log('Data directory does not exist');
    }
    
    console.log('Returning files:', files.length);
    
    return NextResponse.json({
      success: true,
      files,
      count: files.length,
      dataDir, // Include for debugging
    });
  } catch (error) {
    console.error('Error listing data files:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list data files', files: [] },
      { status: 500 }
    );
  }
}
