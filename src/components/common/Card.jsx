import { theme } from '../../config/theme';

// Generic Card component for consistent styling
export default function Card({ 
  children, 
  variant = 'default',
  className = '',
  padding = 'default',
  border = false,
  rounded = false,
  shadow = false,
  ...props 
}) {
  const getCardStyles = () => {
    let styles = [];
    
    // Base styles
    switch (variant) {
      case 'skill':
        styles.push(theme.components.skills.item);
        break;
      case 'inline':
        styles.push('flex items-center h-fit w-fit');
        break;
      default:
        styles.push('flex flex-col');
        break;
    }
    
    // Padding
    switch (padding) {
      case 'none':
        break;
      case 'small':
        styles.push('p-1');
        break;
      case 'large':
        styles.push('p-4');
        break;
      case 'default':
      default:
        styles.push(theme.layout.spacing.padding);
        break;
    }
    
    // Border
    if (border) {
      styles.push(theme.colors.border, 'border');
    }
    
    // Rounded corners
    if (rounded) {
      styles.push('rounded-xl');
    }
    
    // Shadow
    if (shadow) {
      styles.push('shadow-sm');
    }
    
    return styles.join(' ');
  };

  return (
    <div 
      className={`${getCardStyles()} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}