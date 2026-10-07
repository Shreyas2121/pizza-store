import { useState } from "react";
import { Alert, Button, NumberInput, Select, Switch, TextInput } from "@mantine/core";
import { useCreateCustomizationGroup, useCreateCustomizationOption } from "../../api/customization.queries";
import { parseRupeesToPaise, success } from "@/shared/lib";

export function CustomizationGroupForm({ onSaved }: { onSaved: () => void }) {
  const create = useCreateCustomizationGroup();
  const [name, setName] = useState("");
  const [type, setType] = useState<"single" | "multiple">("single");
  const [required, setRequired] = useState(false);
  return <form className="space-y-4" onSubmit={(event) => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), type, required }, { onSuccess: () => { success("Customization group created. Add options before assigning products."); onSaved(); } });
  }}>
    <TextInput label="Group name" placeholder="e.g. Choose your crust" value={name} onChange={(event) => setName(event.currentTarget.value)} required maxLength={100} disabled={create.isPending} />
    <Select label="Selection type" value={type} onChange={(value) => setType(value === "multiple" ? "multiple" : "single")} data={[{ value: "single", label: "Choose one" }, { value: "multiple", label: "Choose multiple" }]} allowDeselect={false} disabled={create.isPending} />
    <Switch label="Selection required" description="Customers must select an option from this group." checked={required} onChange={(event) => setRequired(event.currentTarget.checked)} disabled={create.isPending} />
    {create.isError && <Alert color="red">Group could not be created. Please try again.</Alert>}
    <Button type="submit" fullWidth loading={create.isPending} disabled={!name.trim()}>Create group</Button>
  </form>;
}

export function CustomizationOptionForm({ groupId, onSaved }: { groupId: number; onSaved: () => void }) {
  const create = useCreateCustomizationOption();
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | string>(0);
  const [available, setAvailable] = useState(true);
  const [validation, setValidation] = useState<string | null>(null);
  return <form className="space-y-4" onSubmit={(event) => {
    event.preventDefault();
    if (!name.trim()) return;
    let pricePaise: number;
    try { pricePaise = parseRupeesToPaise(price); if (pricePaise > 50_000) throw new Error(); }
    catch { setValidation("Enter a price from ₹0 to ₹500 with up to two decimal places."); return; }
    setValidation(null);
    create.mutate({ groupId, name: name.trim(), pricePaise, isAvailable: available }, { onSuccess: () => { success("Customization option created."); onSaved(); } });
  }}>
    <TextInput label="Option name" placeholder="e.g. Cheese burst" required maxLength={100} value={name} onChange={(event) => setName(event.currentTarget.value)} disabled={create.isPending} />
    <NumberInput label="Additional price (₹)" description="Use zero for an included option." min={0} max={500} decimalScale={2} value={price} onChange={setPrice} disabled={create.isPending} error={validation} />
    <Switch label="Available to customers" checked={available} onChange={(event) => setAvailable(event.currentTarget.checked)} disabled={create.isPending} />
    {create.isError && <Alert color="red">Option could not be created. Please try again.</Alert>}
    <Button type="submit" fullWidth loading={create.isPending} disabled={!name.trim()}>Create option</Button>
  </form>;
}
