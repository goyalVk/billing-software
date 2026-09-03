import PDFDocument from "pdfkit";

// Streams a simple invoice PDF for the given sale straight into the HTTP response.
export function generateInvoicePdf(res, sale) {
  const shopName = process.env.SHOP_NAME || "My Shop";
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=invoice-${sale.invoiceNo}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(20).text(shopName, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(14).text("Invoice", { align: "center" });
  doc.moveDown(1);

  doc.fontSize(10);
  doc.text(`Invoice No: ${sale.invoiceNo}`);
  doc.text(`Date: ${new Date(sale.date).toLocaleString()}`);
  doc.text(`Customer: ${sale.customerName || "-"}`);
  if (sale.customerPhone) doc.text(`Phone: ${sale.customerPhone}`);
  doc.moveDown(1);

  const tableTop = doc.y;
  const colX = { name: 50, qty: 280, rate: 350, amount: 440 };

  doc.font("Helvetica-Bold");
  doc.text("Item", colX.name, tableTop);
  doc.text("Qty", colX.qty, tableTop);
  doc.text("Rate", colX.rate, tableTop);
  doc.text("Amount", colX.amount, tableTop);
  doc.font("Helvetica");
  doc.moveDown(0.5);
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.3);

  sale.items.forEach((item) => {
    const rowY = doc.y;
    doc.text(item.productName, colX.name, rowY, { width: 220 });
    doc.text(String(item.quantity), colX.qty, rowY);
    doc.text(item.rate.toFixed(2), colX.rate, rowY);
    doc.text(item.amount.toFixed(2), colX.amount, rowY);
    doc.moveDown(0.6);
  });

  doc.moveDown(0.5);
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(12);
  doc.text(`Grand Total: Rs. ${sale.totalAmount.toFixed(2)}`, colX.rate, doc.y, {
    align: "left",
  });

  if (sale.paymentStatus !== "paid") {
    const pending = sale.totalAmount - sale.amountPaid;
    const label =
      sale.paymentStatus === "partial"
        ? `Payment Status: PARTIAL (Rs. ${sale.amountPaid.toFixed(2)} paid, Rs. ${pending.toFixed(2)} pending)`
        : `Payment Status: DUE (Rs. ${pending.toFixed(2)} pending)`;
    doc.moveDown(0.3);
    doc.fillColor("#c0392b");
    doc.text(
      label,
      colX.rate,
      doc.y,
      { align: "left" }
    );
    doc.fillColor("black");
  }

  doc.moveDown(2);
  doc.font("Helvetica").fontSize(9).fillColor("#888888");
  doc.text("Thank you for your business!", { align: "center" });

  doc.end();
}
