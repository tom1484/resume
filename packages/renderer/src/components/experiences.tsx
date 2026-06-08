import { useTheme } from '@contexts/themeContext';
import LinkGroup from '@components/common/linkGroup';
import List from '@components/common/list';
import SectionList from '@components/common/sectionList';
import SplitLine from '@components/common/splitLine';
import TagList from '@components/common/tagList';
import type { ExperienceVM } from '@resume/contracts';

interface ExperienceItemProps extends Partial<ExperienceVM> {
  isLast?: boolean;
  showTags?: boolean;
  showHighlight?: boolean;
  showLinks?: boolean;
  [key: string]: unknown;
}

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
  showLinks: _showLinks = true,
  ...props
}: ExperienceItemProps) {
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

  const linkItem = link.length > 0 ? <LinkGroup links={link} /> : null;

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
        <TagList tags={tags} show={showTags} />
      </div>

      {/* Splitline - only show if not the last item */}
      {!isLast && (
        <SplitLine variant="default" />
      )}
    </>
  );
}

export default function Experiences({
  title: _sectionTitle,
  data,
  config = {},
}: {
  title?: string;
  data: ExperienceVM[];
  config?: Record<string, unknown>;
}) {
  return (
    <SectionList
      data={data}
      renderItem={(item: ExperienceVM, idx: number, isLast: boolean) => (
        <ExperienceItem
          key={idx}
          {...item}
          {...config}
          isLast={isLast}
        />
      )}
    />
  );
}
