"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useDocuments, useSignedUrl, type DocumentRow } from "@/core/documents";
import { formatDateTime } from "@/core/format";
import { checkImageFile, IMAGE_ACCEPT } from "@/core/validation";
import { Button } from "@/ui/button";
import { describedBy, Field, FormMessage, Input, Textarea } from "@/ui/field";
import { StatusBadge } from "@/ui/status-badge";
import { Tile } from "@/ui/tile";
import { useAddImage, useRemoveImage, useSaveBlock, type ContentBlock } from "../api";
import { blockSchema, MAX_IMAGES, type BlockInput, type ContentSlot } from "../schema";

function ImageThumb({
  doc,
  onRemove,
  busy,
}: {
  doc: DocumentRow;
  onRemove: () => void;
  busy: boolean;
}) {
  const url = useSignedUrl(doc.storage_path);
  return (
    <li className="flex flex-col gap-1">
      <div className="bg-canvas flex h-24 w-32 items-center justify-center overflow-hidden rounded-xl border border-neutral-200">
        {url.data ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url.data}
            alt={doc.file_name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-[13px] text-neutral-500">Načítavam…</span>
        )}
      </div>
      <Button
        variant="ghost"
        className="h-8 px-2 text-[13px]"
        disabled={busy}
        onClick={onRemove}
        aria-label={`Odobrať obrázok ${doc.file_name}`}
      >
        Odobrať
      </Button>
    </li>
  );
}

/** One slot of the content library: title, text (markdown) and images. */
export function ContentBlockTile({
  slot,
  block,
  divisionId,
}: {
  slot: ContentSlot;
  block: ContentBlock | null;
  divisionId: string | null;
}) {
  const save = useSaveBlock();
  const addImage = useAddImage();
  const removeImage = useRemoveImage();
  const docs = useDocuments(block?.image_document_ids ?? []);
  const fileInput = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const formId = `content-${slot.key}`;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BlockInput>({
    resolver: zodResolver(blockSchema),
    defaultValues: { title: block?.title ?? slot.title, body: block?.body ?? "" },
  });

  const submit = handleSubmit(async (values) => {
    setSaved(false);
    const row = await save.mutateAsync({ slot, block, values, divisionId }).catch(() => null);
    if (row) {
      reset({ title: row.title, body: row.body });
      setSaved(true);
    }
  });

  const onFile = async (file: File | undefined) => {
    setProblem(null);
    if (!file || !block) return;
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const err = checkImageFile(file, head);
    if (err) {
      setProblem(err);
    } else {
      await addImage.mutateAsync({ block, file }).catch(() => null);
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const ordered = (block?.image_document_ids ?? [])
    .map((id) => docs.data?.find((d) => d.id === id))
    .filter((d): d is DocumentRow => !!d);

  return (
    <Tile
      size="L"
      title={slot.title}
      className="md:row-span-3"
      action={
        <Button type="submit" form={formId} disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Ukladám…" : "Uložiť"}
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-neutral-700">
          {block ? (
            <>
              <StatusBadge label={`Verzia ${block.version}`} tone="info" />
              <span>Upravené {formatDateTime(block.updated_at)}</span>
            </>
          ) : (
            <StatusBadge label="Zatiaľ nevyplnené" tone="warning" />
          )}
        </div>
        <p className="text-[13px] text-neutral-700">{slot.hint}</p>
        <Field id={`${formId}-title`} label="Nadpis" error={errors.title?.message}>
          <Input
            id={`${formId}-title`}
            invalid={!!errors.title}
            aria-describedby={describedBy(`${formId}-title`, { error: errors.title?.message })}
            {...register("title")}
          />
        </Field>
        <Field
          id={`${formId}-body`}
          label="Text"
          hint="Odseky oddeľte prázdnym riadkom. **tučné**, - odrážky (markdown)."
          error={errors.body?.message}
        >
          <Textarea
            id={`${formId}-body`}
            rows={8}
            invalid={!!errors.body}
            aria-describedby={describedBy(`${formId}-body`, {
              hint: "Odseky oddeľte prázdnym riadkom. **tučné**, - odrážky (markdown).",
              error: errors.body?.message,
            })}
            {...register("body")}
          />
        </Field>
        {save.error && <FormMessage tone="error">{save.error.message}</FormMessage>}
        {saved && !isDirty && <FormMessage tone="success">Text je uložený.</FormMessage>}
      </form>

      <section
        aria-label={`Obrázky – ${slot.title}`}
        className="mt-4 flex flex-col gap-2 border-t border-neutral-200 pt-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-semibold tracking-[0.04em] text-neutral-500 uppercase">
            Obrázky ({ordered.length}/{MAX_IMAGES})
          </h3>
          <Button
            variant="secondary"
            disabled={!block || addImage.isPending || ordered.length >= MAX_IMAGES}
            title={block ? undefined : "Najprv uložte text bloku."}
            onClick={() => fileInput.current?.click()}
          >
            {addImage.isPending ? "Nahrávam…" : "Pridať obrázok"}
          </Button>
        </div>
        <label htmlFor={inputId} className="sr-only">
          Obrázok pre blok {slot.title}
        </label>
        <input
          id={inputId}
          ref={fileInput}
          type="file"
          accept={IMAGE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          data-testid={`content-image-input-${slot.key}`}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {!block && (
          <p className="text-[13px] text-neutral-700">Obrázky pridáte po prvom uložení textu.</p>
        )}
        <p className="text-[13px] text-neutral-700">
          PNG, JPEG alebo WebP, najviac 2 MB. SVG nie je povolené.
        </p>
        {ordered.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {ordered.map((d) => (
              <ImageThumb
                key={d.id}
                doc={d}
                busy={removeImage.isPending}
                onRemove={() => block && removeImage.mutate({ block, doc: d })}
              />
            ))}
          </ul>
        )}
        {(problem || addImage.error || removeImage.error) && (
          <FormMessage tone="error">
            {problem ?? addImage.error?.message ?? removeImage.error?.message}
          </FormMessage>
        )}
      </section>
    </Tile>
  );
}
