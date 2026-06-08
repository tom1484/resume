import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  error: Error | null;
}

// Catches render errors so a single bad section doesn't blank the résumé.
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-8 p-4 border border-red-300 text-red-700 font-mono text-sm">
          <p className="font-bold">Something went wrong while rendering.</p>
          <p>{String(this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
