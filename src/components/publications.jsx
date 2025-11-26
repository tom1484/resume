import React from 'react';
import { filterDataByTitles } from '@utils';
import { useTheme } from '@contexts/themeContext';
import Container from '@components/layout/container';
import List from '@components/common/list';
import Link from '@components/common/link';
import SplitLine from '@components/common/splitLine';

function PublicationItem({
  title,
  authors = [],
  publication = {},
  time,
  link = [],
  content = [],
  tags = [],
  showTags = true,
  showLinks = true,
  isLast = false,
  className = '',
  config = {},
  ...props
}) {
  const { theme } = useTheme();

  // Determine layout: use config if available, default to 'inline'
  const infoLayout = config.infoLayout || 'inline';
  const isStandalone = infoLayout === 'standalone';

  const renderAuthors = () => (
    <span className={theme.components.publications.author}>
      {authors.map((author, idx) => {
        const isHighlighted = author.startsWith('!');
        const name = isHighlighted ? author.slice(1) : author;

        return (
          <React.Fragment key={idx}>
            <span className={isHighlighted ? theme.components.publications.authorHighlight : ''}>
              {name}
            </span>
            {idx < authors.length - 1 && ', '}
          </React.Fragment>
        );
      })}
    </span>
  );

  return (
    <>
      <div className={`${className} w-full`} {...props}>
        {/* Title Row */}
        <div className={theme.components.publications.titleRow}>
          <h2 className={theme.typography.heading}>{title}</h2>
          <span className={theme.components.publications.conference}>
            {publication.conference || publication.journal}
            {
              publication.status && <> -  {publication.status}</>
            }
          </span>
        </div>

        {/* Authors Row */}
        <div className={theme.components.publications.authorRow}>
          {renderAuthors()}
          {
            link.length > 0 ? link.map(({ text, url }, idx) => (
                <React.Fragment key={idx}>
                  <Link href={url} variant="block">
                    {text}
                  </Link>
                  {idx !== link.length - 1 && <div className='mr-1' />}
                </React.Fragment>
              )) : null
          }
        </div>

        {/* Content Section */}
        {content && content.length > 0 && (
          <List
            items={content}
            variant="bulleted"
          />
        )}

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


export default function Publications({ title: sectionTitle, data, selectedTitles, config = {} }) {
  if (selectedTitles && selectedTitles.length > 0) {
    data = filterDataByTitles(data, selectedTitles);
  }

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
