/**
 * Minimal ambient types for Hyperswitch's web SDK, which ships no .d.ts.
 * Only the surface we use is typed.
 */

declare module "@juspay-tech/hyper-js" {
  export function loadHyper(publishableKey: string, options?: Record<string, unknown>): Promise<unknown>;
}

declare module "@juspay-tech/react-hyper-js" {
  import type { ReactNode } from "react";

  export interface ConfirmPaymentResult {
    status?: string;
    error?: { message?: string; type?: string };
  }

  export interface Hyper {
    confirmPayment(args: {
      widgets: unknown;
      confirmParams: { return_url: string };
      redirect?: "if_required" | "always";
    }): Promise<ConfirmPaymentResult | undefined>;
  }

  export function HyperElements(props: {
    options: Record<string, unknown>;
    hyper: Promise<unknown> | undefined;
    children: ReactNode;
  }): JSX.Element;

  export function useHyper(): Hyper | null;
  export function useWidgets(): unknown;

  export function UnifiedCheckout(props: {
    id?: string;
    options?: Record<string, unknown>;
  }): JSX.Element;
}
