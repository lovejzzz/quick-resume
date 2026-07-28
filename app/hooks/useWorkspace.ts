"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { tianXingExample } from "../examples/tian-xing";
import {
  makeId,
  type ResumeData,
  type ResumeDocument,
  type ResumeStyle,
} from "../lib/resume-model";
import {
  defaultStyle,
  loadWorkspace,
  parseBackup,
  saveWorkspace,
  serializeBackup,
  starterWorkspace,
  type Workspace,
} from "../lib/storage";

/** Avoids React's SSR warning while still running before first paint. */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const HISTORY_LIMIT = 80;
const HISTORY_COALESCE_MS = 900;
const DIRTY_CHECK_MS = 220;

type Snapshot = { data: ResumeData; style: ResumeStyle };

const snapshotOf = (document: ResumeDocument): Snapshot => ({
  data: document.data,
  style: document.style,
});

const serialize = (workspace: Workspace) =>
  JSON.stringify(workspace.documents.map(({ data, style, title }) => ({ data, style, title })));

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(starterWorkspace);
  const [hydrated, setHydrated] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const savedSnapshot = useRef<string>("");
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const present = useRef<Snapshot | null>(null);
  const applyingHistory = useRef(false);
  const lastChangeAt = useRef(0);

  const activeDocument = useMemo(
    () =>
      workspace.documents.find((document) => document.id === workspace.activeId) ??
      workspace.documents[0],
    [workspace],
  );

  /* ------------------------------------------------------------- hydration */

  useIsomorphicLayoutEffect(() => {
    const loaded = loadWorkspace();
    savedSnapshot.current = serialize(loaded);
    const active =
      loaded.documents.find((document) => document.id === loaded.activeId) ??
      loaded.documents[0];
    present.current = snapshotOf(active);
    setWorkspace(loaded);
    setHydrated(true);
  }, []);

  /* --------------------------------------------------------------- history */

  useEffect(() => {
    if (!hydrated || !activeDocument) return;
    if (applyingHistory.current) {
      applyingHistory.current = false;
      return;
    }
    const next = snapshotOf(activeDocument);
    const previous = present.current;
    if (!previous) {
      present.current = next;
      return;
    }
    if (previous.data === next.data && previous.style === next.style) return;

    const now = Date.now();
    // Rapid consecutive edits collapse into a single undo step.
    if (lastChangeAt.current === 0 || now - lastChangeAt.current > HISTORY_COALESCE_MS) {
      undoStack.current.push(previous);
      if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    }
    present.current = next;
    redoStack.current = [];
    lastChangeAt.current = now;
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(false);
  }, [activeDocument, hydrated]);

  /* ----------------------------------------------------------- dirty state */

  useEffect(() => {
    if (!hydrated) return;
    // Debounced so a burst of keystrokes serialises once, not once per key.
    const timer = window.setTimeout(() => {
      const changed = serialize(workspace) !== savedSnapshot.current;
      setHasUnsavedChanges(changed);
      if (changed) setSaveError("");
    }, DIRTY_CHECK_MS);
    return () => window.clearTimeout(timer);
  }, [hydrated, workspace]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  /* --------------------------------------------------------------- editing */

  const patchActive = useCallback(
    (patch: (document: ResumeDocument) => Partial<ResumeDocument>) => {
      setWorkspace((current) => ({
        ...current,
        documents: current.documents.map((document) =>
          document.id === current.activeId
            ? { ...document, ...patch(document), updatedAt: Date.now() }
            : document,
        ),
      }));
    },
    [],
  );

  const setData = useCallback(
    (update: ResumeData | ((current: ResumeData) => ResumeData)) => {
      patchActive((document) => ({
        data: typeof update === "function" ? update(document.data) : update,
      }));
    },
    [patchActive],
  );

  const setStyle = useCallback(
    (update: ResumeStyle | ((current: ResumeStyle) => ResumeStyle)) => {
      patchActive((document) => ({
        style: typeof update === "function" ? update(document.style) : update,
      }));
    },
    [patchActive],
  );

  /* --------------------------------------------------------- undo and redo */

  const applySnapshot = useCallback(
    (snapshot: Snapshot) => {
      applyingHistory.current = true;
      lastChangeAt.current = 0;
      present.current = snapshot;
      patchActive(() => ({ data: snapshot.data, style: snapshot.style }));
    },
    [patchActive],
  );

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous || !present.current) return;
    redoStack.current.push(present.current);
    applySnapshot(previous);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next || !present.current) return;
    undoStack.current.push(present.current);
    applySnapshot(next);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, [applySnapshot]);

  const resetHistory = useCallback((document: ResumeDocument) => {
    undoStack.current = [];
    redoStack.current = [];
    present.current = snapshotOf(document);
    lastChangeAt.current = 0;
    applyingHistory.current = false;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  /* ------------------------------------------------------------ persistence */

  const save = useCallback(() => {
    const result = saveWorkspace(workspace);
    if (result.ok) {
      savedSnapshot.current = serialize(workspace);
      setHasUnsavedChanges(false);
      setSaveError("");
    } else {
      setSaveError(result.reason);
    }
    return result;
  }, [workspace]);

  /* -------------------------------------------------------------- documents */

  const selectDocument = useCallback(
    (id: string) => {
      const target = workspace.documents.find((document) => document.id === id);
      if (!target || id === workspace.activeId) return;
      // History is per document; carrying it across would let undo rewrite a
      // resume the user is no longer looking at.
      resetHistory(target);
      setWorkspace((current) => ({ ...current, activeId: id }));
    },
    [resetHistory, workspace],
  );

  const addDocument = useCallback(
    (document: ResumeDocument) => {
      setWorkspace((current) => ({
        activeId: document.id,
        documents: [...current.documents, document],
      }));
      resetHistory(document);
    },
    [resetHistory],
  );

  const createBlank = useCallback(() => {
    addDocument({
      id: makeId(),
      title: "Untitled resume",
      data: {
        name: "",
        headline: "",
        email: "",
        phone: "",
        location: "",
        portfolio: "",
        secondaryLink: "",
        photo: "",
        sections: [],
      },
      style: { ...defaultStyle },
      updatedAt: Date.now(),
    });
  }, [addDocument]);

  const createFromExample = useCallback(() => {
    addDocument({
      id: makeId(),
      title: "Example resume",
      data: tianXingExample,
      style: { ...defaultStyle },
      updatedAt: Date.now(),
    });
  }, [addDocument]);

  const duplicateActive = useCallback(() => {
    if (!activeDocument) return;
    addDocument({
      ...activeDocument,
      id: makeId(),
      title: `${activeDocument.title} copy`,
      updatedAt: Date.now(),
    });
  }, [activeDocument, addDocument]);

  const renameActive = useCallback(
    (title: string) => {
      patchActive(() => ({ title }));
    },
    [patchActive],
  );

  const deleteDocument = useCallback(
    (id: string) => {
      // The workspace always keeps at least one resume so the editor never has
      // nothing to render.
      if (workspace.documents.length <= 1) return;
      const documents = workspace.documents.filter((document) => document.id !== id);
      const activeId = workspace.activeId === id ? documents[0].id : workspace.activeId;
      const active = documents.find((document) => document.id === activeId) ?? documents[0];
      resetHistory(active);
      setWorkspace({ activeId, documents });
    },
    [resetHistory, workspace],
  );

  const importDocuments = useCallback(
    (text: string) => {
      const parsed = parseBackup(text);
      if (!parsed.ok) return parsed;
      const [first] = parsed.documents;
      resetHistory(first);
      setWorkspace((current) => ({
        activeId: first.id,
        documents: [...current.documents, ...parsed.documents],
      }));
      return parsed;
    },
    [resetHistory],
  );

  const exportBackup = useCallback(
    () => serializeBackup(workspace.documents),
    [workspace.documents],
  );

  return {
    activeDocument,
    addDocument,
    canRedo,
    canUndo,
    createBlank,
    createFromExample,
    data: activeDocument?.data,
    deleteDocument,
    documents: workspace.documents,
    duplicateActive,
    exportBackup,
    hasUnsavedChanges,
    hydrated,
    importDocuments,
    redo,
    renameActive,
    resetHistory,
    save,
    saveError,
    selectDocument,
    setData,
    setStyle,
    style: activeDocument?.style,
    undo,
  };
}
