import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

const electronAPIShim = {
  platform: 'win32',
  versions: {},

  writeTags: async (filePath: string, tags: any) => {
    try {
      const result = await invoke<boolean>('write_mp3_tags', { filePath, tags });
      return { success: result };
    } catch (error: any) {
      console.error('Error in writeTags tauri invoke:', error);
      return { success: false, error: String(error) };
    }
  },

  openExternal: async (url: string) => {
    try {
      await invoke('open_external_url', { url });
    } catch (error: any) {
      console.error('Error in openExternal tauri invoke:', error);
    }
  },

  readLrc: async (filePath: string) => {
    try {
      const content = await invoke<string>('read_lrc_file', { filePath });
      return { success: true, content };
    } catch (error: any) {
      return { success: false, error: String(error) };
    }
  },

  showItemInFolder: async (filePath: string) => {
    try {
      await invoke('show_item_in_folder', { filePath });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: String(error) };
    }
  },

  selectDirectory: async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      return selected as string | null;
    } catch (err) {
      console.error('Directory dialog error:', err);
      return null;
    }
  },

  scanDirectoryNative: async (dirPath: string) => {
    try {
      return await invoke('scan_directory_native', { dirPath });
    } catch (err) {
      console.error('Scan native error:', err);
      return null;
    }
  },

  parseMetadataNative: async (filePath: string) => {
    try {
      return await invoke('parse_metadata_native', { filePath });
    } catch (err) {
      console.error('Parse metadata error:', err);
      return null;
    }
  },

  writeTextFile: async (filePath: string, content: string) => {
    try {
      await invoke('write_text_file', { filePath, content });
      return true;
    } catch (err) {
      console.error('Write text file error:', err);
      return false;
    }
  },

  readTextFile: async (filePath: string) => {
    try {
      return await invoke<string>('read_text_file', { filePath });
    } catch (err) {
      console.error('Read text file error:', err);
      return '';
    }
  },

  saveFileDialog: async (defaultName: string) => {
    try {
      const selected = await save({
        defaultPath: defaultName,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      return selected as string | null;
    } catch (err) {
      console.error('Save dialog error:', err);
      return null;
    }
  },

  openFileDialog: async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      return selected as string | null;
    } catch (err) {
      console.error('Open dialog error:', err);
      return null;
    }
  },

  setMiniPlayer: async (enabled: boolean) => {
    try {
      const appWindow = getCurrentWindow();
      if (enabled) {
        await appWindow.setMinSize(new LogicalSize(150, 80));
        await appWindow.setSize(new LogicalSize(340, 115));
        await appWindow.setAlwaysOnTop(true);
      } else {
        await appWindow.setMinSize(new LogicalSize(900, 650));
        await appWindow.setSize(new LogicalSize(1250, 800));
        await appWindow.setAlwaysOnTop(false);
      }
    } catch (err) {
      console.error('Set mini player error:', err);
    }
  },

  trashFile: async (filePath: string) => {
    try {
      const success = await invoke<boolean>('trash_file', { filePath });
      return { success };
    } catch (error: any) {
      return { success: false, error: String(error) };
    }
  },

  renameFile: async (oldPath: string, newPath: string) => {
    try {
      const success = await invoke<boolean>('rename_file', { oldPath, newPath });
      return { success };
    } catch (error: any) {
      return { success: false, error: String(error) };
    }
  },

  copyFile: async (srcPath: string, destPath: string) => {
    try {
      const success = await invoke<boolean>('copy_file', { srcPath, destPath });
      return { success };
    } catch (error: any) {
      return { success: false, error: String(error) };
    }
  },

  moveFile: async (srcPath: string, destPath: string) => {
    try {
      const success = await invoke<boolean>('move_file', { srcPath, destPath });
      return { success };
    } catch (error: any) {
      return { success: false, error: String(error) };
    }
  },

  onMediaAction: (callback: (action: string) => void) => {
    let unlisten: any = null;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<string>('media-action', (event) => {
        callback(event.payload);
      }).then(fn => {
        unlisten = fn;
      });
    });
    return () => {
      if (unlisten) unlisten();
    };
  }
};

(window as any).electronAPI = electronAPIShim;

export default electronAPIShim;
