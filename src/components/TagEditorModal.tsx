import React, { useState, useEffect } from 'react';
import type { Track } from '../types/player';
import { X, Save, Edit3, MessageSquare, Image } from 'lucide-react';

interface TagEditorModalProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  onSave: (trackId: string, updatedFields: { name: string; artist: string; album: string; lyrics?: string; coverUrl?: string }) => void;
  lang?: 'he' | 'en';
}

export const TagEditorModal: React.FC<TagEditorModalProps> = ({
  track,
  isOpen,
  onClose,
  onSave,
  lang = 'he',
}) => {
  const [title, setTitle] = useState(track.name);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album);
  const [lyrics, setLyrics] = useState(track.lyrics || '');
  
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(track.coverUrl || null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const TagEditorTranslations = {
    he: {
      pathError: 'לא ניתן היה לזהות את נתיב הקובץ המלא במחשב.',
      writeError: 'שגיאה בכתיבת התגיות לקובץ.',
      unknownError: 'שגיאה לא ידועה בעדכון הקובץ.',
      title: 'עורך תגיות קובץ',
      coverArt: 'עטיפת אלבום',
      changeCover: 'החלף עטיפה',
      songTitle: 'שם השיר',
      artistName: 'שם האמן',
      albumName: 'שם האלבום',
      lyricsLabel: 'מילות השיר (Unsynced Lyrics)',
      lyricsPlaceholder: 'הקלד כאן את מילות השיר (לא מסונכרן)...',
      cancel: 'ביטול',
      saving: 'שומר קובץ...',
      saveChanges: 'שמור שינויים',
    },
    en: {
      pathError: 'Could not identify the full file path on the computer.',
      writeError: 'Error writing tags to the file.',
      unknownError: 'Unknown error updating the file.',
      title: 'File Tag Editor',
      coverArt: 'Album Cover',
      changeCover: 'Change Cover',
      songTitle: 'Song Title',
      artistName: 'Artist Name',
      albumName: 'Album Name',
      lyricsLabel: 'Lyrics (Unsynced)',
      lyricsPlaceholder: 'Type the song lyrics here (unsynced)...',
      cancel: 'Cancel',
      saving: 'Saving file...',
      saveChanges: 'Save Changes',
    }
  };

  const localT = (key: keyof typeof TagEditorTranslations.he) => {
    return TagEditorTranslations[lang][key];
  };

  useEffect(() => {
    setTitle(track.name);
    setArtist(track.artist);
    setAlbum(track.album);
    setLyrics(track.lyrics || '');
    setCoverFile(null);
    setCoverPreviewUrl(track.coverUrl || null);
    setError(null);
  }, [track, isOpen]);

  if (!isOpen) return null;

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreviewUrl(URL.createObjectURL(file));
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

      let absolutePath = '';
      if (track.file) {
        absolutePath = (track.file as any).path;
      } else if (track.fileHandle) {
        const fileObj = await track.fileHandle.getFile();
        absolutePath = (fileObj as any).path;
      }

      if (!absolutePath) {
        throw new Error(localT('pathError'));
      }

      const tagsPayload: any = {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        unsyncedLyrics: lyrics.trim(),
      };

      if (coverFile) {
        const base64Data = await convertToBase64(coverFile);
        tagsPayload.coverImageBase64 = base64Data;
        tagsPayload.coverImageMime = coverFile.type;
      }

      const result = await window.electronAPI.writeTags(absolutePath, tagsPayload);

      if (result.success) {
        onSave(track.id, {
          name: title.trim(),
          artist: artist.trim(),
          album: album.trim(),
          lyrics: lyrics.trim(),
          coverUrl: coverPreviewUrl || undefined
        });
        onClose();
      } else {
        throw new Error(result.error || localT('writeError'));
      }
    } catch (err: any) {
      console.error('Error saving tag edits:', err);
      setError(err.message || localT('unknownError'));
    } finally {
      setSaving(false);
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
            <h2 className="text-sm font-semibold tracking-wide">{localT('title')}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 flex items-center justify-center transition-colors cursor-pointer"
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
              <input type="file" accept="image/png, image/jpeg" onChange={handleCoverChange} className="hidden" />
            </label>
          </div>

          {/* Tag Info Form Fields */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{localT('songTitle')}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full py-1.5 px-3 rounded-lg border border-white/5 bg-neutral-900/60 text-xs text-neutral-200 focus:outline-none focus:border-brand/40 focus:bg-neutral-900 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{localT('artistName')}</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full py-1.5 px-3 rounded-lg border border-white/5 bg-neutral-900/60 text-xs text-neutral-200 focus:outline-none focus:border-brand/40 focus:bg-neutral-900 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{localT('albumName')}</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full py-1.5 px-3 rounded-lg border border-white/5 bg-neutral-900/60 text-xs text-neutral-200 focus:outline-none focus:border-brand/40 focus:bg-neutral-900 transition-all"
              />
            </div>
          </div>

        </div>

        {/* Unsynced Lyrics Area */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
            <MessageSquare size={10} className="text-neutral-500" />
            {localT('lyricsLabel')}
          </label>
          <textarea
            rows={4}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={localT('lyricsPlaceholder')}
            className="w-full py-2 px-3 rounded-lg border border-white/5 bg-neutral-900/60 text-xs text-neutral-200 focus:outline-none focus:border-brand/40 focus:bg-neutral-900 transition-all resize-none font-sans leading-relaxed"
          />
        </div>

        {/* Actions Footer */}
        <div className={`flex justify-end gap-2 border-t border-white/5 pt-3.5 ${
          lang === 'he' ? 'flex-row' : 'flex-row-reverse'
        }`}>
          <button 
            onClick={onClose} 
            disabled={saving}
            className="px-4 py-1.5 rounded-lg border border-white/5 bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 transition-colors cursor-pointer"
          >
            {localT('cancel')}
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-brand hover:bg-brand-bright text-xs font-semibold text-black transition-colors cursor-pointer flex items-center gap-1 shadow shadow-brand/10"
          >
            <Save size={13} />
            <span>{saving ? localT('saving') : localT('saveChanges')}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
