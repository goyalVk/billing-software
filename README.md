# Natural Pasand Billing Software

A simple billing/POS and inventory app for a single shop. Monorepo with an
Express + MongoDB backend (`/server`) and a React + Vite + Tailwind frontend
(`/client`).

## Features

- **Products** — add/edit/delete products, searchable table, tracks stock.
- **Billing (POS)** — search products, build a cart, generate an invoice
  (saves the sale, decrements stock, produces a PDF), download the PDF or
  open WhatsApp to send it manually.
- **Purchase Entry** — record stock coming in from a supplier; increments
  product stock.
- **Dashboard** — today's (or any past date's) total sales, total purchases,
  and transaction lists.

## Prerequisites

- Node.js 18+
- MongoDB (a local `mongod` instance, or a MongoDB Atlas connection string)

## Setup

### 1. Server

```bash
cd server
npm install
```

Copy `.env.example` to `.env` and set your MongoDB connection string:

```
MONGODB_URI=mongodb://127.0.0.1:27017/billing_app
PORT=5000
SHOP_NAME=Natural Pasand
```

Run it:

```bash
npm run dev
```

The API starts on `http://localhost:5000`. Check `http://localhost:5000/api/health`.

### 2. Client

In a separate terminal:

```bash
cd client
npm install
npm run dev
```

The app opens on `http://localhost:5173`. It proxies `/api/*` requests to
the server on port 5000 (see `client/vite.config.js`), so both must be
running.

## Usage

1. Go to **Products** and add your items (name, unit, purchase rate, selling
   rate, opening stock).
2. Go to **Billing** to create a sale: search for a product, add it to the
   cart, adjust rate/quantity if needed, fill in customer details, and click
   **Generate Invoice**. This saves the sale, reduces stock, and lets you
   download the PDF invoice or open WhatsApp to send it.
3. Go to **Purchase** to record new stock coming in from a supplier.
4. Go to **Dashboard** to see today's (or any date's) totals and
   transactions.

## Tech stack

- **Frontend:** React (Vite), Tailwind CSS, React Router, Axios
- **Backend:** Node.js, Express, Mongoose
- **Database:** MongoDB
- **PDF:** pdfkit

## Notes

- No authentication — intended for single-user, local/small deployment.
- Invoice numbers are sequential (`INV-000001`, `INV-000002`, ...).
- "Send on WhatsApp" opens `https://wa.me/<number>` in a new tab; you attach
  the downloaded PDF manually — there's no WhatsApp API integration in
  Phase 1.
