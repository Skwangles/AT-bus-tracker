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