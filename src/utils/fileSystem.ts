import type { FolderNode, Track } from '../types/player';

export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.src = url;
    
    // Set a timeout of 1.5 seconds to avoid hanging on corrupt files
    const timeout = setTimeout(() => {
      audio.src = '';
      URL.revokeObjectURL(url);
      resolve(0);
    }, 1500);

    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      const duration = audio.duration;
      audio.src = '';
      URL.revokeObjectURL(url);
      resolve(duration || 0);
    });

    audio.addEventListener('error', () => {
      clearTimeout(timeout);
      audio.src = '';
      URL.revokeObjectURL(url);
      resolve(0);
    });
  });
}

const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];

export async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  onUpdate?: (root: FolderNode, count: number, filesScanned: number) => void
): Promise<FolderNode> {
  const rootNode: FolderNode = {
    name: dirHandle.name,
    path: dirHandle.name,
    handle: dirHandle,
    subfolders: [],
    tracks: [],
  };

  let totalCount = 0;
  let totalFilesScanned = 0;

  // Throttle updates to the UI (at most once every 150ms) to prevent React render storms
  let lastUpdateTime = 0;
  function triggerUpdate() {
    if (!onUpdate) return;
    const now = Date.now();
    if (now - lastUpdateTime > 150) {
      onUpdate({ ...rootNode }, totalCount, totalFilesScanned);
      lastUpdateTime = now;
    }
  }

  async function scan(handle: FileSystemDirectoryHandle, node: FolderNode): Promise<boolean> {
    const audioFiles: { handle: FileSystemFileHandle; name: string }[] = [];
    const subdirs: FileSystemDirectoryHandle[] = [];

    // Read all entries in this directory
    try {
      for await (const entry of handle.values()) {
        totalFilesScanned++;
        if (totalFilesScanned % 100 === 0) {
          triggerUpdate();
          // Yield control to let browser UI breathe
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        if (entry.kind === 'file') {
          const ext = entry.name.substring(entry.name.lastIndexOf('.')).toLowerCase();
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            audioFiles.push({ handle: entry, name: entry.name });
          }
        } else if (entry.kind === 'directory') {
          // Exclude system, hidden, package, or build directories to avoid hangs on large drives
          const lowerName = entry.name.toLowerCase();
          if (
            lowerName.startsWith('.') ||
            lowerName === 'node_modules' ||
            lowerName === 'appdata' ||
            lowerName === 'windows' ||
            lowerName === 'program files' ||
            lowerName === 'program files (x86)' ||
            lowerName === 'system volume information' ||
            lowerName === '$recycle.bin' ||
            lowerName === 'dist' ||
            lowerName === 'build' ||
            lowerName === 'out' ||
            lowerName === 'target' ||
            lowerName === 'bin' ||
            lowerName === 'obj' ||
            lowerName === 'venv' ||
            lowerName === '.venv' ||
            lowerName === 'env' ||
            lowerName === '.env' ||
            lowerName === '__pycache__' ||
            lowerName === 'bower_components' ||
            lowerName === 'packages' ||
            lowerName === 'temp' ||
            lowerName === 'tmp' ||
            lowerName === 'cache' ||
            lowerName === '.cache' ||
            lowerName === 'logs' ||
            lowerName === 'log' ||
            lowerName === 'ios' ||
            lowerName === 'android' ||
            lowerName === 'cmake-build-debug' ||
            lowerName === 'cmake-build-release' ||
            lowerName === 'debug' ||
            lowerName === 'release'
          ) {
            continue;
          }
          subdirs.push(entry);
        }
      }
    } catch (err) {
      console.warn(`Error reading directory entries: ${node.path}`, err);
    }

    // Process files in parallel batches (concurrency of 15) to speed up reads and tag parsing
    if (audioFiles.length > 0) {
      const BATCH_SIZE = 15;
      for (let i = 0; i < audioFiles.length; i += BATCH_SIZE) {
        const chunk = audioFiles.slice(i, i + BATCH_SIZE);
        
        await Promise.all(
          chunk.map(async (fileObj) => {
            try {
              const file = await fileObj.handle.getFile();

              const track: Track = {
                id: `${node.path}/${fileObj.name}`,
                name: fileObj.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
                artist: 'Unknown Artist',
                album: 'Unknown Album',
                duration: 0, // Loaded on-demand during play to speed up scan
                fileHandle: fileObj.handle,
                size: file.size,
                coverUrl: undefined,
                path: (file as any).path || `${node.path}/${fileObj.name}`,
                metadataLoaded: false,
              };
              node.tracks.push(track);
              totalCount++;
            } catch (err) {
              console.error(`Error loading track: ${fileObj.name}`, err);
            }
          })
        );

        // Yield control to the browser UI thread to prevent freezing the page
        await new Promise((resolve) => setTimeout(resolve, 0));
        triggerUpdate();
      }

      // Sort tracks alphabetically
      node.tracks.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Recursively scan subfolders, but ONLY append them if they contain audio files
    let hasContent = node.tracks.length > 0;

    for (const subdir of subdirs) {
      const subNode: FolderNode = {
        name: subdir.name,
        path: `${node.path}/${subdir.name}`,
        handle: subdir,
        subfolders: [],
        tracks: [],
      };
      
      // Yield control to let browser UI breathe
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        const subfolderHasContent = await scan(subdir, subNode);
        if (subfolderHasContent) {
          node.subfolders.push(subNode);
          node.subfolders.sort((a, b) => a.name.localeCompare(b.name));
          hasContent = true;
          triggerUpdate();
        }
      } catch (subfolderErr) {
        console.warn(`Failed to scan subdirectory ${subdir.name}:`, subfolderErr);
      }
    }

    return hasContent;
  }

  await scan(dirHandle, rootNode);

  // Final update to sync remaining nodes
  if (onUpdate) {
    onUpdate({ ...rootNode }, totalCount, totalFilesScanned);
  }

  return rootNode;
}

// Flat list of all tracks recursively starting from a FolderNode
export function getAllTracksFromNode(node: FolderNode): Track[] {
  let tracks = [...node.tracks];
  for (const sub of node.subfolders) {
    tracks = tracks.concat(getAllTracksFromNode(sub));
  }
  return tracks;
}

// Selects and scans a directory using Tauri's native dialog and native Rust backend command
export async function scanDirectoryTauri(): Promise<FolderNode | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');

    const selected = await open({
      directory: true,
      multiple: false,
      title: 'בחר תיקיית מוזיקה / Select Music Folder',
    });

    if (!selected || typeof selected !== 'string') {
      return null;
    }

    const rootNode = await invoke<FolderNode>('scan_directory_native', { dirPath: selected });
    return rootNode;
  } catch (err) {
    console.error('Failed to select or scan directory in Tauri:', err);
    throw err;
  }
}
