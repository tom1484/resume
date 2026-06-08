import { useCallback, useState } from 'react';
import { Trash2, Plus, Save } from 'lucide-react';
import { api, ApiError } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { AsyncBoundary, ErrorBanner } from '@/components/AsyncBoundary';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Answer } from '@resume/contracts';

function AnswerRow({
  a,
  onSaved,
  onDeleted,
}: {
  a: Answer;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [question, setQuestion] = useState(a.question);
  const [answer, setAnswer] = useState(a.answer);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error>();

  const run = useCallback(async (fn: () => Promise<unknown>, after: () => void) => {
    setBusy(true);
    setErr(undefined);
    try {
      await fn();
      after();
    } catch (e) {
      setErr(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {a.key}
          </Badge>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Question</Label>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Answer</Label>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
          />
        </div>
        {err && <ErrorBanner error={err} />}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              run(() => api.putAnswer(a.key, { question, answer }), onSaved)
            }
          >
            <Save className="size-4" /> Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => run(() => api.deleteAnswer(a.key), onDeleted)}
          >
            <Trash2 className="size-4 text-destructive" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddAnswer({ onAdded }: { onAdded: () => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error>();

  const add = useCallback(async () => {
    setBusy(true);
    setErr(undefined);
    try {
      await api.addAnswer({ question, answer });
      setQuestion('');
      setAnswer('');
      onAdded();
    } catch (e) {
      if (e instanceof ApiError) setErr(e);
      else setErr(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setBusy(false);
    }
  }, [question, answer, onAdded]);

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="text-sm font-medium">Add answer</div>
        <Input
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Textarea
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
        />
        {err && <ErrorBanner error={err} />}
        <Button disabled={busy || !question.trim()} onClick={add}>
          <Plus className="size-4" /> Add
        </Button>
      </CardContent>
    </Card>
  );
}

export function AnswersPage() {
  const answers = useAsync(() => api.answers(), []);
  return (
    <div>
      <PageHeader
        title="Answers"
        description="Reusable Q&A bank for application forms. Keyed by a unique slug."
      />
      <AsyncBoundary
        loading={answers.loading}
        error={answers.error}
        data={answers.data}
        onRetry={answers.reload}
      >
        {(list: Answer[]) => (
          <div className="space-y-4">
            <AddAnswer onAdded={answers.reload} />
            {list.length === 0 && (
              <p className="text-sm text-muted-foreground">No answers yet.</p>
            )}
            {list.map((a) => (
              <AnswerRow
                key={a.key}
                a={a}
                onSaved={answers.reload}
                onDeleted={answers.reload}
              />
            ))}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
