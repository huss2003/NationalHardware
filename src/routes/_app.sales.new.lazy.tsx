import { createLazyFileRoute } from "@tanstack/react-router";
import { NewSaleScreen } from "@/components/erp/NewSaleScreen";

export const Route = createLazyFileRoute("/_app/sales/new")({ component: NewSale });

function NewSale() {
  return <NewSaleScreen entryMode="scan" tabsKey="sale_tabs" />;
}
