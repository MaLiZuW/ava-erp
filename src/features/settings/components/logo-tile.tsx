"use client";

import { useId, useRef, useState } from "react";
import { checkLogoFile, LOGO_ACCEPT } from "@/core/validation";
import { Button } from "@/ui/button";
import { FormMessage } from "@/ui/field";
import { Tile } from "@/ui/tile";
import { useLogoDocument, useSignedUrl, useUploadLogo, type Company } from "../api";

export function LogoTile({ company }: { company: Company | null }) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const upload = useUploadLogo();
  const doc = useLogoDocument(company?.logo_document_id);
  const url = useSignedUrl(doc.data?.storage_path);

  const onFile = async (file: File | undefined) => {
    setProblem(null);
    setDone(false);
    if (!file || !company) return;
    // checked here for a quick answer; the bucket refuses wrong types/sizes on the server as well
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const err = checkLogoFile(file, head);
    if (err) {
      setProblem(err);
      if (input.current) input.current.value = "";
      return;
    }
    upload.mutate(
      { companyId: company.id, file },
      {
        onSuccess: () => setDone(true),
        onSettled: () => {
          if (input.current) input.current.value = "";
        },
      },
    );
  };

  return (
    <Tile
      size="L"
      title="Logo"
      action={
        <Button
          variant="secondary"
          disabled={!company || upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? "Nahrávam…" : "Nahrať logo"}
        </Button>
      }
    >
      <div className="flex h-full flex-col gap-4">
        <div className="bg-canvas flex min-h-[120px] flex-1 items-center justify-center rounded-xl border border-neutral-200 p-4">
          {url.data ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url.data}
              alt="Logo firmy"
              className="max-h-[160px] max-w-full object-contain"
            />
          ) : (
            <p className="text-neutral-700">
              {company?.logo_document_id ? "Načítavam…" : "Logo zatiaľ nie je nahrané."}
            </p>
          )}
        </div>
        <p className="text-[13px] text-neutral-700">
          PNG, JPEG alebo WebP, najviac 2 MB. SVG nie je povolené. Nové logo nahradí doterajšie;
          staré ostáva v histórii.
        </p>
        <label htmlFor={inputId} className="sr-only">
          Súbor s logom
        </label>
        <input
          id={inputId}
          ref={input}
          type="file"
          accept={LOGO_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          data-testid="logo-input"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {(problem || upload.error) && (
          <FormMessage tone="error">{problem ?? upload.error?.message}</FormMessage>
        )}
        {done && <FormMessage tone="success">Logo je nahrané.</FormMessage>}
      </div>
    </Tile>
  );
}
