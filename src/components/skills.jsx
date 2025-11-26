import { useTheme } from '@contexts/themeContext';
import Container from '@components/layout/container';


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