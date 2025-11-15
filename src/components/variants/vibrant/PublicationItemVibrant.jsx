import React from 'react';
import TwoColumnLayout from '../../layout/TwoColumnLayout';
import List from '../../common/List';
import Link from '../../common/Link';
import { useTheme } from '../../../contexts/ThemeContext';

// Vibrant variant of publication item - colorful two-column layout
export default function PublicationItemVibrant({ 
  title,
  authors = [],
  publication = {},
  time,
  link = [],
  content = [],
  tags = [],
  showTags = true,
  showLinks = true,
  className = '',
  config = {},
  ...props 
}) {
  const { theme } = useTheme();
  
  // Determine layout: use config if available, default to 'inline'
  const infoLayout = config.infoLayout || 'inline';
  const isStandalone = infoLayout === 'standalone';
  
  const renderAuthors = () => (
    <h2 className={theme.components.publications.authorText}>
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
    </h2>
  );

  const renderTimeColumn = () => (
    <p className={theme.components.experiences.timeText}>
      {time}
      <br />
      {publication.conference || publication.journal} - {publication.status}
      {showLinks && link && link.length > 0 && (
        <>
          <br />
          Links:{' '}
          {link.map(({ text, url }, idx) => (
            <React.Fragment key={idx}>
              <Link href={url} variant="underline">
                {text}
              </Link>
              {idx < link.length - 1 && <>&nbsp;&nbsp;</>}
            </React.Fragment>
          ))}
        </>
      )}
    </p>
  );

  const renderContentColumn = () => (
    <>
      {content && content.length > 0 && (
        <List 
          items={content}
          variant="bulleted"
        />
      )}
      {showTags && tags && tags.length > 0 && (
        <div className={theme.components.experiences.tags}>
          <List 
            items={tags}
            variant="inline"
            separator=" | "
          />
        </div>
      )}
    </>
  );

  return (
    <div className={className} {...props}>
      {/* Title Row */}
      <div className={`${theme.components.publications.titleRow} ${!isStandalone ? 'justify-between' : ''}`}>
        <h2 className={theme.typography.heading}>{title}</h2>
        {!isStandalone && (
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
        )}
      </div>
      
      {/* Authors Row */}
      <div className={theme.components.publications.authorRow}>
        {renderAuthors()}
      </div>
      
      {/* Content Row - Two column layout for standalone, content only for inline */}
      {isStandalone ? (
        <TwoColumnLayout
          leftColumn={renderTimeColumn()}
          rightColumn={renderContentColumn()}
          leftWidth="dynamic"
          rightWidth="dynamic"
          className=""
        />
      ) : (
        <div>
          {renderContentColumn()}
        </div>
      )}
    </div>
  );
}
