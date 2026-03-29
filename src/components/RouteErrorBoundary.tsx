import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: (props: { error: Error | null; resetError: () => void }) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Route-scoped error boundary — isolates page-level crashes
 * so one broken page doesn't take down the entire app.
 */
class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RouteErrorBoundary] Page crash:", error.message, info.componentStack);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback({ error: this.state.error, resetError: this.resetError });
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
