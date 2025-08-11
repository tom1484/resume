import Card from '../common/Card';
import Image from '../common/Image';
import { theme } from '../../config/theme';

// Composed component for skill items
export default function SkillItem({ 
  title,
  icon,
  variant = 'default',
  showIcon = true,
  className = '',
  ...props 
}) {
  return (
    <Card 
      variant="skill"
      border={true}
      rounded={true}
      className={`mt-2 mr-3 ${className}`}
      {...props}
    >
      {showIcon && icon && (
        <Image
          src={`asset/image/${icon}`}
          alt={title}
          variant="icon"
          size="icon"
        />
      )}
      <h2 className={theme.components.skills.text}>
        {title}
      </h2>
    </Card>
  );
}