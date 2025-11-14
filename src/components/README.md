# Resume Component Library

A comprehensive component system for building flexible and maintainable resume layouts.

## Component Architecture

### Base Components (`/common`)
Generic, reusable components that form the building blocks of the UI.

#### `Card`
Container component with consistent styling options.

```jsx
<Card variant="skill" border rounded padding="small">
  Content here
</Card>
```

**Props:**
- `variant`: 'default' | 'skill' | 'inline'
- `padding`: 'none' | 'small' | 'default' | 'large'
- `border`: boolean
- `rounded`: boolean
- `shadow`: boolean

#### `List`
Flexible list component for various content types.

```jsx
<List items={content} variant="bulleted" />
<List items={tags} variant="inline" separator=" | " />
```

**Props:**
- `items`: Array of content items
- `variant`: 'bulleted' | 'inline' | 'vertical' | 'tags'
- `separator`: String (for inline lists)
- `renderItem`: Function for custom rendering
- `itemClassName`: Additional CSS classes for items

#### `Badge`
Styled labels and tags.

```jsx
<Badge variant="pill" color="highlight" size="small">
  Patent
</Badge>
```

**Props:**
- `variant`: 'default' | 'pill' | 'square' | 'outline'
- `size`: 'small' | 'default' | 'large'
- `color`: 'neutral' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'highlight'

#### `Link`
Consistent link styling with external link detection.

```jsx
<Link href="https://example.com" variant="underline">
  Project Link
</Link>
```

**Props:**
- `href`: URL string
- `variant`: 'default' | 'underline' | 'button' | 'subtle'
- `external`: boolean (auto-detected if not provided)

#### `Image`
Enhanced image component with loading states and labeling.

```jsx
<Image 
  src="/asset/image/icon.png" 
  variant="icon" 
  size="icon"
  label="GitHub"
  labelPosition="bottom"
/>
```

**Props:**
- `variant`: 'default' | 'rounded' | 'circle' | 'icon'
- `size`: 'icon' | 'small' | 'medium' | 'large' | 'qr' | 'default'
- `label`: String
- `labelPosition`: 'top' | 'bottom' | 'left' | 'right'

### Layout Components (`/layout`)
Components that handle positioning and spacing.

#### `Container`
Flexible container with width and layout options.

```jsx
<Container variant="section" width="section">
  Content here
</Container>
```

**Props:**
- `variant`: 'default' | 'section' | 'centered' | 'flex-row' | 'flex-col' | 'grid'
- `width`: 'default' | 'full' | 'section' | 'narrow' | 'wide'
- `padding`: boolean | string
- `margin`: string

#### `TwoColumnLayout`
Common two-column layout pattern used throughout the resume.

```jsx
<TwoColumnLayout
  leftColumn={<TimeInfo />}
  rightColumn={<ContentInfo />}
  leftWidth="time"
  rightWidth="content"
/>
```

**Props:**
- `leftWidth/rightWidth`: 'time' | 'time-wide' | 'content' | 'content-narrow' | 'personal-left' | 'personal-center' | 'personal-right' | 'half' | 'third' | 'quarter' | 'auto' | 'default'
- `alignment`: 'top' | 'center' | 'bottom' | 'stretch'
- `gap`: 'none' | 'small' | 'default' | 'large'

#### `Section`
Complete section wrapper with title and divider.

```jsx
<Section title="Education" id="education-section">
  <EducationContent />
</Section>
```

**Props:**
- `title`: String
- `id`: String
- `showDivider`: boolean
- `spacing`: 'none' | 'small' | 'default' | 'large'
- `containerProps`: Props passed to Container
- `titleProps`: Props passed to title element

### Composed Components (`/composed`)
Higher-level components that combine base components for specific use cases.

#### `ExperienceItem`
Complete experience entry (projects, academics, working).

```jsx
<ExperienceItem
  title="Project Name"
  time="2024"
  content={["Description 1", "Description 2"]}
  tags={["React", "Node.js"]}
  link={[{ text: "GitHub", url: "..." }]}
/>
```

**Props:**
- `title`: String (required)
- `titleFootnote`: String
- `highlight`: String
- `time`: String (required)
- `link`: Array of { text, url }
- `content`: Array of strings
- `tags`: Array of strings
- `showTags/showHighlight/showLinks`: boolean
- `timeColumnWidth`: Layout width option

#### `PublicationItem`
Publication-specific entry with author highlighting.

```jsx
<PublicationItem
  title="Paper Title"
  authors={["Author 1", "!Highlighted Author"]}
  publication={{ conference: "Conference", status: "Published" }}
  content={["Description"]}
/>
```

**Props:**
- Similar to ExperienceItem with publication-specific fields
- `authors`: Array (prefix with '!' to highlight)
- `publication`: Object with conference/journal and status

#### `SkillItem`
Individual skill with icon.

```jsx
<SkillItem title="React" icon="react.png" />
```

**Props:**
- `title`: String (required)
- `icon`: String (required)
- `showIcon`: boolean

## Theme Integration

All components automatically use the centralized theme system from `/config/theme.js`. Components access theme values through:

```jsx
import { theme } from '../../config/theme';

// Typography
className={theme.typography.heading}

// Colors
className={theme.colors.primary}

// Layout
className={theme.layout.widths.timeColumn}

// Component-specific styles
className={theme.components.skills.item}
```

## Usage Examples

### Basic Experience Section
```jsx
import Section from './layout/Section';
import ExperienceItem from './composed/ExperienceItem';
import SplitLine from './splitLine';

function Projects({ data }) {
  return (
    <Section title="Projects">
      {data.map((project, idx) => (
        <React.Fragment key={idx}>
          <ExperienceItem {...project} />
          {idx < data.length - 1 && <SplitLine width="[80%]" weight="200" />}
        </React.Fragment>
      ))}
    </Section>
  );
}
```

### Custom Skills Grid
```jsx
import Container from './layout/Container';
import SkillItem from './composed/SkillItem';

function Skills({ data }) {
  return (
    <Container variant="section">
      <div className="flex flex-wrap justify-start">
        {data.map(skill => (
          <SkillItem key={skill.title} {...skill} />
        ))}
      </div>
    </Container>
  );
}
```

## Best Practices

1. **Composition over Inheritance**: Use composed components for specific use cases
2. **Theme Consistency**: Always use theme values instead of hardcoded styles
3. **Prop Validation**: Consider using PropTypes or TypeScript for prop validation
4. **Accessibility**: Include appropriate ARIA labels and semantic HTML
5. **Performance**: Use React.memo() for components with expensive renders

## Extending the System

To add new components:

1. **Base components**: Add to `/common` for reusable UI elements
2. **Layout components**: Add to `/layout` for positioning and spacing
3. **Composed components**: Add to `/composed` for specific business logic
4. **Update theme**: Add new component styles to `theme.js`
5. **Document**: Add to this README with usage examples