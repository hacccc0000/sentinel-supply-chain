import { useQuery, useQueryClient } from "@tanstack/react-query";
import { bootstrap, getBuild, getMe } from "@/lib/server/api";

export function useTenant() {
  return useQuery({
    queryKey: ["tenant"],
    queryFn: () => bootstrap(),
    staleTime: 4_000,
    refetchInterval: (q) => ((q.state.data?.running ?? 0) > 0 ? 2_500 : 15_000),
    refetchIntervalInBackground: false,
  });
}

export function useBuild(id: string) {
  return useQuery({
    queryKey: ["build", id],
    queryFn: () => getBuild({ data: { id } }),
    refetchInterval: (q) => (q.state.data?.build.status === "running" ? 1_500 : false),
  });
}

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: () => getMe(), staleTime: 30_000 });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["tenant"] }), qc.invalidateQueries({ queryKey: ["build"] })]);
  };
}

export const can = (perms: string[] | undefined, p: string) => !!perms?.includes(p);
