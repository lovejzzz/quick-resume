"use client";

import {
  memo,
  useEffect,
  useRef,
  type ClipboardEvent as ReactClipboardEvent,
  type ElementType,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export type InlineEditProps = {
  as?: ElementType;
  className?: string;
  editId: string;
  fontAdjustment: number;
  fontBase: string;
  label: string;
  multiline?: boolean;
  onActivate: (editId: string, label: string, top: number) => void;
  onCommit: (value: string) => void;
  photoFlow?: boolean;
  placeholder?: string;
  value: string;
};

/**
 * `plaintext-only` keeps pasted markup out of the document in every browser
 * that supports it. The paste handler below is the fallback for those that do
 * not, and also strips the styling that a rich paste from Word or LinkedIn
 * would otherwise drag in.
 */
function insertPlainText(text: string) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function InlineEditComponent({
  as: Tag = "span",
  className,
  editId,
  fontAdjustment,
  fontBase,
  label,
  multiline = false,
  onActivate,
  onCommit,
  photoFlow = false,
  placeholder = "",
  value,
}: InlineEditProps) {
  const elementRef = useRef<HTMLElement>(null);
  const isEditing = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || isEditing.current) return;
    const visibleValue = multiline ? element.innerText : element.textContent;
    if (visibleValue !== value) element.textContent = value;
  }, [multiline, value]);

  const finishEdit = () => {
    const element = elementRef.current;
    if (!element) return;
    isEditing.current = false;
    const rawValue = multiline ? element.innerText : element.textContent;
    const nextValue = (rawValue || "").replace(/\u00a0/g, " ").trim();
    element.textContent = nextValue;
    onCommit(nextValue);
  };

  const handlePaste = (event: ReactClipboardEvent<HTMLElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    const normalised = multiline
      ? text.replace(/\r\n?/g, "\n")
      : text.replace(/\s+/g, " ").trim();
    insertPlainText(normalised);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (elementRef.current) elementRef.current.textContent = value;
      event.currentTarget.blur();
      return;
    }
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (multiline && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <Tag
      aria-label={label}
      // aria-multiline is only valid on a textbox, and bullets keep their
      // native listitem role (see the role note below).
      aria-multiline={multiline && Tag !== "li" ? true : undefined}
      className={className}
      contentEditable="plaintext-only"
      data-inline-edit=""
      data-photo-flow={photoFlow ? "" : undefined}
      data-placeholder={placeholder}
      onBlur={finishEdit}
      onFocus={(event: ReactFocusEvent<HTMLElement>) => {
        isEditing.current = true;
        const paper = event.currentTarget.closest(".resume-paper");
        if (paper) {
          const paperBox = paper.getBoundingClientRect();
          const elementBox = event.currentTarget.getBoundingClientRect();
          onActivate(editId, label, elementBox.top - paperBox.top + elementBox.height / 2);
        }
      }}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      ref={elementRef}
      // A bullet must stay a listitem. Overriding it with `textbox` removes the
      // element from its list in the accessibility tree, so the surrounding
      // <ul> reads as an empty list. `contenteditable` already conveys
      // editability for these.
      role={Tag === "li" ? undefined : "textbox"}
      spellCheck
      style={{ fontSize: `calc(${fontBase} + ${fontAdjustment}px)` }}
      suppressContentEditableWarning
      tabIndex={0}
      title="Click to edit"
    >
      {value}
    </Tag>
  );
}

export const InlineEdit = memo(InlineEditComponent);
