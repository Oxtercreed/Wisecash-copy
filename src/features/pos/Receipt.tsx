import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import type { Shop, SaleWithItems } from "@/lib/types";

export function Receipt({
  sale,
  shop,
  open,
  onClose,
  onNewSale,
}: {
  sale: SaleWithItems | null;
  shop: Shop | null;
  open: boolean;
  onClose: () => void;
  onNewSale?: () => void;
}) {
  if (!sale) return null;
  const currency = shop?.currency ?? "TZS";
  const change =
    sale.payment_method === "cash"
      ? Math.max(0, Number(sale.cash_amount || 0) - Number(sale.total || 0))
      : 0;

  return (
    <Dialog open={open} onClose={onClose} title="Receipt">
      <div className="print-area mx-auto w-full max-w-[300px] bg-white p-2 font-mono text-[12px] leading-relaxed text-black">
        <div className="text-center">
          <p className="text-sm font-bold">{shop?.name ?? "My Shop"}</p>
          {shop?.phone && <p>{shop.phone}</p>}
          {shop?.address && <p>{shop.address}</p>}
        </div>
        <div className="my-2 border-t border-dashed border-black/40" />
        <div className="flex justify-between text-[11px]">
          <span>{sale.invoice_number}</span>
          <span>{new Date(sale.created_at).toLocaleString()}</span>
        </div>
        {sale.customer_name && <p className="text-[11px]">Customer: {sale.customer_name}</p>}
        <div className="my-2 border-t border-dashed border-black/40" />
        <table className="w-full">
          <tbody>
            {sale.sale_items?.map((it) => (
              <tr key={it.id} className="align-top">
                <td className="pb-1 pr-1">
                  {it.product_name}
                  <span className="block text-[10px] text-black/60">
                    {it.quantity} × {formatMoney(it.unit_price, currency)}
                  </span>
                </td>
                <td className="pb-1 text-right whitespace-nowrap">{formatMoney(it.line_total, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="my-2 border-t border-dashed border-black/40" />
        <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(sale.subtotal, currency)}</span></div>
        {Number(sale.discount) > 0 && (
          <div className="flex justify-between"><span>Discount</span><span>-{formatMoney(sale.discount, currency)}</span></div>
        )}
        <div className="flex justify-between font-bold"><span>TOTAL</span><span>{formatMoney(sale.total, currency)}</span></div>
        <div className="flex justify-between text-[11px]">
          <span className="capitalize">{sale.payment_method}</span>
          <span>
            {sale.payment_method === "split"
              ? `${formatMoney(sale.cash_amount, currency)} + ${formatMoney(sale.mpesa_amount, currency)}`
              : formatMoney(sale.total, currency)}
          </span>
        </div>
        {sale.payment_method === "mpesa" && sale.mpesa_ref && (
          <p className="text-[11px]">Ref: {sale.mpesa_ref}</p>
        )}
        {change > 0 && <div className="flex justify-between"><span>Change</span><span>{formatMoney(change, currency)}</span></div>}
        {sale.credit_amount > 0 && (
          <p className="mt-1 font-bold">ON CREDIT: {formatMoney(sale.credit_amount, currency)}</p>
        )}
        <div className="my-2 border-t border-dashed border-black/40" />
        <p className="text-center text-[11px]">{shop?.receipt_footer}</p>
        <p className="mt-1 text-center text-[9px] text-black/50">Powered by SmartDuka</p>
      </div>

      <div className="mt-4 flex gap-2 no-print">
        <Button variant="outline" className="flex-1" onClick={() => window.print()}>
          Print receipt
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            onClose();
            onNewSale?.();
          }}
        >
          New sale
        </Button>
      </div>
    </Dialog>
  );
}
