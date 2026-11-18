export interface CacheItem {
  id: string;
  name: string;
  url?: string;
  timestamp: number;
  size: number;
  status: 'idle' | 'caching' | 'success' | 'error' | 'cancelled';
  progress: number;
  error?: string;
  stage?: 'connecting' | 'downloading' | 'processing' | 'storing' | 'completed';
  startTime?: number;
  downloadedSize?: number;
  totalSize?: number;
}
export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
}
