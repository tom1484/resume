import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

// ThemeSwitcher component - allows switching between Normal and Vibrant modes
export default function ThemeSwitcher({ className = '', position = 'top-right' }) {
  const { themeMode, toggleTheme, THEME_MODES } = useTheme();

  const getPositionStyles = () => {
    const baseStyles = 'fixed z-50';
    
    switch (position) {
      case 'top-right':
        return `${baseStyles} top-4 right-4`;
      case 'top-left':
        return `${baseStyles} top-4 left-4`;
      case 'bottom-right':
        return `${baseStyles} bottom-4 right-4`;
      case 'bottom-left':
        return `${baseStyles} bottom-4 left-4`;
      default:
        return `${baseStyles} top-4 right-4`;
    }
  };

  // Hide in print mode
  const containerStyles = `${getPositionStyles()} print:hidden`;

  const buttonStyles = `
    px-4 py-2 
    rounded-lg 
    border-2 
    font-medium 
    text-sm 
    transition-all 
    duration-200
    shadow-md
    hover:shadow-lg
    ${themeMode === THEME_MODES.VIBRANT 
      ? 'bg-cyan-600 text-white border-cyan-700 hover:bg-cyan-700' 
      : 'bg-gray-600 text-white border-gray-700 hover:bg-gray-700'
    }
  `;

  return (
    <div className={`${containerStyles} ${className}`}>
      <button
        onClick={toggleTheme}
        className={buttonStyles}
        title={`Switch to ${themeMode === THEME_MODES.VIBRANT ? 'Normal' : 'Vibrant'} mode`}
      >
        {themeMode === THEME_MODES.VIBRANT ? '🎨 Vibrant' : '📄 Normal'}
      </button>
    </div>
  );
}
