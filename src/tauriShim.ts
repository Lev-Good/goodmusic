import { invoke } from '@tauri-apps/api/core';

// Define the shim for electronAPI to map to Tauri commands
const electronAPIShim = {
  // Write ID3 tags to MP3 file
  writeTags: async (filePath: string, tags: any) => {
    try {
      const result = await invoke<boolean>('write_mp3_tags', { filePath, tags });
      return { success: result };
    } catch (error: any) {
      console.error('Error in writeTags tauri invoke:', error);
      return { success: false, error: String(error) };
    }
  },

  // Open external URL in user's default browser
  openExternal: async (url: string) => {
    try {
      await invoke('open_external_url', { url });
      return { success: true };
    } catch (error: any) {
      console.error('Error in openExternal tauri invoke:', error);
      return { success: false, error: String(error) };
    }
  },

  // Read LRC lyrics file from disk
  readLrc: async (filePath: string) => {
    try {
      const content = await invoke<string>('read_lrc_file', { filePath });
      return { success: true, content };
    } catch (error: any) {
      console.error('Error in readLrc tauri invoke:', error);
      return { success: false, error: String(error) };
    }
  },

  // Show file in system file explorer
  showItemInFolder: async (filePath: string) => {
    try {
      await invoke('show_item_in_folder', { filePath });
      return { success: true };
    } catch (error: any) {
      console.error('Error in showItemInFolder tauri invoke:', error);
      return { success: false, error: String(error) };
    }
  },

  // Subscribes to media actions (mocked since keyboard shortcuts are captured in React)
  onMediaAction: (_callback: (action: string) => void) => {
    // Return a dummy unsubscribe function
    return () => {};
  }
};

// Expose the shim globally
(window as any).electronAPI = electronAPIShim;

export default electronAPIShim;
