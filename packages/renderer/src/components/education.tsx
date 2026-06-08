import React from 'react';
import { useTheme } from '@contexts/themeContext';
import Container from '@components/layout/container';
import type { EducationVM } from '@resume/contracts';

// BUG FIX (DOM-neutral, DECISIONS drop/fix list): v1 set
// className={theme.components.education.tableCell} on the <td>s, but that theme
// key is UNDEFINED — React omits an `undefined` className, so the rendered DOM
// never had a class there. v2 removes the dead reference entirely; the emitted
// <td> is byte-identical (no class attribute either way). Do NOT introduce a
// `tableCell` class — that would add a DOM attribute and break the render-check.

export default function Education({ data }: { data: EducationVM[] }) {
  const { theme } = useTheme();

  return (
    <Container variant="section" width="section">
      {data.map(({ time, title, content, selectedCourses }, idx) => {
        // For normal mode, arrange content in N rows x 2 columns table
        const tableContent: Array<[[string, string], [string, string] | null]> =
          (() => {
            const rows: Array<[[string, string], [string, string] | null]> = [];
            for (let i = 0; i < content.length; i += 2) {
              rows.push([content[i], content[i + 1] || null]);
            }
            return rows;
          })();

        return (
          <React.Fragment key={idx}>
            <div className={theme.components.education.titleRow}>
              <h2 className={theme.typography.heading}>{title}</h2>
              <span className={theme.components.education.timeText}>{time}</span>
            </div>
            <table className={theme.components.education.table}>
              <tbody>
                {tableContent.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) =>
                      cell ? (
                        <td key={cellIdx}>
                          <span className={theme.components.education.tableKey}>
                            {cell[0]}:
                          </span>{' '}
                          <span className={theme.components.education.tableValue}>
                            {cell[1]}
                          </span>
                        </td>
                      ) : (
                        <td key={cellIdx}></td>
                      )
                    )}
                  </tr>
                ))}
                {selectedCourses && (
                  <tr>
                    <td colSpan={2}>
                      <span className={theme.components.education.tableKey}>
                        Selected Courses:
                      </span>{' '}
                      <span className={theme.components.education.tableValue}>
                        {selectedCourses.map(([course, grade], i) => (
                          <span key={i}>
                            {course} ({grade})
                            {i < selectedCourses.length - 1 ? ', ' : ''}
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
