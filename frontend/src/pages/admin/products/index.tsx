import { ProductsCol } from "@/components/admin";
import { DataTable } from "@/components/table";
import { PRODUCTS_HOOKS } from "@/hooks";
import { Loader, Card, Title, Button } from "@mantine/core";
import { Link } from "react-router";

const ProductsA = () => {
  const { data, isLoading } = PRODUCTS_HOOKS.useGetProductsA();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <Title order={2} className="text-gray-800">
          Products
        </Title>
        <Link to={"/admin/product/new"}>
          <Button>Create Product</Button>
        </Link>
      </div>
      <Card shadow="sm" radius="md" className="p-4">
        <DataTable columns={ProductsCol} data={data!} />
      </Card>
    </div>
  );
};

export default ProductsA;
