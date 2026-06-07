import React, { useState, useEffect, useCallback } from 'react';
import type { Track, RepeatMode } from '../types/player';
import { AudioEngine } from '../utils/audioEngine';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Shuffle, 
  Repeat, 
  Repeat1,
  Volume2, 
  VolumeX, 
  Volume1,
  ListMusic,
  Music
} from 'lucide-react';

interface PlayerControlsProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  volume: number;
  isMuted: boolean;
  isQueueOpen: boolean;
  onPlayPause: () => void;
  onNext: (isNaturalEnd?: boolean) => void;
  onPrev: () => void;
  onToggleShuffle: () => void;
  onCycleRepeatMode: () => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleQueue: () => void;
  lang?: 'he' | 'en';
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  currentTrack,
  isPlaying,
  shuffle,
  repeatMode,
  volume,
  isMuted,
  isQueueOpen,
  onPlayPause,
  onNext,
  onPrev,
  onToggleShuffle,
  onCycleRepeatMode,
  onVolumeChange,
  onToggleMute,
  onToggleQueue,
  lang = 'he',
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioEngine = AudioEngine.getInstance();

  const PlayerControlsTranslations = {
    he: {
      repeatOff: 'חזרה: כבוי',
      repeatOne: 'חזרה: שיר אחד',
      repeatAll: 'חזרה: הכל',
      repeatFolder: 'חזרה: תיקייה',
      notPlaying: 'לא מנוגן שיר',
      shuffleTitle: 'ערבב שירים',
      prevTitle: 'השיר הקודם (חץ שמאלה)',
      nextTitle: 'השיר הבא (חץ ימינה)',
      playTitle: 'נגן (Space)',
      pauseTitle: 'השהה (Space)',
      liveStream: 'שידור חי',
      queueTitle: 'תור השמעה',
      unmute: 'בטל השתקה',
      mute: 'השתק',
      volumeLabel: 'עוצמת קול: {val}%',
    },
    en: {
      repeatOff: 'Repeat: Off',
      repeatOne: 'Repeat: One Song',
      repeatAll: 'Repeat: All Songs',
      repeatFolder: 'Repeat: Folder',
      notPlaying: 'No track playing',
      shuffleTitle: 'Shuffle Songs',
      prevTitle: 'Previous Track (Arrow Left)',
      nextTitle: 'Next Track (Arrow Right)',
      playTitle: 'Play (Space)',
      pauseTitle: 'Pause (Space)',
      liveStream: 'Live Stream',
      queueTitle: 'Playback Queue',
      unmute: 'Unmute',
      mute: 'Mute',
      volumeLabel: 'Volume: {val}%',
    }
  };

  const localT = (key: keyof typeof PlayerControlsTranslations.he, params?: Record<string, string | number>) => {
    const activeLang = lang || 'he';
    let text = PlayerControlsTranslations[activeLang][key];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  // Keyboard shortcut handler — global window listener
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    // Don't intercept when user is typing in an input
    if (tag === 'input' || tag === 'textarea') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        onPlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (e.ctrlKey) {
          audioEngine.seek(Math.max(0, audioEngine.element.currentTime - 5));
        } else {
          onPrev();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (e.ctrlKey) {
          audioEngine.seek(Math.min(
            audioEngine.element.duration || 0,
            audioEngine.element.currentTime + 5
          ));
        } else {
          onNext();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        onVolumeChange(Math.min(1, volume + 0.05));
        break;
      case 'ArrowDown':
        e.preventDefault();
        onVolumeChange(Math.max(0, volume - 0.05));
        break;
    }
  }, [onPlayPause, onVolumeChange, volume, audioEngine, onNext, onPrev]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Audio element event listeners
  useEffect(() => {
    const elA = audioEngine.elementA;
    const elB = audioEngine.elementB;

    const handleTimeUpdate = () => {
      setCurrentTime(audioEngine.element.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audioEngine.element.duration);
    };

    const handleEnded = () => {
      onNext(true);
    };

    elA.addEventListener('timeupdate', handleTimeUpdate);
    elB.addEventListener('timeupdate', handleTimeUpdate);
    elA.addEventListener('loadedmetadata', handleLoadedMetadata);
    elB.addEventListener('loadedmetadata', handleLoadedMetadata);
    elA.addEventListener('ended', handleEnded);
    elB.addEventListener('ended', handleEnded);

    if (audioEngine.element.duration) {
      setDuration(audioEngine.element.duration);
    }

    return () => {
      elA.removeEventListener('timeupdate', handleTimeUpdate);
      elB.removeEventListener('timeupdate', handleTimeUpdate);
      elA.removeEventListener('loadedmetadata', handleLoadedMetadata);
      elB.removeEventListener('loadedmetadata', handleLoadedMetadata);
      elA.removeEventListener('ended', handleEnded);
      elB.removeEventListener('ended', handleEnded);
    };
  }, [onNext]);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    audioEngine.seek(time);
    setCurrentTime(time);
  };

  // Computed percentages for CSS fill gradients
  const seekPct = duration > 0 ? `${((currentTime / duration) * 100).toFixed(1)}%` : '0%';
  const volPct = `${((isMuted ? 0 : volume) * 100).toFixed(0)}%`;

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
  const repeatTitle =
    repeatMode === 'off' ? localT('repeatOff') :
    repeatMode === 'one' ? localT('repeatOne') :
    repeatMode === 'all' ? localT('repeatAll') :
    localT('repeatFolder');

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.4 ? Volume1 : Volume2;

  return (
    <div className="flex items-center justify-between gap-6 w-full" dir={lang === 'he' ? 'rtl' : 'ltr'}>

      {/* Track Info — Right side in RTL */}
      <div className="w-[28%] flex items-center gap-3 overflow-hidden select-none min-w-0">
        {currentTrack ? (
          <>
            {currentTrack.coverUrl ? (
              <img
                src={currentTrack.coverUrl}
                alt={lang === 'he' ? "כריכת אלבום" : "Album Cover"}
                className="w-10 h-10 rounded-lg object-cover border border-white/5 shadow-sm flex-shrink-0"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/5 flex items-center justify-center text-brand flex-shrink-0">
                <Music size={15} />
              </div>
            )}
            <div className={`overflow-hidden min-w-0 ${lang === 'he' ? 'text-right' : 'text-left'}`}>
              <h4
                className="text-xs font-semibold text-text-primary truncate leading-snug"
                title={currentTrack.name}
              >
                {currentTrack.name}
              </h4>
              <p className="text-[10px] text-text-secondary truncate mt-0.5 leading-snug" title={currentTrack.artist}>
                {currentTrack.artist}
              </p>
            </div>
          </>
        ) : (
          <span className="text-[11px] text-text-muted font-medium">{localT('notPlaying')}</span>
        )}
      </div>

      {/* Center — Controls + Seeker */}
      <div className="flex-1 max-w-2xl flex flex-col gap-2.5 items-center select-none">

        {/* Playback buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleShuffle}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              shuffle ? 'text-brand' : 'text-neutral-500 hover:text-neutral-300'
            }`}
            title={localT('shuffleTitle')}
          >
            <Shuffle size={14} />
          </button>

          <button
            onClick={onPrev}
            disabled={!currentTrack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white disabled:opacity-25 transition-colors cursor-pointer"
            title={localT('prevTitle')}
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={onPlayPause}
            disabled={!currentTrack}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-black bg-brand hover:bg-brand-bright transition-all shadow-lg shadow-brand/20 cursor-pointer disabled:opacity-40`}
            title={isPlaying ? localT('pauseTitle') : localT('playTitle')}
          >
            {isPlaying
              ? <Pause size={18} className="fill-current" />
              : <Play size={18} className="fill-current mr-0.5" />
            }
          </button>

          <button
            onClick={() => onNext(false)}
            disabled={!currentTrack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white disabled:opacity-25 transition-colors cursor-pointer"
            title={localT('nextTitle')}
          >
            <SkipForward size={16} />
          </button>

          <button
            onClick={onCycleRepeatMode}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer relative ${
              repeatMode !== 'off' ? 'text-brand' : 'text-neutral-500 hover:text-neutral-300'
            }`}
            title={repeatTitle}
          >
            <RepeatIcon size={14} />
            {repeatMode === 'folder' && (
              <span className="absolute -bottom-1 -right-1 text-[8px] font-bold text-brand bg-brand/10 px-1 rounded-full leading-none py-px">
                F
              </span>
            )}
          </button>
        </div>

        {/* Seek bar with fill */}
        <div className="w-full flex items-center gap-3">
          {!isFinite(duration) ? (
            <div className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-brand/5 border border-brand/10 rounded-xl text-brand text-[10px] font-bold tracking-wider select-none animate-in fade-in duration-200">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
              <span>{localT('liveStream')}</span>
            </div>
          ) : (
            <>
              <span className="text-[10px] font-medium text-neutral-500 w-8 text-center tabular-nums flex-shrink-0">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                disabled={!currentTrack}
                className="seek-bar flex-1 disabled:opacity-30"
                style={{ '--seek-pct': seekPct } as React.CSSProperties}
                title={`${formatTime(currentTime)} / ${formatTime(duration)}`}
              />
              <span className="text-[10px] font-medium text-neutral-500 w-8 text-center tabular-nums flex-shrink-0">
                {formatTime(duration)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right controls — Volume + Queue (Left side in LTR = right panel) */}
      <div className="w-[28%] flex items-center justify-start gap-4 select-none">

        {/* Queue toggle */}
        <button
          onClick={onToggleQueue}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            isQueueOpen
              ? 'text-brand bg-brand/10'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
          title={localT('queueTitle')}
        >
          <ListMusic size={15} />
        </button>

        {/* Volume */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onToggleMute}
            className="text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer flex-shrink-0"
            title={isMuted ? localT('unmute') : localT('mute')}
          >
            <VolumeIcon size={14} className={isMuted ? 'text-red-400' : ''} />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="volume-bar flex-1 min-w-[64px]"
            style={{ '--vol-pct': volPct } as React.CSSProperties}
            title={localT('volumeLabel', { val: Math.round((isMuted ? 0 : volume) * 100) })}
          />
        </div>
      </div>
    </div>
  );
};
