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
import authRouter from "./routes/auth.js";
import { authenticate } from "./middleware/authenticate.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/products", authenticate, productsRouter);
app.use("/api/sales", authenticate, salesRouter);
app.use("/api/purchases", authenticate, purchasesRouter);
app.use("/api/dashboard", authenticate, dashboardRouter);
app.use("/api/customers", authenticate, customersRouter);
app.use("/api/suppliers", authenticate, suppliersRouter);

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
