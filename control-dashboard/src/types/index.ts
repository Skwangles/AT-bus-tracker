export interface PipelineStatus {
  slamMapping: {
    status: 'idle' | 'running' | 'completed' | 'error';
    progress: number;
    currentVideo?: string;
    error?: string;
  };
  mapProcessing: {
    status: 'idle' | 'running' | 'completed' | 'error';
    progress: number;
    currentStep?: string;
    error?: string;
  };
  blurring: {
    status: 'idle' | 'running' | 'completed' | 'error';
    progress: number;
    currentImage?: string;
    error?: string;
  };
}

export interface PipelineConfig {
  slamMapping: {
    videos: string[];
    configFile: string;
    outputMap: string;
  };
  mapProcessing: {
    inputMap: string;
    outputDb: string;
    pruneSettings: {
      targetCloseness: number;
      alwaysMergeCloseness: number;
    };
  };
  blurring: {
    inputDb: string;
    imageDir: string;
    outputDir: string;
  };
}

export interface ContainerStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'exited';
  state: string;
  ports: { [key: string]: string };
  created: string;
  image: string;
}

export interface FileSystemStatus {
  videoDir: {
    total: number;
    used: number;
    available: number;
  };
  imageDir: {
    total: number;
    used: number;
    available: number;
  };
  dbDir: {
    total: number;
    used: number;
    available: number;
  };
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  service: string;
} 