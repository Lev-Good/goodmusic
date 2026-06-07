export {};

declare global {
  interface Window {
    electronAPI: {
      readLrc: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeTags: (path: string, tags: any) => Promise<{ success: boolean; error?: string }>;
      showItemInFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}
