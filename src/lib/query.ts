import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backend } from "./backend";
import type { EntityMap, EntityName, Id, ListQuery, ReviewGrade } from "./types";
import { toast } from "./toast";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: false, structuralSharing: true },
  },
});

/** Every mutation can touch related rows (inherit/cascade/hooks): refresh all local data. */
export const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ["db"] });

export function useList<E extends EntityName>(entity: E, query?: ListQuery, enabled = true) {
  return useQuery({
    queryKey: ["db", entity, "list", query ?? {}],
    queryFn: () => backend().list(entity, query),
    enabled,
  });
}

export function useRow<E extends EntityName>(entity: E, id: Id | null | undefined) {
  return useQuery({
    queryKey: ["db", entity, "get", id],
    queryFn: () => backend().get(entity, id!),
    enabled: !!id,
  });
}

export function useOverview() {
  return useQuery({ queryKey: ["db", "overview"], queryFn: () => backend().overview() });
}

const report = (e: unknown) => toast(String(e), { tone: "danger" });

export function useCreate<E extends EntityName>(entity: E) {
  return useMutation({
    mutationFn: (data: Partial<EntityMap[E]>) => backend().create(entity, data),
    onSuccess: invalidateAll,
    onError: report,
  });
}

export function useUpdate<E extends EntityName>(entity: E) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: Id; patch: Partial<EntityMap[E]> }) => backend().update(entity, id, patch),
    // Optimistic: patch every cached list/get containing this row so toggles feel instant.
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["db", entity] });
      qc.setQueriesData<unknown>({ queryKey: ["db", entity] }, (old: unknown) => {
        if (Array.isArray(old)) return old.map((r: { id: string }) => (r.id === id ? { ...r, ...patch } : r));
        if (old && typeof old === "object" && (old as { id?: string }).id === id) return { ...old, ...patch };
        return old;
      });
    },
    onSettled: invalidateAll,
    onError: report,
  });
}

export function useRemove(entity: EntityName, label = "Item") {
  return useMutation({
    mutationFn: (id: Id) => backend().remove(entity, id),
    onSuccess: (_d, id) => {
      invalidateAll();
      toast(`${label} deleted`, {
        action: { label: "Undo", run: () => backend().restore(entity, id).then(invalidateAll) },
      });
    },
    onError: report,
  });
}

export function useReview() {
  return useMutation({
    mutationFn: ({ id, grade }: { id: Id; grade: ReviewGrade }) => backend().reviewMistake(id, grade),
    onSuccess: invalidateAll,
    onError: report,
  });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => backend().settings(), staleTime: Infinity });
}

export function useSetting<T>(key: string, fallback: T): [T, (v: T) => void] {
  const { data } = useSettings();
  const qc = useQueryClient();
  const value = (data?.[key] as T | undefined) ?? fallback;
  const set = (v: T) => {
    qc.setQueryData(["settings"], (old: Record<string, unknown> | undefined) => ({ ...old, [key]: v }));
    backend().setSetting(key, v).catch(report);
  };
  return [value, set];
}
