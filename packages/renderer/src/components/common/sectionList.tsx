import React from 'react';
import Container from '@components/layout/container';

// Shared section wrapper: section container + per-item rendering with
// last-item awareness (for trailing split lines).
export default function SectionList<T>({
  data,
  renderItem,
}: {
  data: T[];
  renderItem: (item: T, idx: number, isLast: boolean) => React.ReactNode;
}) {
  return (
    <Container variant="section" width="section">
      {data.map((item, idx) => renderItem(item, idx, idx === data.length - 1))}
    </Container>
  );
}
