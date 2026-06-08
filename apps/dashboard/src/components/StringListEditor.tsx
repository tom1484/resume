import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Editable list of plain strings rendered as removable chips + an add box.
export function StringListEditor({
  values,
  onChange,
  placeholder = 'Add…',
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <Badge key={`${v}-${i}`} variant="secondary" className="gap-1">
            {v}
            <button
              type="button"
              aria-label={`remove ${v}`}
              onClick={() => onChange(values.filter((_, j) => j !== i))}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground">empty</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
