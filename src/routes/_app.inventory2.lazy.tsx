import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronRight, Home, Pencil, Trash2, Plus, FolderOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createLazyFileRoute("/_app/inventory2")({ component: Inventory2 });

type Node = { id: string; parent_id: string | null; name: string; image_url: string | null; sort: number };
type Crumb = { id: string | null; name: string };

async function fetchChildren(parentId: string | null): Promise<Node[]> {
  let q = supabase.from("inventory_nodes").select("id,parent_id,name,image_url,sort").order("sort").order("name");
  q = parentId === null ? q.is("parent_id", null) : q.eq("parent_id", parentId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Node[];
}

function Inventory2() {
  const qc = useQueryClient();
  const [path, setPath] = useState<Crumb[]>([{ id: null, name: "All categories" }]);
  const parentId = path[path.length - 1].id;

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ["inventory-nodes", parentId],
    queryFn: () => fetchChildren(parentId),
  });

  // Dialog state: null = closed, {} = add, {node} = edit.
  const [editing, setEditing] = useState<null | { node?: Node }>(null);
  const [deleting, setDeleting] = useState<Node | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["inventory-nodes", parentId] });

  const openAdd = () => { setName(""); setImageUrl(""); setEditing({}); };
  const openEdit = (n: Node) => { setName(n.name); setImageUrl(n.image_url ?? ""); setEditing({ node: n }); };

  const save = async () => {
    const nm = name.trim();
    if (!nm) { toast.error("Name is required"); return; }
    setBusy(true);
    const payload = { name: nm, image_url: imageUrl.trim() || null };
    const res = editing?.node
      ? await supabase.from("inventory_nodes").update(payload).eq("id", editing.node.id)
      : await supabase.from("inventory_nodes").insert({ ...payload, parent_id: parentId });
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing?.node ? "Updated" : "Added");
    setEditing(null);
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const { error } = await supabase.from("inventory_nodes").delete().eq("id", deleting.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setDeleting(null);
    refresh();
  };

  const drillInto = (n: Node) => setPath((p) => [...p, { id: n.id, name: n.name }]);
  const jumpTo = (i: number) => setPath((p) => p.slice(0, i + 1));

  return (
    <div className="min-h-[calc(100dvh-1rem)] w-full bg-[#fafbfc] p-3 md:p-6 pb-28">
      <div className="mx-auto max-w-5xl">
        {/* Breadcrumb */}
        <div className="mb-4 flex flex-wrap items-center gap-1 text-sm">
          {path.map((c, i) => (
            <span key={c.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-4 w-4 text-slate-300" />}
              <button
                type="button"
                onClick={() => jumpTo(i)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 font-semibold ${
                  i === path.length - 1 ? "bg-[#3b82f6]/10 text-[#3b82f6]" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {i === 0 && <Home className="h-3.5 w-3.5" />}
                {c.name}
              </button>
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {nodes.map((n) => (
              <div
                key={n.id}
                className="group relative overflow-hidden rounded-2xl border border-[#e8ecf1] bg-white shadow-sm transition-all active:scale-[0.98] hover:border-[#3b82f6] hover:shadow-md"
              >
                <button type="button" onClick={() => drillInto(n)} className="block w-full text-left">
                  <img
                    src={n.image_url || `https://placehold.co/320x200?text=${encodeURIComponent(n.name)}`}
                    alt={n.name}
                    className="aspect-[8/5] w-full bg-slate-100 object-cover"
                  />
                  <div className="flex items-center justify-between gap-1 px-3 py-2.5">
                    <span className="truncate text-sm font-bold text-slate-700 group-hover:text-[#3b82f6]">{n.name}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </div>
                </button>
                {/* CRUD icons */}
                <div className="absolute right-1.5 top-1.5 flex gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${n.name}`}
                    onClick={() => openEdit(n)}
                    className="rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-sm backdrop-blur hover:bg-white hover:text-[#3b82f6]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${n.name}`}
                    onClick={() => setDeleting(n)}
                    className="rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-sm backdrop-blur hover:bg-white hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add tile */}
            <button
              type="button"
              onClick={openAdd}
              className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 text-slate-400 transition-all hover:border-[#3b82f6] hover:text-[#3b82f6] active:scale-[0.98]"
            >
              <Plus className="h-7 w-7" />
              <span className="text-sm font-bold">Add</span>
            </button>
          </div>
        )}

        {!isLoading && nodes.length === 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <FolderOpen className="h-4 w-4" /> Nothing here yet — tap Add to create one.
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl">
          <DialogTitle>{editing?.node ? "Edit category" : "Add category"}</DialogTitle>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Name</span>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 18 mm"
                onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Image URL <span className="font-normal text-slate-400">(optional)</span></span>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl">
          <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
          <p className="text-sm text-slate-500">
            This removes it and everything nested inside it. This can’t be undone.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>Cancel</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={confirmDelete} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
