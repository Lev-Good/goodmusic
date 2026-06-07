import React, { useState } from 'react';
import type { FolderNode, Track } from '../types/player';
import { getAllTracksFromNode } from '../utils/fileSystem';
import { 
  Folder, 
  FolderOpen, 
  Music, 
  ChevronLeft, 
  Play, 
  Plus, 
  Search, 
  FolderClosed,
  Upload,
  Shuffle,
  Check
} from 'lucide-react';

interface FolderBrowserProps {
  onPlayTracks: (tracks: Track[]) => void;
  onAddTracks: (tracks: Track[]) => void;
  onRootFolderLoaded: (root: FolderNode) => void;
  rootFolder: FolderNode | null;
  exclusionEnabled: boolean;
  exclusionThreshold: number;
  onScanStart?: () => void;
  onScanUpdate?: (scannedCount: number, filesScanned: number) => void;
  onScanEnd?: () => void;
  lang?: 'he' | 'en';
}

const FolderBrowserTranslations = {
  he: {
    selectFolder: 'בחר תיקייה',
    scanning: 'נסרק... ({count})',
    playAll: 'נגן הכל',
    shuffleAll: 'ערבב הכל',
    searchPlaceholder: 'חיפוש מהיר בספריה...',
    noLibraryTitle: 'טרם נטענה תיקיית מקור',
    noLibrarySub: 'לחץ על "בחר תיקייה" כדי לטעון ולנהל את השירים מהמחשב שלך.',
    allFilteredTitle: 'כל השירים סוננו',
    allFilteredSub: 'כל השירים בתיקייה קצרים מהסף שנקבע ({threshold} שניות). כבה את הסינון או הנמך אותו כדי להציגם.',
    searchResultsTitle: 'תוצאות חיפוש עבור "{query}" ({count})',
    noSearchResults: 'לא נמצאו שירים תואמים לחיפוש',
    playFolder: 'נגן תיקייה',
    addToQueue: 'הוסף לתור',
    showInFolder: 'הצג בתיקייה',
    library: 'ספריית תיקיות',
  },
  en: {
    selectFolder: 'Select Folder',
    scanning: 'Scanning... ({count})',
    playAll: 'Play All',
    shuffleAll: 'Shuffle All',
    searchPlaceholder: 'Quick search in library...',
    noLibraryTitle: 'No library loaded yet',
    noLibrarySub: 'Click "Select Folder" to load and manage songs from your computer.',
    allFilteredTitle: 'All tracks filtered',
    allFilteredSub: 'All songs in this folder are shorter than the threshold ({threshold}s). Disable or lower the filter to show them.',
    searchResultsTitle: 'Search results for "{query}" ({count})',
    noSearchResults: 'No matching tracks found',
    playFolder: 'Play Folder',
    addToQueue: 'Add to Queue',
    showInFolder: 'Show in Folder',
    library: 'Folder Library',
  }
};

export function getFilteredFolderTree(node: FolderNode, exclusionEnabled: boolean, threshold: number): FolderNode {
  if (!exclusionEnabled) return node;
  
  const filteredTracks = node.tracks.filter(
    (t) => t.duration === 0 || t.duration >= threshold
  );
  
  const filteredSubfolders: FolderNode[] = [];
  for (const sub of node.subfolders) {
    const filteredSub = getFilteredFolderTree(sub, exclusionEnabled, threshold);
    if (filteredSub.tracks.length > 0 || filteredSub.subfolders.length > 0) {
      filteredSubfolders.push(filteredSub);
    }
  }
  
  return {
    ...node,
    tracks: filteredTracks,
    subfolders: filteredSubfolders
  };
}

export const FolderBrowser: React.FC<FolderBrowserProps> = ({
  onPlayTracks,
  onAddTracks,
  onRootFolderLoaded,
  rootFolder,
  exclusionEnabled,
  exclusionThreshold,
  onScanStart,
  onScanUpdate,
  onScanEnd,
  lang = 'he',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [addedTrackIds, setAddedTrackIds] = useState<Record<string, boolean>>({});

  const localT = (key: keyof typeof FolderBrowserTranslations.he, params?: Record<string, string | number>) => {
    const activeLang = lang || 'he';
    let text = FolderBrowserTranslations[activeLang][key];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  const handleSelectRoot = async () => {
    try {
      setLoading(true);
      if (onScanStart) onScanStart();
      
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
      
      if (isTauri) {
        const { scanDirectoryTauri } = await import('../utils/fileSystem');
        const rootNode = await scanDirectoryTauri();
        
        if (rootNode) {
          onRootFolderLoaded(rootNode);
          const count = getAllTracksFromNode(rootNode).length;
          if (onScanUpdate) onScanUpdate(count, count);
        }
      } else {
        if (!(window as any).showDirectoryPicker) {
          alert(lang === 'he' ? 'הדפדפן שלך אינו תומך בגישה לתיקיות מקומיות. אנא השתמש בכרום (Chrome) או אדג\' (Edge).' : 'Your browser does not support local folder access. Please use Chrome or Edge.');
          return;
         }
        const handle = await (window as any).showDirectoryPicker();
        if (handle) {
          const { scanDirectory } = await import('../utils/fileSystem');
          const rootNode = await scanDirectory(handle, (_updatedNode, count, scanned) => {
            if (onScanUpdate) onScanUpdate(count, scanned);
          });
          onRootFolderLoaded(rootNode);
        }
      }
    } catch (err) {
      console.warn('Directory picking aborted or failed:', err);
    } finally {
      setLoading(false);
      if (onScanEnd) onScanEnd();
    }
  };

  const handleAddWithFeedback = (track: Track) => {
    onAddTracks([track]);
    setAddedTrackIds((prev) => ({ ...prev, [track.id]: true }));
    setTimeout(() => {
      setAddedTrackIds((prev) => ({ ...prev, [track.id]: false }));
    }, 1500);
  };

  const handlePlayAll = (shuffleMode: boolean) => {
    if (!filteredRoot) return;
    const allTracks = getAllTracksFromNode(filteredRoot);
    if (allTracks.length === 0) return;

    if (shuffleMode) {
      const shuffled = shuffleArray(allTracks);
      onPlayTracks(shuffled);
    } else {
      onPlayTracks(allTracks);
    }
  };

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const res = [...arr];
    for (let i = res.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [res[i], res[j]] = [res[j], res[i]];
    }
    return res;
  };

  const getFilteredTracks = (node: FolderNode, query: string): Track[] => {
    const all = getAllTracksFromNode(node);
    return all.filter(
      (t) =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.artist.toLowerCase().includes(query.toLowerCase()) ||
        t.album.toLowerCase().includes(query.toLowerCase())
    );
  };

  const filteredRoot = rootFolder ? getFilteredFolderTree(rootFolder, exclusionEnabled, exclusionThreshold) : null;
  const searchResults = filteredRoot && searchQuery ? getFilteredTracks(filteredRoot, searchQuery) : [];
  const scannedTracksCount = filteredRoot ? getAllTracksFromNode(filteredRoot).length : 0;

  return (
    <div className="h-full flex flex-col gap-4" style={{ textAlign: lang === 'he' ? 'right' : 'left' }} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      
      {/* Title & Scan Folder Trigger */}
      <div className="flex items-center justify-between pb-2 border-b border-border-custom">
        <div className="flex flex-col">
          <h2 className="text-sm font-bold text-text-primary tracking-wide">{localT('library')}</h2>
          {loading && (
            <p className="text-[10px] text-brand font-medium mt-0.5 animate-pulse">
              {lang === 'he' ? `סורק כונן... נטענו ${scannedTracksCount} שירים` : `Scanning folder... Loaded ${scannedTracksCount} songs`}
            </p>
          )}
        </div>
        
        <button
          onClick={handleSelectRoot}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-bg-card border border-border-custom hover:bg-bg-card-hover text-text-primary transition-colors cursor-pointer disabled:opacity-50"
        >
          <Upload size={13} />
          <span>{loading ? localT('scanning', { count: scannedTracksCount }) : localT('selectFolder')}</span>
        </button>
      </div>

      {/* Prominent Play All & Shuffle All buttons */}
      {filteredRoot && scannedTracksCount > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => handlePlayAll(false)}
            className="flex-1 py-2 rounded-xl bg-brand hover:bg-brand-bright text-black text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow shadow-brand/10 hover:scale-102"
          >
            <Play size={13} className="fill-current" />
            <span>{localT('playAll')}</span>
          </button>
          <button
            onClick={() => handlePlayAll(true)}
            className="flex-1 py-2 rounded-xl bg-bg-card border border-border-custom hover:bg-bg-card-hover text-text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-102"
          >
            <Shuffle size={13} />
            <span>{localT('shuffleAll')}</span>
          </button>
        </div>
      )}

      {/* Search Input (Spotify styled pill) */}
      {rootFolder && (
        <div className="relative">
          <input
            type="text"
            placeholder={localT('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full py-2 pl-3 pr-8 rounded-xl border border-border-custom bg-bg-input text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-brand/40 transition-colors ${lang === 'he' ? 'text-right' : 'text-left'}`}
          />
          <Search size={14} className={`absolute ${lang === 'he' ? 'right-2.5' : 'left-2.5'} top-2.5 text-text-muted`} />
        </div>
      )}

      {/* Main Browser Window */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!filteredRoot ? (
          /* Empty State - Guidance Illustration */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3 select-none">
            <div className="w-12 h-12 rounded-full bg-bg-card border border-border-custom flex items-center justify-center text-text-muted shadow-sm">
              <Folder size={20} className="opacity-60" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-bold text-text-primary">{localT('noLibraryTitle')}</h3>
              <p className="text-[11px] text-text-secondary max-w-[200px] leading-relaxed font-medium">
                {localT('noLibrarySub')}
              </p>
            </div>
          </div>
        ) : filteredRoot.tracks.length === 0 && filteredRoot.subfolders.length === 0 ? (
          /* Empty Filter State */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3 select-none">
            <div className="w-12 h-12 rounded-full bg-bg-card border border-border-custom flex items-center justify-center text-brand flex-shrink-0">
              <Music size={20} className="opacity-80" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-bold text-text-primary">{localT('allFilteredTitle')}</h3>
              <p className="text-[11px] text-text-secondary max-w-[200px] leading-relaxed">
                {localT('allFilteredSub', { threshold: exclusionThreshold })}
              </p>
            </div>
          </div>
        ) : searchQuery ? (
          /* Search Results List */
          <div className="flex flex-col gap-1">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
              {localT('searchResultsTitle', { query: searchQuery, count: searchResults.length })}
            </h4>
            {searchResults.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-6">
                {localT('noSearchResults')}
              </p>
            ) : (
              searchResults.map((track) => (
                <div 
                  key={track.id} 
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-bg-card-hover border border-transparent hover:border-border-custom transition-all cursor-pointer group"
                  onClick={() => onPlayTracks([track])}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
                    <div className="w-7 h-7 rounded bg-bg-card border border-border-custom flex items-center justify-center text-brand flex-shrink-0">
                      <Music size={13} />
                    </div>
                    <div className={`overflow-hidden flex-1 min-w-0 ${lang === 'he' ? 'text-right' : 'text-left'}`}>
                      <div className="text-xs font-semibold text-text-primary truncate group-hover:text-brand transition-colors">
                        {track.name}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {track.artist !== 'Unknown Artist' && (
                          <span className="text-[10px] text-text-secondary truncate">
                            {track.artist}
                          </span>
                        )}
                        <span className="text-[9px] text-text-muted/65 truncate font-mono select-all" dir="ltr" title={track.path}>
                          {track.path}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {window.electronAPI && (
                      <button
                        onClick={() => window.electronAPI.showItemInFolder(track.path)}
                        className="w-6 h-6 rounded hover:bg-bg-card-hover text-text-secondary hover:text-brand flex items-center justify-center transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        title={localT('showInFolder')}
                      >
                        <FolderOpen size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => handleAddWithFeedback(track)}
                      className="w-6 h-6 rounded hover:bg-bg-card-hover text-text-secondary hover:text-brand flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {addedTrackIds[track.id] ? (
                        <Check size={13} className="text-green-500 animate-in zoom-in duration-200" />
                      ) : (
                        <Plus size={13} />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Recursive Directory Node List */
          <FolderTreeNode
            node={filteredRoot!}
            onPlayTracks={onPlayTracks}
            onAddTracks={onAddTracks}
            depth={0}
            addedTrackIds={addedTrackIds}
            onAddTrackWithFeedback={handleAddWithFeedback}
            lang={lang}
          />
        )}
      </div>
    </div>
  );
};

/* Internal Recursive Node rendering component */
interface TreeNodeProps {
  node: FolderNode;
  onPlayTracks: (tracks: Track[]) => void;
  onAddTracks: (tracks: Track[]) => void;
  depth: number;
  addedTrackIds: Record<string, boolean>;
  onAddTrackWithFeedback: (track: Track) => void;
  lang?: 'he' | 'en';
}

const FolderTreeNode: React.FC<TreeNodeProps> = ({ 
  node, 
  onPlayTracks, 
  onAddTracks, 
  depth,
  addedTrackIds,
  onAddTrackWithFeedback,
  lang = 'he'
}) => {
  const [isOpen, setIsOpen] = useState(depth === 0); // Root is expanded initially
  const allTracks = getAllTracksFromNode(node);

  return (
    <div className="flex flex-col mb-1 text-right">
      
      {/* Folder Node Card Row */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-bg-card-hover cursor-pointer group transition-colors"
        style={{ paddingRight: `${Math.max(6, depth * 10)}px` }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="text-text-secondary group-hover:text-text-primary transition-colors flex items-center">
            <ChevronLeft size={12} className={`transition-transform duration-250 ${isOpen ? '-rotate-90' : ''}`} />
          </div>
          <div className="text-text-secondary group-hover:text-brand transition-colors flex-shrink-0 flex items-center">
            {isOpen ? <FolderOpen size={14} /> : <FolderClosed size={14} />}
          </div>
          <span className="text-xs font-semibold text-text-primary truncate max-w-[160px] group-hover:text-brand transition-colors">
            {node.name}
          </span>
          <span className="text-[10px] font-bold text-text-muted bg-bg-card border border-border-custom px-1.5 py-0.5 rounded-full">
            {allTracks.length}
          </span>
        </div>

        {/* Quick actions shown on hover */}
        {allTracks.length > 0 && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onPlayTracks(allTracks)}
              title="נגן תיקייה"
              className="w-6 h-6 rounded hover:bg-bg-card-hover text-text-secondary hover:text-brand flex items-center justify-center transition-colors cursor-pointer"
            >
              <Play size={11} className="fill-current" />
            </button>
            <button
              onClick={() => onAddTracks(allTracks)}
              title="הוסף לתור"
              className="w-6 h-6 rounded hover:bg-bg-card-hover text-text-secondary hover:text-brand flex items-center justify-center transition-colors cursor-pointer"
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Render children subfolders and files */}
      {isOpen && (
        <div className={`${lang === 'he' ? 'border-r mr-2.5 pr-1.5' : 'border-l ml-2.5 pl-1.5'} border-border-custom mt-0.5 flex flex-col gap-0.5`}>
          {node.subfolders.map((sub) => (
            <FolderTreeNode
              key={sub.path}
              node={sub}
              onPlayTracks={onPlayTracks}
              onAddTracks={onAddTracks}
              depth={depth + 1}
              addedTrackIds={addedTrackIds}
              onAddTrackWithFeedback={onAddTrackWithFeedback}
              lang={lang}
            />
          ))}

          {/* Files direct child of this node */}
          {node.tracks.map((track) => {
            const isAdded = addedTrackIds[track.id];
            return (
              <div
                key={track.id}
                onClick={() => onPlayTracks([track])}
                className="flex items-center justify-between p-1.5 rounded-lg hover:bg-bg-card-hover cursor-pointer group transition-colors border border-transparent hover:border-border-custom"
                style={{
                  paddingRight: lang === 'he' ? `${Math.max(12, (depth + 1) * 8)}px` : '12px',
                  paddingLeft: lang === 'en' ? `${Math.max(12, (depth + 1) * 8)}px` : '12px',
                }}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                  <Music size={12} className="text-text-secondary group-hover:text-brand transition-colors flex-shrink-0" />
                  <div className={`overflow-hidden flex-1 min-w-0 ${lang === 'he' ? 'text-right' : 'text-left'}`}>
                    <div className="text-xs text-text-primary truncate group-hover:text-brand transition-colors font-semibold">
                      {track.name}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {track.artist !== 'Unknown Artist' && (
                        <span className="text-[10px] text-text-secondary truncate">
                          {track.artist}
                        </span>
                      )}
                      <span className="text-[9px] text-text-muted/65 truncate font-mono select-all" dir="ltr" title={track.path}>
                        {track.path}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {window.electronAPI && (
                    <button
                      onClick={() => window.electronAPI.showItemInFolder(track.path)}
                      className="w-5.5 h-5.5 rounded hover:bg-bg-card-hover text-text-secondary hover:text-brand flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      title={lang === 'he' ? 'הצג בתיקייה' : 'Show in Folder'}
                    >
                      <FolderOpen size={11} />
                    </button>
                  )}
                  <button
                    onClick={() => onAddTrackWithFeedback(track)}
                    className={`w-5.5 h-5.5 rounded hover:bg-bg-card-hover text-text-secondary hover:text-brand flex items-center justify-center transition-all cursor-pointer ${
                      isAdded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isAdded ? (
                      <Check size={12} className="text-green-500 animate-in zoom-in duration-200" />
                    ) : (
                      <Plus size={12} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
