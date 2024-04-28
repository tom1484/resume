export default function SplitLine({ width, weight }) {
  return (
    <hr className={`h-0.5 w-${width} border-t-0 bg-neutral-${weight}`} />
  );
}
