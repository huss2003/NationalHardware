import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/erp/PageHeader";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/inventory/subcategories")({
  component: SubCategoriesPage,
});

const CATEGORIES = ["plywood", "door", "hardware", "mica", "other"] as const;
type Cat = (typeof CATEGORIES)[number];

function SubCategoriesPage() {
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading: loading } = useQuery({
    queryKey: ["product_subcategories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_subcategories")
        .select("*")
        .order("category")
        .order("name");
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const load = () => queryClient.invalidateQueries({ queryKey: ["product_subcategories"] });

  const remove = async (id: string) => {
    if (!confirm("Delete this sub-category? Items inside will become un-categorized.")) return;
    const { error } = await supabase.from("product_subcategories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <>
      <PageHeader
        title="Sub-Categories"
        subtitle="Group items under a sub-category (e.g. Plywood → 18MM 8*4 LC → Blackhud, Comet…)."
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to="/inventory"><ArrowLeft className="h-4 w-4" /> Inventory</Link>
            </Button>
            <NewSubCategoryDialog onCreated={load} />
          </>
        }
      />
      <div className="px-4 sm:px-6 lg:px-8 pb-10 max-w-[1100px] mx-auto w-full">
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Sub-Category</TableHead>
                <TableHead className="text-right">₹/sqft</TableHead>
                <TableHead className="text-right">₹/pc</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No sub-categories yet. Click "New sub-category" to create one.
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{r.category}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.default_price_per_sqft ? `₹${Number(r.default_price_per_sqft).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.default_price_per_pc ? `₹${Number(r.default_price_per_pc).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}

function NewSubCategoryDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Cat>("plywood");
  const [name, setName] = useState("");
  const [pSqft, setPSqft] = useState<number>(0);
  const [pPc, setPPc] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      const { error } = await supabase.from("product_subcategories").insert({
        category: category as any,
        name: name.trim(),
        default_price_per_sqft: pSqft || null,
        default_price_per_pc: pPc || null,
      });
      if (error) throw error;
      toast.success("Sub-category created");
      setOpen(false);
      setName(""); setPSqft(0); setPPc(0);
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> New sub-category</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New sub-category</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Category</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm capitalize"
              value={category}
              onChange={(e) => setCategory(e.target.value as Cat)}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Name</Label>
            <Input placeholder="e.g. 18MM 8*4 LC" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Default ₹/sqft (optional)</Label>
              <Input type="number" min={0} step="0.01" value={pSqft || ""} onChange={(e) => setPSqft(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Default ₹/pc (optional)</Label>
              <Input type="number" min={0} step="0.01" value={pPc || ""} onChange={(e) => setPPc(Number(e.target.value))} />
            </div>
          </div>
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}