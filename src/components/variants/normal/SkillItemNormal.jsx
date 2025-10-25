import { useTheme } from '../../../contexts/ThemeContext';

// Normal variant of skill item - text-based category list
// This component is not used directly; see skills.jsx for the normal mode implementation
export default function SkillItemNormal({ 
  title,
  icon,
  category,
  variant = 'default',
  showIcon = false, // Icon not used in normal mode
  className = '',
  ...props 
}) {
  const { theme } = useTheme();
  
  // This component is kept for compatibility but not used in normal mode
  // Normal mode uses a grouped display in skills.jsx
  return (
    <span className={`${theme.components.skills.text} ${className}`}>
      {title}
    </span>
  );
}
