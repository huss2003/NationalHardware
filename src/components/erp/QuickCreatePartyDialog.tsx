import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceButton } from "@/components/erp/VoiceButton";
import { toast } from "sonner";

type Kind = "customer" | "supplier";
export type PartyRow = { id: string; name: string; gstin?: string | null; address?: string | null; phone?: string | null; state?: string | null };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: Kind;
  initialName?: string;
  onCreated: (row: any) => void;
  /** When set, the dialog edits this party instead of creating a new one. */
  editRow?: PartyRow | null;
}

export function QuickCreatePartyDialog({ open, onOpenChange, kind, initialName = "", onCreated, editRow = null }: Props) {
  const [name, setName] = useState(initialName);
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editRow) {
      setName(editRow.name ?? "");
      setGstin(editRow.gstin ?? "");
      setAddress(editRow.address ?? "");
      setPhone(editRow.phone ?? "");
      setState(editRow.state ?? "");
    } else {
      setName(initialName); setGstin(""); setAddress(""); setPhone(""); setState("");
    }
  }, [open, initialName, editRow]);

  const label = kind === "customer" ? "Customer" : "Supplier";
  const table = kind === "customer" ? "customers" : "suppliers";

  const submit = async () => {
    const n = name.trim();
    if (!n) { toast.error(`${label} name is required`); return; }
    if (n.length > 120) { toast.error("Name is too long"); return; }
    if (gstin && gstin.length > 20) { toast.error("Invalid GSTIN"); return; }
    if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) { toast.error("Invalid phone"); return; }
    setBusy(true);
    try {
      const payload: any = {
        name: n,
        gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        state: state.trim() || null,
      };
      const res = editRow
        ? await supabase.from(table).update(payload).eq("id", editRow.id).select().single()
        : await supabase.from(table).insert(payload).select().single();
      if (res.error) throw res.error;
      toast.success(editRow ? `${label} updated` : `${label} created`);
      onCreated(res.data);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editRow ? `Edit ${label.toLowerCase()}` : `Add new ${label.toLowerCase()}`}</DialogTitle>
          <DialogDescription>Only the name is required. Other fields are optional.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{label} name<span className="text-destructive"> *</span></Label>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${label} name`} maxLength={120} autoFocus />
              <VoiceButton onResult={(t) => setName(t)} />
            </div>
          </div>
          <div>
            <Label>GSTIN <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="29ABCDE1234F1Z5" maxLength={20} />
          </div>
          <div>
            <Label>State <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Madhya Pradesh" maxLength={60} />
          </div>
          <div>
            <Label>Address <span className="text-muted-foreground">(optional)</span></Label>
            <div className="flex gap-2">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, State" maxLength={255} />
              <VoiceButton onResult={(t) => setAddress(t)} />
            </div>
          </div>
          <div>
            <Label>Phone <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxxxx" maxLength={20} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : editRow ? "Save changes" : `Create ${label.toLowerCase()}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
