import React, { useState } from "react";
import { Button, Dialog, Textarea } from "@pal/ui";
import type { WebPreviewState } from "@pal/contracts";
import type { messages } from "./messages";

type Selection = NonNullable<
  NonNullable<WebPreviewState["annotations"]>["selection"]
>;
export function AnnotationEditor({
  selection,
  text,
  cancel,
  submit,
  fail,
}: {
  selection: Selection;
  text: ReturnType<typeof messages>;
  cancel(): void;
  submit(comment: string): Promise<void>;
  fail(error: unknown): void;
}) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!comment.trim() || busy) return;
    setBusy(true);
    try {
      await submit(comment.trim());
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      title={text.annotationTitle}
      className="browser-annotation-dialog"
      onOpenChange={(open) => {
        if (!open && !busy) cancel();
      }}
      footer={
        <>
          <Button disabled={busy} onClick={cancel}>
            {text.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={busy || !comment.trim()}
            onClick={() => void save()}
          >
            {busy ? text.working : text.annotationAdd}
          </Button>
        </>
      }
    >
      <div
        className="browser-annotation-content"
        onWheel={(event) => event.stopPropagation()}
      >
        <img
          className="browser-annotation-preview"
          src={selection.screenshot}
          alt={selection.title || text.annotationTitle}
        />
        {selection.text && (
          <blockquote className="browser-annotation-excerpt">
            {selection.text}
          </blockquote>
        )}
        <Textarea
          label={text.annotationComment}
          placeholder={text.annotationPlaceholder}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          maxLength={12000}
          disabled={busy}
          autoFocus
        />
      </div>
    </Dialog>
  );
}
