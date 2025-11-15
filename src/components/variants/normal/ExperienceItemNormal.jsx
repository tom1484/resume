import React from 'react';
import List from '../../common/List';
import Link from '../../common/Link';
import SplitLine from '../../splitLine';
import { useTheme } from '../../../contexts/ThemeContext';

// Normal variant of experience item - compact single-column layout
export default function ExperienceItemNormal({ 
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
  
  // Determine layout: use config if available, fall back to titleFootnote check
  const infoLayout = config.infoLayout || (titleFootnote ? 'standalone' : 'inline');
  const isStandalone = infoLayout === 'standalone';
  
  return (
    <>
      <div className={`${className} w-full`} {...props}>
        {/* Title Row */}
        <div className={theme.components.experiences.titleRow}>
          <h2 className={theme.typography.heading}>{title}</h2>
          {titleFootnote ? (
            // If titleFootnote exists (academics), show it on the same row
            <span className={theme.components.experiences.titleFootnote}>
              {titleFootnote}
            </span>
          ) : !isStandalone ? (
            // If inline layout and no titleFootnote, show time/location/links on the same row
            <span className={theme.components.experiences.timeText}>
              {showHighlight && highlight && (
                <span className={`${theme.components.experiences.highlight} mr-3`}>
                  {highlight}
                </span>
              )}
              {time}
              {location && <> • {location}</>}
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
          ) : null}
        </div>
        
        {/* Time/Location/Links Row - Show for standalone layout or titleFootnote */}
        {(isStandalone || titleFootnote) && (
          <div className="mb-2">
            {showHighlight && highlight && (
              <span className={`${theme.components.experiences.highlight} mr-3`}>
                {highlight}
              </span>
            )}
            <span className={theme.components.experiences.timeText}>
              {time}
              {location && <> • {location}</>}
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
