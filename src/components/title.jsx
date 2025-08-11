import { theme } from '../config/theme';

export default function Title({ title }) {
  return (
    <div className={`${theme.components.title.container} ${theme.layout.containerWidth}`}>
      <div className={theme.components.title.titleWrapper}>
        <h2 className={theme.typography.sectionTitle}>{title}</h2>
      </div>
      <hr className={theme.components.title.divider} />
    </div>
  );
}
