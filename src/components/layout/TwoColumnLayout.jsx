import { theme } from '../../config/theme';
import { useConfig } from '../../contexts/ConfigContext';

// Two-column layout component used in experiences, publications, education
export default function TwoColumnLayout({ 
  leftColumn,
  rightColumn,
  leftWidth = 'default',
  rightWidth = 'default',
  gap = 'default',
  alignment = 'stretch',
  className = '',
  ...props 
}) {
  const { leftColumnRatio } = useConfig();
  const getLayoutStyles = () => {
    let styles = ['flex h-fit w-full'];
    
    // Alignment
    switch (alignment) {
      case 'top':
        styles.push('items-start');
        break;
      case 'center':
        styles.push('items-center');
        break;
      case 'bottom':
        styles.push('items-end');
        break;
      case 'stretch':
      default:
        styles.push('items-stretch');
        break;
    }
    
    // Gap
    switch (gap) {
      case 'none':
        break;
      case 'small':
        styles.push('gap-2');
        break;
      case 'large':
        styles.push('gap-6');
        break;
      case 'default':
      default:
        styles.push('gap-4');
        break;
    }
    
    return styles.join(' ');
  };

  const getColumnWidth = (column, width) => {
    // For most layouts, use dynamic ratio
    if (width === 'time' || width === 'time-wide' || width === 'content' || width === 'content-narrow' || width === 'dynamic') {
      return 'flex-col'; // We'll use inline styles for width
    }
    
    // Keep static widths only for personal info section
    switch (width) {
      case 'personal-left':
        return theme.layout.widths.personalInfoLeft; // w-[30%]
      case 'personal-center':
        return theme.layout.widths.personalInfoCenter; // w-[40%]
      case 'personal-right':
        return theme.layout.widths.personalInfoRight; // w-[30%]
      case 'half':
        return 'w-1/2';
      case 'third':
        return 'w-1/3';
      case 'quarter':
        return 'w-1/4';
      case 'auto':
        return 'w-auto';
      case 'default':
      default:
        return 'flex-col'; // We'll use inline styles for width
    }
  };

  const getColumnStyle = (column, width) => {
    // For dynamic widths, use inline styles
    if (width === 'time' || width === 'time-wide' || width === 'content' || width === 'content-narrow' || width === 'dynamic' || width === 'default') {
      return {
        width: column === 'left' ? `${leftColumnRatio}%` : `${100 - leftColumnRatio}%`
      };
    }
    return {};
  };

  return (
    <div 
      className={`${getLayoutStyles()} ${className}`}
      {...props}
    >
      <div 
        className={`${getColumnWidth('left', leftWidth)} flex flex-col`}
        style={{
          ...getColumnStyle('left', leftWidth),
          minWidth: 0,
          maxWidth: `${leftColumnRatio}%`,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          boxSizing: 'border-box'
        }}
      >
        {leftColumn}
      </div>
      <div 
        className={`${getColumnWidth('right', rightWidth)} flex flex-col`}
        style={{
          ...getColumnStyle('right', rightWidth),
          minWidth: 0,
          maxWidth: `${100 - leftColumnRatio}%`,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          boxSizing: 'border-box'
        }}
      >
        {rightColumn}
      </div>
    </div>
  );
}