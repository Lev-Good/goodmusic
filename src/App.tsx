import { useState, useEffect } from 'react';
import type { 
  FolderNode, 
  PlaybackQueue, 
  Track, 
  RepeatMode, 
  EQSettings 
} from './types/player';
import { AudioEngine } from './utils/audioEngine';
import { FolderBrowser } from './components/FolderBrowser';
import { QueueManager } from './components/QueueManager';
import { EqualizerPanel } from './components/EqualizerPanel';
import { PlayerControls } from './components/PlayerControls';
import { Visualizer } from './components/Visualizer';
import { TagEditorModal } from './components/TagEditorModal';
import { SyncedLyricsPanel } from './components/SyncedLyricsPanel';
import { parseDroppedItems } from './utils/dragDrop';
import { getAllTracksFromNode } from './utils/fileSystem';
import { parseMetadata } from './utils/metadataParser';
import { 
  Disc, 
  FolderHeart, 
  Info,
  ArrowDownToLine,
  Edit3,
  Music4,
  Settings,
  Clock,
  Gauge,
  SlidersHorizontal,
  Sun,
  Moon,
  Monitor,
  Radio,
  Languages,
  Heart,
  FolderOpen,
  Minimize2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Bookmark,
  Trash2
} from 'lucide-react';

const INITIAL_QUEUES: PlaybackQueue[] = Array.from({ length: 20 }, (_, idx) => ({
  id: idx,
  name: `תור ${idx + 1}`,
  tracks: [],
  currentIndex: -1,
  currentTime: 0,
}));

interface RadioStation {
  id: string;
  name: string;
  frequency: string;
  description: string;
  url: string;
}

const TRANSLATIONS = {
  he: {
    nowPlaying: 'מתנגן עכשיו',
    library: 'ספריית תיקיות',
    radio: 'רדיו שידור חי',
    settings: 'הגדרות',
    musicoletDesktop: 'GoodMusic Desktop',
    localMusicPlayer: 'נגן מוזיקה מקומי · כל הזכויות שמורות',
    notPlaying: 'לא מנוגן שיר',
    scanDots: 'נטענו {count} שירים',
    scanningMusic: 'סורק קבצי מוזיקה...',
    scanningWait: 'אנא המתן, האפליקציה סורקת את התיקייה שנבחרה ומארגנת את השירים שלך.',
    loadLibraryWarning: 'טרם נטענה ספרייה',
    dragAndDropTitle: 'שחרר קבצים או תיקיות כאן',
    dragAndDropSub: 'השירים יתווספו אוטומטית לתור ההשמעה הנוכחי',
    nowPlayingOnboardingTitle: 'Musicolet Desktop',
    nowPlayingOnboardingSub: 'גרור קבצי מוזיקה לכאן, או בחר תיקייה מהמחשב שלך.',
    selectFolder: 'בחר תיקייה',
    editTags: 'ערוך תגיות',
    lyrics: 'מילים',
    visualizer: 'ויזואלייזר',
    audioSpectrum: 'ספקטרום תדרים · Web Audio API',
    radioHeader: 'תחנות רדיו יהודיות / חרדיות בשידור חי',
    radioSub: 'האזנה לשידורים חיים ללא צורך בדפדפן',
    searchLibrary: 'חיפוש מהיר בספריה...',
    noLibraryLoaded: 'טרם נטענה תיקיית מקור',
    noLibraryLoadedSub: 'לחץ על "בחר תיקייה" כדי לטעון ולנהל את השירים מהמחשב שלך.',
    allTracksFiltered: 'כל השירים סוננו',
    allTracksFilteredSub: 'כל השירים בתיקייה קצרים מהסף שנקבע ({threshold} שניות). כבה את הסינון או הנמך אותו כדי להציגם.',
    searchResultsTitle: 'תוצאות חיפוש עבור "{query}" ({count})',
    noSearchResults: 'לא נמצאו שירים תואמים לחיפוש',
    playAll: 'נגן הכל',
    shuffleAll: 'ערבב הכל',
    queueTitle: 'תור השמעה',
    closeQueue: 'סגור תור',
    pinQueue: 'הצמד תור',
    unpinQueue: 'בטל הצמדה',
    selectQueue: 'בחר תור השמעה',
    showLess: 'הצג פחות',
    showAllQueues: 'הצג את כל 20 התורים',
    shuffle: 'ערבב',
    clear: 'נקה',
    queueEmpty: 'תור זה ריק',
    queueEmptySub: 'גרור קבצים לכאן או הוסף שירים מדפדפן התיקיות כדי למלא את התור.',
    noTracksMatchQueueFilter: 'אין שירים התואמים לסינון בתור',
    moveUp: 'העבר למעלה',
    moveDown: 'העבר למטה',
    removeFromQueue: 'הסר מהתור',
    settingsTitle: 'הגדרות שמע וממשק',
    settingsSub: 'התאמה אישית של ממשק המשתמש, סינון והתנהגות הנגן',
    themeSection: 'מראה האפליקציה (Theme)',
    themeSelect: 'ערכת נושא:',
    themeDark: 'כהה premium',
    themeLight: 'בהיר premium',
    themeSystem: 'מערכת',
    languageSection: 'שפת הממשק (Language)',
    languageLabel: 'שפת האפליקציה:',
    languageHe: 'עברית (RTL)',
    languageEn: 'English (LTR)',
    scanningSection: 'סריקת קבצים וסינון',
    filterShortTracks: 'סנן קבצים קצרים',
    filterThresholdLabel: 'משך מינימלי לסינון (בשניות):',
    pitchSpeedSection: 'גובה צליל וקצב השמעה (Pitch/Speed)',
    pitchLabel: 'גובה צליל (טרנספוזיציה): {value} חצי טון',
    speedLabel: 'מהירות השמעה: {value}x',
    reset: 'איפוס',
    creditsSection: 'קרדיטים ואודות',
    creditsCreatedBy: 'נוצר באהבה על ידי לב טוב. כל הזכויות שמורות ללב טוב © 2026. לביקור באתר הבית שלי:',
    creditsVisitSite: 'https://lev-good.github.io/Good-heart/',
    playbackQueueText: 'תור {id}',
    showInFolder: 'הצג בתיקייה',
    duration: 'משך:',
    unknownArtist: 'Unknown Artist',
    unknownAlbum: 'Unknown Album',
    onboardingBackToLibrary: 'סגור וחזור לספריה',
    crossfadeTitle: 'עמעום קרוספייד וסינון',
    crossfadeDurationText: 'עמעום צולב (Crossfade):',
    crossfadeSeconds: '{count} שניות',
    crossfadeOff: 'כבוי',
    sleepTimerTitle: 'טיימר שינה (Sleep Timer)',
    sleepTimerStatus: 'סטטוס טיימר:',
    sleepTimerOffIn: 'כבוי בעוד {time}',
    sleepTimerEndSong: 'יכבה בסוף השיר הנוכחי',
    sleepTimerInactive: 'לא פעיל',
    sleepTimer15m: '15 דקות',
    sleepTimer30m: '30 דקות',
    sleepTimer60m: '60 דקות',
    sleepTimerEndSongBtn: 'כבה בסוף השיר הנוכחי',
    sleepTimerEndSongBtnActive: '✓ מופעל: בסוף השיר',
    sleepTimerCancelBtn: 'בטל טיימר',
    systemInfoTitle: 'מידע על המוצר',
    systemInfoText1: 'Musicolet Desktop v1.0.0 Redesigned',
    systemInfoText2: 'מפותח ב-React + Electron + Tailwind CSS v4.0.',
    systemInfoText3: 'האפליקציה פועלת באופן מקומי לחלוטין ואינה אוספת מידע או דורשת חיבור אינטרנט.',
    equalizerTitle: 'אקולייזר מרובה ערוצים',
    equalizerActive: 'פעיל',
    equalizerInactive: 'כבוי',
    preampLabel: 'הגבר ראשוני',
    bassLabel: 'עוצמת בס',
    trebleLabel: 'עוצמת טרבל',
    speedReset: 'איפוס ל-1.0',
    pitchReset: 'איפוס ל-0',
    openFolder: 'הצג בתיקייה',
    playingText: 'מנגן',
    pausedText: 'מושהה',
  },
  en: {
    nowPlaying: 'Now Playing',
    library: 'Folder Library',
    radio: 'Live Radio',
    settings: 'Settings',
    musicoletDesktop: 'GoodMusic Desktop',
    localMusicPlayer: 'Local Music Player · All Rights Reserved',
    notPlaying: 'No track playing',
    scanDots: 'Loaded {count} songs',
    scanningMusic: 'Scanning music files...',
    scanningWait: 'Please wait, the application is scanning the selected folder and organizing your songs.',
    loadLibraryWarning: 'No library loaded yet',
    dragAndDropTitle: 'Drop files or folders here',
    dragAndDropSub: 'Songs will be automatically added to the active queue',
    nowPlayingOnboardingTitle: 'Musicolet Desktop',
    nowPlayingOnboardingSub: 'Drag music files here, or select a folder from your computer.',
    selectFolder: 'Select Folder',
    editTags: 'Edit Tags',
    lyrics: 'Lyrics',
    visualizer: 'Visualizer',
    audioSpectrum: 'Frequency Spectrum · Web Audio API',
    radioHeader: 'Jewish & Haredi Music Radio Stations',
    radioSub: 'Listen to live broadcasts without needing a browser',
    searchLibrary: 'Quick search in library...',
    noLibraryLoaded: 'No source folder loaded yet',
    noLibraryLoadedSub: 'Click "Select Folder" to load and manage songs from your computer.',
    allTracksFiltered: 'All tracks filtered',
    allTracksFilteredSub: 'All songs in this folder are shorter than the threshold ({threshold}s). Disable or lower the filter to show them.',
    searchResultsTitle: 'Search results for "{query}" ({count})',
    noSearchResults: 'No matching songs found',
    playAll: 'Play All',
    shuffleAll: 'Shuffle All',
    queueTitle: 'Playback Queue',
    closeQueue: 'Close Queue',
    pinQueue: 'Pin Queue',
    unpinQueue: 'Unpin Queue',
    selectQueue: 'Select Playback Queue',
    showLess: 'Show Less',
    showAllQueues: 'Show all 20 queues',
    shuffle: 'Shuffle',
    clear: 'Clear',
    queueEmpty: 'This queue is empty',
    queueEmptySub: 'Drag files here or add songs from the folder browser to fill the queue.',
    noTracksMatchQueueFilter: 'No matching songs in queue',
    moveUp: 'Move Up',
    moveDown: 'Move Down',
    removeFromQueue: 'Remove from Queue',
    settingsTitle: 'Audio & Interface Settings',
    settingsSub: 'Customize user interface, filtering and player behavior',
    themeSection: 'Appearance & Interface Theme',
    themeSelect: 'Theme Mode:',
    themeDark: 'Premium Dark',
    themeLight: 'Premium Light',
    themeSystem: 'System (Auto)',
    languageSection: 'Interface Language',
    languageLabel: 'App Language:',
    languageHe: 'עברית (RTL)',
    languageEn: 'English (LTR)',
    scanningSection: 'File Scanning & Filtering',
    filterShortTracks: 'Filter short tracks',
    filterThresholdLabel: 'Minimum duration threshold (seconds):',
    pitchSpeedSection: 'Playback Pitch & Speed',
    pitchLabel: 'Pitch Shift: {value} semitones',
    speedLabel: 'Playback Speed: {value}x',
    reset: 'Reset',
    creditsSection: 'Credits & About',
    creditsCreatedBy: 'Created with love by Lev Tov. All rights reserved to Lev Tov © 2026. Visit my homepage:',
    creditsVisitSite: 'https://lev-good.github.io/Good-heart/',
    playbackQueueText: 'Queue {id}',
    showInFolder: 'Show in folder',
    duration: 'Duration:',
    unknownArtist: 'Unknown Artist',
    unknownAlbum: 'Unknown Album',
    onboardingBackToLibrary: 'Close and back to Library',
    crossfadeTitle: 'Crossfade & Filters',
    crossfadeDurationText: 'Crossfade Duration:',
    crossfadeSeconds: '{count} seconds',
    crossfadeOff: 'Off',
    sleepTimerTitle: 'Sleep Timer',
    sleepTimerStatus: 'Timer Status:',
    sleepTimerOffIn: 'Off in {time}',
    sleepTimerEndSong: 'Will stop at the end of the current song',
    sleepTimerInactive: 'Inactive',
    sleepTimer15m: '15 Minutes',
    sleepTimer30m: '30 Minutes',
    sleepTimer60m: '60 Minutes',
    sleepTimerEndSongBtn: 'Stop at the end of current track',
    sleepTimerEndSongBtnActive: '✓ Active: End of track',
    sleepTimerCancelBtn: 'Cancel Timer',
    systemInfoTitle: 'Product Information',
    systemInfoText1: 'Musicolet Desktop v1.0.0 Redesigned',
    systemInfoText2: 'Developed using React + Electron + Tailwind CSS v4.0.',
    systemInfoText3: 'The app works completely locally and does not collect any data or require internet.',
    equalizerTitle: 'Multi-band Equalizer',
    equalizerActive: 'Active',
    equalizerInactive: 'Off',
    preampLabel: 'Pre-Amplifier',
    bassLabel: 'Bass Boost',
    trebleLabel: 'Treble Boost',
    speedReset: 'Reset to 1.0',
    pitchReset: 'Reset to 0',
    openFolder: 'Show in Folder',
    playingText: 'Playing',
    pausedText: 'Paused',
  }
};

const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'kcm',
    name: 'קול חי מיוזיק',
    frequency: '102.5 FM',
    description: 'מוזיקה יהודית וחסידית ללא הפסקה 24/6',
    url: 'https://live.kcm.fm/livemusic',
  },
  {
    id: 'kol-chai',
    name: 'רדיו קול חי',
    frequency: '93.0 / 92.8 FM',
    description: 'התחנה המובילה בציבור החרדי - אקטואליה, תוכניות ושיעורים',
    url: 'https://live.kcm.fm/live-new',
  },
  {
    id: 'kol-play',
    name: 'רדיו קול פליי',
    frequency: '107.6 FM',
    description: 'מוזיקה יהודית איכותית, קצב ותוכניות מוזיקה סוחפות',
    url: 'https://cdn.cybercdn.live/Kol_Barama/Music/icecast.audio',
  },
  {
    id: 'kol-barama',
    name: 'רדיו קול ברמה',
    frequency: '92.0 / 104.3 / 105.7 FM',
    description: 'שידורי אקטואליה, יהדות ומוזיקה מגוונת מהעולם התורני',
    url: 'https://cdn.cybercdn.live/Kol_Barama/Live_Audio/icecast.audio',
  },
  {
    id: 'geula-fm',
    name: 'גאולה FM',
    frequency: 'רדיו אינטרנט',
    description: 'מוזיקה חסידית מגוונת, שירים חדשים ונוסטלגיה חסידית (ייתכן שחסום בסינון האינטרנט שלכם)',
    url: 'https://broadcast.adpronet.com/radio/8010/radio.mp3',
  },
  {
    id: 'moreshet',
    name: 'כאן מורשת',
    frequency: 'רדיו אינטרנט / HLS',
    description: 'שידורי מורשת, תרבות ומוזיקה יהודית (ייתכן שחסום בסינון האינטרנט שלכם)',
    url: 'https://kanlivep2event-i.akamaihd.net/hls/live/749629/749629/playlist.m3u8',
  },
  {
    id: 'jewish-music-stream',
    name: 'JewishMusic Stream',
    frequency: 'רדיו אינטרנט בינלאומי',
    description: 'שידור מוזיקה יהודית מגוונת ואיכותית מכל רחבי העולם',
    url: 'https://stream.jewishmusicstream.com:8000/stream',
  }
];

export default function App() {
  const [lang, setLang] = useState<'he' | 'en'>(() => {
    return (localStorage.getItem('musicolet-lang') as 'he' | 'en') || 'he';
  });

  useEffect(() => {
    localStorage.setItem('musicolet-lang', lang);
  }, [lang]);

  const t = (key: string, params?: Record<string, string | number>) => {
    const translation = TRANSLATIONS[lang]?.[key as keyof typeof TRANSLATIONS.he] || TRANSLATIONS.he[key as keyof typeof TRANSLATIONS.he] || key;
    if (!params) return translation;
    let result = translation;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, String(v));
    }
    return result;
  };

  const [rootFolder, setRootFolder] = useState<FolderNode | null>(null);
  const [activeQueueId, setActiveQueueId] = useState<number>(0);
  const [queues, setQueues] = useState<PlaybackQueue[]>(INITIAL_QUEUES);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState<number>(0);
  const [exclusionEnabled, setExclusionEnabled] = useState<boolean>(true);
  const [exclusionThreshold, setExclusionThreshold] = useState<number>(30);
  const [crossfadeDuration, setCrossfadeDuration] = useState<number>(3);
  
  // Navigation & View states
  const [activeHub, setActiveHub] = useState<'now-playing' | 'library' | 'radio' | 'settings'>('library');
  const [nowPlayingTab, setNowPlayingTab] = useState<'vinyl' | 'lyrics' | 'visualizer' | 'bookmarks'>('vinyl');
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isQueuePinned, setIsQueuePinned] = useState(false);
  
  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [scannedFilesCount, setScannedFilesCount] = useState(0);

  // Playback statistics & Ratings from localStorage
  const [trackStats, setTrackStats] = useState<Record<string, { rating?: number; playCount?: number; skipCount?: number; lastPlayed?: number }>>(() => {
    try {
      const saved = localStorage.getItem('musicolet-track-stats');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('musicolet-track-stats', JSON.stringify(trackStats));
  }, [trackStats]);

  // Sound Check State
  const [soundCheck, setSoundCheck] = useState<boolean>(() => {
    return localStorage.getItem('musicolet-sound-check') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('musicolet-sound-check', String(soundCheck));
    audioEngine.setSoundCheck(soundCheck);
  }, [soundCheck]);

  // MiniPlayer State
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [showQuickSpeed, setShowQuickSpeed] = useState(false);
  const [selectedSmartPlaylist, setSelectedSmartPlaylist] = useState<'recent' | 'most' | 'top' | 'never' | null>(null);

  // Audio Bookmarks and Notes state
  const [bookmarks, setBookmarks] = useState<Record<string, { id: string; timestamp: number; note: string; date: number }[]>>(() => {
    try {
      const saved = localStorage.getItem('musicolet-bookmarks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [newBookmarkNote, setNewBookmarkNote] = useState('');

  useEffect(() => {
    localStorage.setItem('musicolet-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const getTrackRating = (path: string): number => {
    return trackStats[path]?.rating || 0;
  };

  const getTrackPlayCount = (path: string): number => {
    return trackStats[path]?.playCount || 0;
  };

  const setTrackRating = (path: string, rating: number) => {
    setTrackStats(prev => {
      const current = prev[path] || {};
      return {
        ...prev,
        [path]: {
          ...current,
          rating
        }
      };
    });
  };

  const handleTrackEnded = (path: string) => {
    setTrackStats(prev => {
      const current = prev[path] || {};
      return {
        ...prev,
        [path]: {
          ...current,
          playCount: (current.playCount || 0) + 1,
          lastPlayed: Date.now()
        }
      };
    });
  };

  const handleTrackSkipped = (path: string) => {
    setTrackStats(prev => {
      const current = prev[path] || {};
      return {
        ...prev,
        [path]: {
          ...current,
          skipCount: (current.skipCount || 0) + 1
        }
      };
    });
  };

  const toggleMiniPlayer = async () => {
    try {
      const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      
      if (!isMiniPlayer) {
        await appWindow.setMinSize(new LogicalSize(320, 370));
        await appWindow.setSize(new LogicalSize(320, 370));
        await appWindow.setAlwaysOnTop(true);
        setIsMiniPlayer(true);
      } else {
        await appWindow.setMinSize(new LogicalSize(900, 650));
        await appWindow.setSize(new LogicalSize(1250, 800));
        await appWindow.setAlwaysOnTop(false);
        setIsMiniPlayer(false);
      }
    } catch (err) {
      console.error('Failed to toggle MiniPlayer size:', err);
      setIsMiniPlayer(!isMiniPlayer);
    }
  };

  const getAllLibraryTracks = (): Track[] => {
    if (!rootFolder) return [];
    return getAllTracksFromNode(rootFolder);
  };

  const getSmartPlaylistTracks = (type: 'recent' | 'most' | 'top' | 'never'): Track[] => {
    const tracks = getAllLibraryTracks();
    switch (type) {
      case 'recent':
        return tracks
          .filter(t => (trackStats[t.path]?.lastPlayed || 0) > 0)
          .sort((a, b) => (trackStats[b.path]?.lastPlayed || 0) - (trackStats[a.path]?.lastPlayed || 0))
          .slice(0, 50);
      case 'most':
        return tracks
          .filter(t => (trackStats[t.path]?.playCount || 0) > 0)
          .sort((a, b) => (trackStats[b.path]?.playCount || 0) - (trackStats[a.path]?.playCount || 0))
          .slice(0, 50);
      case 'top':
        return tracks
          .filter(t => (trackStats[t.path]?.rating || 0) >= 4)
          .sort((a, b) => (trackStats[b.path]?.rating || 0) - (trackStats[a.path]?.rating || 0));
      case 'never':
        return tracks.filter(t => (trackStats[t.path]?.playCount || 0) === 0 || trackStats[t.path]?.playCount === undefined);
      default:
        return [];
    }
  };

  const getSmartPlaylistName = (type: 'recent' | 'most' | 'top' | 'never'): string => {
    if (lang === 'he') {
      switch (type) {
        case 'recent': return 'הושמעו לאחרונה';
        case 'most': return 'הכי מושמעים';
        case 'top': return 'בדירוג גבוה';
        case 'never': return 'לא הושמעו מעולם';
      }
    } else {
      switch (type) {
        case 'recent': return 'Recently Played';
        case 'most': return 'Most Played';
        case 'top': return 'Top Rated';
        case 'never': return 'Never Played';
      }
    }
  };

  const renderSmartPlaylists = () => {
    const playlists: ('recent' | 'most' | 'top' | 'never')[] = ['recent', 'most', 'top', 'never'];
    
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {playlists.map(type => {
          const listTracks = getSmartPlaylistTracks(type);
          const name = getSmartPlaylistName(type);
          const isActive = selectedSmartPlaylist === type;
          
          return (
            <button
              key={type}
              onClick={() => setSelectedSmartPlaylist(isActive ? null : type)}
              className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-right flex items-center justify-between border ${
                isActive 
                  ? 'bg-brand border-brand text-black shadow-md shadow-brand/10'
                  : 'bg-bg-app border-border-custom text-text-secondary hover:text-text-primary hover:border-brand/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] opacity-75 font-semibold bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 px-2 py-0.5 rounded-full">
                  {listTracks.length}
                </span>
              </div>
              <span>{name}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderSmartPlaylistTracks = (type: 'recent' | 'most' | 'top' | 'never') => {
    const listTracks = getSmartPlaylistTracks(type);
    const name = getSmartPlaylistName(type);
    
    // Simple helper to shuffle an array
    const shuffleArrayLocal = (array: any[]) => {
      const copy = [...array];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    
    return (
      <div className="w-full h-full flex flex-col overflow-hidden p-6 animate-in fade-in duration-200" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-custom pb-4 mb-4 select-none flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedSmartPlaylist(null)}
              className="py-1.5 px-3 rounded-xl bg-bg-app border border-border-custom hover:border-brand/40 text-[10px] font-bold text-text-secondary transition-colors cursor-pointer"
            >
              {lang === 'he' ? '← חזרה לתיקיות' : '← Back to Folders'}
            </button>
            <h2 className="text-sm font-bold text-text-primary">{name}</h2>
          </div>
          {listTracks.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePlayTracks(listTracks)}
                className="py-1.5 px-3.5 rounded-xl bg-brand text-black text-[10px] font-bold shadow-md hover:bg-brand-bright transition-colors cursor-pointer"
              >
                {t('playAll')}
              </button>
              <button
                onClick={() => {
                  const shuffled = shuffleArrayLocal(listTracks);
                  handlePlayTracks(shuffled);
                }}
                className="py-1.5 px-3.5 rounded-xl bg-neutral-900 border border-white/5 text-text-primary text-[10px] font-bold hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                {t('shuffleAll')}
              </button>
            </div>
          )}
        </div>

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1.5 pr-1">
          {listTracks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
              <Music4 size={32} className="text-text-muted mb-3 opacity-30 animate-pulse" />
              <p className="text-xs font-semibold text-text-secondary">{lang === 'he' ? 'אין שירים ברשימה זו עדיין' : 'No songs in this list yet'}</p>
              <p className="text-[10px] text-text-muted mt-1">
                {lang === 'he' 
                  ? 'נגן שירים מקומיים או דרג אותם כדי למלא רשימה זו.' 
                  : 'Play local songs or rate them to populate this list.'}
              </p>
            </div>
          ) : (
            listTracks.map((track, index) => {
              const isThisPlaying = currentTrack && currentTrack.path === track.path;
              const rating = getTrackRating(track.path);
              const playCount = getTrackPlayCount(track.path);
              
              return (
                <div
                  key={track.id || track.path}
                  onClick={() => playTrack(track, true)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer border ${
                    isThisPlaying
                      ? 'bg-brand/10 border-brand/20'
                      : 'bg-bg-app border-transparent hover:bg-bg-card-hover hover:border-border-custom'
                  }`}
                >
                  {/* Track info & Cover */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-[10px] text-text-muted font-bold w-5 text-center tabular-nums">
                      {index + 1}
                    </div>
                    {track.coverUrl ? (
                      <img src={track.coverUrl} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-white/5 flex items-center justify-center text-brand flex-shrink-0">
                        <Music4 size={12} />
                      </div>
                    )}
                    <div className="overflow-hidden text-right">
                      <div className={`text-xs font-semibold truncate ${isThisPlaying ? 'text-brand' : 'text-text-primary'}`}>
                        {track.name}
                      </div>
                      <div className="text-[10px] text-text-secondary truncate mt-0.5">
                        {track.artist !== 'Unknown Artist' ? track.artist : ''}
                      </div>
                    </div>
                  </div>

                  {/* Ratings and Stats */}
                  <div className="flex items-center gap-4 flex-shrink-0 select-none">
                    {/* Stars */}
                    {rating > 0 && (
                      <div className="flex items-center text-amber-400">
                        {Array.from({ length: rating }).map((_, i) => (
                          <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                          </svg>
                        ))}
                      </div>
                    )}
                    {/* Play count */}
                    {playCount > 0 && (
                      <span className="text-[9px] text-text-muted font-bold bg-neutral-900 border border-white/5 px-2 py-0.5 rounded-full">
                        {lang === 'he' ? `${playCount} שמיעות` : `${playCount} plays`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Theme state ('dark' | 'light' | 'system')
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light' | 'system') || 'dark';
  });

  // Restore queue metadata from localStorage on first load
  useEffect(() => {
    try {
      const saved = localStorage.getItem('musicolet-queues');
      if (saved) {
        const parsed = JSON.parse(saved) as { id: number; name: string; trackMeta: { id: string; name: string; artist: string; album: string }[]; currentIndex: number }[];
        setQueues(prev => prev.map(q => {
          const savedQ = parsed.find(sq => sq.id === q.id);
          if (!savedQ) return q;
          // Restore metadata only — file handles cannot be serialized
          const restoredTracks = savedQ.trackMeta.map(m => ({
            id: m.id,
            name: m.name,
            artist: m.artist,
            album: m.album,
            duration: 0,
            size: 0,
            path: m.id,
          }));
          return {
            ...q,
            name: savedQ.name || q.name,
            tracks: restoredTracks,
            currentIndex: savedQ.currentIndex
          };
        }));
      }
    } catch {
      // silently ignore corrupt localStorage
    }
  }, []);

  // Sleep Timer states
  const [sleepTimeLeft, setSleepTimeLeft] = useState<number | null>(null); // seconds
  const [sleepEndSong, setSleepEndSong] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  const [eqSettings, setEqSettings] = useState<EQSettings>({
    enabled: true,
    bands: new Array(10).fill(0),
    bassBoost: 0,
    trebleBoost: 0,
    preamp: 0,
  });

  const audioEngine = AudioEngine.getInstance();
  const activeQueue = queues.find((q) => q.id === activeQueueId) || queues[0];

  const handleRenameQueue = (id: number, name: string) => {
    setQueues((prev) =>
      prev.map((q) => (q.id === id ? { ...q, name } : q))
    );
  };

  const handleDuplicateQueue = (sourceId: number, targetId: number) => {
    setQueues((prev) => {
      const source = prev.find((q) => q.id === sourceId);
      if (!source) return prev;
      return prev.map((q) => {
        if (q.id === targetId) {
          return {
            ...q,
            name: source.name ? `${source.name}` : `תור ${sourceId + 1}`,
            tracks: [...source.tracks],
            currentIndex: source.currentIndex,
          };
        }
        return q;
      });
    });
  };

  const handleMoveTrackToQueue = (trackIndex: number, targetQueueId: number) => {
    setQueues((prev) => {
      const active = prev.find((q) => q.id === activeQueueId);
      if (!active || trackIndex < 0 || trackIndex >= active.tracks.length) return prev;
      
      const trackToMove = active.tracks[trackIndex];
      
      return prev.map((q) => {
        if (q.id === activeQueueId) {
          const updatedTracks = q.tracks.filter((_, idx) => idx !== trackIndex);
          let nextIndex = q.currentIndex;
          
          if (trackIndex === q.currentIndex) {
            if (updatedTracks.length === 0) {
              nextIndex = -1;
              audioEngine.pause();
              setIsPlaying(false);
              setCurrentTrack(null);
            } else {
              nextIndex = trackIndex >= updatedTracks.length ? 0 : trackIndex;
              setTimeout(() => playTrack(updatedTracks[nextIndex], true), 50);
            }
          } else if (trackIndex < q.currentIndex) {
            nextIndex = q.currentIndex - 1;
          }
          
          return {
            ...q,
            tracks: updatedTracks,
            currentIndex: nextIndex
          };
        }
        if (q.id === targetQueueId) {
          return {
            ...q,
            tracks: [...q.tracks, trackToMove]
          };
        }
        return q;
      });
    });
  };

  const handleAddBookmark = (note: string) => {
    if (!currentTrack) return;
    if (currentTrack.duration === Infinity || currentTrack.duration <= 0 || currentTrack.path.startsWith('http')) {
      alert(lang === 'he' ? 'סימניות אינן נתמכות בשידורי רדיו חיים.' : 'Bookmarks are not supported on live radio broadcasts.');
      return;
    }
    
    const newBookmark = {
      id: `bookmark-${Date.now()}-${Math.random()}`,
      timestamp: currentTime,
      note: note.trim() || (lang === 'he' ? 'סימנייה ללא הערה' : 'No note'),
      date: Date.now()
    };
    
    setBookmarks(prev => {
      const trackPath = currentTrack.path;
      const trackBookmarks = prev[trackPath] || [];
      const updated = [...trackBookmarks, newBookmark].sort((a, b) => a.timestamp - b.timestamp);
      return {
        ...prev,
        [trackPath]: updated
      };
    });
    setNewBookmarkNote('');
  };

  const handleDeleteBookmark = (bookmarkId: string) => {
    if (!currentTrack) return;
    setBookmarks(prev => {
      const trackPath = currentTrack.path;
      const trackBookmarks = prev[trackPath] || [];
      const updated = trackBookmarks.filter(b => b.id !== bookmarkId);
      const copy = { ...prev };
      if (updated.length === 0) {
        delete copy[trackPath];
      } else {
        copy[trackPath] = updated;
      }
      return copy;
    });
  };

  const handleSeekToBookmark = (seconds: number) => {
    audioEngine.seek(seconds);
    setCurrentTime(seconds);
  };

  const handleExportAllSettings = async () => {
    try {
      const backupData = {
        version: '1.0.0',
        timestamp: Date.now(),
        queues: queues.map(q => ({
          id: q.id,
          name: q.name,
          currentIndex: q.currentIndex,
          trackMeta: q.tracks.map(t => ({
            id: t.id,
            name: t.name,
            artist: t.artist,
            album: t.album,
          })),
        })),
        trackStats,
        bookmarks,
        eqSettings,
        general: {
          volume,
          isMuted,
          speed,
          pitch,
          exclusionEnabled,
          exclusionThreshold,
          crossfadeDuration,
          theme,
          lang,
          soundCheck
        }
      };
      
      const content = JSON.stringify(backupData, null, 2);
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

      if (isTauri) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { invoke } = await import('@tauri-apps/api/core');
        
        const filePath = await save({
          filters: [{ name: 'JSON Backup', extensions: ['json'] }],
          defaultPath: 'goodmusic_backup.json'
        });
        
        if (!filePath) return;
        await invoke('write_text_file', { filePath, content });
      } else {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'goodmusic_backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      alert(lang === 'he' ? 'הגיבוי נוצר בהצלחה!' : 'Backup created successfully!');
    } catch (err) {
      console.error('Failed to export settings:', err);
      alert(lang === 'he' ? 'יצירת הגיבוי נכשלה.' : 'Failed to create backup.');
    }
  };

  const handleImportAllSettings = async () => {
    try {
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
      let content = '';

      if (isTauri) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { invoke } = await import('@tauri-apps/api/core');
        
        const selected = await open({
          filters: [{ name: 'JSON Backup', extensions: ['json'] }],
          multiple: false
        });
        
        if (!selected || typeof selected !== 'string') return;
        content = await invoke<string>('read_text_file', { filePath: selected });
      } else {
        content = await new Promise<string>((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) {
              reject(new Error('No file selected'));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          };
          input.click();
        });
      }
      
      const parsed = JSON.parse(content);
      
      if (parsed && parsed.version === '1.0.0' && Array.isArray(parsed.queues)) {
        const restoredQueues = parsed.queues.map((q: any) => {
          const tracks = Array.isArray(q.trackMeta) ? q.trackMeta.map((m: any) => ({
            id: m.id,
            name: m.name,
            artist: m.artist || 'Unknown Artist',
            album: m.album || 'Unknown Album',
            duration: 0,
            size: 0,
            path: m.id,
          })) : [];
          return {
            id: q.id,
            name: q.name || '',
            tracks,
            currentIndex: q.currentIndex !== undefined ? q.currentIndex : -1
          };
        });
        
        const finalQueues = INITIAL_QUEUES.map(q => {
          const rq = restoredQueues.find((item: any) => item.id === q.id);
          return rq || q;
        });

        setQueues(finalQueues);
        
        if (parsed.trackStats) {
          setTrackStats(parsed.trackStats);
          localStorage.setItem('musicolet-track-stats', JSON.stringify(parsed.trackStats));
        }
        
        if (parsed.bookmarks) {
          setBookmarks(parsed.bookmarks);
          localStorage.setItem('musicolet-bookmarks', JSON.stringify(parsed.bookmarks));
        }
        
        if (parsed.eqSettings) {
          setEqSettings(parsed.eqSettings);
        }
        
        if (parsed.general) {
          const gen = parsed.general;
          if (gen.volume !== undefined) setVolume(gen.volume);
          if (gen.isMuted !== undefined) setIsMuted(gen.isMuted);
          if (gen.speed !== undefined) setSpeed(gen.speed);
          if (gen.pitch !== undefined) setPitch(gen.pitch);
          if (gen.exclusionEnabled !== undefined) setExclusionEnabled(gen.exclusionEnabled);
          if (gen.exclusionThreshold !== undefined) setExclusionThreshold(gen.exclusionThreshold);
          if (gen.crossfadeDuration !== undefined) setCrossfadeDuration(gen.crossfadeDuration);
          if (gen.theme !== undefined) setTheme(gen.theme);
          if (gen.lang !== undefined) setLang(gen.lang);
          if (gen.soundCheck !== undefined) setSoundCheck(gen.soundCheck);
        }
        
        alert(lang === 'he' ? 'הגדרות ושחזור הנתונים בוצעו בהצלחה!' : 'Settings and data restored successfully!');
      } else {
        alert(lang === 'he' ? 'קובץ הגיבוי אינו תקין או בפורמט לא נתמך.' : 'Invalid backup file format.');
      }
    } catch (err) {
      console.error('Failed to import settings:', err);
      alert(lang === 'he' ? 'שחזור הגיבוי נכשל.' : 'Failed to restore backup.');
    }
  };

  useEffect(() => {
    audioEngine.setVolume(volume);
    audioEngine.setSpeed(speed);
    audioEngine.setPitch(pitch);
  }, []);

  useEffect(() => {
    const elA = audioEngine.elementA;
    const elB = audioEngine.elementB;

    const handleTimeUpdate = () => {
      setCurrentTime(audioEngine.element.currentTime);
    };

    elA.addEventListener('timeupdate', handleTimeUpdate);
    elB.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      elA.removeEventListener('timeupdate', handleTimeUpdate);
      elB.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  // Listen to native media-action events (e.g. from System Tray)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    
    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<string>('media-action', (event) => {
          const action = event.payload;
          if (action === 'play-pause') {
            handlePlayPause();
          } else if (action === 'next') {
            handleNext(false);
          } else if (action === 'prev') {
            handlePrev();
          }
        });
      } catch (err) {
        console.error('Failed to register tauri media-action listener:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [isPlaying, currentTrack, activeQueueId, queues, shuffle, repeatMode, sleepEndSong]);

  // Theme Sync Effect
  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (t: 'dark' | 'light' | 'system') => {
      root.classList.remove('light', 'dark');
      
      let actualTheme = t;
      if (t === 'system') {
        actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      root.classList.add(actualTheme);
    };

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  // Queue auto-save — persist metadata to localStorage on every change
  useEffect(() => {
    try {
      const toSave = queues.map(q => ({
        id: q.id,
        name: q.name,
        currentIndex: q.currentIndex,
        trackMeta: q.tracks.map(t => ({
          id: t.id,
          name: t.name,
          artist: t.artist,
          album: t.album,
        })),
      }));
      localStorage.setItem('musicolet-queues', JSON.stringify(toSave));
    } catch {
      // silently ignore quota errors
    }
  }, [queues]);

  // Save library path to localStorage when loaded
  useEffect(() => {
    if (rootFolder && rootFolder.path) {
      localStorage.setItem('musicolet-library-path', rootFolder.path);
    }
  }, [rootFolder]);

  // Auto-restore library folder on startup in Tauri
  useEffect(() => {
    const savedPath = localStorage.getItem('musicolet-library-path');
    if (savedPath) {
      const restoreLibrary = async () => {
        try {
          setIsScanning(true);
          const { invoke } = await import('@tauri-apps/api/core');
          const rootNode = await invoke<FolderNode>('scan_directory_native', { dirPath: savedPath });
          if (rootNode) {
            setRootFolder(rootNode);
          }
        } catch (err) {
          console.warn('Failed to auto-restore library folder on startup:', err);
        } finally {
          setIsScanning(false);
        }
      };
      restoreLibrary();
    }
  }, []);

  useEffect(() => {
    if ((window as any).electronAPI?.onMediaAction) {
      const unsubscribe = (window as any).electronAPI.onMediaAction((action: string) => {
        if (action === 'play-pause') {
          handlePlayPause();
        } else if (action === 'next') {
          handleNext();
        } else if (action === 'prev') {
          handlePrev();
        }
      });
      return () => unsubscribe();
    }
  }, [isPlaying, currentTrack, activeQueue, shuffle, repeatMode, sleepEndSong]);

  useEffect(() => {
    const el = audioEngine.element;
    const handleLoadedMetadata = () => {
      if (el.duration && currentTrack && currentTrack.duration === 0) {
        setQueues(prevQueues => prevQueues.map(q => {
          if (q.id === activeQueueId) {
            const updatedTracks = q.tracks.map(t => {
              if (t.id === currentTrack.id) {
                return { ...t, duration: el.duration };
              }
              return t;
            });
            return { ...q, tracks: updatedTracks };
          }
          return q;
        }));
        setCurrentTrack(prev => prev ? { ...prev, duration: el.duration } : null);
      }
    };

    el.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => el.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [currentTrack, activeQueueId]);

  // Dynamic track metadata updates propagation
  const updateTrackMetadataGlobally = (updated: Track) => {
    setRootFolder((prevRoot) => {
      if (!prevRoot) return prevRoot;
      return updateTrackInTree(prevRoot, updated.id, updated);
    });

    setQueues((prevQueues) =>
      prevQueues.map((q) => ({
        ...q,
        tracks: q.tracks.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
      }))
    );
  };

  // Background metadata parsing loop
  useEffect(() => {
    if (!rootFolder) return;

    const allTracks = getAllTracksFromNode(rootFolder);
    const tracksToParse = allTracks.filter((t) => !t.metadataLoaded);
    if (tracksToParse.length === 0) return;

    let isCancelled = false;

    const parseNext = async (index: number) => {
      if (index >= tracksToParse.length || isCancelled) return;

      const track = tracksToParse[index];
      try {
        let metadata;
        if (track.path && !(track.file || track.fileHandle)) {
          const { invoke } = await import('@tauri-apps/api/core');
          metadata = await invoke<any>('parse_metadata_native', { filePath: track.path });
        } else {
          let fileObj: File;
          if (track.file) {
            fileObj = track.file;
          } else if (track.fileHandle) {
            fileObj = await track.fileHandle.getFile();
          } else {
            setTimeout(() => parseNext(index + 1), 30);
            return;
          }
          metadata = await parseMetadata(fileObj);
        }

        if (isCancelled) return;

        const updatedFields = {
          name: metadata.title || track.name,
          artist: metadata.artist || 'Unknown Artist',
          album: metadata.album || 'Unknown Album',
          coverUrl: metadata.coverUrl || track.coverUrl,
          metadataLoaded: true,
        };

        setRootFolder((prevRoot) => {
          if (!prevRoot) return prevRoot;
          return updateTrackInTree(prevRoot, track.id, updatedFields);
        });

        setQueues((prevQueues) =>
          prevQueues.map((q) => ({
            ...q,
            tracks: q.tracks.map((t) => (t.id === track.id ? { ...t, ...updatedFields } : t)),
          }))
        );

        setCurrentTrack((prev) => {
          if (prev && prev.id === track.id) {
            return { ...prev, ...updatedFields };
          }
          return prev;
        });

      } catch (err) {
        console.warn('Background metadata parser failed for:', track.name, err);
        setRootFolder((prevRoot) => {
          if (!prevRoot) return prevRoot;
          return updateTrackInTree(prevRoot, track.id, { metadataLoaded: true });
        });
      }

      setTimeout(() => parseNext(index + 1), 85);
    };

    const timer = setTimeout(() => {
      parseNext(0);
    }, 2000);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [rootFolder]);

  // Sleep Timer Countdown Effect
  useEffect(() => {
    if (sleepTimeLeft === null) return;

    if (sleepTimeLeft <= 0) {
      audioEngine.fadeAndPause(() => {
        setIsPlaying(false);
        setSleepTimeLeft(null);
      });
      return;
    }

    const timer = setTimeout(() => {
      setSleepTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [sleepTimeLeft]);

  const playTrack = async (track: Track, forceNoCrossfade = false) => {
    try {
      let fileObjOrUrl: File | string;
      if (track.file) {
        fileObjOrUrl = track.file;
      } else if (track.fileHandle) {
        fileObjOrUrl = await track.fileHandle.getFile();
      } else if (track.path) {
        // Native Tauri path playback
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        fileObjOrUrl = convertFileSrc(track.path);
      } else {
        throw new Error('No track file content found');
      }

      // Lazily parse metadata on playback if not loaded yet
      let trackToPlay = track;
      if (!track.metadataLoaded) {
        try {
          let metadata;
          if (track.path && !(track.file || track.fileHandle)) {
            const { invoke } = await import('@tauri-apps/api/core');
            metadata = await invoke<any>('parse_metadata_native', { filePath: track.path });
          } else if (fileObjOrUrl instanceof File) {
            metadata = await parseMetadata(fileObjOrUrl);
          }
          if (metadata) {
            const updated: Track = {
              ...track,
              name: metadata.title || track.name,
              artist: metadata.artist || 'Unknown Artist',
              album: metadata.album || 'Unknown Album',
              coverUrl: metadata.coverUrl || track.coverUrl,
              metadataLoaded: true,
            };
            trackToPlay = updated;
            updateTrackMetadataGlobally(updated);
          }
        } catch (metaErr) {
          console.warn('Failed to parse metadata on demand:', metaErr);
        }
      }

      const shouldCrossfade = !forceNoCrossfade && isPlaying && currentTrack && crossfadeDuration > 0;

      if (shouldCrossfade) {
        await audioEngine.playFileWithCrossfade(fileObjOrUrl, crossfadeDuration);
      } else {
        await audioEngine.playFile(fileObjOrUrl);
      }
      setIsPlaying(true);
      setCurrentTrack(trackToPlay);
      setCurrentTime(0);
    } catch (err) {
      console.error('Playback error:', err);
      handleNext();
    }
  };

  const handlePlayTrackAtIndex = (index: number) => {
    if (index < 0 || index >= activeQueue.tracks.length) return;

    setQueues((prev) =>
      prev.map((q) => (q.id === activeQueueId ? { ...q, currentIndex: index } : q))
    );
    playTrack(activeQueue.tracks[index], true);
  };

  const handlePlayTracks = (newTracks: Track[]) => {
    if (newTracks.length === 0) return;

    let tracksToPlay = [...newTracks];
    if (shuffle) {
      tracksToPlay = shuffleArray(tracksToPlay);
    }

    setQueues((prev) =>
      prev.map((q) =>
        q.id === activeQueueId
          ? { ...q, tracks: tracksToPlay, currentIndex: 0 }
          : q
      )
    );

    playTrack(tracksToPlay[0], true);
    setActiveHub('now-playing');
  };

  const handlePlayRadio = async (station: RadioStation) => {
    try {
      const isThisPlaying = currentTrack && currentTrack.id === station.url && isPlaying;
      
      if (isThisPlaying) {
        audioEngine.pause();
        setIsPlaying(false);
        return;
      }

      // Stop any active file playing
      audioEngine.pause();
      setIsPlaying(false);

      const radioTrack: Track = {
        id: station.url,
        name: station.name,
        artist: 'שידור חי',
        album: station.frequency,
        duration: Infinity, // Indicates a live stream
        path: station.url,
        size: 0,
      };

      setCurrentTrack(radioTrack);
      setIsPlaying(true);
      setCurrentTime(0);

      await audioEngine.playStream(station.url);
    } catch (err) {
      console.error('Radio play error:', err);
      setIsPlaying(false);
      alert(lang === 'he' 
        ? 'שגיאה בהפעלת הרדיו. ייתכן שהשידור חסום בסינון האינטרנט שלכם, או שכתובת התחנה השתנתה.' 
        : 'Error playing live radio. It might be blocked by your internet filter, or the station URL has changed.');
    }
  };

  const handleAddTracks = (newTracks: Track[]) => {
    if (newTracks.length === 0) return;

    setQueues((prev) =>
      prev.map((q) => {
        if (q.id === activeQueueId) {
          const updatedTracks = [...q.tracks, ...newTracks];
          const shouldStartPlay = q.tracks.length === 0 && !isPlaying;
          return {
            ...q,
            tracks: updatedTracks,
            currentIndex: shouldStartPlay ? 0 : q.currentIndex,
          };
        }
        return q;
      })
    );

    if (activeQueue.tracks.length === 0 && !isPlaying) {
      playTrack(newTracks[0], true);
      setActiveHub('now-playing');
    }
  };

  const handleRemoveTrack = (index: number) => {
    setQueues((prev) =>
      prev.map((q) => {
        if (q.id === activeQueueId) {
          const updatedTracks = q.tracks.filter((_, idx) => idx !== index);
          let nextIndex = q.currentIndex;
          
          if (index === q.currentIndex) {
            if (updatedTracks.length === 0) {
              nextIndex = -1;
              audioEngine.pause();
              setIsPlaying(false);
              setCurrentTrack(null);
            } else {
              nextIndex = index >= updatedTracks.length ? 0 : index;
              setTimeout(() => playTrack(updatedTracks[nextIndex], true), 50);
            }
          } else if (index < q.currentIndex) {
            nextIndex = q.currentIndex - 1;
          }

          return {
            ...q,
            tracks: updatedTracks,
            currentIndex: nextIndex,
          };
        }
        return q;
      })
    );
  };

  const handleClearQueue = () => {
    audioEngine.pause();
    setIsPlaying(false);
    setCurrentTrack(null);
    setQueues((prev) =>
      prev.map((q) =>
        q.id === activeQueueId ? { ...q, tracks: [], currentIndex: -1 } : q
      )
    );
  };

  const handleShuffleQueue = () => {
    if (activeQueue.tracks.length <= 1) return;
    
    const current = activeQueue.tracks[activeQueue.currentIndex];
    const rest = activeQueue.tracks.filter((_, idx) => idx !== activeQueue.currentIndex);
    const shuffledRest = shuffleArray(rest);
    const shuffledTracks = current ? [current, ...shuffledRest] : shuffleArray(activeQueue.tracks);

    setQueues((prev) =>
      prev.map((q) =>
        q.id === activeQueueId
          ? { ...q, tracks: shuffledTracks, currentIndex: current ? 0 : q.currentIndex }
          : q
      )
    );
  };

  const handleReorderQueue = (newTracks: Track[]) => {
    let newIndex = activeQueue.currentIndex;
    if (currentTrack) {
      newIndex = newTracks.findIndex((t) => t.id === currentTrack.id);
    }

    setQueues((prev) =>
      prev.map((q) =>
        q.id === activeQueueId
          ? { ...q, tracks: newTracks, currentIndex: newIndex }
          : q
      )
    );
  };

  const handleSwitchQueue = (id: number) => {
    setActiveQueueId(id);
    const targetQueue = queues.find((q) => q.id === id) || queues[0];
    
    if (targetQueue.currentIndex >= 0 && targetQueue.tracks[targetQueue.currentIndex]) {
      const track = targetQueue.tracks[targetQueue.currentIndex];
      setCurrentTrack(track);
      if (isPlaying) {
        playTrack(track, true);
      }
    } else {
      setCurrentTrack(null);
      audioEngine.pause();
      setIsPlaying(false);
    }
  };

  const handlePlayPause = () => {
    if (!currentTrack) return;
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.play();
      setIsPlaying(true);
    }
  };

  const handleNext = (isNaturalEnd = false) => {
    if (activeQueue.tracks.length === 0) return;

    if (currentTrack) {
      if (isNaturalEnd) {
        handleTrackEnded(currentTrack.path);
      } else {
        const curTime = currentTime;
        const dur = currentTrack.duration;
        if (curTime > 2 && dur && curTime < dur * 0.85) {
          handleTrackSkipped(currentTrack.path);
        }
      }
    }

    if (sleepEndSong) {
      setSleepTimeLeft(null);
      setSleepEndSong(false);
      audioEngine.pause();
      setIsPlaying(false);
      return;
    }

    let nextIndex = activeQueue.currentIndex;

    if (repeatMode === 'one') {
      playTrack(activeQueue.tracks[nextIndex], true);
      return;
    }

    if (shuffle) {
      nextIndex = Math.floor(Math.random() * activeQueue.tracks.length);
    } else {
      nextIndex = activeQueue.currentIndex + 1;
      if (nextIndex >= activeQueue.tracks.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          setIsPlaying(false);
          audioEngine.pause();
          return;
        }
      }
    }

    setQueues((prev) =>
      prev.map((q) => (q.id === activeQueueId ? { ...q, currentIndex: nextIndex } : q))
    );
    playTrack(activeQueue.tracks[nextIndex]);
  };

  const handlePrev = () => {
    if (activeQueue.tracks.length === 0) return;

    let prevIndex = activeQueue.currentIndex - 1;
    if (prevIndex < 0) {
      if (repeatMode === 'all') {
        prevIndex = activeQueue.tracks.length - 1;
      } else {
        prevIndex = 0;
      }
    }

    setQueues((prev) =>
      prev.map((q) => (q.id === activeQueueId ? { ...q, currentIndex: prevIndex } : q))
    );
    playTrack(activeQueue.tracks[prevIndex], true);
  };

  const handleCycleRepeatMode = () => {
    const modes: RepeatMode[] = ['off', 'one', 'all', 'folder'];
    const currentIdx = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    setRepeatMode(nextMode);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    audioEngine.setVolume(vol);
    if (isMuted && vol > 0) {
      setIsMuted(false);
      audioEngine.setMute(false);
    }
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioEngine.setMute(nextMute);
  };

  const handleSpeedChange = (val: number) => {
    setSpeed(val);
    audioEngine.setSpeed(val);
  };

  const handlePitchChange = (val: number) => {
    setPitch(val);
    audioEngine.setPitch(val);
  };

  const handleSaveTags = (trackId: string, updatedFields: { name: string; artist: string; album: string; lyrics?: string }) => {
    setQueues((prev) =>
      prev.map((q) => {
        const updatedTracks = q.tracks.map((t) => {
          if (t.id === trackId) {
            return { ...t, ...updatedFields };
          }
          return t;
        });
        return { ...q, tracks: updatedTracks };
      })
    );

    if (currentTrack?.id === trackId) {
      setCurrentTrack((prev) => (prev ? { ...prev, ...updatedFields } : null));
    }

    if (rootFolder) {
      const updateNode = (node: FolderNode): FolderNode => {
        const updatedTracks = node.tracks.map((t) => {
          if (t.id === trackId) {
            return { ...t, ...updatedFields };
          }
          return t;
        });
        const updatedSubs = node.subfolders.map(updateNode);
        return { ...node, tracks: updatedTracks, subfolders: updatedSubs };
      };
      setRootFolder(updateNode(rootFolder));
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

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.items) {
      try {
        const droppedTracks = await parseDroppedItems(e.dataTransfer.items);
        if (droppedTracks.length > 0) {
          const filtered = droppedTracks.filter(
            (t) => !exclusionEnabled || t.duration === 0 || t.duration >= exclusionThreshold
          );
          if (filtered.length > 0) {
            handleAddTracks(filtered);
          }
        }
      } catch (err) {
        console.error('Error handling file drops:', err);
      }
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startSleepTimer = (minutes: number) => {
    setSleepEndSong(false);
    setSleepTimeLeft(minutes * 60);
  };

  if (isMiniPlayer) {
    return (
      <div 
        className="w-full h-screen bg-bg-app flex flex-col justify-between p-4 overflow-hidden relative select-none" 
        dir={lang === 'he' ? 'rtl' : 'ltr'}
      >
        {/* Compact Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-brand/10 blur-[60px]"></div>
        </div>

        {/* Top bar with back button */}
        <div className="w-full flex items-center justify-between z-10">
          <span className="text-[10px] text-text-muted font-bold">MiniPlayer</span>
          <button
            onClick={toggleMiniPlayer}
            className="p-1.5 rounded-lg bg-bg-card border border-border-custom hover:border-brand/40 text-[9px] font-bold text-text-secondary cursor-pointer transition-colors"
            title={lang === 'he' ? 'חזור לנגן המלא' : 'Back to Full Player'}
          >
            {lang === 'he' ? 'נגן מלא' : 'Full Player'}
          </button>
        </div>

        {/* Center: Album Cover & Track Title */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 z-10 overflow-hidden my-2">
          {currentTrack ? (
            <>
              {/* Spinning Vinyl/Cover */}
              <div className="relative w-32 h-32 rounded-full overflow-hidden shadow-xl shadow-black/40 border border-white/10 flex-shrink-0">
                {currentTrack.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt="cover"
                    className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`}
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-brand"
                    style={{
                      background: `linear-gradient(135deg,
                        hsl(${(currentTrack.name.charCodeAt(0) * 37) % 360}, 40%, 18%) 0%,
                        hsl(${(currentTrack.name.charCodeAt(0) * 37 + 60) % 360}, 30%, 10%) 100%
                      )`
                    }}
                  >
                    <Disc size={40} className={`text-white/20 ${isPlaying ? 'animate-spin-slow' : ''}`} strokeWidth={1} />
                  </div>
                )}
                {/* Center dot for vinyl aesthetic */}
                <div className="absolute inset-0 m-auto w-3.5 h-3.5 bg-bg-app rounded-full border border-black/40 shadow-inner"></div>
              </div>

              {/* Title & Artist */}
              <div className="text-center w-full px-2 overflow-hidden">
                <h4 className="text-xs font-bold text-text-primary truncate" title={currentTrack.name}>
                  {currentTrack.name}
                </h4>
                <p className="text-[10px] text-text-secondary truncate mt-0.5" title={currentTrack.artist}>
                  {currentTrack.artist}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <Disc size={36} className="text-neutral-700 animate-pulse" />
              <p className="text-[10px] text-text-muted mt-2">{lang === 'he' ? 'אין שיר מתנגן' : 'No track playing'}</p>
            </div>
          )}
        </div>

        {/* Bottom: Media Controls */}
        <div className="w-full flex items-center justify-center gap-4 z-10 bg-bg-card border border-border-custom p-2 rounded-2xl flex-shrink-0">
          <button
            onClick={handlePrev}
            disabled={!currentTrack}
            className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={handlePlayPause}
            disabled={!currentTrack}
            className="w-8 h-8 rounded-full flex items-center justify-center text-black bg-brand hover:bg-brand-bright transition-colors cursor-pointer disabled:opacity-20"
          >
            {isPlaying ? <Pause size={13} className="fill-current" /> : <Play size={13} className="fill-current ml-0.5" />}
          </button>
          <button
            onClick={() => handleNext(false)}
            disabled={!currentTrack}
            className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
          >
            <SkipForward size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="h-screen flex flex-col bg-bg-app text-text-primary select-none relative overflow-hidden transition-colors duration-200"
    >
      
      {/* Background Blurs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-brand/10 blur-[120px] animate-pulse duration-[8000ms]"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[120px] animate-pulse duration-[10000ms]"></div>
      </div>

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex flex-col items-center justify-center gap-4 border-2 border-dashed border-brand/50 m-4 rounded-3xl pointer-events-none animate-in fade-in duration-200">
          <ArrowDownToLine size={48} className="text-brand animate-bounce" />
          <h2 className="text-lg font-bold text-neutral-100">{t('dragAndDropTitle')}</h2>
          <p className="text-xs text-neutral-500 font-medium">{t('dragAndDropSub')}</p>
        </div>
      )}

      {/* Main Core Application Shell */}
      <div className="flex-1 flex overflow-hidden relative z-10" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        
        {/* Right Navigation Sidebar (Hebrew RTL native) */}
        <nav className={`w-56 bg-bg-sidebar ${lang === 'he' ? 'border-l' : 'border-r'} border-border-custom flex flex-col justify-between py-5 px-3 flex-shrink-0 transition-colors duration-200`}>
          <div className="flex flex-col gap-5">
            <div className={`flex items-center justify-between px-2 ${lang === 'he' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shadow shadow-brand/20 flex-shrink-0">
                  <Disc size={16} className={`text-black ${isPlaying ? 'animate-spin-slow' : ''}`} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[11px] font-bold text-text-primary tracking-wide truncate">
                    GoodMusic <span className="text-brand">Desktop</span>
                  </h1>
                  <p className="text-[9px] text-text-muted font-medium truncate">{t('localMusicPlayer')}</p>
                </div>
              </div>
              <button
                onClick={toggleMiniPlayer}
                className="p-1.5 rounded-lg bg-bg-card border border-border-custom hover:border-brand/40 text-text-secondary hover:text-brand transition-colors cursor-pointer flex-shrink-0"
                title={lang === 'he' ? 'עבור למצב מיני-נגן' : 'Switch to MiniPlayer'}
              >
                <Minimize2 size={12} />
              </button>
            </div>

            {/* Navigation links */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setActiveHub('now-playing')}
                className={`w-full py-2 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeHub === 'now-playing'
                    ? 'bg-brand/10 text-brand'
                    : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                }`}
              >
                <Music4 size={14} />
                <span>{t('nowPlaying')}</span>
              </button>

              <button
                onClick={() => setActiveHub('library')}
                className={`w-full py-2 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeHub === 'library'
                    ? 'bg-brand/10 text-brand'
                    : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                }`}
              >
                <FolderHeart size={14} />
                <span>{t('library')}</span>
              </button>

              <button
                onClick={() => setActiveHub('radio')}
                className={`w-full py-2 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeHub === 'radio'
                    ? 'bg-brand/10 text-brand'
                    : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                }`}
              >
                <Radio size={14} />
                <span>{t('radio')}</span>
              </button>

              <button
                onClick={() => setActiveHub('settings')}
                className={`w-full py-2 px-3 rounded-xl text-[11px] font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeHub === 'settings'
                    ? 'bg-brand/10 text-brand'
                    : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
                }`}
              >
                <Settings size={14} />
                <span>{t('settings')}</span>
              </button>
            </div>
          </div>

          {/* Sidebar Footer — Mini Player info when not on Now Playing */}
          <div className="flex flex-col gap-3 border-t border-border-custom pt-4">
            {currentTrack && activeHub !== 'now-playing' && (
              <button
                onClick={() => setActiveHub('now-playing')}
                className={`flex items-center gap-2.5 p-2 rounded-xl hover:bg-bg-card-hover transition-colors cursor-pointer group w-full ${lang === 'he' ? 'text-right' : 'text-left'}`}
                title={lang === 'he' ? 'חזור למתנגן עכשיו' : 'Back to Now Playing'}
              >
                {currentTrack.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt="cover"
                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-white/5"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-neutral-900 border border-white/5 flex items-center justify-center text-brand flex-shrink-0">
                    <Music4 size={13} />
                  </div>
                )}
                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-text-primary truncate group-hover:text-brand transition-colors" title={currentTrack.name}>
                    {currentTrack.name}
                  </p>
                  <p className="text-[9px] text-text-muted truncate mt-0.5">
                    {isPlaying ? '▶ ' + t('playingText') : '⏸ ' + t('pausedText')}
                  </p>
                </div>
              </button>
            )}
            {rootFolder ? (
              <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
                <FolderHeart size={10} className="text-brand flex-shrink-0" />
                <span className="truncate" title={rootFolder.name}>{rootFolder.name}</span>
              </div>
            ) : (
              <p className="text-[9px] text-text-muted text-center">{t('loadLibraryWarning')}</p>
            )}
          </div>
        </nav>

        {/* Central Display Area */}
        <main className="flex-1 flex flex-row min-w-0 bg-bg-main overflow-hidden relative transition-colors duration-200">
          
          {/* Global Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-bg-main/90 backdrop-blur-md z-45 flex flex-col items-center justify-center p-8 select-none text-center animate-in fade-in duration-300" dir={lang === 'he' ? 'rtl' : 'ltr'}>
              <div className="relative flex items-center justify-center w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-brand/20 animate-ping duration-1000"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-brand border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                <Music4 size={30} className="text-brand animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-text-primary mb-1.5">{t('scanningMusic')}</h3>
              <p className="text-xs text-text-secondary max-w-xs mb-4 leading-relaxed">
                {t('scanningWait')}
              </p>
              <div className="bg-bg-card border border-border-custom px-5 py-2.5 rounded-2xl flex flex-col items-center gap-1 shadow-inner min-w-[220px]">
                <div className="flex items-center gap-2">
                  <div className="scan-dot"></div>
                  <span className="text-xs font-bold text-brand">
                    {lang === 'he' 
                      ? `נסרקו ${scannedFilesCount} קבצים` 
                      : `Scanned ${scannedFilesCount} files`}
                  </span>
                </div>
                <span className="text-[10px] text-text-secondary font-semibold">
                  {lang === 'he' 
                    ? `נמצאו ${scannedCount} שירים` 
                    : `Found ${scannedCount} tracks`}
                </span>
              </div>
            </div>
          )}
          
          {/* Click-outside backdrop (active when queue is open and not pinned) */}
          {isQueueOpen && !isQueuePinned && (
            <div 
              onClick={() => setIsQueueOpen(false)}
              className="fixed inset-0 bg-black/10 z-40 transition-opacity"
            />
          )}

          {/* Floating Queue Drawer (Overlay when not pinned) */}
          <div 
            className={`absolute top-0 bottom-0 left-0 z-45 bg-bg-drawer/98 border-r border-border-custom shadow-2xl transition-all duration-300 flex flex-col overflow-hidden ${
              isQueueOpen && !isQueuePinned ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none'
            }`}
          >
            <div className="w-80 h-full p-4 flex flex-col">
              <QueueManager
                queues={queues}
                activeQueueId={activeQueueId}
                currentTrack={currentTrack}
                onSwitchQueue={handleSwitchQueue}
                onPlayTrackAtIndex={handlePlayTrackAtIndex}
                onRemoveTrack={handleRemoveTrack}
                onClearQueue={handleClearQueue}
                onShuffleQueue={handleShuffleQueue}
                onReorderQueue={handleReorderQueue}
                onRenameQueue={handleRenameQueue}
                onDuplicateQueue={handleDuplicateQueue}
                onMoveTrackToQueue={handleMoveTrackToQueue}
                onClose={() => setIsQueueOpen(false)}
                isPinned={isQueuePinned}
                onTogglePin={() => setIsQueuePinned(true)}
                lang={lang}
              />
            </div>
          </div>

          {/* Pinned Queue Panel (Static side-by-side column on the left) */}
          {isQueueOpen && isQueuePinned && (
            <div className={`w-80 h-full ${lang === 'he' ? 'border-r' : 'border-l'} border-border-custom bg-bg-drawer flex flex-col flex-shrink-0 p-4 animate-in slide-in-from-left duration-200 z-10`}>
              <QueueManager
                queues={queues}
                activeQueueId={activeQueueId}
                currentTrack={currentTrack}
                onSwitchQueue={handleSwitchQueue}
                onPlayTrackAtIndex={handlePlayTrackAtIndex}
                onRemoveTrack={handleRemoveTrack}
                onClearQueue={handleClearQueue}
                onShuffleQueue={handleShuffleQueue}
                onReorderQueue={handleReorderQueue}
                onRenameQueue={handleRenameQueue}
                onDuplicateQueue={handleDuplicateQueue}
                onMoveTrackToQueue={handleMoveTrackToQueue}
                onClose={() => setIsQueueOpen(false)}
                isPinned={isQueuePinned}
                onTogglePin={() => setIsQueuePinned(false)}
                lang={lang}
              />
            </div>
          )}

          {/* Hub Content Switcher */}
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* HUB: Now Playing */}
            {activeHub === 'now-playing' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {!currentTrack ? (
                  /* Clean onboarding — 5-second comprehension */
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20 flex items-center justify-center text-brand mb-6 shadow-xl shadow-brand/10">
                      <Music4 size={40} strokeWidth={1.5} />
                    </div>
                    <h2 className="text-lg font-bold text-text-primary">{t('musicoletDesktop')}</h2>
                    <p className="text-xs text-text-secondary mt-2 max-w-xs leading-relaxed">
                      {t('nowPlayingOnboardingSub')}
                    </p>
                    <div className="flex gap-3 mt-7">
                      <button
                        onClick={async () => {
                          try {
                            setIsScanning(true);
                            setScannedCount(0);
                            setScannedFilesCount(0);
                            const { scanDirectoryTauri, getAllTracksFromNode } = await import('./utils/fileSystem');
                            const rootNode = await scanDirectoryTauri();
                            if (rootNode) {
                              setRootFolder(rootNode);
                              const tracks = getAllTracksFromNode(rootNode);
                              setScannedCount(tracks.length);
                              if (tracks.length > 0) {
                                // Load tracks into active queue, set index to 0, but DO NOT start playing automatically
                                setQueues((prev) =>
                                  prev.map((q) =>
                                    q.id === activeQueueId
                                      ? { ...q, tracks, currentIndex: 0 }
                                      : q
                                  )
                                );
                                setCurrentTrack(tracks[0]);
                                setIsPlaying(false);
                                audioEngine.pause();
                                try {
                                  const { convertFileSrc } = await import('@tauri-apps/api/core');
                                  audioEngine.element.src = convertFileSrc(tracks[0].path);
                                  setCurrentTime(0);
                                } catch (e) {
                                  console.warn("Could not pre-load first track:", e);
                                }
                              }
                              setActiveHub('library');
                            }
                          } catch (err) {
                            console.warn(err);
                          } finally {
                            setIsScanning(false);
                          }
                        }}
                        className="px-5 py-2.5 rounded-full bg-brand hover:bg-brand-bright text-black text-xs font-bold transition-all shadow-lg shadow-brand/20 cursor-pointer"
                      >
                        {t('selectFolder')}
                      </button>
                      <button
                        onClick={() => setActiveHub('library')}
                        className="px-5 py-2.5 rounded-full bg-bg-card border border-border-custom hover:bg-bg-card-hover text-text-primary text-xs font-semibold transition-all cursor-pointer"
                      >
                        {t('library')}
                      </button>
                    </div>
                    <p className="text-[10px] text-text-muted mt-6">{lang === 'he' ? 'או גרור קבצים ישירות לחלון' : 'Or drag files directly here'}</p>
                    
                    {/* Credits Footer */}
                    <div className="mt-12 text-[10px] text-text-muted flex items-center gap-1">
                      <span>{lang === 'he' ? 'נוצר על ידי' : 'Created by'}</span>
                      {window.electronAPI ? (
                        <button
                          onClick={() => window.electronAPI.openExternal('https://lev-good.github.io/Good-heart/')}
                          className="text-brand font-bold underline hover:text-brand-bright transition-colors cursor-pointer"
                        >
                          לב טוב
                        </button>
                      ) : (
                        <a
                          href="https://lev-good.github.io/Good-heart/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand font-bold underline hover:text-brand-bright transition-colors"
                        >
                          לב טוב
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  /* OPTION A: Large cover art as primary view */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Tab bar — art is default */}
                    <div className="flex justify-center pt-5 flex-shrink-0">
                      <div className="flex bg-bg-card border border-border-custom p-1 rounded-full">
                        <button
                          onClick={() => setNowPlayingTab('vinyl')}
                          className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                            nowPlayingTab === 'vinyl'
                              ? 'bg-bg-app text-brand shadow-sm'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {lang === 'he' ? 'כריכה' : 'Cover'}
                        </button>
                        <button
                          onClick={() => setNowPlayingTab('lyrics')}
                          className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                            nowPlayingTab === 'lyrics'
                              ? 'bg-bg-app text-brand shadow-sm'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {lang === 'he' ? 'מילים' : 'Lyrics'}
                        </button>
                        <button
                          onClick={() => setNowPlayingTab('visualizer')}
                          className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                            nowPlayingTab === 'visualizer'
                              ? 'bg-bg-app text-brand shadow-sm'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {lang === 'he' ? 'ויזואלייזר' : 'Visualizer'}
                        </button>
                        <button
                          onClick={() => setNowPlayingTab('bookmarks')}
                          className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                            nowPlayingTab === 'bookmarks'
                              ? 'bg-bg-app text-brand shadow-sm'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {lang === 'he' ? 'סימניות' : 'Bookmarks'}
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center overflow-hidden">

                      {/* PRIMARY VIEW: Large album art card */}
                      {nowPlayingTab === 'vinyl' && (
                        <div className="flex flex-col items-center gap-6 px-8 animate-in fade-in zoom-in-95 duration-300 select-none w-full max-w-sm">
                          {/* Cover art — large square card */}
                          <div className="relative group w-full aspect-square max-w-[260px] rounded-2xl overflow-hidden shadow-2xl shadow-black/40 flex-shrink-0">
                            {currentTrack.coverUrl ? (
                              <img
                                src={currentTrack.coverUrl}
                                alt={lang === 'he' ? 'עטיפת אלבום' : 'Album Cover'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              /* Premium gradient placeholder — never show a plain icon */
                              <div className="w-full h-full flex flex-col items-center justify-center"
                                style={{
                                  background: `linear-gradient(135deg,
                                    hsl(${(currentTrack.name.charCodeAt(0) * 37) % 360}, 40%, 18%) 0%,
                                    hsl(${(currentTrack.name.charCodeAt(0) * 37 + 60) % 360}, 30%, 10%) 100%
                                  )`
                                }}
                              >
                                <Disc size={56} className="text-white/20" strokeWidth={1} />
                                <p className="text-white/30 text-[10px] mt-3 font-medium px-4 text-center truncate max-w-full">
                                  {currentTrack.album !== 'Unknown Album' ? currentTrack.album : currentTrack.name}
                                </p>
                              </div>
                            )}
                            {/* Edit tag hover overlay */}
                            <button
                              onClick={() => setIsTagModalOpen(true)}
                              className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
                              title={t('editTags')}
                            >
                              <Edit3 size={22} className="text-white drop-shadow-lg" />
                            </button>
                          </div>

                          {/* Track info */}
                          <div className="text-center w-full flex flex-col items-center">
                            <h2
                              className="text-base font-bold text-text-primary leading-snug px-2 line-clamp-2"
                              title={currentTrack.name}
                            >
                              {currentTrack.name}
                            </h2>
                            <p className="text-xs text-text-secondary mt-1.5 font-medium">
                              {currentTrack.artist !== 'Unknown Artist' ? currentTrack.artist : ''}
                              {currentTrack.artist !== 'Unknown Artist' && currentTrack.album !== 'Unknown Album' ? ' · ' : ''}
                              {currentTrack.album !== 'Unknown Album' ? (
                                <span className="text-text-muted">{currentTrack.album}</span>
                              ) : null}
                            </p>

                            {/* Star Rating component */}
                            {!currentTrack.id.startsWith('http') && (
                              <div className="flex items-center gap-1 mt-3.5 select-none justify-center">
                                {[1, 2, 3, 4, 5].map((starValue) => {
                                  const trackRating = getTrackRating(currentTrack.path);
                                  return (
                                    <button
                                      key={starValue}
                                      onClick={() => setTrackRating(currentTrack.path, trackRating === starValue ? 0 : starValue)}
                                      className={`p-0.5 hover:scale-125 transition-transform cursor-pointer ${
                                        starValue <= trackRating ? 'text-amber-400' : 'text-neutral-600 hover:text-neutral-400'
                                      }`}
                                      title={lang === 'he' ? `דרג ${starValue} כוכבים` : `Rate ${starValue} stars`}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                                      </svg>
                                    </button>
                                  );
                                })}
                                {getTrackPlayCount(currentTrack.path) > 0 && (
                                  <span className="text-[10px] text-text-muted font-bold ml-2 bg-neutral-900 border border-white/5 px-2 py-0.5 rounded-full">
                                    {lang === 'he' ? `הושמע: ${getTrackPlayCount(currentTrack.path)}` : `Played: ${getTrackPlayCount(currentTrack.path)}`}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Toggle quick settings button */}
                            {!currentTrack.id.startsWith('http') && (
                              <button
                                onClick={() => setShowQuickSpeed(!showQuickSpeed)}
                                className={`mt-3.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  showQuickSpeed 
                                    ? 'bg-brand/10 border-brand/30 text-brand' 
                                    : 'bg-bg-card border-border-custom text-text-secondary hover:text-text-primary hover:border-brand/30'
                                }`}
                                title={lang === 'he' ? 'הגדרות שמע מהירות' : 'Quick Audio Settings'}
                              >
                                <Gauge size={12} />
                                <span>{lang === 'he' ? 'קצב השמעה' : 'Playback Speed'}</span>
                              </button>
                            )}

                            {/* Quick Playback Speed Control in Now Playing */}
                            {!currentTrack.id.startsWith('http') && showQuickSpeed && (
                              <div className="flex flex-col items-center gap-1.5 mt-3 w-full max-w-[200px] select-none p-3 bg-bg-card border border-border-custom rounded-2xl animate-in slide-in-from-top-2 duration-250">
                                <div className="flex items-center justify-between w-full text-[10px] font-semibold text-text-secondary">
                                  <span>{t('speedLabel', { value: speed.toFixed(2) })}</span>
                                  <button
                                    onClick={() => handleSpeedChange(1.0)}
                                    className="text-[9px] text-brand hover:text-brand-bright transition-colors cursor-pointer"
                                  >
                                    {t('speedReset')}
                                  </button>
                                </div>
                                <input
                                  type="range"
                                  min="0.5"
                                  max="2.5"
                                  step="0.05"
                                  value={speed}
                                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                                  className="w-full accent-brand h-1 cursor-pointer"
                                />
                              </div>
                            )}
                            
                            {/* Path and Show in Folder button for Now Playing */}
                            {!currentTrack.id.startsWith('http') && (
                              <div className="mt-3 flex items-center gap-2 max-w-xs bg-bg-card border border-border-custom px-3 py-1.5 rounded-xl text-[9px]">
                                <span className="text-text-muted font-mono select-all truncate max-w-[200px]" dir="ltr" title={currentTrack.path}>
                                  {currentTrack.path}
                                </span>
                                {window.electronAPI && (
                                  <button
                                    onClick={() => window.electronAPI.showItemInFolder(currentTrack.path)}
                                    className="p-1 rounded hover:bg-bg-card-hover text-text-secondary hover:text-brand flex items-center justify-center transition-colors cursor-pointer"
                                    title={t('showInFolder')}
                                  >
                                    <FolderOpen size={11} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* SECONDARY VIEW: Lyrics */}
                      {nowPlayingTab === 'lyrics' && (
                        <div className="w-full h-full overflow-hidden flex flex-col justify-center animate-in fade-in duration-300">
                          <SyncedLyricsPanel track={currentTrack} currentTime={currentTime} lang={lang} />
                        </div>
                      )}

                      {/* TERTIARY VIEW: Visualizer */}
                      {nowPlayingTab === 'visualizer' && (
                        <div className="w-full max-w-xl flex flex-col items-center gap-6 select-none animate-in fade-in duration-300">
                          <Visualizer isPlaying={isPlaying} />
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('audioSpectrum')}</p>
                        </div>
                      )}

                      {/* FOURTH VIEW: Bookmarks */}
                      {nowPlayingTab === 'bookmarks' && (
                        <div className="w-full h-full max-w-sm flex flex-col p-4 animate-in fade-in duration-300 overflow-hidden" dir={lang === 'he' ? 'rtl' : 'ltr'}>
                          <h3 className="text-xs font-bold text-brand uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Bookmark size={14} className="fill-current" />
                            {lang === 'he' ? 'סימניות והערות' : 'Bookmarks & Notes'}
                          </h3>
                          
                          {/* Add Bookmark form */}
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              value={newBookmarkNote}
                              onChange={(e) => setNewBookmarkNote(e.target.value)}
                              placeholder={lang === 'he' ? 'הוסף הערה בנקודת הזמן הנוכחית...' : 'Add note at current time...'}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddBookmark(newBookmarkNote);
                                }
                              }}
                              className="flex-1 px-3 py-1.5 text-xs bg-neutral-900 border border-border-custom rounded-lg text-neutral-100 focus:outline-none focus:border-brand/40 text-right"
                            />
                            <button
                              onClick={() => handleAddBookmark(newBookmarkNote)}
                              className="px-3 py-1.5 bg-brand text-bg-app rounded-lg text-xs font-bold hover:bg-brand-bright transition-all cursor-pointer"
                            >
                              {lang === 'he' ? 'הוסף' : 'Add'}
                            </button>
                          </div>

                          {/* List of bookmarks */}
                          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5">
                            {(!bookmarks[currentTrack.path] || bookmarks[currentTrack.path].length === 0) ? (
                              <p className="text-xs text-text-secondary text-center py-8">
                                {lang === 'he' ? 'אין סימניות לשיר זה עדיין.' : 'No bookmarks for this track yet.'}
                              </p>
                            ) : (
                              bookmarks[currentTrack.path].map((b) => (
                                <div
                                  key={b.id}
                                  className="flex items-center justify-between p-2 rounded-xl bg-bg-card border border-border-custom hover:border-brand/30 transition-all group cursor-pointer"
                                  onClick={() => handleSeekToBookmark(b.timestamp)}
                                >
                                  <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                                    <span className="text-[10px] font-mono font-bold bg-brand/10 text-brand px-2 py-0.5 rounded-full flex-shrink-0">
                                      {formatTime(b.timestamp)}
                                    </span>
                                    <span className="text-xs text-text-primary truncate">{b.note}</span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteBookmark(b.id);
                                    }}
                                    className="w-6 h-6 rounded hover:bg-red-500/10 text-text-secondary hover:text-red-500 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                    title={lang === 'he' ? 'מחק סימנייה' : 'Delete bookmark'}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HUB: Library */}
            {activeHub === 'library' && (
              <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden p-6 animate-in fade-in duration-200" dir={lang === 'he' ? 'rtl' : 'ltr'}>
                {/* Smart Playlists Sidebar */}
                <div className="w-full md:w-64 flex flex-col bg-bg-card border border-border-custom rounded-2xl p-4 overflow-y-auto flex-shrink-0 gap-3">
                  <h3 className="text-xs font-bold text-brand uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Radio size={14} />
                    {lang === 'he' ? 'רשימות השמעה חכמות' : 'Smart Playlists'}
                  </h3>
                  
                  {renderSmartPlaylists()}
                </div>

                {/* Main Content (FolderBrowser or Selected Smart Playlist) */}
                <div className="flex-1 flex flex-col overflow-hidden bg-bg-card border border-border-custom rounded-2xl">
                  {selectedSmartPlaylist ? (
                    renderSmartPlaylistTracks(selectedSmartPlaylist)
                  ) : (
                    <FolderBrowser
                      onPlayTracks={handlePlayTracks}
                      onAddTracks={handleAddTracks}
                      onRootFolderLoaded={setRootFolder}
                      rootFolder={rootFolder}
                      exclusionEnabled={exclusionEnabled}
                      exclusionThreshold={exclusionThreshold}
                      onScanStart={() => {
                        setIsScanning(true);
                        setScannedCount(0);
                        setScannedFilesCount(0);
                      }}
                      onScanUpdate={(count, filesScanned) => {
                        setScannedCount(count);
                        setScannedFilesCount(filesScanned);
                      }}
                      onScanEnd={() => {
                        setIsScanning(false);
                      }}
                      lang={lang}
                    />
                  )}
                </div>
              </div>
            )}

            {/* HUB: Radio Streams */}
            {activeHub === 'radio' && (
              <div className="flex-1 flex flex-col overflow-hidden p-6 animate-in fade-in duration-200" dir={lang === 'he' ? 'rtl' : 'ltr'}>
                {/* Radio Header */}
                <div className={`border-b border-border-custom pb-3 mb-6 flex items-center gap-2 ${lang === 'he' ? 'text-right' : 'text-left'}`}>
                  <Radio className="text-brand animate-pulse" size={18} />
                  <h2 className="text-sm font-bold text-text-primary">{t('radioHeader')}</h2>
                </div>

                {/* Stations Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {RADIO_STATIONS.map((station) => {
                      const isThisPlaying = currentTrack && currentTrack.id === station.url && isPlaying;
                      return (
                        <div 
                          key={station.id}
                          className={`p-4 rounded-2xl bg-bg-card border transition-all flex items-center justify-between group ${
                            isThisPlaying ? 'border-brand/40 shadow shadow-brand/5' : 'border-border-custom hover:border-brand/20 hover:scale-101'
                          }`}
                        >
                          <div className={`flex items-center gap-3.5 overflow-hidden ${lang === 'he' ? 'text-right' : 'text-left'}`}>
                            {/* Visualizer / logo placeholder */}
                            <div className="w-12 h-12 rounded-xl bg-bg-app border border-border-custom flex items-center justify-center text-brand flex-shrink-0 relative overflow-hidden group-hover:border-brand/30 transition-colors">
                              {isThisPlaying ? (
                                <div className="flex items-end gap-0.5 h-6">
                                  <div className="w-1 bg-brand animate-bounce" style={{ animationDelay: '0.1s', height: '60%' }}></div>
                                  <div className="w-1 bg-brand animate-bounce" style={{ animationDelay: '0.3s', height: '90%' }}></div>
                                  <div className="w-1 bg-brand animate-bounce" style={{ animationDelay: '0.5s', height: '40%' }}></div>
                                </div>
                              ) : (
                                <Radio size={18} className="text-text-muted group-hover:text-brand transition-colors" />
                              )}
                            </div>
                            
                            <div className="overflow-hidden">
                              <h3 className="text-xs font-bold text-text-primary truncate">
                                {lang === 'he' ? station.name : (station.id === 'kcm' ? 'Kol Chai Music' : station.id === 'kol-chai' ? 'Radio Kol Chai' : station.id === 'kol-play' ? 'Radio Kol Play' : station.id === 'kol-barama' ? 'Radio Kol Barama' : station.id === 'geula-fm' ? 'Geula FM' : station.id === 'moreshet' ? 'Kan Moreshet' : 'JewishMusic Stream')}
                              </h3>
                              <p className="text-[10px] text-text-secondary mt-1 font-semibold">{lang === 'he' ? station.frequency : (station.frequency.includes('FM') ? station.frequency : 'Web Radio')}</p>
                              <p className="text-[9px] text-text-muted mt-0.5 truncate" title={lang === 'he' ? station.description : undefined}>
                                {lang === 'he' ? station.description : (station.id === 'kcm' ? 'Jewish & Hasidic music 24/6' : station.id === 'kol-chai' ? 'Leading Haredi talk & music station' : station.id === 'kol-play' ? 'High-quality Jewish music and programs' : station.id === 'kol-barama' ? 'Haredi talk, Torah lessons, and music' : station.id === 'geula-fm' ? 'Hasidic music, new releases and classics (may be blocked by your filter)' : station.id === 'moreshet' ? 'Jewish heritage, culture and music (may be blocked by your filter)' : 'Jewish music broadcast worldwide') }
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handlePlayRadio(station)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-md ${
                              isThisPlaying 
                                ? 'bg-brand text-black scale-105 shadow-brand/10' 
                                : 'bg-bg-app border border-border-custom hover:border-brand hover:text-brand text-text-secondary'
                            }`}
                          >
                            {isThisPlaying ? (
                              <div className="w-2.5 h-2.5 bg-black rounded-sm" />
                            ) : (
                              <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* HUB: Settings (Advanced Panel) */}
            {activeHub === 'settings' && (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-8 select-none animate-in fade-in duration-200" dir={lang === 'he' ? 'rtl' : 'ltr'}>
                
                {/* Header title */}
                <div className={`border-b border-border-custom pb-3 flex items-center gap-2 ${lang === 'he' ? 'text-right' : 'text-left'}`}>
                  <Settings className="text-brand" size={18} />
                  <h2 className="text-sm font-bold text-text-primary">{t('settingsTitle')}</h2>
                </div>

                {/* Grid Split: Equalizer & Tweaks */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  
                  {/* Part A: Equalizer panel */}
                  <div className="bg-bg-card border border-border-custom rounded-2xl p-5 shadow-sm">
                    <EqualizerPanel
                      settings={eqSettings}
                      onChange={setEqSettings}
                      lang={lang}
                    />
                  </div>

                  {/* Part B: Audio Tweaks */}
                  <div className="flex flex-col gap-6">
                    
                    {/* Theme selector (Light / Dark / System) */}
                    <div className="bg-bg-card border border-border-custom rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-border-custom pb-2">
                        <Sun size={14} className="text-text-secondary" />
                        <h3 className="text-xs font-bold text-text-primary">{t('themeSection')}</h3>
                      </div>

                      <div className="flex bg-bg-app border border-border-custom p-1 rounded-xl">
                        <button
                          onClick={() => setTheme('dark')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            theme === 'dark'
                              ? 'bg-brand text-black'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <Moon size={13} />
                          <span>{t('themeDark')}</span>
                        </button>
                        <button
                          onClick={() => setTheme('light')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            theme === 'light'
                              ? 'bg-brand text-black'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <Sun size={13} />
                          <span>{t('themeLight')}</span>
                        </button>
                        <button
                          onClick={() => setTheme('system')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            theme === 'system'
                              ? 'bg-brand text-black'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <Monitor size={13} />
                          <span>{t('themeSystem')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Language Selector */}
                    <div className="bg-bg-card border border-border-custom rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-border-custom pb-2">
                        <Languages size={14} className="text-text-secondary" />
                        <h3 className="text-xs font-bold text-text-primary">{t('languageSection')}</h3>
                      </div>

                      <div className="flex bg-bg-app border border-border-custom p-1 rounded-xl">
                        <button
                          onClick={() => setLang('he')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            lang === 'he'
                              ? 'bg-brand text-black'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <span>עברית (RTL)</span>
                        </button>
                        <button
                          onClick={() => setLang('en')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            lang === 'en'
                              ? 'bg-brand text-black'
                              : 'text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <span>English (LTR)</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Speed & Pitch */}
                    <div className="bg-bg-card border border-border-custom rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-border-custom pb-2">
                        <Gauge size={14} className="text-text-secondary" />
                        <h3 className="text-xs font-bold text-text-primary">{t('pitchSpeedSection')}</h3>
                      </div>

                      {/* Speed */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary">
                          <span>{t('speedLabel', { value: speed.toFixed(2) })}</span>
                          <button 
                            onClick={() => handleSpeedChange(1.0)} 
                            className="text-[10px] text-text-muted hover:text-brand transition-colors cursor-pointer"
                          >
                            {t('speedReset')}
                          </button>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.5"
                          step="0.05"
                          value={speed}
                          onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                          className="w-full accent-brand h-1"
                        />
                      </div>

                      {/* Pitch */}
                      <div className="flex flex-col gap-1.5 mt-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary">
                          <span>{t('pitchLabel', { value: pitch > 0 ? `+${pitch}` : pitch })}</span>
                          <button 
                            onClick={() => handlePitchChange(0)} 
                            className="text-[10px] text-text-muted hover:text-brand transition-colors cursor-pointer"
                          >
                            {t('pitchReset')}
                          </button>
                        </div>
                        <input
                          type="range"
                          min="-6"
                          max="6"
                          step="1"
                          value={pitch}
                          onChange={(e) => handlePitchChange(parseInt(e.target.value))}
                          className="w-full accent-brand h-1"
                        />
                      </div>
                    </div>

                    {/* Crossfade & Filters */}
                    <div className="bg-bg-card border border-border-custom rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-border-custom pb-2">
                        <SlidersHorizontal size={14} className="text-text-secondary" />
                        <h3 className="text-xs font-bold text-text-primary">{t('crossfadeTitle')}</h3>
                      </div>

                      {/* Crossfade slider */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary">
                          <span>{t('crossfadeDurationText')}</span>
                          <span className="text-brand font-bold">{crossfadeDuration > 0 ? t('crossfadeSeconds', { count: crossfadeDuration }) : t('crossfadeOff')}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={crossfadeDuration}
                          onChange={(e) => setCrossfadeDuration(parseInt(e.target.value))}
                          className="w-full accent-brand h-1"
                        />
                      </div>

                      {/* Short file exclusions */}
                      <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border-custom">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-text-secondary select-none">
                            <input
                              type="checkbox"
                              checked={exclusionEnabled}
                              onChange={(e) => setExclusionEnabled(e.target.checked)}
                              className="accent-brand w-3.5 h-3.5 rounded border-neutral-700 bg-neutral-800 cursor-pointer"
                            />
                            <span>{t('filterShortTracks')}</span>
                          </label>
                          {exclusionEnabled && (
                            <span className="text-[10px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                              {lang === 'he' ? `פחות מ-${exclusionThreshold} שנ'` : `less than ${exclusionThreshold}s`}
                            </span>
                          )}
                        </div>
                        
                        {exclusionEnabled && (
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="5"
                              max="120"
                              step="5"
                              value={exclusionThreshold}
                              onChange={(e) => setExclusionThreshold(parseInt(e.target.value))}
                              className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand"
                            />
                            <span className="text-[10px] font-medium text-text-muted w-6 text-left">
                              {exclusionThreshold}s
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Sound Check / Normalization toggle */}
                      <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border-custom">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-text-secondary select-none">
                            <input
                              type="checkbox"
                              checked={soundCheck}
                              onChange={(e) => setSoundCheck(e.target.checked)}
                              className="accent-brand w-3.5 h-3.5 rounded border-neutral-700 bg-neutral-800 cursor-pointer"
                            />
                            <span>{lang === 'he' ? 'נרמול עוצמה (Sound Check)' : 'Volume Normalization (Sound Check)'}</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Sleep Timer Configuration Panel */}
                    <div className="bg-bg-card border border-border-custom rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-border-custom pb-2">
                        <Clock size={14} className="text-text-secondary" />
                        <h3 className="text-xs font-bold text-text-primary">{t('sleepTimerTitle')}</h3>
                      </div>

                      <div className="flex items-center justify-between text-xs text-text-secondary">
                        <span>{t('sleepTimerStatus')}</span>
                        <span className={`font-bold ${sleepTimeLeft !== null || sleepEndSong ? 'text-brand' : 'text-text-muted'}`}>
                          {sleepTimeLeft !== null 
                            ? t('sleepTimerOffIn', { time: formatTime(sleepTimeLeft) }) 
                            : sleepEndSong 
                            ? t('sleepTimerEndSong') 
                            : t('sleepTimerInactive')}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={() => startSleepTimer(15)} 
                          className="py-2 rounded-lg bg-bg-app border border-border-custom hover:border-brand/40 text-[10px] font-bold text-text-secondary cursor-pointer transition-colors"
                        >
                          {t('sleepTimer15m')}
                        </button>
                        <button 
                          onClick={() => startSleepTimer(30)} 
                          className="py-2 rounded-lg bg-bg-app border border-border-custom hover:border-brand/40 text-[10px] font-bold text-text-secondary cursor-pointer transition-colors"
                        >
                          {t('sleepTimer30m')}
                        </button>
                        <button 
                          onClick={() => startSleepTimer(60)} 
                          className="py-2 rounded-lg bg-bg-app border border-border-custom hover:border-brand/40 text-[10px] font-bold text-text-secondary cursor-pointer transition-colors"
                        >
                          {t('sleepTimer60m')}
                        </button>
                        <button 
                          onClick={() => {
                            setSleepTimeLeft(null);
                            setSleepEndSong(!sleepEndSong);
                          }} 
                          className={`col-span-2 py-2 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors ${
                            sleepEndSong 
                              ? 'bg-brand/10 border-brand/20 text-brand' 
                              : 'bg-bg-app border border-border-custom hover:border-brand/40 text-text-secondary'
                          }`}
                        >
                          {sleepEndSong ? t('sleepTimerEndSongBtnActive') : t('sleepTimerEndSongBtn')}
                        </button>
                        {(sleepTimeLeft !== null || sleepEndSong) && (
                          <button 
                            onClick={() => {
                              setSleepTimeLeft(null);
                              setSleepEndSong(false);
                            }} 
                            className="py-2 rounded-lg bg-red-950/20 border border-red-900/10 hover:bg-red-900/10 text-[10px] font-bold text-red-400 cursor-pointer transition-colors"
                          >
                            {t('sleepTimerCancelBtn')}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Backup & Restore Settings Card */}
                    <div className="bg-bg-card border border-border-custom rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-border-custom pb-2">
                        <ArrowDownToLine size={14} className="text-text-secondary" />
                        <h3 className="text-xs font-bold text-text-primary">{lang === 'he' ? 'גיבוי ושחזור הגדרות נגן' : 'Settings Backup & Restore'}</h3>
                      </div>
                      <div className={`text-xs text-text-secondary leading-relaxed ${lang === 'he' ? 'text-right' : 'text-left'} flex flex-col gap-3`}>
                        <p>
                          {lang === 'he' 
                            ? 'תוכל לייצא את כל 20 התורים, שמותיהם, דירוגי השירים והסימניות לקובץ גיבוי אחד, או לשחזר אותם מקובץ קיים.' 
                            : 'You can export all 20 queues, their names, song ratings, and bookmarks to a single backup file, or restore them.'}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleExportAllSettings}
                            className="flex-1 py-2 rounded-lg bg-bg-app border border-border-custom hover:border-brand/40 text-[10px] font-bold text-text-primary hover:text-brand cursor-pointer transition-colors"
                          >
                            {lang === 'he' ? 'גיבוי מלא' : 'Full Backup'}
                          </button>
                          <button
                            onClick={handleImportAllSettings}
                            className="flex-1 py-2 rounded-lg bg-bg-app border border-border-custom hover:border-brand/40 text-[10px] font-bold text-text-primary hover:text-brand cursor-pointer transition-colors"
                          >
                            {lang === 'he' ? 'שחזור מלא' : 'Full Restore'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Credits & About (Lev Tov Credits) */}
                    <div className="bg-bg-card border border-border-custom rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-border-custom pb-2">
                        <Heart size={14} className="text-red-500 fill-red-500/10" />
                        <h3 className="text-xs font-bold text-text-primary">{t('creditsSection')}</h3>
                      </div>
                      <div className={`text-xs text-text-secondary leading-relaxed ${lang === 'he' ? 'text-right' : 'text-left'}`}>
                        <p>{t('creditsCreatedBy')}</p>
                        {window.electronAPI ? (
                          <button
                            onClick={() => window.electronAPI.openExternal('https://lev-good.github.io/Good-heart/')}
                            className="text-brand font-bold underline hover:text-brand-bright transition-colors cursor-pointer mt-1 text-left block"
                            dir="ltr"
                          >
                            https://lev-good.github.io/Good-heart/
                          </button>
                        ) : (
                          <a
                            href="https://lev-good.github.io/Good-heart/"
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand font-bold underline hover:text-brand-bright transition-colors mt-1 text-left block"
                            dir="ltr"
                          >
                            https://lev-good.github.io/Good-heart/
                          </a>
                        )}
                      </div>
                    </div>

                    {/* System Information */}
                    <div className={`bg-[#0b0c10]/20 border border-border-custom rounded-2xl p-4 text-[10px] text-text-muted leading-relaxed ${lang === 'he' ? 'text-right' : 'text-left'}`}>
                      <div className="flex items-center gap-1.5 font-bold text-text-secondary mb-1.5">
                        <Info size={11} />
                        <span>{t('systemInfoTitle')}</span>
                      </div>
                      <p>{t('systemInfoText1')}</p>
                      <p>{t('systemInfoText2')}</p>
                      <p>{t('systemInfoText3')}</p>
                    </div>

                  </div>
                </div>

              </div>
            )}

          </div>

        </main>
      </div>

      {/* Footer controls bar */}
      <footer className="px-6 py-3.5 border-t border-border-custom bg-bg-sidebar relative z-15 flex flex-col gap-2 transition-colors duration-200">
        <PlayerControls
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          shuffle={shuffle}
          repeatMode={repeatMode}
          volume={volume}
          isMuted={isMuted}
          isQueueOpen={isQueueOpen}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrev={handlePrev}
          onToggleShuffle={() => setShuffle(!shuffle)}
          onCycleRepeatMode={handleCycleRepeatMode}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
          onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
          lang={lang}
        />
      </footer>

      {/* Metadata ID3 Tag Editor Modal */}
      {currentTrack && (
        <TagEditorModal
          track={currentTrack}
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          onSave={handleSaveTags}
          lang={lang}
        />
      )}
    </div>
  );
}

function updateTrackInTree(node: FolderNode, trackId: string, updates: Partial<Track>): FolderNode {
  const updatedTracks = node.tracks.map((t) =>
    t.id === trackId ? { ...t, ...updates } : t
  );
  const updatedSubfolders = node.subfolders.map((sub) =>
    updateTrackInTree(sub, trackId, updates)
  );
  return {
    ...node,
    tracks: updatedTracks,
    subfolders: updatedSubfolders,
  };
}

