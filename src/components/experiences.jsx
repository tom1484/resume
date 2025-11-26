import React from 'react';
import { filterDataByTitles } from '@utils';
import { useTheme } from '@contexts/themeContext';
import Container from '@components/layout/container';
import List from '@components/common/list';
import Link from '@components/common/link';
import SplitLine from '@components/common/splitLine';

function ExperienceItem({
  title,
  footnote,
  highlight,
  role,
  time,
  location,
  link = [],
  content = [],
  tags = [],
  isLast = false,
  showTags = true,
  showHighlight = true,
  showLinks = true,
  ...props
}) {
  const { theme } = useTheme();

  // Determine if we need two rows or can collapse to one
  const hasTitleRowRight = footnote || location;
  const hasInfoRowLeft = (showHighlight && highlight) || role;
  const needsTwoRows = hasTitleRowRight || hasInfoRowLeft;

  const highlightItem = showHighlight && highlight ? (
    <span className={theme.components.experiences.highlight}>
      {highlight}
    </span>
  ) : null;

  const roleItem = role ? (
    <span className={theme.components.experiences.role}>
      {role}
    </span>
  ) : null;

  const linkItem = link.length > 0 ? link.map(({ text, url }, idx) => (
    <React.Fragment key={idx}>
      <Link href={url} variant="block">
        {text}
      </Link>
      {idx !== link.length - 1 && <div className='mr-1' />}
    </React.Fragment>
  )) : null;

  const titleRowLeftItem = !needsTwoRows && linkItem ? (
    <span className="flex items-center">
      <span className={theme.typography.heading}>{title}</span>
      <div className='mr-1' />
      {linkItem}
    </span>
  ) : (
    <span className={theme.typography.heading}>{title}</span>
  );

  const titleRowRightItem = hasTitleRowRight ? (
    footnote ? (
      <span className={theme.components.experiences.footnote}>
        {footnote}
      </span>
    ) : (
      <span className={theme.components.experiences.location}>
        {location}
      </span>
    )
  ) : null;

  const infoRowLeftItem = (
    <div className={theme.components.experiences.infoRowLeft}>
      {highlightItem}
      {highlightItem && roleItem && <span className={theme.components.experiences.infoSplit}>·</span>}
      {roleItem}
      {linkItem && <span className={theme.components.experiences.infoSplit}>·</span>}
      {linkItem}
    </div>
  );

  const infoRowRightItem = (
    <span className={theme.components.experiences.time}>
      {time}
    </span>
  );

  return (
    <>
      <div className="w-full print-no-break-in" {...props}>
        {needsTwoRows ? (
          <>
            {/* Row 1: Title (left) and Location/Footnote (right) */}
            <div className={theme.components.experiences.titleRow}>
              {titleRowLeftItem}
              {titleRowRightItem}
            </div>
            {/* Row 2: Role/Highlight (left) and Time (right) */}
            <div className={theme.components.experiences.infoRow}>
              {infoRowLeftItem}
              {infoRowRightItem}
            </div>
          </>
        ) : (
          /* Single Row: Title (left) and Time (right) */
          <div className={theme.components.experiences.titleRow}>
            {titleRowLeftItem}
            {infoRowRightItem}
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
          {...config}
          isLast={idx === data.length - 1}
        />
      ))}
    </Container>
  );
}
