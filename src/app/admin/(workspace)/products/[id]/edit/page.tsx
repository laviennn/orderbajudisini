import { ProductScreen } from "@/features/admin/ProductScreen";
export default async function EditProduct({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ProductScreen id={(await params).id} />;
}
