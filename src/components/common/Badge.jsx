import { useTheme } from '../../contexts/ThemeContext';

// Generic Badge component for tags, highlights, and labels
export default function Badge({ 
  children,
  variant = 'default',
  size = 'default',
  color = 'neutral',
  className = '',
  ...props 
}) {
  const { theme } = useTheme();
  
  const getBadgeStyles = () => {
    let styles = [theme.typography.fontFamily];
    
    // Size variants
    switch (size) {
      case 'small':
        styles.push('text-xs px-2 py-1');
        break;
      case 'large':
        styles.push('text-base px-4 py-2');
        break;
      case 'default':
      default:
        styles.push('text-sm px-3 py-1');
        break;
    }
    
    // Color variants
    switch (color) {
      case 'primary':
        styles.push('bg-blue-100 text-blue-800');
        break;
      case 'secondary':
        styles.push('bg-gray-100 text-gray-800');
        break;
      case 'success':
        styles.push('bg-green-100 text-green-800');
        break;
      case 'warning':
        styles.push('bg-yellow-100 text-yellow-800');
        break;
      case 'danger':
        styles.push('bg-red-100 text-red-800');
        break;
      case 'highlight':
        styles.push('bg-orange-100 text-orange-800');
        break;
      case 'neutral':
      default:
        styles.push('bg-gray-50 text-gray-600');
        break;
    }
    
    // Variant-specific styles
    switch (variant) {
      case 'pill':
        styles.push('rounded-full');
        break;
      case 'square':
        styles.push('rounded-none');
        break;
      case 'outline':
        styles.push('bg-transparent border border-current');
        break;
      case 'default':
      default:
        styles.push('rounded');
        break;
    }
    
    // Base styling
    styles.push('inline-block font-medium whitespace-nowrap');
    
    return styles.join(' ');
  };

  return (
    <span 
      className={`${getBadgeStyles()} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}