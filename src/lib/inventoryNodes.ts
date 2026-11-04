import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Shared reads of the inventory_nodes tree so Sales 2 wizards show whatever
// Inventory 2 currently has (add/edit/delete reflects live). Cache key matches
// the Inventory 2 route so both share it.
export type InvNode = { id: string; name: string };

// Root node id by name (e.g. "PLY" / "MICA"). null while loading or absent.
export function useRootNodeId(name: string) {
  return useQuery({
    queryKey: ["inventory-root", name],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_nodes").select("id").is("parent_id", null).eq("name", name).maybeSingle();
      if (error) throw error;
      return (data?.id ?? null) as string | null;
    },
  });
}

// Children of a parent id. Disabled (no fetch) until parentId is known.
export function useChildren(parentId: string | null | undefined) {
  return useQuery({
    queryKey: ["inventory-nodes", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_nodes").select("id,name").eq("parent_id", parentId!).order("sort").order("name");
      if (error) throw error;
      return (data ?? []) as InvNode[];
    },
  });
}
