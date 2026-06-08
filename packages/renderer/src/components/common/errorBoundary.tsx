import React from 'react';

// Catches render errors so a single bad section doesn't blank the resume.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
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
