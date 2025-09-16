import React from 'react';
import Container from './layout/Container';
import PublicationItem from './composed/PublicationItem';
import SplitLine from './splitLine';
import { filterDataByTitles } from '../utils';
import { theme } from '../config/theme';

export default function Publications({ title: sectionTitle, data, selectedTitles }) {
  if (selectedTitles && selectedTitles.length > 0) {
    data = filterDataByTitles(data, selectedTitles);
  }

  return (
    <Container variant="section" width="section">
      {data.map((item, idx) => (
        <React.Fragment key={idx}>
          <PublicationItem {...item} />
          {idx < data.length - 1 && <div className={theme.layout.spacing.itemGap}><SplitLine width="[80%]" weight="200" /></div>}
        </React.Fragment>
      ))}
    </Container>
  );
}
