import Container from './layout/Container';
import SkillItemVibrant from './variants/vibrant/SkillItemVibrant';
import { useTheme } from '../contexts/ThemeContext';

export default function Skills({ data }) {
  const { themeMode, theme, THEME_MODES } = useTheme();

  // Normal mode: Group skills by category and display as text
  if (themeMode === THEME_MODES.NORMAL) {
    // Group skills by category
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
              {/* {index < Object.entries(skillsByCategory).length - 1 && <br />} */}
            </div>
          ))}
        </div>
      </Container>
    );
  }

  // Vibrant mode: Display skills as badges with icons
  return (
    <Container variant="section" width="section">
      <div className={theme.components.skills.wrapper}>
        {data.map(skill => (
          <SkillItemVibrant key={skill.title} {...skill} />
        ))}
      </div>
    </Container>
  );
}