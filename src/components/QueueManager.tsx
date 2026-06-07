import React, { useState, useEffect, useRef } from 'react';
import type { PlaybackQueue, Track } from '../types/player';
import { 
  Play, 
  Trash2, 
  Shuffle, 
  ChevronUp, 
  ChevronDown, 
  ListMusic,
  X,
  Pin,
  Search,
  Edit3,
  Check
} from 'lucide-react';

interface QueueManagerProps {
  queues: PlaybackQueue[];
  activeQueueId: number;
  currentTrack: Track | null;
  onSwitchQueue: (id: number) => void;
  onPlayTrackAtIndex: (index: number) => void;
  onRemoveTrack: (index: number) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
  onReorderQueue: (newTracks: Track[]) => void;
  onRenameQueue?: (id: number, name: string) => void;
  onDuplicateQueue?: (sourceId: number, targetId: number) => void;
  onMoveTrackToQueue?: (trackIndex: number, targetQueueId: number) => void;
  onClose?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  lang?: 'he' | 'en';
}

const QueueManagerTranslations = {
  he: {
    closeQueue: 'סגור תור',
    pinQueue: 'הצמד תור',
    unpinQueue: 'בטל הצמדה',
    queueTitle: 'תור השמעה',
    queueLabel: 'תור {id}',
    selectQueue: 'בחר תור השמעה',
    showLess: 'הצג פחות',
    showAll: 'הצג את כל 20 התורים',
    tracksCount: '{count} שירים',
    shuffle: 'ערבב',
    clear: 'נקה',
    emptyTitle: 'תור זה ריק',
    emptySub: 'גרור קבצים לכאן או הוסף שירים מדפדפן התיקיות כדי למלא את התור.',
    noTracks: 'אין שירים התואמים לסינון בתור',
    moveUp: 'העבר למעלה',
    moveDown: 'העבר למטה',
    remove: 'הסר מהתור',
  },
  en: {
    closeQueue: 'Close Queue',
    pinQueue: 'Pin Queue',
    unpinQueue: 'Unpin Queue',
    queueTitle: 'Playback Queue',
    queueLabel: 'Queue {id}',
    selectQueue: 'Select Playback Queue',
    showLess: 'Show Less',
    showAll: 'Show all 20 queues',
    tracksCount: '{count} tracks',
    shuffle: 'Shuffle',
    clear: 'Clear',
    emptyTitle: 'This queue is empty',
    emptySub: 'Drag files here or add songs from the folder browser to fill the queue.',
    noTracks: 'No matching songs in queue',
    moveUp: 'Move Up',
    moveDown: 'Move Down',
    remove: 'Remove from Queue',
  }
};

export const QueueManager: React.FC<QueueManagerProps> = ({
  queues,
  activeQueueId,
  currentTrack,
  onSwitchQueue,
  onPlayTrackAtIndex,
  onRemoveTrack,
  onClearQueue,
  onShuffleQueue,
  onReorderQueue,
  onRenameQueue,
  onDuplicateQueue,
  onMoveTrackToQueue,
  onClose,
  isPinned = false,
  onTogglePin,
  lang = 'he',
}) => {
  const [showQueueSelector, setShowQueueSelector] = useState(false);
  const [showAllQueues, setShowAllQueues] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showDuplicateSelect, setShowDuplicateSelect] = useState(false);
  const [movingTrackIndex, setMovingTrackIndex] = useState<number | null>(null);

  const activeQueue = queues.find((q) => q.id === activeQueueId) || queues[0];

  const filteredTracks = activeQueue.tracks
    .map((track, idx) => ({ track, originalIndex: idx }))
    .filter(({ track }) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        track.name.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.album.toLowerCase().includes(query)
      );
    });

  const listRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const visibleQueues = showAllQueues ? queues : queues.slice(0, 5);

  const localT = (key: keyof typeof QueueManagerTranslations.he, params?: Record<string, string | number>) => {
    const activeLang = lang || 'he';
    let text = QueueManagerTranslations[activeLang][key];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  // Auto-scroll active track into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('.track-item-active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeQueue.currentIndex, activeQueueId]);

  // Click outside listener to close queue selector dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowQueueSelector(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleExportPlaylist = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');
      
      const filePath = await save({
        filters: [{ name: 'JSON Playlist', extensions: ['json'] }],
        defaultPath: `${activeQueue.name || `playlist_${activeQueueId + 1}`}.json`
      });
      
      if (!filePath) return;
      
      const content = JSON.stringify({
        name: activeQueue.name || `תור ${activeQueueId + 1}`,
        tracks: activeQueue.tracks.map(t => ({
          name: t.name,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          size: t.size,
          path: t.path
        }))
      }, null, 2);
      
      await invoke('write_text_file', { filePath, content });
      alert(lang === 'he' ? 'רשימת ההשמעה יוצאה בהצלחה!' : 'Playlist exported successfully!');
    } catch (err) {
      console.error('Failed to export playlist:', err);
      alert(lang === 'he' ? 'ייצוא רשימת ההשמעה נכשל.' : 'Failed to export playlist.');
    }
  };

  const handleImportPlaylist = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');
      
      const selected = await open({
        filters: [{ name: 'JSON Playlist', extensions: ['json'] }],
        multiple: false
      });
      
      if (!selected || typeof selected !== 'string') return;
      
      const content = await invoke<string>('read_text_file', { filePath: selected });
      const parsed = JSON.parse(content);
      
      if (parsed && Array.isArray(parsed.tracks)) {
        const importedTracks = parsed.tracks.map((t: any, idx: number) => ({
          id: t.id || `imported-${Date.now()}-${idx}-${Math.random()}`,
          name: t.name || 'Unknown Track',
          artist: t.artist || 'Unknown Artist',
          album: t.album || 'Unknown Album',
          duration: t.duration || 0,
          size: t.size || 0,
          path: t.path || '',
          metadataLoaded: true
        }));
        
        if (onRenameQueue && parsed.name) {
          onRenameQueue(activeQueueId, parsed.name);
        }
        onReorderQueue(importedTracks);
        alert(lang === 'he' ? 'רשימת ההשמעה יובאה בהצלחה!' : 'Playlist imported successfully!');
      } else {
        alert(lang === 'he' ? 'קובץ לא תקין.' : 'Invalid playlist file format.');
      }
    } catch (err) {
      console.error('Failed to import playlist:', err);
      alert(lang === 'he' ? 'ייבוא רשימת ההשמעה נכשל.' : 'Failed to import playlist.');
    }
  };

  const handleMoveUp = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === 0) return;
    const newTracks = [...activeQueue.tracks];
    const temp = newTracks[index];
    newTracks[index] = newTracks[index - 1];
    newTracks[index - 1] = temp;
    onReorderQueue(newTracks);
  };

  const handleMoveDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === activeQueue.tracks.length - 1) return;
    const newTracks = [...activeQueue.tracks];
    const temp = newTracks[index];
    newTracks[index] = newTracks[index + 1];
    newTracks[index + 1] = temp;
    onReorderQueue(newTracks);
  };

  return (
    <div className="h-full flex flex-col gap-4" style={{ textAlign: lang === 'he' ? 'right' : 'left' }} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      
      {/* Header and Queue Selector Popover */}
      <div className="relative flex items-center justify-between pb-2 border-b border-border-custom" ref={dropdownRef}>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className={`w-6 h-6 rounded hover:bg-bg-card-hover text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer ${lang === 'he' ? 'ml-1' : 'mr-1'}`}
              title={localT('closeQueue')}
            >
              <X size={14} />
            </button>
          )}
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              className={`w-6 h-6 rounded hover:bg-bg-card-hover flex items-center justify-center transition-colors cursor-pointer ${lang === 'he' ? 'ml-1' : 'mr-1'} ${
                isPinned ? 'text-brand' : 'text-text-secondary hover:text-text-primary'
              }`}
              title={isPinned ? localT('unpinQueue') : localT('pinQueue')}
            >
              <Pin size={13} className={isPinned ? 'fill-current rotate-45' : ''} />
            </button>
          )}
          <ListMusic size={16} className="text-text-secondary" />
          <h2 className="text-sm font-bold text-text-primary tracking-wide">{localT('queueTitle')}</h2>
        </div>

        {/* Dropdown switch button */}
        {isRenaming ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (onRenameQueue) onRenameQueue(activeQueueId, renameValue);
                  setIsRenaming(false);
                } else if (e.key === 'Escape') {
                  setIsRenaming(false);
                }
              }}
              className="px-2 py-0.5 text-xs bg-neutral-900 border border-brand rounded text-neutral-100 focus:outline-none w-28 text-right"
              autoFocus
            />
            <button
              onClick={() => {
                if (onRenameQueue) onRenameQueue(activeQueueId, renameValue);
                setIsRenaming(false);
              }}
              className="p-1 text-brand hover:text-brand-bright cursor-pointer"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => setIsRenaming(false)}
              className="p-1 text-text-secondary hover:text-text-primary cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowQueueSelector(!showQueueSelector)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-bg-card border border-border-custom hover:border-brand/40 text-text-primary transition-colors cursor-pointer"
            >
              <span>{activeQueue.name || localT('queueLabel', { id: activeQueueId + 1 })}</span>
              {activeQueue.tracks.length > 0 && (
                <span className={`text-[10px] bg-bg-app text-text-secondary px-1.5 py-0.5 rounded-full ${lang === 'he' ? 'mr-1' : 'ml-1'} font-semibold`}>
                  {activeQueue.tracks.length}
                </span>
              )}
              <ChevronDown size={12} className={`${lang === 'he' ? 'mr-1' : 'ml-1'} transition-transform duration-200 ${showQueueSelector ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => {
                setRenameValue(activeQueue.name || `תור ${activeQueueId + 1}`);
                setIsRenaming(true);
              }}
              className="p-1 text-text-secondary hover:text-brand transition-colors cursor-pointer"
              title={lang === 'he' ? 'שנה שם' : 'Rename'}
            >
              <Edit3 size={11} />
            </button>
          </div>
        )}

        {/* Grid Dropdown Panel */}
        {showQueueSelector && (
          <div className={`absolute ${lang === 'he' ? 'left-0' : 'right-0'} top-9 z-50 w-60 p-3 bg-bg-drawer border border-border-custom rounded-2xl shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150`}>
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
              {localT('selectQueue')}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {visibleQueues.map((q) => {
                const isActive = q.id === activeQueueId;
                const hasTracks = q.tracks.length > 0;
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      onSwitchQueue(q.id);
                      setShowQueueSelector(false);
                    }}
                    title={q.name || `תור ${q.id + 1}`}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand/10 border-brand/40 text-brand'
                        : 'bg-bg-card border-transparent text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                    }`}
                  >
                    <span className="truncate max-w-[30px]">{q.id + 1}</span>
                    {hasTracks && (
                      <span className={`text-[7px] mt-0.5 ${isActive ? 'text-brand' : 'text-text-muted'}`}>
                        {q.tracks.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowAllQueues(!showAllQueues)}
              className="text-[10px] text-text-secondary hover:text-text-primary transition-colors text-center cursor-pointer pt-1 border-t border-border-custom"
            >
              {showAllQueues ? localT('showLess') : localT('showAll')}
            </button>
          </div>
        )}
      </div>

      {/* Toolbar / Actions (Import, Export, Shuffle, Clear) */}
      <div className="relative flex gap-1.5 items-center justify-between pb-1">
        <div className="flex gap-1.5">
          <button
            onClick={handleImportPlaylist}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-bg-card-hover text-text-secondary hover:text-brand text-[10px] font-bold transition-all border border-border-custom cursor-pointer bg-bg-card"
            title={lang === 'he' ? 'ייבוא רשימת השמעה מ-JSON' : 'Import Playlist from JSON'}
          >
            <span>{lang === 'he' ? 'ייבוא' : 'Import'}</span>
          </button>
          {activeQueue.tracks.length > 0 && (
            <>
              <button
                onClick={handleExportPlaylist}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-bg-card-hover text-text-secondary hover:text-brand text-[10px] font-bold transition-all border border-border-custom cursor-pointer bg-bg-card"
                title={lang === 'he' ? 'ייצוא רשימת השמעה ל-JSON' : 'Export Playlist to JSON'}
              >
                <span>{lang === 'he' ? 'ייצוא' : 'Export'}</span>
              </button>
              <button
                onClick={() => setShowDuplicateSelect(!showDuplicateSelect)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border cursor-pointer bg-bg-card ${
                  showDuplicateSelect
                    ? 'border-brand text-brand'
                    : 'border-border-custom hover:bg-bg-card-hover text-text-secondary hover:text-brand'
                }`}
                title={lang === 'he' ? 'שכפל תור זה לתור אחר' : 'Duplicate this queue to another'}
              >
                <span>{lang === 'he' ? 'שכפל' : 'Duplicate'}</span>
              </button>
            </>
          )}
        </div>
        
        {activeQueue.tracks.length > 0 ? (
          <div className="flex gap-1.5 items-center">
            <span className="text-[9px] text-text-muted font-medium ml-1">
              {localT('tracksCount', { count: activeQueue.tracks.length })}
            </span>
            <button
              onClick={onShuffleQueue}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-bg-card-hover text-text-secondary hover:text-brand text-[10px] font-bold transition-all border border-transparent hover:border-border-custom cursor-pointer"
              title={localT('shuffle')}
            >
              <Shuffle size={11} />
              <span>{localT('shuffle')}</span>
            </button>
            <button
              onClick={onClearQueue}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-red-500/10 text-text-secondary hover:text-red-400 text-[10px] font-bold transition-all border border-transparent hover:border-red-500/10 cursor-pointer"
              title={localT('clear')}
            >
              <Trash2 size={11} />
              <span>{localT('clear')}</span>
            </button>
          </div>
        ) : null}

        {/* Duplicate target select dropdown */}
        {showDuplicateSelect && (
          <div className={`absolute top-8 ${lang === 'he' ? 'right-0' : 'left-0'} z-50 w-52 p-3 bg-bg-drawer border border-border-custom rounded-2xl shadow-2xl flex flex-col gap-2 animate-in fade-in duration-150`}>
            <div className="flex items-center justify-between text-[9px] font-bold text-text-muted">
              <span>{lang === 'he' ? 'בחר תור יעד לשכפול:' : 'Select target queue to duplicate:'}</span>
              <button onClick={() => setShowDuplicateSelect(false)} className="text-text-secondary hover:text-text-primary">
                <X size={10} />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {queues.filter(q => q.id !== activeQueueId).map(q => (
                <button
                  key={q.id}
                  onClick={() => {
                    if (onDuplicateQueue) {
                      onDuplicateQueue(activeQueueId, q.id);
                    }
                    setShowDuplicateSelect(false);
                  }}
                  title={q.name || `תור ${q.id + 1}`}
                  className="py-1 rounded bg-bg-card border border-border-custom hover:border-brand text-xs font-bold text-text-primary transition-all cursor-pointer text-center truncate"
                >
                  {q.id + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Input for Queue */}
      {activeQueue.tracks.length > 0 && (
        <div className="relative flex items-center">
          <Search size={12} className={`absolute ${lang === 'he' ? 'right-3' : 'left-3'} text-neutral-500`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'he' ? 'חיפוש בתור ההשמעה...' : 'Search in queue...'}
            className={`w-full py-1.5 rounded-lg border border-white/5 bg-neutral-900 text-xs text-neutral-200 focus:outline-none focus:border-brand/40 focus:bg-neutral-950 transition-all ${
              lang === 'he' ? 'pr-8 pl-8' : 'pl-8 pr-8'
            }`}
            dir={lang === 'he' ? 'rtl' : 'ltr'}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute ${lang === 'he' ? 'left-2.5' : 'right-2.5'} w-4 h-4 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-neutral-200 flex items-center justify-center cursor-pointer transition-colors`}
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}

      {/* Track List */}
      <div 
        ref={listRef} 
        className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 ${lang === 'he' ? 'pr-0.5' : 'pl-0.5'}`}
      >
        {activeQueue.tracks.length === 0 ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3 select-none">
            <div className="w-12 h-12 rounded-full bg-bg-card border border-border-custom flex items-center justify-center text-text-muted">
              <ListMusic size={20} className="opacity-60" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-bold text-text-primary">{localT('emptyTitle')}</h3>
              <p className="text-[11px] text-text-secondary max-w-[220px] leading-relaxed">
                {localT('emptySub')}
              </p>
            </div>
          </div>
        ) : filteredTracks.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-6">
            {localT('noTracks')}
          </p>
        ) : (
          filteredTracks.map(({ track, originalIndex }) => {
            const isActive = currentTrack?.id === track.id && activeQueue.currentIndex === originalIndex;
            return (
              <div
                key={`${track.id}-${originalIndex}`}
                className={`flex items-center justify-between p-2 rounded-xl transition-all group border relative ${
                  isActive 
                    ? 'bg-brand/5 border-brand/20 track-item-active shadow-sm shadow-brand/[0.02]' 
                    : 'bg-transparent border-transparent hover:bg-bg-card-hover hover:border-border-custom'
                }`}
                onClick={() => onPlayTrackAtIndex(originalIndex)}
              >
                {/* Index / Info */}
                <div className={`flex items-center gap-3 overflow-hidden flex-1 ${lang === 'he' ? 'pl-2' : 'pr-2'}`}>
                  <span className="text-[10px] font-bold text-text-muted w-5 text-center flex-shrink-0 flex items-center justify-center">
                    {isActive ? (
                      <Play size={10} className="text-brand fill-current" />
                    ) : (
                      <span className="group-hover:hidden">{originalIndex + 1}</span>
                    )}
                    {!isActive && (
                      <Play size={9} className="hidden group-hover:block text-text-primary fill-current" />
                    )}
                  </span>
                  
                  <div className={`overflow-hidden flex-1 min-w-0 ${lang === 'he' ? 'text-right' : 'text-left'}`}>
                    <div className={`text-xs font-semibold truncate ${isActive ? 'text-brand' : 'text-text-primary'}`}>
                      {track.name}
                    </div>
                    <div className="text-[10px] text-text-secondary truncate mt-0.5">
                      {track.artist}
                    </div>
                  </div>
                </div>

                {/* Queue Manipulation Actions (Visible on hover) */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMovingTrackIndex(movingTrackIndex === originalIndex ? null : originalIndex);
                    }}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                      movingTrackIndex === originalIndex ? 'text-brand bg-brand/10' : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                    }`}
                    title={lang === 'he' ? 'העבר לתור אחר' : 'Move to another queue'}
                  >
                    <ListMusic size={12} />
                  </button>
                  <button
                    onClick={(e) => handleMoveUp(originalIndex, e)}
                    disabled={originalIndex === 0}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                      originalIndex === 0 
                        ? 'text-text-muted opacity-30' 
                        : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                    }`}
                    title={localT('moveUp')}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    onClick={(e) => handleMoveDown(originalIndex, e)}
                    disabled={originalIndex === activeQueue.tracks.length - 1}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                      originalIndex === activeQueue.tracks.length - 1 
                        ? 'text-text-muted opacity-30' 
                        : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                    }`}
                    title={localT('moveDown')}
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button
                    onClick={() => onRemoveTrack(originalIndex)}
                    className="w-6 h-6 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                    title={localT('remove')}
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Inline target select popup for moving a track */}
                {movingTrackIndex === originalIndex && (
                  <div 
                    className={`absolute bottom-8 ${lang === 'he' ? 'right-0' : 'left-0'} z-50 p-2 bg-bg-drawer border border-brand/30 rounded-xl shadow-xl flex flex-col gap-1.5`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between text-[8px] font-bold text-text-muted gap-4">
                      <span>{lang === 'he' ? 'העבר שיר לתור:' : 'Move track to queue:'}</span>
                      <button onClick={() => setMovingTrackIndex(null)} className="text-text-secondary hover:text-text-primary">
                        <X size={8} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {queues.filter(q => q.id !== activeQueueId).map(q => (
                        <button
                          key={q.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onMoveTrackToQueue) {
                              onMoveTrackToQueue(originalIndex, q.id);
                            }
                            setMovingTrackIndex(null);
                          }}
                          className="px-1.5 py-0.5 text-[9px] font-bold bg-bg-card border border-border-custom hover:border-brand rounded text-text-primary cursor-pointer"
                        >
                          {q.id + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
