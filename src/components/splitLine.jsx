import { theme } from '../config/theme';

export default function SplitLine({ width, weight }) {
  return (
    <hr className={`${theme.components.splitLine.default} w-${width} bg-neutral-${weight}`} />
  );
}
