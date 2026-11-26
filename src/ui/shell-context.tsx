"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Header of the page in the sticky app header (owner's point 21). */
export interface ShellHeader {
  /** e.g. Nastavenia / Firma; the last item is the current group */
  breadcrumb?: { label: string; href?: string }[];
  title: string;
  /** one line under the title */
  description?: string;
  /** mobile only: "← Nastavenia" */
  back?: { label: string; href: string };
}

export interface ShellApi {
  /** replaces the main menu in the left panel (settings mode); null = main menu */
  setSidebar: (node: ReactNode | null) => void;
  setHeader: (header: ShellHeader | null) => void;
  /** element in the sticky header where a page puts its primary button */
  actionSlot: HTMLElement | null;
}

export const ShellContext = createContext<ShellApi | null>(null);

/** A module takes over the left panel while it is shown (e.g. settings mode). */
export function useShellSidebar(node: ReactNode) {
  const shell = useContext(ShellContext);
  useEffect(() => {
    shell?.setSidebar(node);
    return () => shell?.setSidebar(null);
    // the node is set once; it reads its own state (route, data) itself
  }, [shell?.setSidebar]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** A page sets the sticky header (breadcrumb, title, description, window title). */
export function useShellHeader(header: ShellHeader | null) {
  const shell = useContext(ShellContext);
  const key = JSON.stringify(header);
  useEffect(() => {
    shell?.setHeader(header);
    return () => shell?.setHeader(null);
  }, [shell?.setHeader, key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Renders the primary button of a page into the sticky header (falls back to in place). */
export function HeaderAction({ children }: { children: ReactNode }) {
  const shell = useContext(ShellContext);
  if (!shell) return <>{children}</>;
  if (!shell.actionSlot) return null;
  return createPortal(children, shell.actionSlot);
}
