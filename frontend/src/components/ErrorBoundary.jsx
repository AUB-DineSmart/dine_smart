import { Component } from "react";
import DashboardLoading from "./DashboardLoading.jsx";
import { isDynamicImportError } from "../utils/lazyWithRetry.js";

/**
 * ErrorBoundary — catches render errors and shows a fallback UI
 * instead of crashing the whole app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Custom message</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, recovering: false };
    this.recoveryTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, recovering: isDynamicImportError(error) };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);

    if (!isDynamicImportError(error)) return;

    const recoveryKey = `dinesmart:chunk-recovery:${window.location.pathname}`;
    const alreadyRecovered = sessionStorage.getItem(recoveryKey) === "1";

    if (alreadyRecovered) {
      this.setState({ recovering: false });
      return;
    }

    sessionStorage.setItem(recoveryKey, "1");
    this.recoveryTimer = window.setTimeout(() => {
      window.location.reload();
    }, 700);
  }

  componentWillUnmount() {
    if (this.recoveryTimer) window.clearTimeout(this.recoveryTimer);
  }

  render() {
    if (this.state.hasError) {
      if (this.state.recovering) {
        return <DashboardLoading message="Loading..." />;
      }

      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="errorBoundary" role="alert">
          <h2 className="errorBoundary__title">Something went wrong</h2>
          <p className="errorBoundary__message">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            className="btn btn--gold"
            onClick={() => this.setState({ hasError: false, error: null, recovering: false })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
