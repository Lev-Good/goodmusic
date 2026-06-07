export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  fileHandle?: FileSystemFileHandle;
  file?: File;
  size: number;
  coverUrl?: string;
  lyrics?: string;
  path: string;
  metadataLoaded?: boolean;
  rating?: number; // 1-5 stars
  playCount?: number;
  skipCount?: number;
  lastPlayed?: number; // timestamp
}

export interface FolderNode {
  name: string;
  path: string;
  handle?: FileSystemDirectoryHandle;
  subfolders: FolderNode[];
  tracks: Track[];
}

export interface PlaybackQueue {
  id: number;
  name: string;
  tracks: Track[];
  currentIndex: number;
  currentTime: number;
}

export type RepeatMode = 'off' | 'one' | 'all' | 'folder';

export interface PlaybackState {
  isPlaying: boolean;
  activeQueueId: number;
  queues: PlaybackQueue[];
  speed: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
}

export interface EQSettings {
  enabled: boolean;
  bands: number[]; // 10 values for 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz
  bassBoost: number; // 0 to 100
  trebleBoost: number; // 0 to 100
  preamp: number; // -12 to +12 dB
}
