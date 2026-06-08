import * as React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { ApiError } from '@/api';
import { Button } from '@/components/ui/button';

/** Render error problems (from ApiError) as a readable banner. */
export function ErrorBanner({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  const problems = error instanceof ApiError ? error.problems : undefined;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4" />
        {error.message}
      </div>
      {problems && problems.length > 0 && (
        <ul className="ml-6 mt-2 list-disc space-y-0.5 font-mono text-xs">
          {problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </div>
  );
}

/** Loading / error / empty wrapper for an async data slot. */
export function AsyncBoundary<T>({
  loading,
  error,
  data,
  onRetry,
  children,
}: {
  loading: boolean;
  error: Error | undefined;
  data: T | undefined;
  onRetry?: () => void;
  children: (data: T) => React.ReactNode;
}) {
  if (loading && data === undefined) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error && data === undefined) {
    return <ErrorBanner error={error} onRetry={onRetry} />;
  }
  if (data === undefined) return null;
  return <>{children(data)}</>;
}
