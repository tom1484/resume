import React from 'react';
import { useTheme } from '../../contexts/themeContext';

interface ListProps {
  items?: unknown[];
  variant?: 'bulleted' | 'inline' | 'vertical' | 'tags' | string;
  className?: string;
  itemClassName?: string;
  separator?: React.ReactNode;
  renderItem?: ((item: unknown, index: number) => React.ReactNode) | null;
  [key: string]: unknown;
}

// Generic List component for various list types
export default function List({
  items,
  variant = 'bulleted',
  className = '',
  itemClassName = '',
  separator = null,
  renderItem = null,
  ...props
}: ListProps) {
  const { theme } = useTheme();
  
  if (!items || !Array.isArray(items)) return null;

  const getListStyles = () => {
    switch (variant) {
      case 'bulleted':
        return `${theme.components.experiences.list} overflow-hidden pl-5`;
      case 'inline':
        return 'flex flex-wrap gap-2 overflow-hidden';
      case 'vertical':
        return 'flex flex-col space-y-1 overflow-hidden';
      case 'tags':
        return 'flex flex-wrap gap-1 overflow-hidden';
      default:
        return 'overflow-hidden';
    }
  };

  const getItemStyles = () => {
    switch (variant) {
      case 'bulleted':
        return `${theme.components.experiences.listItem} ${itemClassName}`;
      case 'inline':
      case 'vertical':
        return itemClassName;
      case 'tags':
        return `inline-block ${itemClassName}`;
      default:
        return itemClassName;
    }
  };

  const processContent = (content: unknown): React.ReactNode => {
    if (typeof content === 'string' && content.includes('<br>')) {
      return content.split('<br>').map((text, i, arr) => (
        <React.Fragment key={i}>
          {text}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      ));
    }
    return content as React.ReactNode;
  };

  const renderListItem = (item: unknown, index: number) => {
    const content = renderItem ? renderItem(item, index) : processContent(item);
    
    if (variant === 'bulleted') {
      return (
        <li key={index} className={getItemStyles()}>
          {content}
        </li>
      );
    }
    
    if (variant === 'inline' && separator && index < items.length - 1) {
      return (
        <React.Fragment key={index}>
          <span className={getItemStyles()}>{content}</span>
          <span className="text-neutral-400">{separator}</span>
        </React.Fragment>
      );
    }
    
    return (
      <div key={index} className={getItemStyles()}>
        {content}
      </div>
    );
  };

  if (variant === 'bulleted') {
    return (
      <ul className={`${getListStyles()} ${className}`} {...props}>
        {items.map(renderListItem)}
      </ul>
    );
  }

  return (
    <div className={`${getListStyles()} ${className}`} {...props}>
      {items.map(renderListItem)}
    </div>
  );
}