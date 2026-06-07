import React, { useState, useEffect, useRef } from 'react';
import type { Track } from '../types/player';
import { AlignCenter, MessageSquareDashed } from 'lucide-react';

interface SyncedLyricsPanelProps {
  track: Track | null;
  currentTime: number;
  lang?: 'he' | 'en';
}

interface LrcLine {
  time: number; // in seconds
  text: string;
}

export const SyncedLyricsPanel: React.FC<SyncedLyricsPanelProps> = ({ track, currentTime, lang = 'he' }) => {
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const SyncedLyricsTranslations = {
    he: {
      selectTrack: 'בחר שיר להשמעה',
      lyricsWillAppear: 'מילים מסונכרנות יוצגו כאן.',
      loadingLyrics: 'טוען מילים...',
      noLyrics: 'אין מילים מסונכרנות זמינות',
      placeLrcFile: 'הנח קובץ מילים מסונכרנות (`.lrc`) באותו השם ובאותה התיקייה ליד קובץ המוזיקה.',
    },
    en: {
      selectTrack: 'Select track to play',
      lyricsWillAppear: 'Synced lyrics will be displayed here.',
      loadingLyrics: 'Loading lyrics...',
      noLyrics: 'No synced lyrics available',
      placeLrcFile: 'Place a synced lyrics file (`.lrc`) with the same name in the same folder next to the music file.',
    }
  };

  const localT = (key: keyof typeof SyncedLyricsTranslations.he) => {
    return SyncedLyricsTranslations[lang][key];
  };

  // Load and parse LRC file on track change
  useEffect(() => {
    if (!track) {
      setLrcLines([]);
      return;
    }

    const loadLrc = async () => {
      try {
        setLoading(true);
        let absolutePath = '';
        if (track.file) {
          absolutePath = (track.file as any).path;
        } else if (track.fileHandle) {
          const fileObj = await track.fileHandle.getFile();
          absolutePath = (fileObj as any).path;
        }

        if (!absolutePath) {
          setLrcLines([]);
          return;
        }

        const res = await (window as any).electronAPI.readLrc(absolutePath);
        if (res.success && res.content) {
          parseLrc(res.content);
        } else {
          setLrcLines([]);
        }
      } catch (e) {
        console.error('Failed to load LRC file:', e);
        setLrcLines([]);
      } finally {
        setLoading(false);
      }
    };

    loadLrc();
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
    if (activeIndex === -1 || !containerRef.current) return;
    const activeEl = containerRef.current.querySelector(`.lrc-line-${activeIndex}`);
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

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
      <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-2.5 text-text-muted select-none">
        <MessageSquareDashed size={24} className="opacity-50" />
        <span className="text-xs font-bold text-text-primary">{localT('noLyrics')}</span>
        <p className="text-[10px] text-text-secondary max-w-[200px] leading-relaxed">
          {localT('placeLrcFile')}
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="flex-1 w-full overflow-y-auto lyrics-mask custom-scrollbar flex flex-col items-center py-[100px] px-4 gap-6 scroll-smooth select-none"
    >
      {lrcLines.map((line, idx) => {
        const isActive = idx === activeIndex;
        return (
          <div
            key={idx}
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
  );
};
