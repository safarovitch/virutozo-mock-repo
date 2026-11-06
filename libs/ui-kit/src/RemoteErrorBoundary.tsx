import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Called once per caught render error; a remote publishes `remote:error { fatal: true }` from here (MF-6). */
  onError: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
}

/**
 * The root boundary of a React remote (MF-6, D7-17). A React remote renders into its own root, so the
 * shell's boundary can't see its render errors. After an error it renders nothing: the shell unmounts the
 * remote and shows its panel. Pair it with `createRoot(el, { onCaughtError: () => {} })` so React doesn't
 * log a second entry.
 */
export class RemoteErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError(error, info);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
