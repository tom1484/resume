import React from 'react';
import { useTheme } from '@contexts/themeContext';
import Container from '@components/layout/container';

export default function Education({ data }) {
  const { theme } = useTheme();

  return (
    <Container variant="section" width="section">
      {data.map(({ time, title, content, selectedCourses }, idx) => {
        // For normal mode, arrange content in N rows x 2 columns table
        const tableContent = (() => {
          const rows = [];
          for (let i = 0; i < content.length; i += 2) {
            rows.push([content[i], content[i + 1] || null]);
          }
          return rows;
        })();

        return (
          <React.Fragment key={idx}>
            <h2 className={theme.typography.heading}>{title}</h2>
            <table className={theme.components.education.table}>
              <tbody>
                {tableContent.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      cell ? (
                        <td key={cellIdx} className={theme.components.education.tableCell}>
                          <span className={theme.components.education.tableKey}>
                            {cell[0]}:
                          </span>{' '}
                          <span className={theme.components.education.tableValue}>
                            {cell[1]}
                          </span>
                        </td>
                      ) : (
                        <td key={cellIdx} className={theme.components.education.tableCell}></td>
                      )
                    ))}
                  </tr>
                ))}
                {selectedCourses && (
                  <tr>
                    <td colSpan="2" className={theme.components.education.tableCell}>
                      <span className={theme.components.education.tableKey}>
                        Selected Courses:
                      </span>{' '}
                      <span className={theme.components.education.tableValue}>
                        {selectedCourses.map(([course, grade], idx) => (
                          <span key={idx}>
                            {course} ({grade}){idx < selectedCourses.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </React.Fragment>
        );
      })}
    </Container>
  );
}
