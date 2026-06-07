import { filterDataByTitles } from '@utils';
import Container from '@components/layout/container';

// Shared section wrapper: optional title filtering + section container +
// per-item rendering with last-item awareness (for trailing split lines).
export default function SectionList({ data, selectedTitles, renderItem }) {
  if (selectedTitles && selectedTitles.length > 0) {
    data = filterDataByTitles(data, selectedTitles);
  }

  return (
    <Container variant="section" width="section">
      {data.map((item, idx) => renderItem(item, idx, idx === data.length - 1))}
    </Container>
  );
}
