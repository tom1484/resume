import { useTheme } from '../../contexts/ThemeContext';

// Generic Image component with consistent styling and loading states
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
}) {
  const { theme } = useTheme();
  
  const getImageStyles = () => {
    let styles = [];
    
    // Size variants
    switch (size) {
      case 'icon':
        styles.push(theme.components.skills.icon); // h-8
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

  const handleError = (e) => {
    if (onError) {
      onError(e);
    } else {
      // Default error handling - hide broken image
      e.target.style.display = 'none';
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
    const containerStyles = labelPosition === 'bottom' 
      ? theme.components.personalInfo.qrItem // flex flex-col items-center
      : 'flex items-center gap-2';
    
    const labelStyles = labelPosition === 'bottom'
      ? theme.components.personalInfo.qrLabel // text-xs text-neutral-500
      : theme.typography.caption + ' ' + theme.colors.secondary;

    return (
      <div className={containerStyles}>
        {labelPosition === 'top' && (
          <span className={labelStyles}>{label}</span>
        )}
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