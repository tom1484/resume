import TwoColumnLayout from './layout/TwoColumnLayout';
import Link from './common/Link';
import Image from './common/Image';
import { useTheme } from '../contexts/ThemeContext';

export default function PersonalInfo({ data }) {
  const { theme } = useTheme();
  
  const info = data.info;
  const link = data.link;
  
  const renderInfoTable = () => (
    <table className={theme.components.personalInfo.table}>
      <tbody>
        {info.map(([key, value]) => (
          <tr key={key}>
            <td className={theme.components.personalInfo.tableKey}>
              {key}:
            </td>
            <td className={theme.components.personalInfo.tableValue}>
              {value}
            </td>
          </tr>
        ))}
        <tr>
          <td className={theme.components.personalInfo.tableKey}>
            Links:
          </td>
          <td className={theme.components.personalInfo.tableValue}>
            {link.map(([key, value]) => (
              <Link
                key={key}
                href={value}
                className={theme.components.personalInfo.link}
              >
                {key}
              </Link>
            ))}
          </td>
        </tr>
      </tbody>
    </table>
  );

  const renderNameSection = () => (
    <div className={theme.components.personalInfo.nameSection}>
      <h1 className={`${theme.typography.mainTitle} ${theme.components.container.justifyCenter} ${theme.components.container.itemsCenter}`}>
        Chu-Rong Chen
      </h1>
    </div>
  );

  const renderQRSection = () => (
    <div className={theme.components.personalInfo.qrSection}>
      {data.qrcodes && data.qrcodes.map(([key, value]) => (
        <Image
          key={key}
          src={`/asset/image/${value}`}
          alt={`${key} QR code`}
          variant="default"
          size="qr"
          label={key}
          labelPosition="bottom"
        />
      ))}
    </div>
  );

  return (
    <div className={`${theme.components.personalInfo.container} ${theme.layout.containerWidth} ${theme.layout.margins.section}`}>
      {renderInfoTable()}
      {renderNameSection()}
      {renderQRSection()}
    </div>
  );
}
