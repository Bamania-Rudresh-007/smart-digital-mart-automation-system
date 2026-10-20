# Smart Digital Mart Automation System (SDMAS)

## Project Information

**Institution:** Government Polytechnic, Daman

**Project team:**

- Bamania Rudresh Vinaychandra
- Aditya Chaudhary
- Parmar Bhavin
- Solanki Priyanka

## 1. Introduction

The Smart Digital Mart Automation System (SDMAS) is a web-based application for managing the daily operations of a retail mart. It brings product and batch inventory, purchasing, point-of-sale billing, stock records, alerts, and reports into one system. It also automates selected inventory and procurement checks to help staff make timely, traceable decisions.

## 2. Problem Statement

Retail stores need to coordinate sales, stock, suppliers, and purchasing. When these activities are handled separately or manually, several problems can occur:

- Stock quantities can become inaccurate when incoming goods and sales are not recorded consistently.
- Staff may sell an item from a later-expiring batch while an earlier-expiring batch remains on the shelf.
- Products approaching their expiry date or already expired may be overlooked, increasing waste and potential losses.
- Low stock may not be noticed in time, causing product shortages and delayed replenishment.
- Purchase orders, received goods, and supplier invoices can disagree on quantities or prices, making discrepancies difficult to detect.
- Sales, stock changes, and purchase activity can be difficult to review later without a shared transaction history.
- In a multi-user store, unrestricted access can make it difficult to protect sensitive operations and keep actions accountable.

## 3. Proposed Solution

SDMAS provides a shared application for store staff to record and review core mart operations. The system tracks stock in batches, allocates sales to eligible batches using the **First Expiry, First Out (FEFO)** rule, scans for expiry and low-stock conditions, and supports purchasing workflows.

For procurement, the system compares purchase-order, goods-receipt, and supplier-invoice information. Where PDF documents contain readable, labeled text, it can extract key values and report differences. Role-based permissions and store scope help control access, while stock-ledger entries and audit logs support traceability.

## 4. Objectives

- Maintain product, supplier, batch, and stock information in one application.
- Record point-of-sale transactions and update inventory as part of checkout.
- Prioritize stock with the earliest expiry date when fulfilling sales.
- Identify low-stock and expiry conditions and present alerts to staff.
- Support purchase-order and goods-receipt workflows.
- Compare procurement records and surface quantity or price discrepancies.
- Restrict operations according to user roles and permissions.
- Provide reports and historical records for operational review.

## 5. Main Features

### Inventory management

- Manage products and suppliers.
- Track stock by batch, including received quantity, remaining quantity, purchase price, and expiry information.
- View the stock ledger for recorded stock movements.
- Identify expired and near-expiry batches.

### Sales and point of sale

- Create sales through the POS screen and review sales history.
- Deduct stock from batches in FEFO order, excluding expired stock.
- Record sale items and stock-ledger movements together in a database transaction.
- Broadcast stock updates to connected clients in real time.

### Purchasing and matching

- Manage purchase orders and their items.
- Record received goods and supplier invoices.
- Compare ordered, received, and invoiced quantities and prices using a configurable tolerance.
- Parse supported, text-based PDF documents for selected procurement values; scanned PDFs are not supported by this parser.
- Generate purchase-order PDFs and export supported reports to Excel or PDF.

### Automation and alerts

- Run a scheduled daily expiry scan and reorder check.
- Run an hourly low-stock reorder check.
- Generate draft purchase orders for qualifying low-stock products when a supplier is available and there is no active pending order for that product.
- Create in-app alerts for configured expiry and low-stock events.
- Optionally configure SMTP for email delivery; without SMTP configuration, email dispatch is logged as a development mock.

### Users, reporting, and accountability

- Authenticate users and protect application pages and API operations.
- Use roles and permissions to control access to modules and actions.
- Restrict non-super-admin users to their assigned store.
- View dashboards, reports, alerts, and audit logs.
- Maintain user profiles and account workflows.

## 6. How the Solution Works

1. An authorized user signs in and accesses the modules allowed by their role.
2. Staff maintain product, supplier, and batch information, including stock and expiry details.
3. Procurement users create purchase orders, record goods receipts and supplier invoices, and review matching results.
4. Cashiers record a sale in the POS. The server checks available non-expired stock, allocates quantities from the earliest-expiring eligible batches, and saves the sale and stock-ledger entries transactionally.
5. The system checks stock levels and batch expiry dates. Scheduled jobs and post-sale reorder checks generate alerts and, where conditions are met, draft purchase orders.
6. Managers and other permitted users review current status, reports, alerts, sales history, stock movements, and audit records.

## 7. Technology and Tools Used

| Area | Technologies |
|---|---|
| Front end | React 18, Vite, React Router, Redux Toolkit, Axios |
| User interface and charts | Tailwind CSS, Recharts, Lucide React |
| Back end | Node.js, Express |
| Database and data access | MySQL, Sequelize, mysql2 |
| Authentication and validation | JSON Web Tokens (JWT), bcryptjs, Joi |
| Real-time updates and automation | Socket.IO, node-cron |
| Documents, exports, and API documentation | pdf-parse, PDFKit, ExcelJS, Swagger UI |
| Logging and HTTP middleware | Winston, Morgan, Helmet, CORS |
| Testing | Jest, Supertest |

The browser application communicates with the Express API under `/api`. Sequelize handles MySQL persistence. Socket.IO is used for live stock and alert updates, and scheduled background jobs run in the server process.

## 8. Project Structure

```text
client/
  src/
    components/       Shared layout and UI components
    pages/            Dashboard, inventory, sales, purchasing, reports, and account pages
    services/         API and Socket.IO clients
    store/            Redux store and authentication state
server/
  src/
    config/           Database and Swagger configuration
    controllers/      API request handling
    jobs/             Scheduled background jobs
    middleware/       Authentication, permissions, validation, and error handling
    models/           Sequelize models and relationships
    routes/           API route definitions
    services/         Sales, expiry, reorder, matching, and authentication logic
    tests/            Automated backend tests
```

## 9. Setup and Run

### Prerequisites

- Node.js and npm
- A running MySQL server and an empty database created for SDMAS

### Configure the backend

1. Create the MySQL database and note its host, port, database name, username, and password.
2. Create `server/.env` with the required database values and a strong, unique authentication secret. Do not commit this file.

```dotenv
PORT=5000
CLIENT_URL=http://localhost:5173
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=sdmas
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
JWT_SECRET=replace_with_a_long_random_secret
JWT_REFRESH_SECRET=replace_with_another_long_random_secret
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=replace_with_a_strong_password
```

`DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` are required. Set real, private values for the database credentials and both JWT secrets. The super-admin password must contain at least eight characters. Additional optional settings include `MATCH_TOLERANCE_PERCENT` (default `2`), `EXPIRY_WARNING_DAYS_1` (default `30`), and `EXPIRY_WARNING_DAYS_2` (default `15`). SMTP settings can be added to enable email delivery.

### Install and start

From the repository root, install dependencies and provision an initial super-admin account:

```bash
cd server
npm install
npm run db:admin
npm run dev
```

In a second terminal, start the front end:

```bash
cd client
npm install
npm run dev
```

Open the Vite development URL shown in the client terminal (normally `http://localhost:5173`). The Vite development server proxies API and upload requests to the backend on port `5000`. The backend API documentation is available at `http://localhost:5000/api/docs`.

The backend synchronizes Sequelize models when it starts. The optional `npm run db:seed` command creates demo data and refuses to seed when its checked tables already contain records.

## 10. Testing

Run the backend test suite from the `server` directory:

```bash
npm test
```

The existing tests cover behaviors including FEFO stock allocation, expiry automation, low-stock reorder automation, and procurement matching.

## 11. Conclusion

SDMAS addresses common retail inventory and procurement challenges by connecting batch-level stock tracking, expiry-aware sales, purchasing records, automated checks, and operational reporting in one web application. Its use of FEFO allocation, low-stock and expiry alerts, procurement matching, role-based access, and traceable records is intended to help mart staff improve stock visibility and reduce avoidable errors and waste.
