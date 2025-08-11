import React from 'react';
import Container from './layout/Container';
import ExperienceItem from './composed/ExperienceItem';
import SplitLine from './splitLine';
import { filterDataByTitles } from '../utils';

export default function Experiences({ title: sectionTitle, data, selectedTitles }) {
  if (selectedTitles && selectedTitles.length > 0) {
    data = filterDataByTitles(data, selectedTitles);
  }

  return (
    <Container variant="section" width="section">
      {data.map((item, idx) => (
        <React.Fragment key={idx}>
          <div className="w-full">
            <ExperienceItem {...item} />
          </div>
          {idx < data.length - 1 && <SplitLine width="[80%]" weight="200" />}
        </React.Fragment>
      ))}
    </Container>
  );
}
