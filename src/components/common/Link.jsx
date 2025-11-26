import { useTheme } from '../../contexts/themeContext';

// Generic Link component with consistent styling
export default function Link({ 
  children,
  href,
  variant = 'default',
  external = null,
  className = '',
  ...props 
}) {
  const { theme } = useTheme();
  
  // Auto-detect external links
  const isExternal = external !== null ? external : href?.startsWith('http');
  
  const getLinkStyles = () => {
    let styles = [theme.typography.fontFamily];
    
    switch (variant) {
      case 'underline':
        styles.push(theme.colors.linkUnderline);
        break;
      case 'button':
        styles.push(
          'inline-block px-3 py-1 rounded',
          'bg-blue-500 text-white hover:bg-blue-600',
          'transition-colors duration-200'
        );
        break;
      case 'subtle':
        styles.push(theme.colors.secondary, 'hover:' + theme.colors.link);
        break;
      case 'default':
      default:
        styles.push(theme.colors.link, 'hover:underline');
        break;
    }
    
    return styles.join(' ');
  };

  const linkProps = {
    href,
    className: `${getLinkStyles()} ${className}`,
    ...props
  };

  if (isExternal) {
    linkProps.target = '_blank';
    linkProps.rel = 'noopener noreferrer';
  }

  return (
    <a {...linkProps}>
      {children}
      {isExternal && variant !== 'button' && (
        <span className="ml-1 text-xs" aria-label="Opens in new tab">↗</span>
      )}
    </a>
  );
}