"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { emptySnapshot, type Snapshot, type PlanConfirmation, type CommandResult } from "./types";
import { applyConfirmedPlans } from "./confirmed-plans";
import type { CommandData } from "./service";
export function useSocial(params: string) {
  const [data, setData] = useState<Snapshot>(emptySnapshot),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [snapshotParams, setSnapshotParams] = useState(params);
  const retry = useRef<{ signature: string; id: string } | null>(null);
  const confirmedPlans = useRef(new Map<string, PlanConfirmation>());
  const loadedPages = useRef({ posts: 1, comments: 1 });
  const submittedComment = useRef<string | null>(null);
  const seq = useRef(0),
    paramsRef = useRef(params),
    pending = useRef(false);
  const refresh = useCallback(async () => {
    const queryParams = paramsRef.current;
    const n = ++seq.current;
    setLoading(true);
    try {
      const query = new URLSearchParams(queryParams);
      if (submittedComment.current && query.has("post"))
        query.set("comment", submittedComment.current);
      const read = async (pageQuery: URLSearchParams) => {
        const response = await fetch("/api/polis?" + pageQuery, {
          cache: "no-store",
        });
        const value = (await response.json()) as Snapshot & { error?: string };
        if (!response.ok) {
          // A direct link can be unavailable before any session snapshot loads.
          // Recover the permitted shell without treating a 404 as a sign-out.
          let shell: Snapshot | null = null;
          if (response.status === 404) {
            const session = await fetch("/api/polis", { cache: "no-store" });
            if (session.ok) shell = (await session.json()) as Snapshot;
          }
          if (n === seq.current) {
            if (response.status === 401 || response.status === 403 ||
              (response.status === 404 && shell?.status !== "ready"))
              confirmedPlans.current.clear();
            const confirmations = [...confirmedPlans.current.values()];
            setData((s) => applyConfirmedPlans({
              ...emptySnapshot,
              me: response.status === 401 ? null : (shell?.me ?? s.me),
              status:
                response.status === 401
                  ? "signed_out"
                  : (shell?.status ?? s.status),
            }, confirmations));
          }
          throw new Error(value.error ?? "Unable to load Polis.");
        }
        return value;
      };
      const next = await read(query);
      // Revalidate every loaded page. Keeping old pages without rechecking could
      // retain content after an author revokes friendship or deletes a post.
      for (let i = 1; i < loadedPages.current.posts && next.nextCursor; i++) {
        if (n !== seq.current) return;
        const pageQuery = new URLSearchParams(query);
        pageQuery.set("cursor", next.nextCursor);
        const page = await read(pageQuery);
        next.posts.push(
          ...page.posts.filter((p) => !next.posts.some((o) => o.id === p.id)),
        );
        next.nextCursor = page.nextCursor;
      }
      for (
        let i = 1;
        i < loadedPages.current.comments && next.nextCommentCursor;
        i++
      ) {
        if (n !== seq.current) return;
        const pageQuery = new URLSearchParams(query);
        pageQuery.set("commentsAfter", next.nextCommentCursor);
        const page = await read(pageQuery);
        next.comments = [
          ...(next.comments ?? []),
          ...(page.comments ?? []).filter(
            (p) => !next.comments?.some((o) => o.id === p.id),
          ),
        ];
        next.nextCommentCursor = page.nextCommentCursor;
      }
      if (n !== seq.current) return;
      next.comments?.sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      );
      confirmedPlans.current.clear();
      setData(next);
      setSnapshotParams(queryParams);
      setError("");
    } catch (e) {
      if (n === seq.current)
        setError(
          confirmedPlans.current.size
            ? "Your plan change was saved. We couldn’t refresh the rest of the page. Try again to reload."
            : e instanceof Error
            ? e.message
            : "Connection interrupted. Please retry.",
        );
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    paramsRef.current = params;
    loadedPages.current = { posts: 1, comments: 1 };
    submittedComment.current = null;
    // This effect synchronizes server data; refresh marks its network request pending.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !pending.current)
        void refresh();
    }, 30000);
    return () => {
      window.removeEventListener("focus", focus);
      clearInterval(timer);
    };
  }, [params, refresh]);
  const run = useCallback(
    async (values: CommandData, requestId?: string) => {
      if (pending.current)
        throw new Error("Please wait for your previous change.");
      pending.current = true;
      setBusy(true);
      setError("");
      const signature = JSON.stringify(values);
      const submissionId =
        requestId ??
        (retry.current?.signature === signature
          ? retry.current.id
          : crypto.randomUUID());
      retry.current = { signature, id: submissionId };
      try {
        const r = await fetch("/api/polis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: submissionId, data: values }),
        });
        const value = (await r.json()) as CommandResult & { error?: string };
        if (!r.ok) throw new Error(value.error ?? "Unable to save.");
        retry.current = null;
        if (value.plan) {
          // Invalidate GETs started before this committed write. Confirmations
          // survive a failed refresh and are shared by every event view.
          seq.current++;
          confirmedPlans.current.set(value.plan.eventId, value.plan);
          setData((s) => applyConfirmedPlans(s, [value.plan!]));
        }
        if (
          value.commentId &&
          value.postId === new URLSearchParams(paramsRef.current).get("post")
        )
          submittedComment.current = value.commentId;
        await refresh();
        return value;
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Connection interrupted. Your draft is still here.",
        );
        throw e;
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  async function page(cursor: string, comments = false) {
    const pageParams = paramsRef.current,
      n = ++seq.current;
    setLoading(true);
    try {
      const p = new URLSearchParams(pageParams);
      p.set(comments ? "commentsAfter" : "cursor", cursor);
      const r = await fetch("/api/polis?" + p, { cache: "no-store" });
      const value = (await r.json()) as Snapshot & { error?: string };
      if (n !== seq.current || pageParams !== paramsRef.current) return;
      if (!r.ok) throw new Error(value.error);
      confirmedPlans.current.clear();
      loadedPages.current[comments ? "comments" : "posts"]++;
      setData((s) =>
        comments
          ? {
              ...s,
              comments: [
                ...(s.comments ?? []),
                ...(value.comments ?? []).filter(
                  (p: NonNullable<Snapshot["comments"]>[number]) =>
                    !s.comments?.some((o) => o.id === p.id),
                ),
              ].sort(
                (a, b) =>
                  a.createdAt.localeCompare(b.createdAt) ||
                  a.id.localeCompare(b.id),
              ),
              nextCommentCursor: value.nextCommentCursor,
            }
          : {
              ...value,
              posts: [
                ...s.posts,
                ...value.posts.filter(
                  (p: Snapshot["posts"][number]) =>
                    !s.posts.some((o) => o.id === p.id),
                ),
              ],
            },
      );
    } catch (e) {
      if (n === seq.current)
        setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }
  return {
    data:
      snapshotParams === params
        ? data
        : {
            ...data,
            posts: [],
            comments: [],
            nextCursor: null,
            nextCommentCursor: null,
          },
    loading,
    error,
    busy,
    run,
    refresh,
    loadMore: (cursor: string) => page(cursor),
    loadComments: (cursor: string) => page(cursor, true),
  };
}
