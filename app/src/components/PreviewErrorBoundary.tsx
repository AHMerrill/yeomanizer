import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

// Wraps the live preview so a render bug there shows a message instead of white-screening the
// whole app — which matters because nothing persists, so a crash would lose the user's text.
// The editor lives OUTSIDE this boundary, so the user's input always survives. No error is
// logged anywhere external (the default console output stays in the user's own browser).
export class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="preview-error">
          <p>
            <strong>The preview hit a rendering error.</strong>
          </p>
          <p>Your text is safe — it’s still in the editor on the left. Adjust it, or reload the page.</p>
          <button onClick={() => this.setState({ hasError: false })}>Retry preview</button>
        </div>
      );
    }
    return this.props.children;
  }
}
