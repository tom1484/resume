import { useTheme } from '@contexts/themeContext';

// Generic Container component for consistent layout
export default function Container({ 
  children,
  variant = 'default',
  width = 'default',
  padding = true,
  margin = null,
  className = '',
  ...props 
}) {
  const { theme } = useTheme();
  
  const getContainerStyles = () => {
    let styles = [];
    
    // Width variants
    switch (width) {
      case 'full':
        styles.push('w-full');
        break;
      case 'section':
        styles.push(theme.layout.containerWidth); // w-11/12
        break;
      case 'narrow':
        styles.push('w-10/12');
        break;
      case 'wide':
        styles.push('w-full max-w-7xl');
        break;
      case 'default':
      default:
        styles.push(theme.layout.containerWidth);
        break;
    }
    
    // Layout variants
    switch (variant) {
      case 'section':
        styles.push(theme.components.container.section); // flex flex-col items-end justify-center h-fit
        break;
      case 'centered':
        styles.push(theme.components.container.main); // h-full flex flex-col items-center
        break;
      case 'flex-row':
        styles.push('flex flex-row items-center');
        break;
      case 'flex-col':
        styles.push('flex flex-col');
        break;
      case 'grid':
        styles.push('grid');
        break;
      case 'default':
      default:
        styles.push('block');
        break;
    }
    
    // Padding
    if (padding === true) {
      styles.push(theme.layout.spacing.padding);
    } else if (typeof padding === 'string') {
      styles.push(padding);
    }
    
    // Margin
    if (margin) {
      styles.push(margin);
    }
    
    return styles.join(' ');
  };

  return (
    <div 
      className={`${getContainerStyles()} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}