"use client";

import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card } from "@/components/ui";

interface State {
  error: Error | null;
}

/**
 * Last line of defence. Without this, any uncaught client error unmounts the
 * whole tree and Next renders its blank production error page, which tells an
 * operator nothing. This keeps the shell and reports what actually broke.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <section className="container-page flex justify-center py-24">
        <Card className="w-full max-w-[620px] p-6">
          <p className="font-[family-name:var(--font-system-ui)] text-[10px] uppercase tracking-[-0.3px] text-stone-500">
            Something went wrong
          </p>
          <h1 className="mt-2 text-[20px] leading-[1.2] font-medium tracking-[-0.4px] text-ink-black">
            This section could not be displayed
          </h1>
          <p className="mt-2 text-[14px] leading-[1.5] text-stone-600">
            The rest of the site still works. Reloading usually clears it; if it
            keeps happening, the details are in the browser console.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md border border-stone-200 bg-bone p-3 font-[family-name:var(--font-system-ui)] text-[11px] leading-[1.4] text-stone-700 whitespace-pre-wrap">
            {error.message}
          </pre>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <Link href="/" className="btn-neutral no-underline">
              Back to home
            </Link>
          </div>
        </Card>
      </section>
    );
  }
}