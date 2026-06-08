import { useTheme } from '@contexts/themeContext';
import List from '@components/common/list';

// Renders the pipe-separated tag row under an item.
// Shared by experience and publication items.
export default function TagList({
  tags = [],
  show = true,
}: {
  tags?: string[];
  show?: boolean;
}) {
  const { theme } = useTheme();

  if (!show || !tags || tags.length === 0) return null;

  return (
    <div className={theme.components.experiences.tags}>
      <List
        items={tags}
        variant="inline"
        separator=" | "
      />
    </div>
  );
}
