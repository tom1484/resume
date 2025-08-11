import React from 'react';
import TwoColumnLayout from '../layout/TwoColumnLayout';
import List from '../common/List';
import Link from '../common/Link';
import Badge from '../common/Badge';
import { theme } from '../../config/theme';

// Composed component for experience entries (projects, academics, etc.)
export default function ExperienceItem({ 
  title,
  titleFootnote,
  highlight,
  time,
  link = [],
  content = [],
  tags = [],
  showTags = true,
  showHighlight = true,
  showLinks = true,
  className = '',
  ...props 
}) {
  const renderTimeColumn = () => (
    <>
      {showHighlight && highlight && (
        <p className={theme.components.experiences.highlight}>
          {highlight}
        </p>
      )}
      <p className={theme.components.experiences.timeText}>
        {time}
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
    </>
  );

  const renderContentColumn = () => (
    <>
      <List 
        items={content}
        variant="bulleted"
      />
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
    <div className={`${className} w-full`} {...props}>
      {/* Title Row */}
      <div className={`${theme.components.experiences.titleRow}`}>
        <h2 className={theme.typography.heading}>{title}</h2>
        {titleFootnote && (
          <span className={theme.components.experiences.titleFootnote}>
            {titleFootnote}
          </span>
        )}
      </div>
      
      {/* Content Row */}
      <TwoColumnLayout
        leftColumn={renderTimeColumn()}
        rightColumn={renderContentColumn()}
        leftWidth="dynamic"
        rightWidth="dynamic"
        alignment="top"
        className=""
      />
    </div>
  );
}