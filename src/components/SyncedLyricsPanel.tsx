import React, { useState, useEffect, useRef } from 'react';
import type { Track, FolderNode } from '../types/player';
import { AlignCenter, MessageSquareDashed, Edit3, Save, RotateCcw, Play, Pause, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

interface SyncedLyricsPanelProps {
  track: Track | null;
  currentTime: number;
  rootFolder?: FolderNode | null;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onSeek?: (time: number) => void;
  lang?: 'he' | 'en';
}

interface LrcLine {
  time: number; // in seconds
  text: string;
}

interface EditableLrcLine {
  text: string;
  time: number | null; // null if not synced yet
}

export const SyncedLyricsPanel: React.FC<SyncedLyricsPanelProps> = ({
  track,
  currentTime,
  rootFolder = null,
  isPlaying = false,
  onTogglePlay,
  onSeek,
  lang = 'he',
}) => {
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Editor states
  const [rawText, setRawText] = useState('');
  const [editStep, setEditStep] = useState<'text' | 'sync'>('text');
  const [syncLines, setSyncLines] = useState<EditableLrcLine[]>([]);
  const [currentSyncIndex, setCurrentSyncIndex] = useState(0);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorSuccess, setEditorSuccess] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const SyncedLyricsTranslations = {
    he: {
      selectTrack: 'בחר שיר להשמעה',
      lyricsWillAppear: 'מילים מסונכרנות יוצגו כאן.',
      loadingLyrics: 'טוען מילים...',
      noLyrics: 'אין מילים מסונכרנות זמינות',
      placeLrcFile: 'הנח קובץ מילים מסונכרנות (`.lrc`) באותו השם ובאותה התיקייה ליד קובץ המוזיקה, או צור מילים עכשיו.',
      editLyrics: 'ערוך מילים',
      createLyrics: 'צור מילים מסונכרנות',
      pasteLyricsPrompt: 'הדבק את מילות השיר כאן (שורה אחת בכל פסקה):',
      startSyncing: 'המשך לסנכרון',
      syncButtonPrompt: 'לחץ על כפתור הסנכרון או על מקש הרווח (Space) ברגע שמתחילה השורה הבאה:',
      syncNextLine: 'סנכרן שורה (רווח)',
      skipBack: 'חזור 5 שניות',
      reset: 'איפוס',
      saveAndFinish: 'שמור וסיים',
      cancel: 'ביטול',
      unSynced: 'טרם סונכרן',
      downloadPrompt: 'הורד קובץ .lrc ידנית',
      currentLine: 'שורה נוכחית לסנכרון:',
      saving: 'שומר...',
      saveFailed: 'שמירת המילים נכשלה.',
    },
    en: {
      selectTrack: 'Select track to play',
      lyricsWillAppear: 'Synced lyrics will be displayed here.',
      loadingLyrics: 'Loading lyrics...',
      noLyrics: 'No synced lyrics available',
      placeLrcFile: 'Place a synced lyrics file (`.lrc`) with the same name in the same folder next to the music file, or create them now.',
      editLyrics: 'Edit Lyrics',
      createLyrics: 'Create Synced Lyrics',
      pasteLyricsPrompt: 'Paste lyrics here (one line per paragraph):',
      startSyncing: 'Continue to Sync',
      syncButtonPrompt: 'Click the button or press Spacebar when the next line begins:',
      syncNextLine: 'Sync Line (Spacebar)',
      skipBack: 'Skip Back 5s',
      reset: 'Reset',
      saveAndFinish: 'Save & Finish',
      cancel: 'Cancel',
      unSynced: 'Not synced',
      downloadPrompt: 'Download .lrc file',
      currentLine: 'Current line to sync:',
      saving: 'Saving...',
      saveFailed: 'Failed to save lyrics.',
    }
  };

  const localT = (key: keyof typeof SyncedLyricsTranslations.he) => {
    return SyncedLyricsTranslations[lang][key];
  };

  // Find parent folder directory handle for Web version
  const findParentFolderNode = async (root: FolderNode, trackId: string): Promise<FolderNode | null> => {
    if (root.tracks.some(t => t.id === trackId)) {
      return root;
    }
    for (const sub of root.subfolders) {
      const found = await findParentFolderNode(sub, trackId);
      if (found) return found;
    }
    return null;
  };

  // Helper to load LRC content from disk
  const loadLrc = async () => {
    if (!track) {
      setLrcLines([]);
      return;
    }

    try {
      setLoading(true);
      let absolutePath = '';
      if (track.file) {
        absolutePath = (track.file as any).path;
      } else if (track.fileHandle) {
        const fileObj = await track.fileHandle.getFile();
        absolutePath = (fileObj as any).path;
      }

      const isWeb = !window.electronAPI;

      if (isWeb) {
        // Web version: search in rootFolder handles
        if (rootFolder) {
          const parentNode = await findParentFolderNode(rootFolder, track.id);
          if (parentNode && parentNode.handle) {
            const dirHandle = parentNode.handle as FileSystemDirectoryHandle;
            const fullName = track.fileHandle ? track.fileHandle.name : track.name;
            const baseName = fullName.includes('.') ? fullName.substring(0, fullName.lastIndexOf('.')) : fullName;
            const lrcName = `${baseName}.lrc`;
            
            try {
              const lrcHandle = await dirHandle.getFileHandle(lrcName);
              const lrcFile = await lrcHandle.getFile();
              const content = await lrcFile.text();
              parseLrc(content);
              return;
            } catch (err) {
              console.log("Web: No LRC file in directory handle:", err);
            }
          }
        }
        setLrcLines([]);
      } else {
        // Native Electron version
        if (!absolutePath) {
          setLrcLines([]);
          return;
        }
        const res = await window.electronAPI.readLrc(absolutePath);
        if (res.success && res.content) {
          parseLrc(res.content);
        } else {
          setLrcLines([]);
        }
      }
    } catch (e) {
      console.error('Failed to load LRC file:', e);
      setLrcLines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLrc();
    setIsEditing(false);
    setEditStep('text');
  }, [track]);

  const parseLrc = (text: string) => {
    const lines = text.split(/\r?\n/);
    const parsed: LrcLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2}))?\]/g;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let match;
      const times: number[] = [];
      timeRegex.lastIndex = 0;
      
      while ((match = timeRegex.exec(trimmed)) !== null) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3], 10) * 10 : 0;
        const totalSecs = min * 60 + sec + ms / 1000;
        times.push(totalSecs);
      }

      const content = trimmed.replace(timeRegex, '').trim();

      if (times.length === 0 && trimmed.startsWith('[') && trimmed.includes(':')) {
        continue;
      }

      for (const time of times) {
        parsed.push({ time, text: content });
      }
    }

    parsed.sort((a, b) => a.time - b.time);
    setLrcLines(parsed);
  };

  let activeIndex = -1;
  for (let i = 0; i < lrcLines.length; i++) {
    if (currentTime >= lrcLines[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  // Auto scroll active line to center of container
  useEffect(() => {
    if (isEditing || activeIndex === -1 || !containerRef.current) return;
    const activeEl = containerRef.current.querySelector(`.lrc-line-${activeIndex}`);
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, isEditing]);

  // Spacebar hotkey listener during sync stage of editor
  useEffect(() => {
    if (!isEditing || editStep !== 'sync') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        triggerSyncNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, editStep, currentSyncIndex, syncLines]);

  const handleStartEditing = () => {
    setIsEditing(true);
    setEditStep('text');
    setEditorSuccess(false);

    // Prepopulate raw text: first check if we have parsed lines, otherwise check track.lyrics
    if (lrcLines.length > 0) {
      const textOnly = lrcLines.map(l => l.text).join('\n');
      setRawText(textOnly);
    } else if (track?.lyrics) {
      setRawText(track.lyrics);
    } else {
      setRawText('');
    }
  };

  const handleContinueToSync = () => {
    const lines = rawText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const editable: EditableLrcLine[] = lines.map((line, idx) => {
      // If we are editing existing lines and the line index matches, try to keep the old timestamp
      if (lrcLines[idx] && lrcLines[idx].text === line) {
        return { text: line, time: lrcLines[idx].time };
      }
      return { text: line, time: null };
    });

    setSyncLines(editable);
    setEditStep('sync');
    setCurrentSyncIndex(0);
  };

  const triggerSyncNext = () => {
    if (currentSyncIndex >= syncLines.length) return;

    const updated = [...syncLines];
    updated[currentSyncIndex].time = currentTime;
    setSyncLines(updated);

    // Scroll the sync editor list into focus
    const nextIndex = currentSyncIndex + 1;
    setCurrentSyncIndex(nextIndex);

    // Auto-scroll inside editor sync list
    const editorList = document.getElementById('lrc-editor-sync-list');
    if (editorList) {
      const activeLineEl = editorList.querySelector(`.lrc-edit-line-${currentSyncIndex}`);
      if (activeLineEl) {
        activeLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const adjustLineTime = (index: number, delta: number) => {
    const updated = [...syncLines];
    const prevTime = updated[index].time;
    if (prevTime !== null) {
      updated[index].time = Math.max(0, prevTime + delta);
      setSyncLines(updated);
    }
  };

  const clearLineTime = (index: number) => {
    const updated = [...syncLines];
    updated[index].time = null;
    setSyncLines(updated);
    if (index < currentSyncIndex) {
      setCurrentSyncIndex(index);
    }
  };

  const formatLrcTime = (time: number): string => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `[${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
  };

  const handleSaveLrc = async () => {
    if (!track) return;
    try {
      setEditorSaving(true);
      setEditorError(null);

      // Generate LRC string
      const lines = syncLines
        .filter(l => l.time !== null)
        .map(l => `${formatLrcTime(l.time!)}${l.text}`);
      const lrcContent = lines.join('\n');

      const isWeb = !window.electronAPI;
      let saved = false;

      if (isWeb) {
        // Save to browser directory handle
        if (rootFolder) {
          const parentNode = await findParentFolderNode(rootFolder, track.id);
          if (parentNode && parentNode.handle) {
            const dirHandle = parentNode.handle as FileSystemDirectoryHandle;
            const fullName = track.fileHandle ? track.fileHandle.name : track.name;
            const baseName = fullName.includes('.') ? fullName.substring(0, fullName.lastIndexOf('.')) : fullName;
            const lrcName = `${baseName}.lrc`;
            
            const lrcFileHandle = await dirHandle.getFileHandle(lrcName, { create: true });
            const writable = await lrcFileHandle.createWritable();
            await writable.write(lrcContent);
            await writable.close();
            saved = true;
          }
        }
      } else {
        // Save via native file writing
        let absolutePath = '';
        if (track.file) {
          absolutePath = (track.file as any).path;
        } else if (track.fileHandle) {
          const fileObj = await track.fileHandle.getFile();
          absolutePath = (fileObj as any).path;
        }

        if (absolutePath) {
          const lrcPath = absolutePath.substring(0, absolutePath.lastIndexOf('.')) + '.lrc';
          await window.electronAPI.writeTextFile(lrcPath, lrcContent);
          saved = true;
        }
      }

      if (saved) {
        setEditorSuccess(true);
        parseLrc(lrcContent);
        setTimeout(() => {
          setIsEditing(false);
          setEditorSuccess(false);
        }, 1200);
      } else {
        // Fallback: trigger file download in browser
        triggerBlobDownload(lrcContent);
        setEditorSuccess(true);
        parseLrc(lrcContent);
        setTimeout(() => {
          setIsEditing(false);
          setEditorSuccess(false);
        }, 1200);
      }
    } catch (err: any) {
      console.error('Failed to save LRC file:', err);
      setEditorError(localT('saveFailed'));
    } finally {
      setEditorSaving(false);
    }
  };

  const triggerBlobDownload = (content: string) => {
    if (!track) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${track.name}.lrc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSkipBack = () => {
    if (onSeek) {
      onSeek(Math.max(0, currentTime - 5));
    }
  };

  const formatSeconds = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- RENDERING MODES ---

  // 1. Syncing / Editing UI
  if (isEditing) {
    return (
      <div className="h-full flex flex-col gap-4 text-right" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between pb-2 border-b border-border-custom flex-shrink-0">
          <h3 className="text-xs font-bold text-text-primary">
            {lang === 'he' ? `עורך מילים: ${track?.name}` : `Lyrics Editor: ${track?.name}`}
          </h3>
          <button
            onClick={() => setIsEditing(false)}
            className="px-2.5 py-1 rounded-lg bg-bg-card border border-border-custom text-[10px] font-bold text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
          >
            {localT('cancel')}
          </button>
        </div>

        {editorError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] px-3 py-1.5 rounded-lg leading-normal flex-shrink-0">
            {editorError}
          </div>
        )}

        {editStep === 'text' ? (
          // Stage 1: Paste Text Input
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <span className="text-[10px] text-text-secondary font-semibold">
              {localT('pasteLyricsPrompt')}
            </span>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="flex-1 w-full p-3 bg-neutral-900 border border-white/5 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-brand/40 focus:bg-neutral-950 transition-all resize-none leading-relaxed custom-scrollbar"
              placeholder={lang === 'he' ? 'שורה 1\nשורה 2\nשורה 3...' : 'Line 1\nLine 2\nLine 3...'}
            />
            <button
              onClick={handleContinueToSync}
              disabled={!rawText.trim()}
              className="py-2.5 rounded-xl bg-brand hover:bg-brand-bright text-xs font-bold text-black cursor-pointer shadow shadow-brand/10 disabled:opacity-50 disabled:cursor-default flex-shrink-0"
            >
              {localT('startSyncing')}
            </button>
          </div>
        ) : (
          // Stage 2: Synchronize in Realtime
          <div className="flex-1 flex flex-col gap-3 min-h-0 relative">
            {/* Editor Action Toolbar */}
            <div className="flex justify-between items-center gap-2 bg-neutral-900/40 border border-white/5 p-2 rounded-xl flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onTogglePlay}
                  className="w-7 h-7 rounded-full bg-brand hover:bg-brand-bright flex items-center justify-center text-black cursor-pointer transition-colors"
                >
                  {isPlaying ? <Pause size={12} className="fill-current" /> : <Play size={12} className="fill-current" />}
                </button>
                <button
                  onClick={handleSkipBack}
                  className="px-2 py-1 rounded bg-bg-card hover:bg-bg-card-hover border border-border-custom text-[9px] font-bold text-text-primary cursor-pointer transition-colors"
                >
                  {localT('skipBack')}
                </button>
                <button
                  onClick={() => {
                    const reset = syncLines.map(l => ({ ...l, time: null }));
                    setSyncLines(reset);
                    setCurrentSyncIndex(0);
                  }}
                  className="w-7 h-7 rounded hover:bg-bg-card-hover border border-border-custom text-text-secondary hover:text-brand flex items-center justify-center cursor-pointer transition-colors"
                  title={localT('reset')}
                >
                  <RotateCcw size={11} />
                </button>
              </div>
              <span className="text-[10px] font-mono font-bold text-brand">{formatSeconds(currentTime)}</span>
            </div>

            {/* Syncing instruction banner */}
            <div className="text-[9px] text-text-secondary font-medium leading-relaxed bg-brand/5 border border-brand/15 px-3 py-1.5 rounded-lg flex-shrink-0 flex items-center gap-1.5">
              <span>💡</span>
              <span>{localT('syncButtonPrompt')}</span>
            </div>

            {/* Live Lines List */}
            <div
              id="lrc-editor-sync-list"
              className="flex-1 overflow-y-auto border border-white/5 rounded-xl bg-neutral-950/40 p-3 custom-scrollbar flex flex-col gap-1.5 min-h-0"
            >
              {syncLines.map((line, idx) => {
                const isCurrent = idx === currentSyncIndex;
                const isSynced = line.time !== null;
                
                return (
                  <div
                    key={idx}
                    className={`lrc-edit-line-${idx} p-2 rounded-lg flex items-center justify-between border transition-all ${
                      isCurrent
                        ? 'border-brand/40 bg-brand/5 scale-101 shadow-sm'
                        : isSynced
                        ? 'border-white/5 bg-neutral-900/30'
                        : 'border-transparent opacity-40'
                    }`}
                  >
                    <span className="text-[11px] font-medium text-text-primary truncate flex-1 pl-2 text-right">
                      {line.text}
                    </span>

                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isSynced ? (
                        <>
                          {/* Micro adjustments */}
                          <button
                            onClick={() => adjustLineTime(idx, -0.5)}
                            className="w-5 h-5 rounded hover:bg-bg-card-hover border border-border-custom text-[9px] text-text-secondary flex items-center justify-center cursor-pointer"
                            title="-0.5s"
                          >
                            <ChevronLeft size={10} />
                          </button>
                          <span className="text-[9px] font-mono font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                            {formatSeconds(line.time!)}
                          </span>
                          <button
                            onClick={() => adjustLineTime(idx, 0.5)}
                            className="w-5 h-5 rounded hover:bg-bg-card-hover border border-border-custom text-[9px] text-text-secondary flex items-center justify-center cursor-pointer"
                            title="+0.5s"
                          >
                            <ChevronRight size={10} />
                          </button>
                          <button
                            onClick={() => clearLineTime(idx)}
                            className="w-5 h-5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 flex items-center justify-center cursor-pointer transition-colors text-[9px]"
                          >
                            <X size={10} />
                          </button>
                        </>
                      ) : (
                        <span className="text-[9px] text-text-muted italic">{localT('unSynced')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Giant Big Sync Button */}
            {currentSyncIndex < syncLines.length ? (
              <button
                onClick={triggerSyncNext}
                className="py-3 rounded-xl bg-green-600 hover:bg-green-500 text-xs font-bold text-white cursor-pointer shadow-lg shadow-green-900/10 transition-all flex-shrink-0 flex items-center justify-center gap-1.5 active:scale-98"
              >
                <span>{localT('syncNextLine')}</span>
              </button>
            ) : (
              // All lines completed - Save changes
              <button
                onClick={handleSaveLrc}
                disabled={editorSaving || editorSuccess}
                className="py-3 rounded-xl bg-brand hover:bg-brand-bright text-xs font-bold text-black cursor-pointer shadow-lg shadow-brand/10 transition-all flex-shrink-0 flex items-center justify-center gap-1.5"
              >
                {editorSuccess ? (
                  <>
                    <Check size={14} />
                    <span>{lang === 'he' ? 'נשמר בהצלחה!' : 'Saved!'}</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>{editorSaving ? localT('saving') : localT('saveAndFinish')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. Default View mode
  if (!track) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-2 text-text-muted select-none">
        <AlignCenter size={20} className="opacity-60" />
        <span className="text-xs font-bold text-text-primary">{localT('selectTrack')}</span>
        <span className="text-[10px] text-text-secondary">{localT('lyricsWillAppear')}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3 text-text-muted select-none">
        <div className="w-5 h-5 rounded-full border-2 border-border-custom border-t-brand animate-spin" />
        <span className="text-xs">{localT('loadingLyrics')}</span>
      </div>
    );
  }

  if (lrcLines.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3 text-text-muted select-none">
        <MessageSquareDashed size={24} className="opacity-50" />
        <span className="text-xs font-bold text-text-primary">{localT('noLyrics')}</span>
        <p className="text-[10px] text-text-secondary max-w-[200px] leading-relaxed">
          {localT('placeLrcFile')}
        </p>
        <button
          onClick={handleStartEditing}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-bg-card border border-border-custom hover:border-brand/40 text-xs font-semibold text-text-primary transition-colors cursor-pointer select-none"
        >
          <Edit3 size={13} className="text-brand" />
          <span>{localT('createLyrics')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative min-h-0">
      {/* Mini floating header for options */}
      <div className={`absolute top-0 ${lang === 'he' ? 'left-4' : 'right-4'} z-10 p-1 flex gap-2`}>
        <button
          onClick={handleStartEditing}
          className="p-1.5 rounded-lg bg-neutral-900/60 hover:bg-neutral-900/90 border border-white/5 text-text-secondary hover:text-brand flex items-center justify-center transition-all cursor-pointer"
          title={localT('editLyrics')}
        >
          <Edit3 size={12} />
        </button>
      </div>

      {/* Lyrics scroll container */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full overflow-y-auto lyrics-mask custom-scrollbar flex flex-col items-center py-[120px] px-4 gap-6 scroll-smooth select-none min-h-0"
      >
        {lrcLines.map((line, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div
              key={idx}
              onClick={() => onSeek && onSeek(line.time)}
              className={`lrc-line-${idx} transition-all duration-300 text-center cursor-pointer max-w-[90%] ${
                isActive 
                  ? 'text-sm md:text-base font-bold text-brand scale-106 opacity-100 filter-none drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]' 
                  : 'text-xs md:text-sm font-semibold text-text-secondary opacity-35 blur-[0.4px] scale-95 hover:opacity-60 hover:blur-none'
              }`}
            >
              {line.text || '• • •'}
            </div>
          );
        })}
      </div>
    </div>
  );
};
