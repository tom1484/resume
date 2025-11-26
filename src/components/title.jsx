import { useTheme } from '@contexts/themeContext';

export default function Title({ title }) {
  const { theme } = useTheme();
  
  return (
    <div className={`${theme.components.title.container} ${theme.layout.containerWidth} print-keep-with-next`}>
      <div className={theme.components.title.titleWrapper}>
        <h2 className={theme.typography.sectionTitle}>{title}</h2>
      </div>
      <hr className={theme.components.title.divider} />
    </div>
  );
}
