import { useConfig } from '@/hooks/useConfig';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { PageHeader } from '@/components/PageHeader';
import { SaveBar } from '@/components/SaveBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LlmConfig } from '@resume/contracts';

const MODEL_STAGES: { key: keyof LlmConfig['models']; label: string }[] = [
  { key: 'parse', label: 'parse_jd' },
  { key: 'fit', label: 'score (fit)' },
  { key: 'tailor', label: 'tailor' },
  { key: 'tailorDream', label: 'tailor (dream)' },
  { key: 'verify', label: 'verify' },
];

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
                        <Input
                          value={v.models[m.key]}
                          onChange={(e) =>
                            set({
                              models: { ...v.models, [m.key]: e.target.value },
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
