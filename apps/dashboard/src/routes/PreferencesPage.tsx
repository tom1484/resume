import { Trash2, Plus } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { PageHeader } from '@/components/PageHeader';
import { SaveBar } from '@/components/SaveBar';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PreferencesConfig, Preference } from '@resume/contracts';

function priorityLabel(p: number): string {
  if (p >= 9) return 'decisive';
  if (p >= 6) return 'important';
  if (p >= 3) return 'moderate';
  return 'mild';
}

function newId(): string {
  return `pref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function PreferencesPage() {
  const cfg = useConfig('preferences');

  return (
    <div>
      <PageHeader
        title="Preferences"
        description="Soft, priority-weighted considerations fed to the LLM scorer (9–10 decisive · 6–8 important · 3–5 moderate · 1–2 mild)."
      />
      <AsyncBoundary
        loading={cfg.loading}
        error={cfg.loadError}
        data={cfg.value}
        onRetry={cfg.reload}
      >
        {(list: PreferencesConfig) => {
          const upd = (i: number, patch: Partial<Preference>) =>
            cfg.set(list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
          const add = () =>
            cfg.set([
              ...list,
              { id: newId(), text: '', priority: 5, enabled: true },
            ]);
          const del = (i: number) => cfg.set(list.filter((_, j) => j !== i));

          return (
            <div className="space-y-4">
              <SaveBar
                status={cfg.status}
                onSave={cfg.save}
                extra={
                  <Button variant="outline" onClick={add}>
                    <Plus className="size-4" /> Add preference
                  </Button>
                }
              />
              {list.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No preferences. Add one above.
                </p>
              )}
              {list.map((p, i) => (
                <Card key={p.id}>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Text</Label>
                        <Textarea
                          value={p.text}
                          onChange={(e) => upd(i, { text: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={p.enabled}
                          onCheckedChange={(c) => upd(i, { enabled: c })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => del(i)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="w-20 text-xs">
                        Priority {p.priority}
                      </Label>
                      <Slider
                        className="max-w-xs"
                        min={1}
                        max={10}
                        step={1}
                        value={[p.priority]}
                        onValueChange={([val]) =>
                          upd(i, { priority: val ?? p.priority })
                        }
                      />
                      <Badge variant="secondary">{priorityLabel(p.priority)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
