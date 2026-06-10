import React, { useState, useEffect } from 'react';
import type { Track } from '../types/player';
import { X, Save, Edit3, MessageSquare, Image } from 'lucide-react';

interface TagEditorModalProps {
  tracks: Track[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatesMap: Record<string, { name?: string; artist?: string; album?: string; lyrics?: string; coverUrl?: string }>) => void;
  lang?: 'he' | 'en';
}

export const TagEditorModal: React.FC<TagEditorModalProps> = ({
  tracks,
  isOpen,
  onClose,
  onSave,
  lang = 'he',
}) => {
  const isBatch = tracks.length > 1;
  const singleTrack = tracks[0] || null;

  // Form states
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  // Batch update toggles (decides which fields to overwrite in batch mode)
  const [updateArtist, setUpdateArtist] = useState(false);
  const [updateAlbum, setUpdateAlbum] = useState(false);
  const [updateLyrics, setUpdateLyrics] = useState(false);
  const [updateCover, setUpdateCover] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const TagEditorTranslations = {
    he: {
      pathError: 'לא ניתן היה לזהות את נתיב הקובץ המלא עבור: {file}',
      writeError: 'שגיאה בכתיבת התגיות לקובץ: {file}',
      unknownError: 'שגיאה לא ידועה בעדכון הקבצים.',
      titleSingle: 'עורך תגיות קובץ',
      titleBatch: 'עורך תגיות מרובה ({count} שירים)',
      coverArt: 'עטיפת אלבום',
      changeCover: 'החלף עטיפה',
      songTitle: 'שם השיר',
      artistName: 'שם האמן',
      albumName: 'שם האלבום',
      lyricsLabel: 'מילות השיר (Unsynced Lyrics)',
      lyricsPlaceholder: 'הקלד כאן את מילות השיר (לא מסונכרן)...',
      cancel: 'ביטול',
      saving: 'שומר קבצים... ({progress})',
      saveChanges: 'שמור שינויים',
      overwriteLabel: 'עדכן שדה זה בכל השירים שנבחרו',
    },
    en: {
      pathError: 'Could not identify the full file path for: {file}',
      writeError: 'Error writing tags to the file: {file}',
      unknownError: 'Unknown error updating the files.',
      titleSingle: 'File Tag Editor',
      titleBatch: 'Batch Tag Editor ({count} tracks)',
      coverArt: 'Album Cover',
      changeCover: 'Change Cover',
      songTitle: 'Song Title',
      artistName: 'Artist Name',
      albumName: 'Album Name',
      lyricsLabel: 'Lyrics (Unsynced)',
      lyricsPlaceholder: 'Type the song lyrics here (unsynced)...',
      cancel: 'Cancel',
      saving: 'Saving files... ({progress})',
      saveChanges: 'Save Changes',
      overwriteLabel: 'Update this field in all selected tracks',
    }
  };

  const localT = (key: keyof typeof TagEditorTranslations.he, params?: Record<string, string | number>) => {
    let text = TagEditorTranslations[lang][key];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  useEffect(() => {
    if (!isOpen || tracks.length === 0) return;

    setError(null);
    setProgress(null);
    setCoverFile(null);

    if (!isBatch && singleTrack) {
      // Single track: populate all fields
      setTitle(singleTrack.name);
      setArtist(singleTrack.artist === 'Unknown Artist' ? '' : singleTrack.artist);
      setAlbum(singleTrack.album === 'Unknown Album' ? '' : singleTrack.album);
      setLyrics(singleTrack.lyrics || '');
      setCoverPreviewUrl(singleTrack.coverUrl || null);
    } else {
      // Batch mode: check if fields are identical across all tracks, otherwise set empty
      const first = tracks[0];
      const allSameArtist = tracks.every(t => t.artist === first.artist);
      const allSameAlbum = tracks.every(t => t.album === first.album);
      const allSameLyrics = tracks.every(t => t.lyrics === first.lyrics);
      const allSameCover = tracks.every(t => t.coverUrl === first.coverUrl);

      setTitle(''); // Title is never editable in batch mode
      setArtist(allSameArtist && first.artist !== 'Unknown Artist' ? first.artist : '');
      setAlbum(allSameAlbum && first.album !== 'Unknown Album' ? first.album : '');
      setLyrics(allSameLyrics ? first.lyrics || '' : '');
      setCoverPreviewUrl(allSameCover ? first.coverUrl || null : null);

      setUpdateArtist(false);
      setUpdateAlbum(false);
      setUpdateLyrics(false);
      setUpdateCover(false);
    }
  }, [tracks, isOpen]);

  if (!isOpen || tracks.length === 0) return null;

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreviewUrl(URL.createObjectURL(file));
      if (isBatch) setUpdateCover(true);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const updatesMap: Record<string, { name?: string; artist?: string; album?: string; lyrics?: string; coverUrl?: string }> = {};
      let index = 0;

      for (const track of tracks) {
        index++;
        setProgress(`${index}/${tracks.length}`);

        let absolutePath = '';
        if (track.file) {
          absolutePath = (track.file as any).path;
        } else if (track.fileHandle) {
          const fileObj = await track.fileHandle.getFile();
          absolutePath = (fileObj as any).path;
        }

        const isWeb = !window.electronAPI;

        // Skip physical write for Web, but we still build the updatesMap for virtual tagging
        if (!isWeb && !absolutePath) {
          throw new Error(localT('pathError', { file: track.name }));
        }

        const tagsPayload: any = {};
        const updatedFields: any = {};

        if (!isBatch) {
          // Single Edit - save all fields
          tagsPayload.title = title.trim();
          tagsPayload.artist = artist.trim() || 'Unknown Artist';
          tagsPayload.album = album.trim() || 'Unknown Album';
          tagsPayload.unsyncedLyrics = lyrics.trim();

          updatedFields.name = title.trim();
          updatedFields.artist = artist.trim() || 'Unknown Artist';
          updatedFields.album = album.trim() || 'Unknown Album';
          updatedFields.lyrics = lyrics.trim();

          if (coverFile) {
            const base64Data = await convertToBase64(coverFile);
            tagsPayload.coverImageBase64 = base64Data;
            tagsPayload.coverImageMime = coverFile.type;
            updatedFields.coverUrl = coverPreviewUrl || undefined;
          } else if (coverPreviewUrl === null) {
            tagsPayload.removeCover = true;
            updatedFields.coverUrl = undefined;
          }
        } else {
          // Batch Edit - save only checked fields
          if (updateArtist) {
            tagsPayload.artist = artist.trim() || 'Unknown Artist';
            updatedFields.artist = artist.trim() || 'Unknown Artist';
          }
          if (updateAlbum) {
            tagsPayload.album = album.trim() || 'Unknown Album';
            updatedFields.album = album.trim() || 'Unknown Album';
          }
          if (updateLyrics) {
            tagsPayload.unsyncedLyrics = lyrics.trim();
            updatedFields.lyrics = lyrics.trim();
          }
          if (updateCover) {
            if (coverFile) {
              const base64Data = await convertToBase64(coverFile);
              tagsPayload.coverImageBase64 = base64Data;
              tagsPayload.coverImageMime = coverFile.type;
              updatedFields.coverUrl = coverPreviewUrl || undefined;
            } else if (coverPreviewUrl === null) {
              tagsPayload.removeCover = true;
              updatedFields.coverUrl = undefined;
            }
          }
        }

        // Only save if we actually modified something
        if (Object.keys(updatedFields).length > 0) {
          if (!isWeb) {
            // Native write via Electron IPC
            const result = await window.electronAPI.writeTags(absolutePath, tagsPayload);
            if (!result.success) {
              throw new Error(result.error || localT('writeError', { file: track.name }));
            }
          }
          updatesMap[track.id] = updatedFields;
        }
      }

      onSave(updatesMap);
      onClose();
    } catch (err: any) {
      console.error('Error saving tag edits:', err);
      setError(err.message || localT('unknownError'));
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div 
        className={`w-full max-w-lg bg-neutral-950 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150 ${
          lang === 'he' ? 'text-right' : 'text-left'
        }`}
        dir={lang === 'he' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2 text-neutral-300">
            <Edit3 size={16} className="text-brand" />
            <h2 className="text-sm font-semibold tracking-wide">
              {isBatch 
                ? localT('titleBatch', { count: tracks.length }) 
                : localT('titleSingle')}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            disabled={saving}
            className="w-7 h-7 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg leading-normal">
            {error}
          </div>
        )}

        {/* Dual Column Editor (Cover & Form) */}
        <div className="flex gap-5 items-start">
          
          {/* Cover Art input */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0 w-28">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{localT('coverArt')}</span>
            <div className="w-28 h-28 rounded-xl bg-neutral-900 border border-white/5 overflow-hidden flex items-center justify-center relative shadow group select-none">
              {coverPreviewUrl ? (
                <img src={coverPreviewUrl} alt="cover art" className="w-full h-full object-cover" />
              ) : (
                <Image size={24} className="text-neutral-600 opacity-40" />
              )}
            </div>
            
            <label className="w-full text-center py-1.5 px-3 rounded-lg border border-white/5 bg-neutral-900 hover:bg-neutral-800 text-[10px] font-semibold text-neutral-300 hover:text-neutral-100 transition-colors cursor-pointer select-none">
              {localT('changeCover')}
              <input type="file" accept="image/png, image/jpeg" onChange={handleCoverChange} className="hidden" disabled={saving} />
            </label>

            {isBatch && (
              <label className="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={updateCover}
                  onChange={(e) => setUpdateCover(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-800 accent-brand w-3.5 h-3.5"
                  disabled={saving}
                />
                <span className="text-[9px] text-neutral-500 font-bold">{lang === 'he' ? 'עדכן עטיפה' : 'Update Cover'}</span>
              </label>
            )}
          </div>

          {/* Form Fields */}
          <div className="flex-1 flex flex-col gap-3">
            {/* Song Title (Single track only) */}
            {!isBatch && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{localT('songTitle')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={saving}
                  className="w-full py-1.5 px-3 rounded-lg border border-white/5 bg-neutral-900/60 text-xs text-neutral-200 focus:outline-none focus:border-brand/40 focus:bg-neutral-900 transition-all disabled:opacity-50"
                />
              </div>
            )}

            {/* Artist Name */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{localT('artistName')}</label>
                {isBatch && (
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={updateArtist}
                      onChange={(e) => setUpdateArtist(e.target.checked)}
                      className="rounded border-neutral-700 bg-neutral-800 accent-brand w-3 h-3"
                      disabled={saving}
                    />
                    <span className="text-[9px] text-neutral-500">{lang === 'he' ? 'עדכן שדה' : 'Update'}</span>
                  </label>
                )}
              </div>
              <input
                type="text"
                value={artist}
                onChange={(e) => {
                  setArtist(e.target.value);
                  if (isBatch) setUpdateArtist(true);
                }}
                disabled={saving}
                className="w-full py-1.5 px-3 rounded-lg border border-white/5 bg-neutral-900/60 text-xs text-neutral-200 focus:outline-none focus:border-brand/40 focus:bg-neutral-900 transition-all disabled:opacity-50"
              />
            </div>

            {/* Album Name */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{localT('albumName')}</label>
                {isBatch && (
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={updateAlbum}
                      onChange={(e) => setUpdateAlbum(e.target.checked)}
                      className="rounded border-neutral-700 bg-neutral-800 accent-brand w-3 h-3"
                      disabled={saving}
                    />
                    <span className="text-[9px] text-neutral-500">{lang === 'he' ? 'עדכן שדה' : 'Update'}</span>
                  </label>
                )}
              </div>
              <input
                type="text"
                value={album}
                onChange={(e) => {
                  setAlbum(e.target.value);
                  if (isBatch) setUpdateAlbum(true);
                }}
                disabled={saving}
                className="w-full py-1.5 px-3 rounded-lg border border-white/5 bg-neutral-900/60 text-xs text-neutral-200 focus:outline-none focus:border-brand/40 focus:bg-neutral-900 transition-all disabled:opacity-50"
              />
            </div>
          </div>

        </div>

        {/* Unsynced Lyrics Area */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
              <MessageSquare size={10} className="text-neutral-500" />
              {localT('lyricsLabel')}
            </label>
            {isBatch && (
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={updateLyrics}
                  onChange={(e) => setUpdateLyrics(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-800 accent-brand w-3 h-3"
                  disabled={saving}
                />
                <span className="text-[9px] text-neutral-500">{lang === 'he' ? 'עדכן מילים לכל השירים' : 'Update lyrics for all'}</span>
              </label>
            )}
          </div>
          <textarea
            rows={4}
            value={lyrics}
            onChange={(e) => {
              setLyrics(e.target.value);
              if (isBatch) setUpdateLyrics(true);
            }}
            disabled={saving}
            placeholder={localT('lyricsPlaceholder')}
            className="w-full py-2 px-3 rounded-lg border border-white/5 bg-neutral-900/60 text-xs text-neutral-200 focus:outline-none focus:border-brand/40 focus:bg-neutral-900 transition-all resize-none font-sans leading-relaxed disabled:opacity-50"
          />
        </div>

        {/* Actions Footer */}
        <div className={`flex justify-end gap-2 border-t border-white/5 pt-3.5 ${
          lang === 'he' ? 'flex-row' : 'flex-row-reverse'
        }`}>
          <button 
            onClick={onClose} 
            disabled={saving}
            className="px-4 py-1.5 rounded-lg border border-white/5 bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            {localT('cancel')}
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving || (isBatch && !updateArtist && !updateAlbum && !updateLyrics && !updateCover)}
            className="px-4 py-1.5 rounded-lg bg-brand hover:bg-brand-bright text-xs font-semibold text-black transition-colors cursor-pointer flex items-center gap-1 shadow shadow-brand/10 disabled:opacity-50 disabled:cursor-default"
          >
            <Save size={13} />
            <span>{saving ? localT('saving', { progress: progress || '' }) : localT('saveChanges')}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
