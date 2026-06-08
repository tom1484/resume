import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { PageHeader } from '@/components/PageHeader';
import { ResumeCanvas } from '@/components/ResumeCanvas';
import { SaveBar, type SaveStatus } from '@/components/SaveBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  buildEditorModel,
  treeToResume,
  ResumeTree,
  PAPER_SIZES,
  type EditorTree,
} from '@/resumeEditor';
import { ResumeDoc } from '@resume/contracts';
import type { ResumeDoc as ResumeDocT } from '@resume/contracts';

type PrintMeta = NonNullable<ResumeDocT['meta']['print']>;

function PrintEditor({
  doc,
  onChange,
}: {
  doc: ResumeDocT;
  onChange: (next: ResumeDocT) => void;
}) {
  const print: PrintMeta = doc.meta.print ?? {
    paperSize: 'A4',
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    scale: 1,
  };
  const set = (patch: Partial<PrintMeta>) =>
    onChange({
      ...doc,
      meta: { ...doc.meta, print: { ...print, ...patch } },
    });
  const setMargin = (k: keyof PrintMeta['margins'], v: number) =>
    set({ margins: { ...print.margins, [k]: v } });

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="paper">Paper size</Label>
        <select
          id="paper"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          value={print.paperSize}
          onChange={(e) => set({ paperSize: e.target.value as PrintMeta['paperSize'] })}
        >
          {PAPER_SIZES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Margins (mm)</Label>
        <div className="mt-1.5 grid grid-cols-4 gap-2">
          {(['top', 'right', 'bottom', 'left'] as const).map((k) => (
            <div key={k}>
              <Label className="text-xs text-muted-foreground">{k}</Label>
              <Input
                type="number"
                min={0}
                value={print.margins[k]}
                onChange={(e) => setMargin(k, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scale">Scale</Label>
        <Input
          id="scale"
          type="number"
          step={0.05}
          min={0.1}
          value={print.scale}
          onChange={(e) => set({ scale: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

function Editor({ initial }: { initial: ResumeDocT }) {
  const [doc, setDoc] = useState<ResumeDocT>(initial);
  const [tree, setTree] = useState<EditorTree>(() =>
    buildEditorModel({}, initial, initial.meta.sectionOrder)
  );
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initial, null, 2));
  const [jsonErr, setJsonErr] = useState<string>();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [rev, setRev] = useState(0);

  // Structured edits → doc (treeToResume preserves slots, §2 invariant).
  const applyTree = useCallback(
    (next: EditorTree) => {
      setTree(next);
      const merged = treeToResume(next, doc);
      setDoc(merged);
      setJsonText(JSON.stringify(merged, null, 2));
    },
    [doc]
  );

  // JSON edits → validate against ResumeDoc, then rebuild the structured tree.
  const applyJson = useCallback((text: string) => {
    setJsonText(text);
    try {
      const obj: unknown = JSON.parse(text);
      const parsed = ResumeDoc.safeParse(obj);
      if (!parsed.success) {
        setJsonErr(
          parsed.error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join('/')} ${i.message}`)
            .join('; ')
        );
        return;
      }
      setJsonErr(undefined);
      setDoc(parsed.data);
      setTree(buildEditorModel({}, parsed.data, parsed.data.meta.sectionOrder));
    } catch (e) {
      setJsonErr(`JSON parse: ${(e as Error).message}`);
    }
  }, []);

  const updatePrint = useCallback((next: ResumeDocT) => {
    setDoc(next);
    setJsonText(JSON.stringify(next, null, 2));
  }, []);

  const save = useCallback(async () => {
    setStatus({ kind: 'saving' });
    const parsed = ResumeDoc.safeParse(doc);
    if (!parsed.success) {
      setStatus({
        kind: 'error',
        message: 'Résumé fails validation',
        problems: parsed.error.issues.map(
          (i) => `${i.path.join('/')} ${i.message}`
        ),
      });
      return;
    }
    try {
      await api.putResume(parsed.data);
      setStatus({ kind: 'saved' });
      setRev((r) => r + 1); // refresh the iframe preview (saved doc)
    } catch (e) {
      if (e instanceof ApiError)
        setStatus({ kind: 'error', message: e.message, problems: e.problems });
      else setStatus({ kind: 'error', message: String(e) });
    }
  }, [doc]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-4">
        <SaveBar
          status={status}
          onSave={save}
          label="Save résumé"
          disabled={!!jsonErr}
        />
        <Tabs defaultValue="structured">
          <TabsList>
            <TabsTrigger value="structured">Structured</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="print">Print</TabsTrigger>
          </TabsList>
          <TabsContent value="structured">
            <Card>
              <CardContent className="pt-6">
                <ResumeTree tree={tree} onChange={applyTree} mode="resume" />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="json">
            <Card>
              <CardContent className="space-y-2 pt-6">
                {jsonErr && (
                  <p className="font-mono text-xs text-destructive">{jsonErr}</p>
                )}
                <Textarea
                  value={jsonText}
                  onChange={(e) => applyJson(e.target.value)}
                  className="min-h-[600px] font-mono text-xs"
                  spellCheck={false}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="print">
            <Card>
              <CardContent className="pt-6">
                <PrintEditor doc={doc} onChange={updatePrint} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <div>
        <ResumeCanvas reloadKey={rev} />
        <p className="print-hide mt-2 text-xs text-muted-foreground">
          The preview reflects the last SAVED résumé (it iframes the bare host).
          Save to refresh. Cmd+P or "Print résumé" outputs only the résumé.
        </p>
      </div>
    </div>
  );
}

export function ResumePage() {
  const resume = useAsync(() => api.resume(), []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div>
      <PageHeader
        title="Résumé"
        description="Canonical, DB-backed résumé. Every save writes a new history row."
      />
      <AsyncBoundary
        loading={resume.loading}
        error={resume.error}
        data={resume.data}
        onRetry={resume.reload}
      >
        {(doc) => <Editor key="editor" initial={doc} />}
      </AsyncBoundary>
    </div>
  );
}
