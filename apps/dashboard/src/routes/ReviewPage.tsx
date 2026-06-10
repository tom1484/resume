import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';
import { api, ApiError } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { fmtScore } from '@/lib/utils';
import { AsyncBoundary, ErrorBanner } from '@/components/AsyncBoundary';
import { PageHeader } from '@/components/PageHeader';
import { PreviewModal } from '@/components/PreviewModal';
import { SaveBar, type SaveStatus } from '@/components/SaveBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  buildEditorModel,
  editorTreeToOverlay,
  ResumeTree,
  type EditorTree,
} from '@/resumeEditor';
import type {
  JobStatus,
  JobListItem,
  JobDetail,
  ScoreBreakdown,
  ResumeDoc,
  Overlay,
} from '@resume/contracts';

const STATUS_TABS: { value: JobStatus; label: string }[] = [
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'scored', label: 'Scored' },
  { value: 'rejected', label: 'Rejected' },
];

function Inbox({ onOpen }: { onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<JobStatus>('in_review');
  const list = useAsync(() => api.jobs(status), [status]);

  return (
    <div>
      <PageHeader
        title="Review"
        description="Triage scored jobs, edit the tailored overlay, approve or reject."
      />
      <Tabs value={status} onValueChange={(v) => setStatus(v as JobStatus)}>
        <TabsList>
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={status}>
          <Card className="mt-4">
            <CardContent className="p-0">
              <AsyncBoundary
                loading={list.loading}
                error={list.error}
                data={list.data}
                onRetry={list.reload}
              >
                {(rows: JobListItem[]) => (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead>Flags</TableHead>
                        <TableHead>Label</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-muted-foreground"
                          >
                            No jobs in this status.
                          </TableCell>
                        </TableRow>
                      )}
                      {rows.map((j) => (
                        <TableRow
                          key={j.id}
                          className="cursor-pointer"
                          onClick={() => onOpen(j.id)}
                        >
                          <TableCell className="font-medium">
                            {j.company}
                          </TableCell>
                          <TableCell>{j.title}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {j.location ?? '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmtScore(j.score)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {j.company_flags.map((f) => (
                                <Badge key={f} variant="outline">
                                  {f}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {j.label ? (
                              <Badge
                                variant={
                                  j.label === 'good' ? 'success' : 'destructive'
                                }
                              >
                                {j.label}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AsyncBoundary>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoreBreakdownView({ b }: { b: ScoreBreakdown }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ['keyword', b.keyword],
            ['llmFit', b.llmFit],
            ['structural', b.structural],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="font-mono text-lg">{v.toFixed(3)}</div>
            <div className="text-xs text-muted-foreground">
              w={b.weights[k as keyof typeof b.weights]}
            </div>
          </div>
        ))}
      </div>

      {b.rationale && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            Rationale
          </div>
          <p className="mt-1">{b.rationale}</p>
        </div>
      )}

      {b.constraintsFired.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            Constraints fired
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {b.constraintsFired.map((c, i) => (
              <Badge
                key={`${c.id}-${i}`}
                variant={c.effect === 'hard' ? 'destructive' : 'warning'}
              >
                {c.id} · {c.effect}
                {c.amount != null ? ` −${c.amount}` : ''}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {b.preferencesApplied.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            Preferences applied
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {b.preferencesApplied.map((p, i) => (
              <Badge key={`${p.id}-${i}`} variant="secondary">
                {p.id} · p{p.priority}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {b.redFlags.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            Red flags
          </div>
          <ul className="ml-5 mt-1 list-disc text-destructive">
            {b.redFlags.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {b.missingTerms.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            Missing terms
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {b.missingTerms.map((t, i) => (
              <Badge key={i} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PatchDiff({ job }: { job: JobDetail }) {
  const patches = job.overlay?.patches ?? [];
  const unsupported = new Set(job.audit?.unsupported ?? []);
  if (patches.length === 0)
    return <p className="text-sm text-muted-foreground">No patches.</p>;
  return (
    <div className="space-y-2 text-sm">
      {patches.map((p, i) => {
        const value = (p as { value?: unknown }).value;
        const lines = Array.isArray(value) ? (value as string[]) : [String(value)];
        return (
          <div key={i} className="rounded-md border p-3">
            <div className="flex items-center justify-between font-mono text-xs">
              <span>
                {p.op} {p.path}
              </span>
              {unsupported.has(i) && (
                <Badge variant="destructive">unsupported</Badge>
              )}
            </div>
            <ul className="ml-5 mt-1 list-disc">
              {lines.map((l, j) => (
                <li key={j}>{l}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function OverlayEditor({
  job,
  resume,
  onSaved,
  previewKey,
}: {
  job: JobDetail;
  resume: ResumeDoc;
  onSaved: () => void;
  previewKey: number;
}) {
  const [tree, setTree] = useState<EditorTree>(() =>
    buildEditorModel(job.overlay ?? {}, resume)
  );
  const [cover, setCover] = useState(job.cover_letter ?? '');
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [preview, setPreview] = useState(false);

  // The SAME transform save() uses, computed live so the preview renders the
  // current UNSAVED overlay (no save required before previewing).
  const liveOverlay: Overlay = useMemo(
    () => editorTreeToOverlay(tree, job.id, cover || null, resume),
    [tree, cover, job.id, resume]
  );

  const save = useCallback(async () => {
    setStatus({ kind: 'saving' });
    try {
      await api.putOverlay(job.id, liveOverlay);
      setStatus({ kind: 'saved' });
      onSaved();
    } catch (e) {
      if (e instanceof ApiError)
        setStatus({ kind: 'error', message: e.message, problems: e.problems });
      else setStatus({ kind: 'error', message: String(e) });
    }
  }, [liveOverlay, job.id, onSaved]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Overlay editor</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
          <Eye className="size-4" /> Preview résumé
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Toggle sections/items/bullets and reorder by dragging. Reviewer edits
            are trusted and bypass the fabrication verify. Saving writes a new
            overlay (section selection + reviewer filters + highlight patches).
          </p>
          <div className="rounded-md border p-3">
            <ResumeTree tree={tree} onChange={setTree} mode="overlay" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium">Cover letter</div>
            <Textarea
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              rows={8}
            />
          </div>
          <SaveBar status={status} onSave={save} label="Save overlay" />
        </div>
      </CardContent>
      {preview && (
        <PreviewModal
          open={preview}
          onOpenChange={setPreview}
          applicationId={job.id}
          overlay={liveOverlay}
          reloadKey={previewKey}
        />
      )}
    </Card>
  );
}

function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const job = useAsync(() => api.job(id), [id]);
  const resume = useAsync(() => api.resume(), []);
  const [actionErr, setActionErr] = useState<Error>();
  const [rev, setRev] = useState(0);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      setActionErr(undefined);
      try {
        await fn();
        job.reload();
      } catch (e) {
        setActionErr(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [job]
  );

  return (
    <div>
      <PageHeader
        title="Review job"
        actions={
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" /> Inbox
          </Button>
        }
      />
      {actionErr && (
        <div className="mb-4">
          <ErrorBanner error={actionErr} />
        </div>
      )}
      <AsyncBoundary
        loading={job.loading}
        error={job.error}
        data={job.data}
        onRetry={job.reload}
      >
        {(j: JobDetail) => (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {j.company} — {j.title}
                  <Badge variant="secondary">{j.status}</Badge>
                  {j.company_flags.map((f) => (
                    <Badge key={f} variant="outline">
                      {f}
                    </Badge>
                  ))}
                  <span className="ml-auto font-mono text-base">
                    {fmtScore(j.score)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={j.status !== 'in_review'}
                  onClick={() => act(() => api.approve(j.id))}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    act(() => api.reject(j.id, 'rejected by reviewer'))
                  }
                >
                  Reject
                </Button>
                <div className="ml-2 flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">label:</span>
                  <Button
                    size="sm"
                    variant={j.label === 'good' ? 'default' : 'outline'}
                    onClick={() => act(() => api.label(j.id, 'good'))}
                  >
                    good
                  </Button>
                  <Button
                    size="sm"
                    variant={j.label === 'bad' ? 'destructive' : 'outline'}
                    onClick={() => act(() => api.label(j.id, 'bad'))}
                  >
                    bad
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => act(() => api.label(j.id, null))}
                  >
                    clear
                  </Button>
                </div>
                {j.url && (
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Original posting
                  </a>
                )}
              </CardContent>
            </Card>

            {j.reject_reason && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Reject reason</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">{j.reject_reason}</CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Score breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {j.score_breakdown ? (
                  <ScoreBreakdownView b={j.score_breakdown} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not scored yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="patches">
              <TabsList>
                <TabsTrigger value="patches">Patch diff</TabsTrigger>
                <TabsTrigger value="cover">Cover letter</TabsTrigger>
                <TabsTrigger value="jd">JD</TabsTrigger>
              </TabsList>
              <TabsContent value="patches">
                <Card>
                  <CardContent className="pt-6">
                    <PatchDiff job={j} />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="cover">
                <Card>
                  <CardContent className="whitespace-pre-wrap pt-6 text-sm">
                    {j.cover_letter || (
                      <span className="text-muted-foreground">
                        No cover letter.
                      </span>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="jd">
                <Card>
                  <CardContent className="max-h-[600px] overflow-auto whitespace-pre-wrap pt-6 font-mono text-xs">
                    {j.jd_text || (
                      <span className="text-muted-foreground">
                        No JD text.
                      </span>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <AsyncBoundary
              loading={resume.loading}
              error={resume.error}
              data={resume.data}
              onRetry={resume.reload}
            >
              {(doc: ResumeDoc) => (
                <OverlayEditor
                  key={j.id}
                  job={j}
                  resume={doc}
                  previewKey={rev}
                  onSaved={() => {
                    setRev((r) => r + 1);
                    job.reload();
                  }}
                />
              )}
            </AsyncBoundary>
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}

export function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const open = useMemo(() => (jid: string) => navigate(`/review/${jid}`), [navigate]);
  const back = useCallback(() => navigate('/review'), [navigate]);

  // Reset scroll on navigation between inbox/detail.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  return id ? <Detail id={id} onBack={back} /> : <Inbox onOpen={open} />;
}
