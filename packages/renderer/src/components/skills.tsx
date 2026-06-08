import { useTheme } from '@contexts/themeContext';
import Container from '@components/layout/container';
import type { SkillVM } from '@resume/contracts';

export default function Skills({ data }: { data: SkillVM[] }) {
  const { theme } = useTheme();

  // Group skills by category and display as text
  const skillsByCategory = data.reduce<Record<string, string[]>>((acc, skill) => {
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
        {Object.entries(skillsByCategory).map(([category, skills]) => (
          <div key={category}>
            <span className={theme.components.skills.category}>{category}:</span>{' '}
            <span className={theme.components.skills.text}>{skills.join(', ')}</span>
          </div>
        ))}
      </div>
    </Container>
  );
}