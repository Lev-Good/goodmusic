import React, { useState } from 'react';
import type { EQSettings } from '../types/player';
import { AudioEngine } from '../utils/audioEngine';
import { Sliders } from 'lucide-react';

interface EqualizerPanelProps {
  settings: EQSettings;
  onChange: (newSettings: EQSettings) => void;
  lang?: 'he' | 'en';
}

const PRESETS: Record<string, number[]> = {
  'שטוח (Flat)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'רוק (Rock)': [4, 3, 2, -2, -3, -1, 2, 4, 5, 5],
  'פופ (Pop)': [-1, 2, 3, 4, 2, -1, -2, -2, -1, 0],
  'ג\'אז (Jazz)': [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  'קלאסי (Classical)': [3, 2, 2, 2, 0, 0, -1, -2, -2, -3],
  'מגביר באס (Bass)': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'מגביר קול (Vocal)': [-3, -3, -2, 0, 2, 4, 4, 3, 1, -1],
};

const BANDS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

export const EqualizerPanel: React.FC<EqualizerPanelProps> = ({ settings, onChange, lang = 'he' }) => {
  const [activePreset, setActivePreset] = useState<string>('שטוח (Flat)');
  const audioEngine = AudioEngine.getInstance();

  const getPresetDisplayName = (name: string) => {
    if (lang === 'en') {
      if (name === 'שטוח (Flat)') return 'Flat';
      if (name === 'רוק (Rock)') return 'Rock';
      if (name === 'פופ (Pop)') return 'Pop';
      if (name === 'ג\'אז (Jazz)') return 'Jazz';
      if (name === 'קלאסי (Classical)') return 'Classical';
      if (name === 'מגביר באס (Bass)') return 'Bass Boost';
      if (name === 'מגביר קול (Vocal)') return 'Vocal Boost';
      if (name === 'מותאם אישית (Custom)') return 'Custom';
    }
    return name;
  };

  const handleToggle = () => {
    const nextEnabled = !settings.enabled;
    audioEngine.setEQEnabled(nextEnabled);
    onChange({ ...settings, enabled: nextEnabled });
  };

  const handleBandChange = (index: number, val: number) => {
    const newBands = [...settings.bands];
    newBands[index] = val;
    audioEngine.setEQBand(index, val);
    setActivePreset('מותאם אישית (Custom)');
    onChange({ ...settings, bands: newBands });
  };

  const handlePreampChange = (val: number) => {
    audioEngine.setPreamp(val);
    onChange({ ...settings, preamp: val });
  };

  const handleBassChange = (val: number) => {
    audioEngine.setBassBoost(val);
    onChange({ ...settings, bassBoost: val });
  };

  const handleTrebleChange = (val: number) => {
    audioEngine.setTrebleBoost(val);
    onChange({ ...settings, trebleBoost: val });
  };

  const selectPreset = (presetName: string) => {
    setActivePreset(presetName);
    const bands = PRESETS[presetName];
    if (bands) {
      const newBands = [...bands];
      newBands.forEach((db, i) => audioEngine.setEQBand(i, db));
      let bassVal = settings.bassBoost;
      if (presetName === 'מגביר באס (Bass)') {
        bassVal = 70;
        audioEngine.setBassBoost(70);
      }
      onChange({
        ...settings,
        bands: newBands,
        bassBoost: bassVal,
      });
    }
  };

  return (
    <div className="h-full flex flex-col gap-4" style={{ textAlign: lang === 'he' ? 'right' : 'left' }} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      
      {/* Title & Enable Switch */}
      <div className="flex items-center justify-between pb-2 border-b border-border-custom">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-text-secondary" />
          <h2 className="text-sm font-bold text-text-primary tracking-wide">
            {lang === 'he' ? 'אקולייזר מרובה ערוצים' : 'Multi-band Equalizer'}
          </h2>
        </div>
        
        {/* Toggle Switch */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className={`text-xs font-semibold ${settings.enabled ? 'text-brand' : 'text-text-muted'}`}>
            {settings.enabled ? (lang === 'he' ? 'פעיל' : 'Active') : (lang === 'he' ? 'כבוי' : 'Off')}
          </span>
          <div 
            onClick={handleToggle}
            className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${
              settings.enabled ? 'bg-brand' : 'bg-bg-app border border-border-custom'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all shadow ${
              settings.enabled ? (lang === 'he' ? 'right-[18px]' : 'left-[18px]') : (lang === 'he' ? 'right-0.5' : 'left-0.5')
            }`} />
          </div>
        </label>
      </div>

      {/* Preset Badges (Horizontally scrollable list) */}
      <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
        {Object.keys(PRESETS).map((p) => (
          <button
            key={p}
            onClick={() => selectPreset(p)}
            disabled={!settings.enabled}
            className={`px-3 py-1 rounded-full text-[10px] font-bold white-space-nowrap border transition-all cursor-pointer ${
              activePreset === p
                ? 'bg-brand/10 border-brand/40 text-brand'
                : 'bg-bg-app border-border-custom text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-default'
            }`}
          >
            {getPresetDisplayName(p)}
          </button>
        ))}
      </div>

      {/* 10-Band EQ Faders */}
      <div className={`flex justify-between items-stretch flex-1 py-4 gap-1 select-none transition-opacity duration-300 ${
        settings.enabled ? 'opacity-100' : 'opacity-35 pointer-events-none'
      }`}>
        {BANDS.map((label, idx) => (
          <div key={label} className="flex flex-col items-center flex-1 relative gap-2">
            
            {/* Value indicator */}
            <span className="text-[9px] font-bold text-text-muted w-8 text-center">
              {settings.bands[idx] > 0 ? `+${settings.bands[idx]}` : settings.bands[idx]}
            </span>
            
            {/* Center Zero Tick Line */}
            <div className="absolute top-[38px] bottom-[38px] w-[1px] bg-border-custom pointer-events-none" />
            
            {/* Vertical input range */}
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={settings.bands[idx]}
              onChange={(e) => handleBandChange(idx, parseInt(e.target.value))}
              className="eq-slider-input"
            />
            
            {/* Band frequency label */}
            <span className="text-[9px] font-bold text-text-secondary">{label}</span>
          </div>
        ))}
      </div>

      {/* Auxiliary Channels (Preamp, Bass, Treble) */}
      <div className={`grid grid-cols-3 gap-4 border-t border-border-custom pt-4 transition-opacity duration-300 ${
        settings.enabled ? 'opacity-100' : 'opacity-35 pointer-events-none'
      }`}>
        
        {/* Preamp Channel */}
        <div className="flex flex-col gap-2 items-center text-center">
          <span className="text-[10px] font-bold text-text-secondary">
            {lang === 'he' ? 'הגבר ראשוני' : 'Preamp'}
          </span>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={settings.preamp}
            onChange={(e) => handlePreampChange(parseFloat(e.target.value))}
            className="w-[90%] accent-brand h-1 bg-bg-input rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-[10px] font-bold text-text-primary">
            {settings.preamp > 0 ? `+${settings.preamp}` : settings.preamp} dB
          </span>
        </div>

        {/* Bass Channel */}
        <div className="flex flex-col gap-2 items-center text-center">
          <span className="text-[10px] font-bold text-text-secondary">
            {lang === 'he' ? 'עוצמת בס' : 'Bass Boost'}
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.bassBoost}
            onChange={(e) => handleBassChange(parseInt(e.target.value))}
            className="w-[90%] accent-brand h-1 bg-bg-input rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-[10px] font-bold text-brand">
            {settings.bassBoost}%
          </span>
        </div>

        {/* Treble Channel */}
        <div className="flex flex-col gap-2 items-center text-center">
          <span className="text-[10px] font-bold text-text-secondary">
            {lang === 'he' ? 'עוצמת טרבל' : 'Treble Boost'}
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.trebleBoost}
            onChange={(e) => handleTrebleChange(parseInt(e.target.value))}
            className="w-[90%] accent-brand h-1 bg-bg-input rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-[10px] font-bold text-brand">
            {settings.trebleBoost}%
          </span>
        </div>
      </div>
    </div>
  );
};
