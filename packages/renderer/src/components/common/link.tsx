import React from 'react';
import { useTheme } from '../../contexts/themeContext';
import clsx from 'clsx';

// Generic Link component with consistent styling. NOTE: `className` is accepted
// but intentionally IGNORED — v1's Link never applied a caller className (it set
// its own theme classes), and personalInfo passes one. Honoring it would add a
// DOM attribute and break the render-check; we keep v1's drop-it behavior.
export default function Link({
  children,
  href,
  variant = 'default',
}: {
  children: React.ReactNode;
  href: string;
  variant?: 'default' | 'block';
  className?: string;
}) {
  const { theme } = useTheme();

  switch (variant) {
    case 'block':
      return (
        <span className={theme.components.link.block}>
          [<a
            target='_blank'
            rel="noopener noreferrer"
            href={href}
            className='hover:underline'
          >
            {children}
          </a>]
        </span>
      );
    case 'default':
    default:
      return (
        <span>
          <a
            target='_blank'
            rel="noopener noreferrer"
            href={href}
            className={clsx(theme.components.link.default, 'hover:underline')}
          >
            {children}
          </a>
          <span className="mx-1 text-xs" aria-label="Opens in new tab">↗</span>
        </span>
      );
  }
}