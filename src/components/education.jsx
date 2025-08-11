import Container from './layout/Container';
import TwoColumnLayout from './layout/TwoColumnLayout';
import { theme } from '../config/theme';

export default function Education({ data }) {
  return (
    <Container variant="section" width="section">
      {data.map(({ time, title, content }, idx) => (
        <TwoColumnLayout
          key={idx}
          leftColumn={
            <h2 className={theme.typography.heading}>{time}</h2>
          }
          rightColumn={
            <>
              <h2 className={theme.typography.heading}>{title}</h2>
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
            </>
          }
          leftWidth="dynamic"
          rightWidth="dynamic"
          alignment="top"
          className=""
        />
      ))}
    </Container>
  );
}
