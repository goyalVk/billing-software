import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import productsRouter from "./routes/products.js";
import salesRouter from "./routes/sales.js";
import purchasesRouter from "./routes/purchases.js";
import dashboardRouter from "./routes/dashboard.js";
import customersRouter from "./routes/customers.js";
import suppliersRouter from "./routes/suppliers.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/products", productsRouter);
app.use("/api/sales", salesRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/customers", customersRouter);
app.use("/api/suppliers", suppliersRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
