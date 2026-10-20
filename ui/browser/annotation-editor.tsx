import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, PopoverMorph, Textarea, Tooltip } from "@pal/ui";
import { ArrowUp, SlidersHorizontal, Trash2, X } from "lucide-react";
import type { WebPreviewAnnotation } from "@pal/contracts";
import type { messages } from "./messages";

/** Host-owned input anchored to a selection; remote documents receive no input bridge. */
export function AnnotationEditor({
  selection,
  viewport,
  text,
  cancel,
  submit,
  remove,
  fail,
}: {
  selection: WebPreviewAnnotation;
  viewport: HTMLElement | null;
  text: ReturnType<typeof messages>;
  cancel(): void;
  submit(comment: string): Promise<void>;
  remove?(): void;
  fail(error: unknown): void;
}) {
  const [comment, setComment] = useState(selection.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const [armed, setArmed] = useState(false);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const zh = text.extensions !== "Extensions";
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    if (!viewport) return;
    const locate = () => {
      const box = viewport.getBoundingClientRect();
      const scaleX = box.width / (selection.viewport?.width || box.width || 1);
      const scaleY =
        box.height / (selection.viewport?.height || box.height || 1);
      setPosition({
        x: Math.max(
          8,
          Math.min(
            box.width - 302,
            (selection.bounds.x + Math.min(selection.bounds.width, 80)) *
              scaleX,
          ),
        ),
        y: Math.max(
          8,
          Math.min(box.height - 170, selection.bounds.y * scaleY - 28),
        ),
      });
    };
    locate();
    const observer = new ResizeObserver(locate);
    observer.observe(viewport);
    window.addEventListener("resize", locate);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", locate);
    };
  }, [
    viewport,
    selection.bounds.x,
    selection.bounds.y,
    selection.viewport?.width,
    selection.viewport?.height,
  ]);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = "24px";
    field.style.height = `${Math.min(160, field.scrollHeight)}px`;
  }, [comment]);
  const dismiss = () => {
    if (busy) return;
    if (comment.trim() && !armed) {
      setArmed(true);
      input.current?.focus();
    } else cancel();
  };
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
    <>
      {viewport &&
        createPortal(
          <span
            ref={setAnchor}
            className="browser-annotation-anchor"
            style={{ left: position.x, top: position.y }}
          />,
          viewport,
        )}
      <PopoverMorph
        open={!!anchor}
        anchor={anchor}
        align="start"
        onOpenChange={(open) => {
          if (!open) dismiss();
        }}
        className={`browser-comment-editor${armed ? " browser-comment-armed" : ""}`}
      >
        {details && (
          <div className="browser-comment-target">
            <code>
              {selection.mode === "region"
                ? zh
                  ? "区域"
                  : "Area"
                : selection.selector?.split(/\s+|>/).at(-1) || "element"}
            </code>
            <img src={selection.screenshot} alt="" />
          </div>
        )}
        <div className="browser-comment-input-row">
          <Tooltip content={zh ? "查看批注对象" : "View selection"}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={zh ? "查看批注对象" : "View selection"}
              aria-pressed={details}
              onClick={() => setDetails((value) => !value)}
            >
              <SlidersHorizontal size={15} />
            </Button>
          </Tooltip>
          <Textarea
            ref={input}
            hideLabel
            label={text.annotationComment}
            placeholder={zh ? "添加评论…" : "Add a comment…"}
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
              setArmed(false);
            }}
            rows={1}
            maxLength={12000}
            autoFocus
            disabled={busy}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void save();
              }
              if (event.key === "Escape") {
                event.stopPropagation();
                dismiss();
              }
            }}
          />
          <Tooltip content={zh ? "保存批注" : "Save comment"}>
            <Button
              variant="primary"
              size="icon"
              className="browser-comment-submit"
              aria-label={zh ? "保存批注" : "Save comment"}
              disabled={busy || !comment.trim()}
              onClick={() => void save()}
            >
              <ArrowUp size={16} />
            </Button>
          </Tooltip>
        </div>
        {selection.commentId && (
          <div className="browser-comment-edit-actions">
            <Button
              variant="ghost"
              size="small"
              disabled={busy}
              onClick={cancel}
            >
              <X size={13} />
              {text.cancel}
            </Button>
            <Button
              variant="ghost"
              size="small"
              disabled={busy}
              onClick={remove}
            >
              <Trash2 size={13} />
              {text.remove}
            </Button>
          </div>
        )}
      </PopoverMorph>
    </>
  );
}
