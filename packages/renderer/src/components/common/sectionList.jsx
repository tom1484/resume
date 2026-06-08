import Container from '@components/layout/container';

// Shared section wrapper: section container + per-item rendering with
// last-item awareness (for trailing split lines).
export default function SectionList({ data, renderItem }) {
  return (
    <Container variant="section" width="section">
      {data.map((item, idx) => renderItem(item, idx, idx === data.length - 1))}
    </Container>
  );
}
