import React from 'react';
import { useTheme } from '../../contexts/themeContext';

// BUG FIX (DOM-neutral, DECISIONS drop/fix list): v1's `size: 'icon'` branch
// pushed theme.components.skills.icon, which is UNDEFINED in the theme — it
// would have rendered no class (and is unreached by the current seed, which
// only uses size 'qr'). v2 removes the dead reference; the branch now pushes
// nothing, identical to the prior `undefined` (React omits it). No new theme
// key is introduced (that would change the DOM).

interface ImageProps {
  src: string;
  alt?: string;
  variant?: 'default' | 'rounded' | 'circle' | 'icon';
  size?: 'icon' | 'small' | 'medium' | 'large' | 'qr' | 'default';
  className?: string;
  label?: string | null;
  labelPosition?: 'bottom' | 'top' | 'left';
  loading?: 'lazy' | 'eager';
  onError?: ((e: React.SyntheticEvent<HTMLImageElement>) => void) | null;
  [key: string]: unknown;
}

export default function Image({
  src,
  alt = '',
  variant = 'default',
  size = 'default',
  className = '',
  label = null,
  labelPosition = 'bottom',
  loading = 'lazy',
  onError = null,
  ...props
}: ImageProps) {
  const { theme } = useTheme();

  const getImageStyles = (): string => {
    const styles: string[] = [];

    // Size variants
    switch (size) {
      case 'icon':
        // dead/undefined in v1 (theme.components.skills.icon) — push nothing
        break;
      case 'small':
        styles.push('w-12 h-12');
        break;
      case 'medium':
        styles.push('w-16 h-16');
        break;
      case 'large':
        styles.push('w-24 h-24');
        break;
      case 'qr':
        styles.push(theme.components.personalInfo.qrImage); // w-20 h-20
        break;
      case 'default':
      default:
        styles.push('w-auto h-auto');
        break;
    }

    // Variant styles
    switch (variant) {
      case 'rounded':
        styles.push('rounded-lg');
        break;
      case 'circle':
        styles.push('rounded-full');
        break;
      case 'icon':
        styles.push('object-contain');
        break;
      case 'default':
      default:
        break;
    }

    return styles.join(' ');
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (onError) {
      onError(e);
    } else {
      // Default error handling - hide broken image
      (e.target as HTMLImageElement).style.display = 'none';
    }
  };

  const imageElement = (
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={`${getImageStyles()} ${className}`}
      onError={handleError}
      {...props}
    />
  );

  if (label) {
    const containerStyles =
      labelPosition === 'bottom'
        ? theme.components.personalInfo.qrItem // flex flex-col items-center
        : 'flex items-center gap-2';

    const labelStyles =
      labelPosition === 'bottom'
        ? theme.components.personalInfo.qrLabel // text-xs text-neutral-500
        : theme.typography.caption + ' ' + theme.colors.secondary;

    return (
      <div className={containerStyles}>
        {labelPosition === 'top' && <span className={labelStyles}>{label}</span>}
        {imageElement}
        {labelPosition === 'bottom' && (
          <span className={labelStyles}>{label}</span>
        )}
        {labelPosition === 'left' && (
          <span className={labelStyles}>{label}</span>
        )}
      </div>
    );
  }

  return imageElement;
}
