import { useTheme } from '../../contexts/themeContext';
import clsx from 'clsx';

// Generic Link component with consistent styling
export default function Link({
  children,
  href,
  variant = 'default',
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