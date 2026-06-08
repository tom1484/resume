import React from 'react';
import { useTheme } from '@contexts/themeContext';
import LinkGroup from '@components/common/linkGroup';
import List from '@components/common/list';
import SectionList from '@components/common/sectionList';
import SplitLine from '@components/common/splitLine';
import TagList from '@components/common/tagList';
import type { PublicationVM } from '@resume/contracts';

interface PublicationItemProps extends Partial<PublicationVM> {
  time?: string;
  content?: string[];
  tags?: string[];
  showTags?: boolean;
  showLinks?: boolean;
  isLast?: boolean;
  className?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

function PublicationItem({
  title,
  authors = [],
  publication = {},
  time,
  link = [],
  content = [],
  tags = [],
  showTags = true,
  showLinks: _showLinks = true,
  isLast = false,
  className = '',
  config: _config = {},
  ...props
}: PublicationItemProps) {
  const { theme } = useTheme();

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
          {link.length > 0 ? <LinkGroup links={link} /> : null}
        </div>

        {/* Content Section */}
        {content && content.length > 0 && (
          <List
            items={content}
            variant="bulleted"
          />
        )}

        {/* Tags Section */}
        <TagList tags={tags} show={showTags} />
      </div>

      {/* Splitline - only show if not the last item */}
      {!isLast && (
        <SplitLine variant="default" />
      )}
    </>
  );
}

export default function Publications({
  title: _sectionTitle,
  data,
  config = {},
}: {
  title?: string;
  data: PublicationVM[];
  config?: Record<string, unknown>;
}) {
  return (
    <SectionList
      data={data}
      renderItem={(item: PublicationVM, idx: number, isLast: boolean) => (
        <PublicationItem key={idx} {...item} config={config} isLast={isLast} />
      )}
    />
  );
}
