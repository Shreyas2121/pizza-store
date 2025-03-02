import ProductForm from "@/components/admin/products/product-form";

const NewProduct = () => {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Add New Product
      </h2>
      <ProductForm />
    </div>
  );
};

export default NewProduct;
