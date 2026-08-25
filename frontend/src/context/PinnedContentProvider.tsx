import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "oncampus.personal-pins.v1";

type StoredPins = {
  posts: string[];
  groups: string[];
};

type PinnedContentContextValue = {
  hydrated: boolean;
  isPostPinned: (id: string | number | null | undefined) => boolean;
  isGroupPinned: (id: string | number | null | undefined) => boolean;
  togglePostPin: (id: string | number) => Promise<boolean>;
  toggleGroupPin: (id: string | number) => Promise<boolean>;
};

const PinnedContentContext = createContext<PinnedContentContextValue | null>(null);

function normalizedId(value: string | number | null | undefined) {
  return String(value ?? "").trim();
}

function parseStoredPins(raw: string | null): StoredPins {
  if (!raw) return { posts: [], groups: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPins>;
    return {
      posts: Array.isArray(parsed.posts) ? parsed.posts.map(normalizedId).filter(Boolean) : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups.map(normalizedId).filter(Boolean) : [],
    };
  } catch {
    return { posts: [], groups: [] };
  }
}

export function PinnedContentProvider({ children }: { children: React.ReactNode }) {
  const [postIds, setPostIds] = useState<Set<string>>(() => new Set());
  const [groupIds, setGroupIds] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const stored = parseStoredPins(raw);
        setPostIds(new Set(stored.posts));
        setGroupIds(new Set(stored.groups));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((posts: Set<string>, groups: Set<string>) => {
    const payload: StoredPins = {
      posts: Array.from(posts),
      groups: Array.from(groups),
    };
    return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => undefined);
  }, []);

  const togglePostPin = useCallback(async (id: string | number) => {
    const key = normalizedId(id);
    if (!key) return false;
    const nextPosts = new Set(postIds);
    const nextPinned = !nextPosts.has(key);
    if (nextPinned) nextPosts.add(key);
    else nextPosts.delete(key);
    setPostIds(nextPosts);
    await persist(nextPosts, groupIds);
    return nextPinned;
  }, [groupIds, persist, postIds]);

  const toggleGroupPin = useCallback(async (id: string | number) => {
    const key = normalizedId(id);
    if (!key) return false;
    const nextGroups = new Set(groupIds);
    const nextPinned = !nextGroups.has(key);
    if (nextPinned) nextGroups.add(key);
    else nextGroups.delete(key);
    setGroupIds(nextGroups);
    await persist(postIds, nextGroups);
    return nextPinned;
  }, [groupIds, persist, postIds]);

  const isPostPinned = useCallback((id: string | number | null | undefined) => postIds.has(normalizedId(id)), [postIds]);
  const isGroupPinned = useCallback((id: string | number | null | undefined) => groupIds.has(normalizedId(id)), [groupIds]);

  const value = useMemo<PinnedContentContextValue>(() => ({
    hydrated,
    isPostPinned,
    isGroupPinned,
    togglePostPin,
    toggleGroupPin,
  }), [hydrated, isGroupPinned, isPostPinned, toggleGroupPin, togglePostPin]);

  return <PinnedContentContext.Provider value={value}>{children}</PinnedContentContext.Provider>;
}

export function usePinnedContent() {
  const context = useContext(PinnedContentContext);
  if (!context) throw new Error("usePinnedContent must be used within PinnedContentProvider");
  return context;
}
