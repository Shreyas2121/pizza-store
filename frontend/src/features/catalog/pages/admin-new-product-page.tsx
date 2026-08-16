import ProductForm from "../components/admin/product-form";
import { PageHeader } from "@/shared/ui";


export const AdminNewProductPage = () => {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Add product" description="Create a catalogue item with customer-facing details, price, dietary information, and imagery." />
      <ProductForm />
    </div>
  );
};

export default AdminNewProductPage;
