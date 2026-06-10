export {};

declare global {
  interface Window {
    electronAPI: {
      readLrc: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeTags: (path: string, tags: any) => Promise<{ success: boolean; error?: string }>;
      showItemInFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
      openExternal: (url: string) => Promise<void>;
      selectDirectory: () => Promise<string | null>;
      scanDirectoryNative: (dirPath: string) => Promise<any>;
      parseMetadataNative: (filePath: string) => Promise<any>;
      writeTextFile: (filePath: string, content: string) => Promise<boolean>;
      readTextFile: (filePath: string) => Promise<string>;
      saveFileDialog: (defaultName: string) => Promise<string | null>;
      openFileDialog: () => Promise<string | null>;
      setMiniPlayer: (enabled: boolean) => Promise<void>;
      onMediaAction: (callback: (action: string) => void) => () => void;
      trashFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
      copyFile: (srcPath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
      moveFile: (srcPath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}
