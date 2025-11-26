import React from 'react';
import { filterDataByTitles } from '@utils';
import { useTheme } from '@contexts/themeContext';
import Container from '@components/layout/container';
import List from '@components/common/list';
import Link from '@components/common/link';
import SplitLine from '@components/common/splitLine';

function ExperienceItem({
  title,
  titleFootnote,
  highlight,
  time,
  location,
  link = [],
  content = [],
  tags = [],
  showTags = true,
  showHighlight = true,
  showLinks = true,
  isLast = false,
  className = '',
  config = {},
  ...props
}) {
  const { theme } = useTheme();

  // Determine if we need two rows or can collapse to one
  const rightInfo = titleFootnote || location || '';
  const leftSubInfo = showHighlight && highlight ? highlight : '';
  const needsTwoRows = rightInfo || leftSubInfo;

  const renderLinks = () => {
    if (!showLinks || !link || link.length === 0) return null;
    return (
      <>
        {' • '}
        {link.map(({ text, url }, idx) => (
          <React.Fragment key={idx}>
            <Link href={url} variant="underline">
              {text}
            </Link>
            {idx < link.length - 1 && <>, </>}
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <>
      <div className={`${className} w-full`} {...props}>
        {needsTwoRows ? (
          <>
            {/* Row 1: Title (left) and Location/Footnote (right) */}
            <div className={theme.components.experiences.titleRow}>
              <h2 className={theme.typography.heading}>{title}</h2>
              <span className={theme.components.experiences.titleFootnote}>
                {rightInfo}
              </span>
            </div>

            {/* Row 2: Role/Highlight (left) and Time (right) */}
            <div className={`${theme.components.experiences.titleRow} mb-2`}>
              <span className={theme.components.experiences.highlight}>
                {leftSubInfo}
              </span>
              <span className={theme.components.experiences.timeText}>
                {time}
                {renderLinks()}
              </span>
            </div>
          </>
        ) : (
          /* Single Row: Title (left) and Time (right) */
          <div className={`${theme.components.experiences.titleRow} mb-2`}>
            <h2 className={theme.typography.heading}>{title}</h2>
            <span className={theme.components.experiences.timeText}>
              {time}
              {renderLinks()}
            </span>
          </div>
        )}

        {/* Content Section */}
        <List
          items={content}
          variant="bulleted"
        />

        {/* Tags Section */}
        {showTags && tags && tags.length > 0 && (
          <div className={theme.components.experiences.tags}>
            <List
              items={tags}
              variant="inline"
              separator=" | "
            />
          </div>
        )}
      </div>

      {/* Splitline - only show if not the last item */}
      {!isLast && (
        <SplitLine variant="default" />
      )}
    </>
  );
}

export default function Experiences({ title: sectionTitle, data, selectedTitles, config = {} }) {
  if (selectedTitles && selectedTitles.length > 0) {
    data = filterDataByTitles(data, selectedTitles);
  }

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
