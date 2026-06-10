import * as React from 'react';

export function FieldError({
  message,
}: {
  message?: string;
}): React.JSX.Element | null {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

export function FieldWarning({
  message,
}: {
  message?: string;
}): React.JSX.Element | null {
  if (!message) return null;
  return <p className="mt-1 text-xs text-amber-600">{message}</p>;
}
