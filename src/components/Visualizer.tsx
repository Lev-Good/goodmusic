import React, { useRef, useEffect } from 'react';
import { AudioEngine } from '../utils/audioEngine';

interface VisualizerProps {
  isPlaying: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioEngine = AudioEngine.getInstance();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Adjust canvas resolution
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 300;
      canvas.height = 100;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      const dataArray = audioEngine.getAnalyserData();
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (!dataArray || !isPlaying) {
        // Draw idle line
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = dataArray.length;
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      // Glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f0ff';

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2.8;

        // Gradient for bars
        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0.1)');
        grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.6)');
        grad.addColorStop(1, 'rgba(255, 87, 34, 0.9)'); // Fade into primary orange at tips

        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

        x += barWidth;
      }

      // Reset shadow for performance
      ctx.shadowBlur = 0;

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div style={{ width: '100%', padding: '0 4px' }}>
      <canvas ref={canvasRef} style={{ display: 'block', borderRadius: '8px' }} />
    </div>
  );
};
