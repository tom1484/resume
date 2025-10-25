import React from 'react';
import List from '../../common/List';
import Link from '../../common/Link';
import SplitLine from '../../splitLine';
import { useTheme } from '../../../contexts/ThemeContext';

// Normal variant of publication item - compact single-column layout
export default function PublicationItemNormal({ 
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
  ...props 
}) {
  const { theme } = useTheme();
  
  const renderAuthors = () => (
    <span className={theme.components.publications.authorText}>
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
      <div className={className} {...props}>
        {/* Title Row */}
        <div className={theme.components.publications.titleRow}>
          <h2 className={theme.typography.heading}>{title}</h2>
        </div>
        
        {/* Authors Row */}
        <div className={theme.components.publications.authorRow}>
          {renderAuthors()}
        </div>
        
        {/* Publication Info Row - Single line under authors */}
        <div className="mb-2">
          <span className={theme.components.experiences.timeText}>
            {time} • {publication.conference || publication.journal} - {publication.status}
            {showLinks && link && link.length > 0 && (
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
            )}
          </span>
        </div>
        
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
        <div className="my-2">
          <SplitLine variant="default" />
        </div>
      )}
    </>
  );
}
