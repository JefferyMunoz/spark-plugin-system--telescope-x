import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWatcher } from '../../hooks/useWatcher';
import SpritePet from './SpritePet';
import { ImageProcessor } from '../../lib/ImageProcessor';
import { Ghost, Sparkles, MessageCircle, Zap } from 'lucide-react';

const { ipcRenderer } = (window as any).require('electron');

const PetView: React.FC = () => {
  const status = useWatcher();
  const [isHovered, setIsHovered] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  
  const isDragging = useRef(false);
  const [currentAction, setCurrentAction] = useState('IDLE');
  const lastPos = useRef({ x: 0, y: 0 });
  const [dragRotation, setDragRotation] = useState(0);

  const [activePet, setActivePet] = useState(() => {
    const saved = localStorage.getItem('active_pet');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (isDragging.current) {
      setCurrentAction('GRAB');
    } else {
      setCurrentAction(status === 'WORKING' ? 'THINKING' : status === 'FINISHED' ? 'SUCCESS' : 'IDLE');
    }
  }, [status]);

  useEffect(() => {
    if (activePet?.imageUrl) {
      ImageProcessor.removeMagenta(activePet.imageUrl).then(setProcessedImage);
    } else {
      setProcessedImage(null);
    }
  }, [activePet]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.screenX - lastPos.current.x;
      const dy = e.screenY - lastPos.current.y;
      ipcRenderer.send('pet-move-relative', { dx, dy });
      setDragRotation(dx * 2);
      lastPos.current = { x: e.screenX, y: e.screenY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      setCurrentAction(status === 'WORKING' ? 'THINKING' : status === 'FINISHED' ? 'SUCCESS' : 'IDLE');
      setDragRotation(0);
      ipcRenderer.send('pet-ignore-mouse', true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [status]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    setCurrentAction('GRAB');
    lastPos.current = { x: e.screenX, y: e.screenY };
    ipcRenderer.send('pet-ignore-mouse', false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm('是否隐藏宠物？')) {
      ipcRenderer.send('pet-close');
    }
  };

  return (
    <div 
      className="w-full h-full flex items-center justify-center select-none relative"
      onMouseEnter={() => { setIsHovered(true); ipcRenderer.send('pet-ignore-mouse', false); }}
      onMouseLeave={() => { if (!isDragging.current) { setIsHovered(false); ipcRenderer.send('pet-ignore-mouse', true); } }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{ width: '200px', height: '200px', cursor: isDragging.current ? 'grabbing' : 'grab' }}
    >
      <AnimatePresence>
        {currentAction === 'THINKING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  y: [-20, -100],
                  x: Math.sin(i) * 30,
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeOut"
                }}
                className="absolute left-1/2 top-1/2 w-1 h-1 bg-blue-400 rounded-full blur-[1px]"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentAction}-${activePet?.id || 'default'}`}
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ 
            scale: isDragging.current ? 1.1 : 1, 
            opacity: 1,
            y: 0,
            rotate: dragRotation,
            transition: { type: 'spring', stiffness: 400, damping: 15 }
          }}
          exit={{ scale: 0, opacity: 0, y: -20 }}
          className="relative"
        >
          {processedImage ? (
            <SpritePet 
              imageUrl={processedImage} 
              status={currentAction} 
              frameWidth={100} 
              frameHeight={100} 
            />
          ) : (
            <div className={`relative p-6 bg-white/90 backdrop-blur-2xl border-2 rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.2)] transition-all duration-500 ${
              currentAction === 'SUCCESS' ? 'border-emerald-200 bg-emerald-50/50' : 
              currentAction === 'THINKING' ? 'border-blue-200 bg-blue-50/30' :
              currentAction === 'GRAB' ? 'border-zinc-400 scale-105 rotate-3' :
              'border-zinc-100'
            }`}>
              <div className="relative">
                <Ghost 
                  size={56} 
                  className={`transition-colors duration-500 ${
                    currentAction === 'THINKING' ? 'text-blue-500' : 
                    currentAction === 'SUCCESS' ? 'text-emerald-500' : 
                    currentAction === 'GRAB' ? 'text-zinc-600' : 'text-zinc-400'
                  }`} 
                  strokeWidth={1.5} 
                />
                
                <motion.div 
                  animate={{ 
                    y: isDragging.current ? -10 : [0, -6, 0],
                    scale: isDragging.current ? 1.2 : 1
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-3 -right-3 text-2xl"
                >
                  {currentAction === 'THINKING' ? '💭' : currentAction === 'SUCCESS' ? '✨' : currentAction === 'GRAB' ? '✊' : '💤'}
                </motion.div>
              </div>
              
              {(currentAction === 'THINKING' || currentAction === 'GRAB') && (
                <div className={`absolute inset-[-6px] border-2 rounded-[38px] opacity-30 ${
                  currentAction === 'THINKING' ? 'border-blue-500 animate-pulse' : 'border-zinc-400 border-dashed'
                }`} />
              )}
            </div>
          )}

          {isHovered && !isDragging.current && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-black px-4 py-2 rounded-2xl shadow-2xl whitespace-nowrap border border-white/10 flex items-center gap-2"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${currentAction === 'THINKING' ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} />
              {currentAction === 'THINKING' ? '深度推理中...' : currentAction === 'SUCCESS' ? '搞定了！' : '随时听候差遣'}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PetView;
