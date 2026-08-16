import { ProductForm } from "@/components/admin";
import { PageHeader } from "@/components/common";

const NewProduct = () => {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Add product" description="Create a catalogue item with customer-facing details, price, dietary information, and imagery." />
      <ProductForm />
    </div>
  );
};

export default NewProduct;
