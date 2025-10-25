import { useTheme } from '../contexts/ThemeContext';

export default function SplitLine({ variant = 'default', className = '' }) {
  const { theme } = useTheme();
  
  const style = variant === 'section' 
    ? theme.components.splitLine.section 
    : theme.components.splitLine.default;
  
  return (
    <hr className={`${style} w-full ${className}`} />
  );
}
