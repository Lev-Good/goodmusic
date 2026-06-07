import type { Track } from '../types/player';
import { getAudioDuration } from './fileSystem';

export async function parseDroppedItems(items: DataTransferItemList): Promise<Track[]> {
  const tracks: Track[] = [];
  const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];

  const traverseEntry = async (entry: any, currentPath = ''): Promise<void> => {
    if (entry.isFile) {
      const ext = entry.name.substring(entry.name.lastIndexOf('.')).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        try {
          const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
          const duration = await getAudioDuration(file);
          const trackPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          
          const track: Track = {
            id: `drop-${Date.now()}-${Math.random()}-${entry.name}`,
            name: entry.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
            artist: 'Unknown Artist',
            album: 'Dropped Files',
            duration: duration,
            file: file,
            size: file.size,
            path: (file as any).path || trackPath,
          };
          tracks.push(track);
        } catch (e) {
          console.error('Error reading dropped file entry', e);
        }
      }
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readEntries = (): Promise<any[]> => {
        return new Promise((resolve) => {
          dirReader.readEntries((entries: any[]) => {
            resolve(entries);
          }, (err: any) => {
            console.error('Error reading directory entries', err);
            resolve([]);
          });
        });
      };
      
      const entries = await readEntries();
      for (const childEntry of entries) {
        await traverseEntry(childEntry, currentPath ? `${currentPath}/${entry.name}` : entry.name);
      }
    }
  };

  const promises: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        promises.push(traverseEntry(entry));
      }
    }
  }

  await Promise.all(promises);
  // Sort tracks alphabetically
  tracks.sort((a, b) => a.name.localeCompare(b.name));
  return tracks;
}
