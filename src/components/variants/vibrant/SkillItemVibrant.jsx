import Card from '../../common/Card';
import Image from '../../common/Image';
import { useTheme } from '../../../contexts/ThemeContext';

// Vibrant variant of skill item - badge with icon
export default function SkillItemVibrant({ 
  title,
  icon,
  variant = 'default',
  showIcon = true,
  className = '',
  ...props 
}) {
  const { theme } = useTheme();
  
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
