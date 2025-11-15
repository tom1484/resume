import React from 'react';
import Container from './layout/Container';
import PublicationItemVibrant from './variants/vibrant/PublicationItemVibrant';
import PublicationItemNormal from './variants/normal/PublicationItemNormal';
import { filterDataByTitles } from '../utils';
import { useTheme } from '../contexts/ThemeContext';

export default function Publications({ title: sectionTitle, data, selectedTitles, config = {} }) {
  const { themeMode, theme, THEME_MODES } = useTheme();
  
  if (selectedTitles && selectedTitles.length > 0) {
    data = filterDataByTitles(data, selectedTitles);
  }

  // Select the appropriate component variant based on theme mode
  const PublicationItem = themeMode === THEME_MODES.NORMAL 
    ? PublicationItemNormal 
    : PublicationItemVibrant;

  return (
    <Container variant="section" width="section">
      {data.map((item, idx) => (
        <PublicationItem 
          key={idx} 
          {...item}
          config={config}
          isLast={idx === data.length - 1}
        />
      ))}
    </Container>
  );
}
