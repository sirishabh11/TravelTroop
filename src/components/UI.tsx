import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { configured } from "../lib/supabase";
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "notice-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function ConfigurationNotice() {
  return (
    <Notice>
      Connect Supabase to start planning. Set <code>VITE_SUPABASE_URL</code> and{" "}
      <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, apply the migration, then
      restart Vite. No trip or response is saved until a real database is
      connected. See the repository README for setup.
    </Notice>
  );
}
export function BackendGate({ children }: { children: ReactNode }) {
  return configured ? <>{children}</> : <ConfigurationNotice />;
}
export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  ) : null;
}
export function PageHeading({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{kicker}</p>
      <h1>{title}</h1>
      {children && <p className="page-deck">{children}</p>}
    </div>
  );
}
export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
export const formatDates = (start: string, end: string) =>
  `${new Date(start + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(end + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
export function NotFound() {
  return (
    <div className="workspace">
      <PageHeading kicker="OFF THE MAP" title="Page not found." />
      <Link className="button button-dark" to="/">
        Back to the start ↗
      </Link>
    </div>
  );
}
