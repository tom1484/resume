import React from 'react';
import Container from './layout/Container';
import ExperienceItemVibrant from './variants/vibrant/ExperienceItemVibrant';
import ExperienceItemNormal from './variants/normal/ExperienceItemNormal';
import { filterDataByTitles } from '../utils';
import { useTheme } from '../contexts/ThemeContext';

export default function Experiences({ title: sectionTitle, data, selectedTitles, config = {} }) {
  const { themeMode, theme, THEME_MODES } = useTheme();
  
  if (selectedTitles && selectedTitles.length > 0) {
    data = filterDataByTitles(data, selectedTitles);
  }

  // Select the appropriate component variant based on theme mode
  const ExperienceItem = themeMode === THEME_MODES.NORMAL 
    ? ExperienceItemNormal 
    : ExperienceItemVibrant;

  return (
    <Container variant="section" width="section">
      {data.map((item, idx) => (
        <ExperienceItem 
          key={idx} 
          {...item}
          config={config}
          isLast={idx === data.length - 1}
        />
      ))}
    </Container>
  );
}
