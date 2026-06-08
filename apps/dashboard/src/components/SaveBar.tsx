import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string; problems?: string[] };

export function SaveBar({
  status,
  onSave,
  disabled,
  label = 'Save',
  extra,
}: {
  status: SaveStatus;
  onSave: () => void;
  disabled?: boolean;
  label?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={onSave} disabled={disabled || status.kind === 'saving'}>
        {status.kind === 'saving' && (
          <Loader2 className="size-4 animate-spin" />
        )}
        {label}
      </Button>
      {extra}
      {status.kind === 'saved' && (
        <span className="flex items-center gap-1 text-sm text-emerald-600">
          <Check className="size-4" /> Saved
        </span>
      )}
      {status.kind === 'error' && (
        <div className="text-sm text-destructive">
          <span className="flex items-center gap-1 font-medium">
            <AlertTriangle className="size-4" /> {status.message}
          </span>
          {status.problems && status.problems.length > 0 && (
            <ul className="ml-5 mt-1 list-disc font-mono text-xs">
              {status.problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
