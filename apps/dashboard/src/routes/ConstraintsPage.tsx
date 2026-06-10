import { Trash2, Plus } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { PageHeader } from '@/components/PageHeader';
import { SaveBar } from '@/components/SaveBar';
import { StringListEditor } from '@/components/StringListEditor';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  JdSchema,
  type ConstraintsConfig,
  type Constraint,
  type ConstraintField,
} from '@resume/contracts';

const SENIORITY_OPTIONS = JdSchema.shape.seniority.options;
const SPONSORSHIP_OPTIONS = JdSchema.shape.sponsorshipAvailable.options;

const FIELDS: ConstraintField[] = [
  'citizenshipOrClearanceRequired',
  'sponsorshipAvailable',
  'seniority',
  'minEducation',
  'internshipTerm',
];
const TEST_KINDS = ['isTrue', 'equals', 'notIn'] as const;
const EFFECT_KINDS = ['hard', 'penalty'] as const;

type TestKind = (typeof TEST_KINDS)[number];
type EffectKind = (typeof EFFECT_KINDS)[number];

function newId(): string {
  return `constraint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function defaultTest(kind: TestKind): Constraint['test'] {
  if (kind === 'isTrue') return { kind: 'isTrue' };
  if (kind === 'equals') return { kind: 'equals', value: '' };
  return { kind: 'notIn', values: [] };
}
function defaultEffect(kind: EffectKind): Constraint['effect'] {
  return kind === 'hard' ? { kind: 'hard' } : { kind: 'penalty', amount: 0.5 };
}

export function ConstraintsPage() {
  const cfg = useConfig('constraints');

  return (
    <div>
      <PageHeader
        title="Constraints"
        description="Hard, deterministic rules over parsed-JD fields. A 'hard' fire forces score 0; a 'penalty' subtracts from structural."
      />
      <AsyncBoundary
        loading={cfg.loading}
        error={cfg.loadError}
        data={cfg.value}
        onRetry={cfg.reload}
      >
        {(list: ConstraintsConfig) => {
          const upd = (i: number, patch: Partial<Constraint>) =>
            cfg.set(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
          const add = () =>
            cfg.set([
              ...list,
              {
                id: newId(),
                label: '',
                field: 'citizenshipOrClearanceRequired',
                test: { kind: 'isTrue' },
                effect: { kind: 'hard' },
                enabled: true,
              },
            ]);
          const del = (i: number) => cfg.set(list.filter((_, j) => j !== i));

          return (
            <div className="space-y-4">
              <SaveBar
                status={cfg.status}
                onSave={cfg.save}
                extra={
                  <Button variant="outline" onClick={add}>
                    <Plus className="size-4" /> Add constraint
                  </Button>
                }
              />
              {list.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No constraints. Add one above.
                </p>
              )}
              {list.map((c, i) => (
                <Card key={c.id}>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={c.label}
                          placeholder="must accept F-1 (no citizenship/clearance)"
                          onChange={(e) => upd(i, { label: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={c.enabled}
                          onCheckedChange={(en) => upd(i, { enabled: en })}
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

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Field</Label>
                        <Select
                          value={c.field}
                          onValueChange={(next) =>
                            upd(i, { field: next as ConstraintField })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELDS.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Test</Label>
                        <Select
                          value={c.test.kind}
                          onValueChange={(next) =>
                            upd(i, { test: defaultTest(next as TestKind) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TEST_KINDS.map((k) => (
                              <SelectItem key={k} value={k}>
                                {k}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Effect</Label>
                        <Select
                          value={c.effect.kind}
                          onValueChange={(next) =>
                            upd(i, {
                              effect: defaultEffect(next as EffectKind),
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EFFECT_KINDS.map((k) => (
                              <SelectItem key={k} value={k}>
                                {k}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {c.test.kind === 'equals' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Equals value</Label>
                        {c.field === 'seniority' ||
                        c.field === 'sponsorshipAvailable' ? (
                          <Select
                            value={c.test.value}
                            onValueChange={(next) =>
                              upd(i, { test: { kind: 'equals', value: next } })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select value…" />
                            </SelectTrigger>
                            <SelectContent>
                              {(c.field === 'seniority'
                                ? SENIORITY_OPTIONS
                                : SPONSORSHIP_OPTIONS
                              ).map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={c.test.value}
                            onChange={(e) =>
                              upd(i, {
                                test: { kind: 'equals', value: e.target.value },
                              })
                            }
                          />
                        )}
                      </div>
                    )}
                    {c.test.kind === 'notIn' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Not in</Label>
                        <StringListEditor
                          values={c.test.values}
                          onChange={(next) =>
                            upd(i, { test: { kind: 'notIn', values: next } })
                          }
                        />
                      </div>
                    )}
                    {c.effect.kind === 'penalty' && (
                      <div className="max-w-[10rem] space-y-1">
                        <Label className="text-xs">Penalty (0–1)</Label>
                        <Input
                          type="number"
                          step={0.1}
                          min={0}
                          max={1}
                          value={c.effect.amount}
                          onChange={(e) =>
                            upd(i, {
                              effect: {
                                kind: 'penalty',
                                amount: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                    )}
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
