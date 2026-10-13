# Country Liquor Bar — Stock Management & Daily Sales

A web application for a country liquor bar in India. It records sealed boxes in storage and loose bottles on the table, calculates daily sales from those counts, and keeps every device on the same MongoDB database.

Sales are not typed in. They are calculated:

```
Opening bottles = (opening boxes × units per box) + opening loose bottles
Received bottles = (received boxes × units per box) + received loose bottles
Closing bottles = (closing boxes × units per box) + closing loose bottles
Sold bottles = opening + received + authorized adjustments − closing
Revenue = sold bottles × the bottle price saved on that day
```

Moving a sealed box onto the table only changes the split between boxes and loose bottles. It does not change the total and it is not a sale.

## Stack

- React, Vite, Tailwind CSS, Recharts
- Node.js, Express
- MongoDB Atlas (or any MongoDB replica set)
- JWT login with Admin, Manager, and Staff roles
- Excel, CSV, and PDF exports
- Currency in Indian Rupees, dates as DD-MM-YYYY, timestamps in Asia/Kolkata

Stock is stored in MongoDB. The browser only keeps the sign-in token for the session.

## Local setup

Requires Node.js 20 or newer.

1. Create a MongoDB Atlas database named `clbsm` and copy the connection string.
2. In `backend`, copy `.env.example` to `.env` and set:

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/clbsm?retryWrites=true&w=majority
JWT_SECRET=a-long-random-string-at-least-20-characters
JWT_EXPIRES_IN=12h
CLIENT_ORIGIN=http://localhost:5173
```

3. Install and seed:

```
npm install --prefix backend
npm install --prefix frontend
npm run seed --prefix backend
```

4. Start the API and the site:

```
npm run dev --prefix backend
npm run dev --prefix frontend
```

Open http://localhost:5173. The Vite dev server proxies `/api` to http://localhost:5000.

### Seed accounts

Change these passwords after the first sign-in.

| Role | User | Password |
|---|---|---|
| Admin | admin | admin#2026 |

There is one sign-in. Older manager and staff accounts are turned off the next time the server starts.

The seed also creates the seven configured items (GM, Tango, Soaf, and RD). Sample bottle prices are placeholders. The other items are added later in Item Master. Sample stock is created for today and the previous two days only when the database has no daily stock yet. Running the seed again does not reset passwords or overwrite saved days.

## Access

The app has one admin login. That account can enter stock, record collections, adjust inventory, and open reports and settings.

## Stock rules

- Closing stock is entered once for each item on a date. Saving again updates that same day.
- The first count for an item is the starting stock. It is stored as both opening and closing, so nothing is sold that day. That closing becomes the next day’s opening.
- After the first count, opening stock is the previous closing. It is not typed in. Received stock can still be entered when a delivery arrives.
- If a closing is corrected, the next saved day takes the new closing as its opening and its sales are recalculated.
- Closing bottles cannot exceed opening + received + same-day adjustments.
- Counts cannot be negative.
- An adjustment needs a reason, and it stores the user and time.
- An adjustment on a date that already has a closing count changes that day’s sales calculation. It is not added again on top of the physical closing count.
- An adjustment after the latest count updates the on-hand inventory until the next daily entry.
- Changing an item’s current price writes price history and does not change revenue already stored on older days.

## Reports

Daily sales, date-wise summary, item-wise sales, opening and closing stock, stock movement and adjustments, monthly revenue, and cash reconciliation. Each report accepts a date range (or a year) and an optional item. Excel, CSV, and PDF are built from that same result, including the business name, period, generated timestamp, item details, totals, and rupee amounts.

## Tests

```
npm test --prefix backend
```

The tests cover:

1. The first closing is starting stock, so sales are 0. The next day opens at that closing. Closing 4 boxes after an opening of 5 boxes, 48 bottles per box, sells 48 bottles.
2. 2 boxes and 10 loose bottles moved to 1 box and 58 loose bottles: 0 sold.
3. 100 bottles opening, 48 received, 120 closing: 28 sold.
4. Closing stock above available stock is rejected unless an authorized adjustment covers it.
5. A later item-master price does not change a saved day’s revenue.
6. A second read sees the same saved counts, and a stale edit is rejected.
7. A filtered export total matches the on-screen report total.

## Deployment

Use one Atlas database for every phone, tablet, and computer. Do not point production devices at separate databases.

### Database

In Atlas, create the database user, allow the Render service to connect (IP access or `0.0.0.0/0` only if you accept that exposure), and copy the SRV connection string. If the string has no database name, the API uses `clbsm`. On Render, set `MONGODB_URI` to that full string. The local `.env` file is not uploaded.

### One Render web service

The website and the API are served from the same address. Leave the root directory empty.

- Build command: `npm ci --prefix backend && npm ci --prefix frontend && npm run build --prefix frontend`
- Start command: `npm start --prefix backend`
- Health check path: `/api/health`
- Environment:
  - `NODE_ENV=production`
  - `MONGODB_URI` — the Atlas connection string, including the database name `clbsm`
  - `JWT_SECRET` — at least 32 random characters
  - `JWT_EXPIRES_IN=12h`

Render’s own site address is allowed for sign-in. Set `CLIENT_ORIGIN` only when a browser on a different address must call this service.

The admin login `admin` / `admin#2026` is already in the database. A later start does not replace that password or add sample sales.

## API overview

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Signed in |
| POST | `/api/auth/logout` | Signed in |
| GET | `/api/dashboard?date=` | Signed in |
| GET/POST/PUT | `/api/items` | Read: signed in. Write: admin, manager |
| PUT | `/api/daily-stock` | Admin, manager, staff |
| GET | `/api/daily-stock?date=` | Signed in |
| DELETE | `/api/daily-stock/:id` | Admin |
| GET | `/api/sales?date=` | Signed in |
| PUT | `/api/sales/collection` | Admin, manager |
| GET | `/api/inventory` | Signed in |
| GET | `/api/inventory/:itemId/history` | Signed in |
| POST | `/api/inventory/adjustments` | Admin, manager |
| GET | `/api/reports/:type` | Admin, manager |
| GET | `/api/reports/:type/export?format=xlsx\|csv\|pdf` | Admin, manager |
| GET/POST/PUT | `/api/users` | Admin |
| GET/PUT | `/api/settings` | Read: admin, manager. Write: admin |
| GET | `/api/settings/public` | Public business name |
| GET | `/api/health` | Public |

Report `type` is one of `daily-sales`, `sales-summary`, `item-wise`, `opening-closing`, `movements`, `monthly`, `reconciliation`.
