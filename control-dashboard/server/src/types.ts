export interface ContainerStatus {
  id: string;
  name: string;
  status: string;
  image: string;
}

export interface FileSystemStats {
  total: number;
  used: number;
  available: number;
}

export interface FileSystemStatus {
  [key: string]: FileSystemStats;
}

export interface SystemSettings {
  modelPath: string;
  outputPath: string;
  maxConcurrentJobs: number;
  autoStart: boolean;
  notificationEnabled: boolean;
}

export interface FileInfo {
  name: string;
  size: number;
  lastModified: string;
  path: string;
} 