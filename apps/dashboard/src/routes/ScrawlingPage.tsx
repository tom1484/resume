import { Trash2, Plus } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { PageHeader } from '@/components/PageHeader';
import { SaveBar } from '@/components/SaveBar';
import { StringListEditor } from '@/components/StringListEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type {
  DiscoveryConfig,
  ScheduleConfig,
  DiscoverySearch,
  DiscoveryCompany,
} from '@resume/contracts';

const SITES = ['indeed', 'linkedin'] as const;
const COMPANY_FLAGS = ['dream', 'startup', 'return-path'] as const;
const PROVIDERS = ['greenhouse', 'lever', 'ashby'] as const;
const MODES = ['boards', 'jobspy', 'all'] as const;

function ScheduleCard({
  v,
  onChange,
}: {
  v: ScheduleConfig;
  onChange: (next: ScheduleConfig) => void;
}) {
  const d = v.discovery;
  const set = (patch: Partial<ScheduleConfig['discovery']>) =>
    onChange({ ...v, discovery: { ...d, ...patch } });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Discovery enabled</Label>
          <Switch
            checked={d.enabled}
            onCheckedChange={(c) => set({ enabled: c })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Cron</Label>
            <Input value={d.cron} onChange={(e) => set({ cron: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Input value={d.tz} onChange={(e) => set({ tz: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            value={d.mode}
            onChange={(e) =>
              set({ mode: e.target.value as ScheduleConfig['discovery']['mode'] })
            }
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          The in-process scheduler reads this each tick — an edit takes effect next
          tick, no restart.
        </p>
      </CardContent>
    </Card>
  );
}

function SearchesCard({
  v,
  onChange,
}: {
  v: DiscoveryConfig;
  onChange: (next: DiscoveryConfig) => void;
}) {
  const upd = (i: number, patch: Partial<DiscoverySearch>) =>
    onChange({
      ...v,
      searches: v.searches.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });
  const add = () =>
    onChange({
      ...v,
      searches: [...v.searches, { name: 'new', term: '', enabled: true }],
    });
  const del = (i: number) =>
    onChange({ ...v, searches: v.searches.filter((_, j) => j !== i) });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Searches</CardTitle>
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {v.searches.length === 0 && (
          <p className="text-sm text-muted-foreground">No searches.</p>
        )}
        {v.searches.map((s, i) => (
          <div
            key={i}
            className="flex flex-wrap items-end gap-2 rounded-md border p-3"
          >
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={s.name}
                onChange={(e) => upd(i, { name: e.target.value })}
              />
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1">
              <Label className="text-xs">Term</Label>
              <Input
                value={s.term}
                onChange={(e) => upd(i, { term: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                checked={s.enabled}
                onCheckedChange={(c) => upd(i, { enabled: c })}
              />
              <Button variant="ghost" size="icon" onClick={() => del(i)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CompaniesCard({
  v,
  onChange,
}: {
  v: DiscoveryConfig;
  onChange: (next: DiscoveryConfig) => void;
}) {
  const upd = (i: number, patch: Partial<DiscoveryCompany>) =>
    onChange({
      ...v,
      companies: v.companies.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    });
  const add = () =>
    onChange({
      ...v,
      companies: [
        ...v.companies,
        { name: 'new', flags: [], board: null, enabled: true },
      ],
    });
  const del = (i: number) =>
    onChange({ ...v, companies: v.companies.filter((_, j) => j !== i) });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Companies (board scrapers)</CardTitle>
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {v.companies.length === 0 && (
          <p className="text-sm text-muted-foreground">No companies.</p>
        )}
        {v.companies.map((c, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[10rem] flex-1 space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={c.name}
                  onChange={(e) => upd(i, { name: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={c.enabled}
                  onCheckedChange={(en) => upd(i, { enabled: en })}
                />
                <Button variant="ghost" size="icon" onClick={() => del(i)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Board provider</Label>
                <select
                  className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm"
                  value={c.board?.provider ?? ''}
                  onChange={(e) =>
                    upd(i, {
                      board: e.target.value
                        ? {
                            provider:
                              e.target.value as DiscoveryCompany['board'] extends null
                                ? never
                                : (typeof PROVIDERS)[number],
                            slug: c.board?.slug ?? '',
                          }
                        : null,
                    })
                  }
                >
                  <option value="">none</option>
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              {c.board && (
                <div className="min-w-[8rem] flex-1 space-y-1">
                  <Label className="text-xs">Slug</Label>
                  <Input
                    value={c.board.slug}
                    onChange={(e) =>
                      upd(i, {
                        board: { provider: c.board!.provider, slug: e.target.value },
                      })
                    }
                  />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Flags</Label>
              <div className="flex flex-wrap gap-3">
                {COMPANY_FLAGS.map((f) => (
                  <label key={f} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={c.flags.includes(f)}
                      onChange={(e) =>
                        upd(i, {
                          flags: e.target.checked
                            ? [...c.flags, f]
                            : c.flags.filter((x) => x !== f),
                        })
                      }
                    />
                    {f}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ScrawlingPage() {
  const discovery = useConfig('discovery');
  const schedule = useConfig('schedule');

  return (
    <div>
      <PageHeader
        title="Scrawling"
        description="Discovery searches & companies, JobSpy sites/defaults, exclude rules, and the discovery schedule."
      />
      <div className="space-y-8">
        <section className="space-y-4">
          <AsyncBoundary
            loading={schedule.loading}
            error={schedule.loadError}
            data={schedule.value}
            onRetry={schedule.reload}
          >
            {(v) => (
              <>
                <SaveBar status={schedule.status} onSave={schedule.save} label="Save schedule" />
                <ScheduleCard v={v} onChange={schedule.set} />
              </>
            )}
          </AsyncBoundary>
        </section>

        <section className="space-y-4">
          <AsyncBoundary
            loading={discovery.loading}
            error={discovery.loadError}
            data={discovery.value}
            onRetry={discovery.reload}
          >
            {(v: DiscoveryConfig) => {
              const set = (patch: Partial<DiscoveryConfig>) =>
                discovery.set({ ...v, ...patch });
              return (
                <>
                  <SaveBar
                    status={discovery.status}
                    onSave={discovery.save}
                    label="Save discovery"
                  />
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>JobSpy</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Sites</Label>
                          <div className="flex gap-3">
                            {SITES.map((s) => (
                              <label
                                key={s}
                                className="flex items-center gap-1.5 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={v.sites.includes(s)}
                                  onChange={(e) =>
                                    set({
                                      sites: e.target.checked
                                        ? [...v.sites, s]
                                        : v.sites.filter((x) => x !== s),
                                    })
                                  }
                                />
                                {s}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Results wanted</Label>
                            <Input
                              type="number"
                              value={v.jobspyDefaults.resultsWanted}
                              onChange={(e) =>
                                set({
                                  jobspyDefaults: {
                                    ...v.jobspyDefaults,
                                    resultsWanted: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Hours old</Label>
                            <Input
                              type="number"
                              value={v.jobspyDefaults.hoursOld}
                              onChange={(e) =>
                                set({
                                  jobspyDefaults: {
                                    ...v.jobspyDefaults,
                                    hoursOld: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Job type</Label>
                            <Input
                              value={v.jobspyDefaults.jobType}
                              onChange={(e) =>
                                set({
                                  jobspyDefaults: {
                                    ...v.jobspyDefaults,
                                    jobType: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Location</Label>
                            <Input
                              value={v.jobspyDefaults.location}
                              onChange={(e) =>
                                set({
                                  jobspyDefaults: {
                                    ...v.jobspyDefaults,
                                    location: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Filters</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Title include</Label>
                          <StringListEditor
                            values={v.titleInclude}
                            onChange={(next) => set({ titleInclude: next })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Exclude — title</Label>
                          <StringListEditor
                            values={v.exclude.title}
                            onChange={(next) =>
                              set({ exclude: { ...v.exclude, title: next } })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Exclude — JD</Label>
                          <StringListEditor
                            values={v.exclude.jd}
                            onChange={(next) =>
                              set({ exclude: { ...v.exclude, jd: next } })
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <SearchesCard v={v} onChange={discovery.set} />
                    <CompaniesCard v={v} onChange={discovery.set} />
                  </div>
                </>
              );
            }}
          </AsyncBoundary>
        </section>
      </div>
    </div>
  );
}
