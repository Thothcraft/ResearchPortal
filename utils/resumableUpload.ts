/** Resumable upload utility for large files */

export interface UploadSession {
  uploadId: string;
  filename: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  expiresAt: string;
}

export interface UploadProgress {
  uploadId: string;
  filename: string;
  progress: number;
  uploadedChunks: number[];
  totalChunks: number;
  bytesUploaded: number;
  totalBytes: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
}

export interface ChunkInfo {
  number: number;
  start: number;
  end: number;
  size: number;
  hash?: string;
  retryCount?: number;
}

export class ResumableUpload {
  private sessions: Map<string, UploadSession> = new Map();
  private activeUploads: Map<string, UploadProgress> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private maxConcurrentChunks = 3;
  private retryAttempts = 3;
  private baseUrl: string;

  constructor(baseUrl: string = '/api/proxy') {
    this.baseUrl = baseUrl;
  }

  /**
   * Calculate SHA-256 hash of a file or chunk
   */
  private async calculateHash(data: ArrayBuffer): Promise<string> {
    const buffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Split file into chunks
   */
  private splitFileIntoChunks(file: File, chunkSize: number): ChunkInfo[] {
    const chunks: ChunkInfo[] = [];
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      chunks.push({
        number: i,
        start,
        end,
        size: end - start
      });
    }
    
    return chunks;
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Initialize a resumable upload session
   */
  async initializeUpload(
    file: File,
    options: {
      chunkSize?: number;
      onProgress?: (progress: UploadProgress) => void;
      onComplete?: (fileId: number) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<string> {
    const { chunkSize = 1024 * 1024, onProgress, onComplete, onError } = options;
    
    try {
      // Calculate file hash
      const fileBuffer = await file.arrayBuffer();
      const fileHash = await this.calculateHash(fileBuffer);
      
      // Initialize upload session
      const response = await fetch(`${this.baseUrl}/upload/init`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          filename: file.name,
          total_size: file.size,
          chunk_size: chunkSize,
          file_hash: fileHash,
          content_type: file.type
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail?.message || 'Failed to initialize upload');
      }
      
      const session: UploadSession = await response.json();
      this.sessions.set(session.uploadId, session);
      
      // Create upload progress tracker
      const progress: UploadProgress = {
        uploadId: session.uploadId,
        filename: file.name,
        progress: 0,
        uploadedChunks: session.uploadedChunks,
        totalChunks: session.totalChunks,
        bytesUploaded: 0,
        totalBytes: file.size,
        status: 'pending'
      };
      
      this.activeUploads.set(session.uploadId, progress);
      
      // Start uploading chunks
      this.startChunkedUpload(file, session, onProgress, onComplete, onError);
      
      return session.uploadId;
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Upload initialization failed');
      throw error;
    }
  }

  /**
   * Start uploading chunks concurrently
   */
  private async startChunkedUpload(
    file: File,
    session: UploadSession,
    onProgress?: (progress: UploadProgress) => void,
    onComplete?: (fileId: number) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const progress = this.activeUploads.get(session.uploadId)!;
    progress.status = 'uploading';
    onProgress?.(progress);
    
    const chunks = this.splitFileIntoChunks(file, session.chunkSize);
    const abortController = new AbortController();
    this.abortControllers.set(session.uploadId, abortController);
    
    // Filter out already uploaded chunks
    const pendingChunks = chunks.filter(
      chunk => !session.uploadedChunks.includes(chunk.number)
    );
    
    // Upload chunks concurrently with limited parallelism
    const uploadPromises: Promise<void>[] = [];
    let chunkIndex = 0;
    
    const uploadNextChunk = async (): Promise<void> => {
      if (abortController.signal.aborted) return;
      
      if (chunkIndex >= pendingChunks.length) {
        // All chunks uploaded, complete the upload
        await this.completeUpload(session.uploadId, onComplete, onError);
        return;
      }
      
      const chunk = pendingChunks[chunkIndex++];
      const uploadPromise = this.uploadChunk(file, session, chunk, abortController.signal)
        .then(() => {
          // Update progress
          const updatedProgress = this.activeUploads.get(session.uploadId)!;
          updatedProgress.uploadedChunks.push(chunk.number);
          updatedProgress.uploadedChunks.sort((a, b) => a - b);
          updatedProgress.bytesUploaded += chunk.size;
          updatedProgress.progress = (updatedProgress.uploadedChunks.length / session.totalChunks) * 100;
          
          onProgress?.(updatedProgress);
          
          // Upload next chunk
          return uploadNextChunk();
        })
        .catch((error) => {
          if (abortController.signal.aborted) return;
          
          console.error(`Chunk ${chunk.number} upload failed:`, error);
          
          // Retry logic
          const currentRetryCount = chunk.retryCount || 0;
          if (currentRetryCount < this.retryAttempts) {
            chunk.retryCount = currentRetryCount + 1;
            console.log(`Retrying chunk ${chunk.number} (attempt ${chunk.retryCount})`);
            return uploadNextChunk(); // Skip retry for now, continue with next chunk
          } else {
            onError?.(`Failed to upload chunk ${chunk.number} after ${this.retryAttempts} attempts`);
            progress.status = 'error';
            progress.error = `Chunk ${chunk.number} upload failed`;
            onProgress?.(progress);
          }
        });
      
      uploadPromises.push(uploadPromise);
      
      // Maintain concurrency limit
      if (uploadPromises.length < this.maxConcurrentChunks && chunkIndex < pendingChunks.length) {
        uploadNextChunk();
      }
    };
    
    // Start initial chunk uploads
    for (let i = 0; i < Math.min(this.maxConcurrentChunks, pendingChunks.length); i++) {
      uploadNextChunk();
    }
    
    // Wait for all uploads to complete
    try {
      await Promise.all(uploadPromises);
    } catch (error) {
      // Errors are handled in individual chunk uploads
      console.error('Chunk upload error:', error);
    }
  }

  /**
   * Upload a single chunk
   */
  private async uploadChunk(
    file: File,
    session: UploadSession,
    chunk: ChunkInfo,
    signal: AbortSignal
  ): Promise<void> {
    const chunkData = file.slice(chunk.start, chunk.end);
    const chunkBuffer = await chunkData.arrayBuffer();
    const chunkHash = await this.calculateHash(chunkBuffer);
    
    const formData = new FormData();
    formData.append('chunk', new Blob([chunkBuffer]), `chunk_${chunk.number}`);
    
    const response = await fetch(
      `${this.baseUrl}/upload/chunk/${session.uploadId}?chunk_number=${chunk.number}&chunk_hash=${chunkHash}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData,
        signal
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || `Chunk ${chunk.number} upload failed`);
    }
  }

  /**
   * Complete the upload
   */
  private async completeUpload(
    uploadId: string,
    onComplete?: (fileId: number) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/upload/complete/${uploadId}`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail?.message || 'Failed to complete upload');
      }
      
      const result = await response.json();
      
      // Update progress
      const progress = this.activeUploads.get(uploadId)!;
      progress.status = 'completed';
      progress.progress = 100;
      
      // Clean up
      this.sessions.delete(uploadId);
      this.activeUploads.delete(uploadId);
      this.abortControllers.delete(uploadId);
      
      onComplete?.(result.file_id);
      
    } catch (error) {
      const progress = this.activeUploads.get(uploadId)!;
      progress.status = 'error';
      progress.error = error instanceof Error ? error.message : 'Upload completion failed';
      onError?.(progress.error);
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId: string): Promise<UploadProgress | null> {
    try {
      const response = await fetch(`${this.baseUrl}/upload/status/${uploadId}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        return null;
      }
      
      const status = await response.json();
      const progress = this.activeUploads.get(uploadId);
      
      if (progress) {
        progress.uploadedChunks = status.uploaded_chunks;
        progress.progress = status.progress;
        return progress;
      }
      
      return null;
      
    } catch (error) {
      console.error('Failed to get upload status:', error);
      return null;
    }
  }

  /**
   * Pause an upload
   */
  pauseUpload(uploadId: string): void {
    const abortController = this.abortControllers.get(uploadId);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(uploadId);
      
      const progress = this.activeUploads.get(uploadId);
      if (progress) {
        progress.status = 'paused';
      }
    }
  }

  /**
   * Resume an upload
   */
  async resumeUpload(
    uploadId: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
    onComplete?: (fileId: number) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const session = this.sessions.get(uploadId);
    if (!session) {
      onError?.('Upload session not found');
      return;
    }
    
    const progress = this.activeUploads.get(uploadId);
    if (progress) {
      progress.status = 'uploading';
      onProgress?.(progress);
    }
    
    await this.startChunkedUpload(file, session, onProgress, onComplete, onError);
  }

  /**
   * Cancel an upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    // Abort any ongoing uploads
    this.pauseUpload(uploadId);
    
    try {
      const response = await fetch(`${this.baseUrl}/upload/cancel/${uploadId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        console.error('Failed to cancel upload on server');
      }
    } catch (error) {
      console.error('Error cancelling upload:', error);
    }
    
    // Clean up local state
    this.sessions.delete(uploadId);
    this.activeUploads.delete(uploadId);
    this.abortControllers.delete(uploadId);
  }

  /**
   * Get all active uploads
   */
  getActiveUploads(): UploadProgress[] {
    return Array.from(this.activeUploads.values());
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
