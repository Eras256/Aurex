import React from 'react';

interface AurexLogoProps {
  variant?: 'full' | 'icon' | 'wordmark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | number;
  accent?: boolean;
  className?: string;
}

export const AurexLogo: React.FC<AurexLogoProps> = ({
  variant = 'full',
  size = 'md',
  accent = true,
  className = '',
}) => {
  // Sizing definitions in pixels for the SVG container
  const sizeMap = {
    xs: 16,
    sm: 24,
    md: 32,
    lg: 48,
  };

  const pixelSize = typeof size === 'number' ? size : sizeMap[size] || 32;

  // Sizing class mapping for text styling
  const textSizeMap = {
    xs: 'text-sm gap-1.5',
    sm: 'text-base gap-2',
    md: 'text-xl gap-2.5',
    lg: 'text-3xl gap-3.5',
  };

  const textStyleClass = typeof size === 'string' ? textSizeMap[size] || textSizeMap.md : textSizeMap.md;

  // Minimalist geometric logo mark SVG
  const renderIcon = () => (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 select-none"
      aria-label="Aurex Brand Mark"
    >
      {/* Left Pillar (Bid exchange L2 limits) */}
      <path
        d="M4 28 L10 28 L15 8 L11 8 Z"
        fill="currentColor"
        className="text-slate-100"
      />
      {/* Right Pillar (Ask exchange L2 limits) */}
      <path
        d="M28 28 L22 28 L17 8 L21 8 Z"
        fill="currentColor"
        className="text-slate-100"
      />
      {/* Crossbar Bridge (Execution Arbitrage Corridor) */}
      <path
        d="M12.5 17.5 L19.5 17.5 L20 19.5 L12 19.5 Z"
        fill={accent ? '#C89B3C' : 'currentColor'}
        className={accent ? '' : 'text-slate-100'}
      />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {renderIcon()}
      </div>
    );
  }

  if (variant === 'wordmark') {
    return (
      <span className={`font-sans font-bold tracking-wide text-white select-none ${className}`}>
        Aurex
      </span>
    );
  }

  // Full brand lockup: Icon + Wordmark + Tagline
  return (
    <div className={`inline-flex items-center ${textStyleClass} ${className}`}>
      {renderIcon()}
      <div className="flex flex-col justify-center leading-none">
        <h1 className="font-bold tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent uppercase font-sans">
          Aurex
        </h1>
        {pixelSize >= 24 && (
          <span className="text-[8px] text-gold font-mono tracking-widest uppercase mt-0.5 whitespace-nowrap">
            Arbitrage Intelligence
          </span>
        )}
      </div>
    </div>
  );
};
