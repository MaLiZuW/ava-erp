import type { ReactNode } from "react";

/** Sign-in screens: one large white tile on the canvas, logo, title, one main action. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="bg-canvas flex min-h-screen items-center justify-center p-4 md:p-8">
      <section
        aria-labelledby="auth-title"
        className="w-full max-w-[480px] rounded-[20px] border border-neutral-200 bg-white p-6 md:p-8"
      >
        <div className="mb-8 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/av-mark.svg" alt="" width={40} height={40} />
          <span className="text-navy text-[13px] leading-4 font-semibold">Add Value Agency</span>
        </div>
        <h1 id="auth-title" className="text-navy text-[32px] leading-10 font-semibold">
          {title}
        </h1>
        {description && <p className="mt-2 text-neutral-700">{description}</p>}
        <div className="mt-6">{children}</div>
        {footer && (
          <div className="mt-6 border-t border-neutral-200 pt-4 text-[13px] text-neutral-700">
            {footer}
          </div>
        )}
      </section>
    </main>
  );
}
