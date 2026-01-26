import React, { useState, useEffect, useRef } from 'react';

export interface ActionConfig {
  startFrame: number;
  endFrame: number;
  fps: number;
  loop: boolean;
}

interface SpritePetProps {
  imageUrl: string;
  status: string;
  frameWidth: number;
  frameHeight: number;
  actionMap?: Record<string, ActionConfig>;
}

const DEFAULT_ACTION_MAP: Record<string, ActionConfig> = {
  IDLE: { startFrame: 0, endFrame: 3, fps: 6, loop: true },
  WORKING: { startFrame: 4, endFrame: 7, fps: 12, loop: true },
  THINKING: { startFrame: 8, endFrame: 11, fps: 10, loop: true },
  SUCCESS: { startFrame: 12, endFrame: 15, fps: 15, loop: false },
};

const SpritePet: React.FC<SpritePetProps> = ({ 
  imageUrl, 
  status, 
  frameWidth, 
  frameHeight, 
  actionMap = DEFAULT_ACTION_MAP 
}) => {
  const config = actionMap[status] || actionMap['IDLE'];
  const [currentFrame, setCurrentFrame] = useState(config.startFrame);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setCurrentFrame(config.startFrame);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      setCurrentFrame(prev => {
        if (prev >= config.endFrame) {
          return config.loop ? config.startFrame : config.endFrame;
        }
        return prev + 1;
      });
    }, 1000 / config.fps);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, config]);

  return (
    <div
      style={{
        width: `${frameWidth}px`,
        height: `${frameHeight}px`,
        backgroundImage: `url(${imageUrl})`,
        backgroundPosition: `-${currentFrame * frameWidth}px 0px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        transition: 'background-position 0.05s steps(1)',
      }}
    />
  );
};

export default SpritePet;
