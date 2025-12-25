import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Path to thoth/data directory (relative to ResearchPortal)
    const dataDir = path.join(process.cwd(), '..', 'thoth', 'data');
    
    const files: { name: string; size: number; modified: string }[] = [];
    
    if (fs.existsSync(dataDir)) {
      const items = fs.readdirSync(dataDir);
      
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
    }
    
    return NextResponse.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (error) {
    console.error('Error listing data files:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list data files', files: [] },
      { status: 500 }
    );
  }
}
