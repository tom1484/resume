import clsx from 'clsx';
import { useTheme } from '@contexts/themeContext';

export default function Title({ title }) {
  const { theme } = useTheme();

  return (
    <div className={clsx(theme.components.title.container, theme.layout.containerWidth, "print-no-break-after")}>
      <div className={theme.components.title.titleWrapper}>
        <h2 className={theme.typography.sectionTitle}>{title}</h2>
      </div>
      <hr className={theme.components.title.divider} />
    </div>
  );
}
