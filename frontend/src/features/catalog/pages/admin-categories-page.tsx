import { useState } from "react";
import { Badge, Button, Paper, Text, TextInput } from "@mantine/core";
import { Plus } from "lucide-react";
import { useCreateCategory, useGetCategories } from "../api/category.queries";
import { PageHeader, CardGridSkeleton } from "@/shared/ui";
import { error, success } from "@/shared/lib";

export default function AdminCategoriesPage() {
  const categories = useGetCategories();
  const create = useCreateCategory();
  const [name, setName] = useState("");
  const duplicate = categories.data?.some((category) => category.name.toLowerCase() === name.trim().toLowerCase());
  return <div className="space-y-5">
    <PageHeader eyebrow="Catalogue" title="Categories" description="Organize products into categories. New categories are available immediately in the product form." />
    <Paper withBorder radius="lg" p="lg">
      <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || duplicate) return;
        create.mutate({ name: name.trim() }, { onSuccess: () => { setName(""); success("Category created."); }, onError: () => error("Category could not be created. Please try again.") });
      }}>
        <TextInput className="flex-1" label="Category name" placeholder="e.g. Sides" required maxLength={100} value={name} onChange={(event) => setName(event.currentTarget.value)} error={duplicate ? "A category with this name already exists." : undefined} disabled={create.isPending} />
        <Button type="submit" leftSection={<Plus size={16} />} loading={create.isPending} disabled={!name.trim() || duplicate || !categories.data}>Create category</Button>
      </form>
    </Paper>
    {categories.isLoading ? <CardGridSkeleton count={6} height={110} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" label="Loading categories" /> : categories.isError ? <Paper withBorder p="lg"><Text c="red">Categories could not be loaded.</Text><Button mt="sm" variant="default" onClick={() => categories.refetch()}>Retry</Button></Paper> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.data?.map((category) => <Paper key={category.id} withBorder radius="lg" p="lg"><Text fw={700}>{category.name}</Text><Badge mt="sm" color={category.isActive ? "basil" : "gray"}>{category.isActive ? "Active" : "Inactive"}</Badge></Paper>)}
      {!categories.data?.length && <Text c="dimmed">No categories yet. Create your first category above.</Text>}
    </div>}
  </div>;
}
