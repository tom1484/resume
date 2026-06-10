import { useConfig } from '@/hooks/useConfig';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { PageHeader } from '@/components/PageHeader';
import { SaveBar } from '@/components/SaveBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { FieldWarning } from '@/components/ui/field-error';
import { weightsSumWarning } from '@/lib/validators';
import { KNOWN_MODELS, type LlmConfig } from '@resume/contracts';

const MODEL_STAGES: { key: keyof LlmConfig['models']; label: string }[] = [
  { key: 'parse', label: 'parse_jd' },
  { key: 'fit', label: 'score (fit)' },
  { key: 'tailor', label: 'tailor' },
  { key: 'tailorDream', label: 'tailor (dream)' },
  { key: 'verify', label: 'verify' },
];

const CUSTOM = '__custom__';

// Model picker: a Select over the known model IDs plus a "Custom…" escape hatch.
// When the current value is not a known model (or the user picks Custom), an
// Input is shown to type a free-form id. The contract field stays a string.
function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const known = (KNOWN_MODELS as readonly string[]).includes(value);
  return (
    <div className="space-y-1.5">
      <Select
        value={known ? value : CUSTOM}
        onValueChange={(next) => onChange(next === CUSTOM ? '' : next)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select model…" />
        </SelectTrigger>
        <SelectContent>
          {(KNOWN_MODELS as readonly string[]).map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      {!known && (
        <Input
          value={value}
          placeholder="custom-model-id"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export function LlmPage() {
  const cfg = useConfig('llm');

  return (
    <div>
      <PageHeader
        title="LLM"
        description="Per-stage models, scoring weights/threshold, batching, polling and JD truncation. Read by the pipeline every cycle."
      />
      <AsyncBoundary
        loading={cfg.loading}
        error={cfg.loadError}
        data={cfg.value}
        onRetry={cfg.reload}
      >
        {(v: LlmConfig) => {
          const set = (patch: Partial<LlmConfig>) => cfg.set({ ...v, ...patch });
          return (
            <div className="space-y-6">
              <SaveBar status={cfg.status} onSave={cfg.save} />
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Models per stage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {MODEL_STAGES.map((m) => (
                      <div key={m.key} className="space-y-1.5">
                        <Label>{m.label}</Label>
                        <ModelPicker
                          value={v.models[m.key]}
                          onChange={(next) =>
                            set({
                              models: { ...v.models, [m.key]: next },
                            })
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Scoring</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="scoreThreshold">Score threshold (0–1)</Label>
                      <Input
                        id="scoreThreshold"
                        type="number"
                        step={0.01}
                        min={0}
                        max={1}
                        value={v.scoreThreshold}
                        onChange={(e) =>
                          set({ scoreThreshold: Number(e.target.value) })
                        }
                      />
                    </div>
                    <Label>Weights</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['keyword', 'llmFit', 'structural'] as const).map((w) => (
                        <div key={w}>
                          <Label className="text-xs text-muted-foreground">
                            {w}
                          </Label>
                          <Input
                            type="number"
                            step={0.05}
                            value={v.weights[w]}
                            onChange={(e) =>
                              set({
                                weights: {
                                  ...v.weights,
                                  [w]: Number(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <FieldWarning message={weightsSumWarning(v.weights)} />
                    <p className="text-xs text-muted-foreground">
                      score = w.keyword·keyword + w.llmFit·llmFit +
                      w.structural·structural
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Throughput</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Batch size</Label>
                      <Input
                        type="number"
                        min={1}
                        value={v.batchSize}
                        onChange={(e) =>
                          set({ batchSize: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Poll interval (ms)</Label>
                      <Input
                        type="number"
                        min={1000}
                        value={v.pollIntervalMs}
                        onChange={(e) =>
                          set({ pollIntervalMs: Number(e.target.value) })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>JD truncation (chars)</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-3">
                    {(['parse', 'fit', 'tailor'] as const).map((k) => (
                      <div key={k} className="space-y-1.5">
                        <Label>{k}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={v.jdTruncation[k]}
                          onChange={(e) =>
                            set({
                              jdTruncation: {
                                ...v.jdTruncation,
                                [k]: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
