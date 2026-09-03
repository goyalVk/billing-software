import Purchase from "../models/Purchase.js";
import Sale from "../models/Sale.js";

// Replays every purchase and sale of a product in chronological order to
// rebuild its current stock and moving-average purchase rate from scratch.
// Needed after editing a historical purchase entry, since the weighted
// average depends on the exact order and stock level at the time of each
// purchase (same formula used when purchases are recorded normally). Each
// purchase's miscAmount (transport/labour/other charges) is allocated across
// its items proportionally to amount, same as at write-time, so the replayed
// rate stays misc-inclusive.
export async function recomputeProductCostBasis(productId) {
  const [purchases, sales] = await Promise.all([
    Purchase.find({ "items.productId": productId }).sort({ date: 1 }),
    Sale.find({ "items.productId": productId }).sort({ date: 1 }),
  ]);

  const events = [];
  for (const purchase of purchases) {
    const itemsTotal = purchase.itemsTotal || purchase.items.reduce((sum, i) => sum + i.amount, 0);
    const miscAmount = purchase.miscAmount || 0;
    for (const item of purchase.items) {
      if (String(item.productId) === String(productId)) {
        const allocatedMisc = itemsTotal > 0 ? (item.amount / itemsTotal) * miscAmount : 0;
        const effectiveRate =
          item.quantity > 0 ? (item.amount + allocatedMisc) / item.quantity : item.rate;
        events.push({
          date: purchase.date,
          type: "purchase",
          quantity: item.quantity,
          rate: effectiveRate,
        });
      }
    }
  }
  for (const sale of sales) {
    for (const item of sale.items) {
      if (String(item.productId) === String(productId)) {
        events.push({ date: sale.date, type: "sale", quantity: item.quantity });
      }
    }
  }
  events.sort((a, b) => a.date - b.date);

  let stock = 0;
  let rate = 0;
  for (const event of events) {
    if (event.type === "purchase") {
      const newStock = stock + event.quantity;
      rate =
        newStock > 0
          ? Math.round(((stock * rate + event.quantity * event.rate) / newStock) * 100) / 100
          : rate;
      stock = newStock;
    } else {
      stock -= event.quantity;
    }
  }

  return { stock: Math.max(0, stock), rate };
}
