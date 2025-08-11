import Container from './layout/Container';
import SkillItem from './composed/SkillItem';
import { theme } from '../config/theme';

export default function Skills({ data }) {
  return (
    <Container variant="section" width="section">
      <div className={theme.components.skills.wrapper}>
        {data.map(skill => (
          <SkillItem key={skill.title} {...skill} />
        ))}
      </div>
    </Container>
  );
}
