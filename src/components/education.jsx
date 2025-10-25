import Container from './layout/Container';
import TwoColumnLayout from './layout/TwoColumnLayout';
import { useTheme } from '../contexts/ThemeContext';

export default function Education({ data }) {
  const { theme, themeMode, THEME_MODES } = useTheme();
  
  return (
    <Container variant="section" width="section">
      {data.map(({ time, title, content }, idx) => {
        // For normal mode, arrange content in N rows x 2 columns table
        const tableContent = themeMode === THEME_MODES.NORMAL ? (() => {
          const rows = [];
          for (let i = 0; i < content.length; i += 2) {
            rows.push([content[i], content[i + 1] || null]);
          }
          return rows;
        })() : null;

        return (
          <TwoColumnLayout
            key={idx}
            leftColumn={
              <h2 className={theme.typography.heading}>{time}</h2>
            }
            rightColumn={
              <>
                <h2 className={theme.typography.heading}>{title}</h2>
                {themeMode === THEME_MODES.NORMAL ? (
                  // Normal mode: N rows x 2 columns layout
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
                    </tbody>
                  </table>
                ) : (
                  // Vibrant mode: Original vertical layout
                  <table className={theme.components.education.table}>
                    <tbody>
                      {content.map(([key, value]) => (
                        <tr key={key}>
                          <td className={theme.components.education.tableKey}>
                            {key}:
                          </td>
                          <td className={theme.components.education.tableValue}>
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            }
            leftWidth="dynamic"
            rightWidth="dynamic"
            alignment="top"
            className=""
          />
        );
      })}
    </Container>
  );
}
