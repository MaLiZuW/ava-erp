import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAttachmentQueue } from "./api";
import { AttachmentsTile, NewRecordAttachments } from "./attachments-tile";

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n...");
const categories = [
  {
    code: "photo",
    label: "Foto",
    allowed_mime_types: ["image/png", "image/jpeg", "image/webp"],
    max_bytes: 5242880,
  },
  { code: "other", label: "Iné", allowed_mime_types: ["application/pdf"], max_bytes: 20971520 },
];
const tables: Record<string, unknown[]> = {};
const inserted: unknown[] = [];
const uploads: string[] = [];
let failUpload = false;

vi.mock("@/core/supabase/client", () => ({
  getSupabase: () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "in", "delete", "update"]) b[m] = () => b;
      b.insert = (row: Record<string, unknown>) => {
        inserted.push(row);
        const r: Record<string, unknown> = {};
        r.select = () => r;
        r.single = async () => ({ data: { id: `doc-${inserted.length}`, ...row }, error: null });
        return r;
      };
      b.then = (resolve: (v: unknown) => void) =>
        resolve({
          data: t === "attachment_categories" ? categories : (tables[t] ?? []),
          error: null,
        });
      return b;
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          if (failUpload) return { data: null, error: { message: "boom" } };
          uploads.push(path);
          return { data: { path }, error: null };
        },
        remove: async () => ({ data: [], error: null }),
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((p) => ({ path: p, signedUrl: `https://x/${p}`, error: null })),
          error: null,
        }),
        createSignedUrl: async (p: string) => ({
          data: { signedUrl: `https://x/${p}` },
          error: null,
        }),
      }),
    },
  }),
}));

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client()}>{children}</QueryClientProvider>
);

beforeEach(() => {
  inserted.length = 0;
  uploads.length = 0;
  failUpload = false;
  tables.attachments = [];
});

const pdf = () => new File([PDF_BYTES], "list.pdf", { type: "application/pdf" });
const ID = "11111111-1111-1111-1111-111111111111";

describe("useAttachmentQueue", () => {
  it("collects files without uploading; Cancel = nothing is sent", async () => {
    const { result, unmount } = renderHook(() => useAttachmentQueue(), { wrapper });
    await waitFor(() => expect(result.current.rules).toHaveLength(2));
    act(() => result.current.add([pdf()]));
    expect(result.current.items[0]).toMatchObject({ category: "other", status: "waiting" });
    unmount();
    expect(uploads).toHaveLength(0);
  });

  it("uploads after saving; a failure stays in the queue and can be uploaded again", async () => {
    const { result } = renderHook(() => useAttachmentQueue(), { wrapper });
    await waitFor(() => expect(result.current.rules).toHaveLength(2));
    act(() => result.current.add([pdf()]));
    await waitFor(() => expect(result.current.pending).toBe(1));

    failUpload = true;
    let out = { stored: [] as unknown[], failed: 0 };
    await act(async () => {
      out = await result.current.run("suppliers", ID);
    });
    expect(out.failed).toBe(1);
    expect(result.current.items[0].status).toBe("error");
    expect(result.current.items[0].error).toMatch(/Nahranie súboru sa nepodarilo/);

    failUpload = false;
    await act(async () => {
      out = await result.current.run("suppliers", ID);
    });
    expect(out).toMatchObject({ failed: 0 });
    expect(out.stored).toHaveLength(1);
    expect(result.current.items[0].status).toBe("done");
    expect(uploads[0]).toMatch(new RegExp(`^\\d{4}/suppliers/${ID}/[0-9a-f-]{36}-list\\.pdf$`));
    expect(inserted[0]).toMatchObject({
      entity_table: "suppliers",
      entity_id: ID,
      category: "other",
      mime_type: "application/pdf",
      storage_provider: "supabase",
    });
  });

  it("refuses a file that does not fit the category before sending anything", async () => {
    const { result } = renderHook(() => useAttachmentQueue(), { wrapper });
    await waitFor(() => expect(result.current.rules).toHaveLength(2));
    const fake = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    act(() => result.current.add([fake]));
    await waitFor(() => expect(result.current.pending).toBe(1));
    await act(async () => {
      await result.current.run("suppliers", ID);
    });
    expect(result.current.items[0].error).toMatch(/nikdy/);
    expect(uploads).toHaveLength(0);
  });
});

describe("NewRecordAttachments", () => {
  it("shows the files with their category and offers 'Nahrať znova' after a failure", async () => {
    function Harness({ retry }: { retry?: () => void }) {
      const queue = useAttachmentQueue();
      return <NewRecordAttachments queue={queue} retry={retry} />;
    }
    render(<Harness />, { wrapper });
    const input = await screen.findByTestId("attachment-input");
    await userEvent.upload(input, pdf());
    expect(await screen.findByLabelText("Kategória – list.pdf")).toHaveValue("other");
    expect(screen.getByText("Nahrané 0/1")).toBeInTheDocument();
    expect(screen.getByText("Čaká")).toBeInTheDocument();
  });
});

describe("AttachmentsTile", () => {
  it("lists attachments, marks the main photo and asks before deleting", async () => {
    tables.attachments = [
      {
        id: "d1",
        entity_table: "catalog_items",
        entity_id: ID,
        category: "photo",
        category_label: "Foto",
        file_name: "hrnček.webp",
        mime_type: "image/webp",
        size_bytes: 120000,
        storage_provider: "supabase",
        storage_path: `2026/catalog_items/${ID}/x-hrnček.webp`,
        is_locked: false,
        created_at: "2026-11-27T10:00:00Z",
        created_by_name: "Admin",
      },
      {
        id: "d2",
        entity_table: "catalog_items",
        entity_id: ID,
        category: "other",
        category_label: "Iné",
        file_name: "zmluva.pdf",
        mime_type: "application/pdf",
        size_bytes: 2048,
        storage_provider: "supabase",
        storage_path: `2026/catalog_items/${ID}/y-zmluva.pdf`,
        is_locked: true,
        created_at: "2026-11-27T10:00:00Z",
        created_by_name: "Admin",
      },
    ];
    const onSet = vi.fn();
    render(
      <AttachmentsTile
        entityTable="catalog_items"
        entityId={ID}
        mainPhotoId="d1"
        onSetMainPhoto={onSet}
      />,
      { wrapper },
    );
    expect(await screen.findByText("Hlavná fotka")).toBeInTheDocument();
    expect(screen.getAllByTestId("attachment-row")).toHaveLength(2);
    expect(screen.getByText(/PDF · 2 kB/)).toBeInTheDocument();
    // a locked document cannot be deleted; the other one asks first
    expect(screen.queryByRole("button", { name: "Zmazať – zmluva.pdf" })).toBeNull();
    expect(screen.getByText("Zamknutý")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Zmazať – hrnček.webp" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Je to hlavná fotka položky");
  });
});
