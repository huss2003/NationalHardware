import { createLazyFileRoute } from "@tanstack/react-router";
import { NewSaleScreen } from "@/components/erp/NewSaleScreen";

export const Route = createLazyFileRoute("/_app/sales2")({ component: Sales2 });

function Sales2() {
  return <NewSaleScreen entryMode="tiles" tabsKey="sale2_tabs" />;
}
