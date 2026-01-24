import React from 'react';

interface DashedArrowProps {
  className?: string;
  direction?: 'down' | 'right' | 'curved';
}

export function DashedArrow({ className = '', direction = 'curved' }: DashedArrowProps) {
  if (direction === 'down') {
    return (
      <svg 
        width="24" 
        height="40" 
        viewBox="0 0 24 40" 
        fill="none" 
        className={className}
      >
        <path 
          d="M12 4 L12 32" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <path 
          d="M6 26 L12 34 L18 26" 
          stroke="currentColor" 
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  if (direction === 'right') {
    return (
      <svg 
        width="40" 
        height="24" 
        viewBox="0 0 40 24" 
        fill="none" 
        className={className}
      >
        <path 
          d="M4 12 L32 12" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <path 
          d="M26 6 L34 12 L26 18" 
          stroke="currentColor" 
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  return (
    <svg 
      width="60" 
      height="40" 
      viewBox="0 0 60 40" 
      fill="none" 
      className={className}
    >
      <path 
        d="M5 8 Q30 8 50 30" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeDasharray="4 3"
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M44 24 L52 32 L46 34" 
        stroke="currentColor" 
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function AccentDot({ className = '' }: { className?: string }) {
  return (
    <div 
      className={`w-6 h-6 rounded-full bg-[--accent] ${className}`}
      style={{ boxShadow: '0 2px 8px rgba(224, 122, 95, 0.4)' }}
    />
  );
}

export function SketchDecoration({ className = '' }: { className?: string }) {
  return (
    <svg 
      width="120" 
      height="80" 
      viewBox="0 0 120 80" 
      fill="none" 
      className={className}
    >
      <rect 
        x="10" y="10" 
        width="100" height="60" 
        rx="8"
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeDasharray="6 4"
        fill="none"
      />
      <circle 
        cx="105" 
        cy="65" 
        r="12" 
        fill="#E07A5F"
      />
    </svg>
  );
}
