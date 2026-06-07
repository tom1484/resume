import React from 'react';
import { useTheme } from '@contexts/themeContext';
import Container from '@components/layout/container';

// Generic Section wrapper component
export default function Section({ 
  title,
  children,
  id,
  className = '',
  containerProps = {},
  titleProps = {},
  showDivider = true,
  spacing = 'default',
  ...props 
}) {
  const { theme } = useTheme();
  
  const getSectionSpacing = () => {
    switch (spacing) {
      case 'none':
        return '';
      case 'small':
        return 'mb-2';
      case 'large':
        return 'mb-6';
      case 'default':
      default:
        return theme.layout.margins.section; // mb-2
    }
  };

  return (
    <section 
      id={id}
      className={`${getSectionSpacing()} ${className}`}
      {...props}
    >
      {title && (
        <>
          <Container 
            variant="section"
            width="section"
            {...containerProps}
          >
            <div className={theme.components.title.titleWrapper}>
              <h2 
                className={theme.typography.sectionTitle}
                {...titleProps}
              >
                {title}
              </h2>
            </div>
            {showDivider && (
              <hr className={theme.components.title.divider} />
            )}
          </Container>
        </>
      )}
      
      <Container 
        variant="section"
        width="section"
        padding={false}
        {...containerProps}
      >
        {children}
      </Container>
    </section>
  );
}