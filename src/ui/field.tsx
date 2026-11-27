import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

const CONTROL =
  "h-10 w-full rounded-xl border bg-white px-3 text-[15px] text-ink transition-colors duration-150 ease-out " +
  "placeholder:text-neutral-500 disabled:bg-canvas disabled:text-neutral-500";

export function Input({
  invalid,
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, invalid ? "border-danger" : "border-neutral-200", className)}
      {...props}
    />
  );
}

export function Select({
  invalid,
  className,
  ref,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; ref?: Ref<HTMLSelectElement> }) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, invalid ? "border-danger" : "border-neutral-200", className)}
      {...props}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        "h-auto min-h-24 py-2 leading-6",
        invalid ? "border-danger" : "border-neutral-200",
        className,
      )}
      {...props}
    />
  );
}

/** Checkbox with its label on the right (the whole row is clickable). */
export function Checkbox({
  label,
  className,
  ref,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <label className={cn("flex min-h-10 items-center gap-3 text-[15px]", className)}>
      <input ref={ref} type="checkbox" className="accent-navy size-5 shrink-0" {...props} />
      <span>{label}</span>
    </label>
  );
}

/**
 * Label + control + hint + error. The control must carry `id={id}` and
 * `aria-describedby={describedBy(id, …)}` – use the helper below.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[13px] leading-5 font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[13px] leading-5 text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-danger text-[13px] leading-5 font-medium"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(
  id: string,
  { hint, error }: { hint?: string; error?: string },
): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

/** Form-level message (success / error) – always text, never colour only. */
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-3 py-2 text-[15px] font-medium",
        tone === "error" ? "border-danger/30 text-danger" : "border-success/30 text-success",
      )}
    >
      {children}
    </p>
  );
}
