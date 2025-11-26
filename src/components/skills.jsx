import { useTheme } from '@contexts/themeContext';
import Container from '@components/layout/container';

// function SkillItem({ 
//   title,
//   icon,
//   category,
//   variant = 'default',
//   showIcon = false, // Icon not used in normal mode
//   className = '',
//   ...props 
// }) {
//   const { theme } = useTheme();

//   // This component is kept for compatibility but not used in normal mode
//   // Normal mode uses a grouped display in skills.jsx
//   return (
//     <span className={`${theme.components.skills.text} ${className}`}>
//       {title}
//     </span>
//   );
// }


export default function Skills({ data }) {
  const { theme } = useTheme();

  // Group skills by category and display as text
  const skillsByCategory = data.reduce((acc, skill) => {
    const category = skill.category || 'Others';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(skill.title);
    return acc;
  }, {});

  return (
    <Container variant="section" width="section">
      <div className={theme.components.skills.wrapper}>
        {Object.entries(skillsByCategory).map(([category, skills], index) => (
          <div key={category}>
            <span className={theme.components.skills.category}>{category}:</span>{' '}
            <span className={theme.components.skills.text}>{skills.join(', ')}</span>
          </div>
        ))}
      </div>
    </Container>
  );
}