# DOCUMENTATION — Food Ordering System (Microservices)

## 1. Title

**Food Ordering System** — a distributed, containerized microservices application with a
single API Gateway handling JWT authentication, role-based access control (RBAC), rate
limiting, and round-robin load balancing.

## 2. Architecture

All client requests enter through **api-gateway (port 3000)**. The gateway verifies the JWT,
checks the role, applies rate limits, then proxies to the correct service using `http-proxy`,
forwarding the decoded identity as `x-user-id` and `x-user-role`. Downstream services trust
those headers and hold no auth logic.

```
                 ┌───────────────────────────────────────────┐
   Client  ──▶   │  api-gateway :3000                          │
                 │  JWT verify · RBAC · rate limit · round-robin │
                 └───┬───────────┬───────────────┬────────────┘
                     │           │               │
        ┌────────────▼──┐  ┌─────▼──────┐  ┌─────▼───────┐  ┌──────────────┐
        │ auth-service  │  │ menu-svc-1 │  │ order-service│  │ payment-svc  │
        │   :3001       │  │   :3002    │  │   :3003      │  │   :3004      │
        └───────────────┘  ├────────────┤  └──────────────┘  └──────────────┘
                           │ menu-svc-2 │  (round-robin between menu-svc-1/2)
                           │   :3002    │
                           └────────────┘
```

### Service → API list

**auth-service** (collection `users`)
- `POST /reg` — register (`POST /auth/reg` at the gateway)
- `POST /login` — login, returns JWT (`POST /auth/login` at the gateway)

**menu-service** (collection `menu`)
- `POST /menu` — admin add item
- `PUT /menu/:id` — admin update item
- `DELETE /menu/:id` — admin delete item
- `GET /menu` — customer browse items
- `POST /cart` — customer add to cart

**order-service** (collection `orders`)
- `POST /order` — customer create order
- `GET /order` — admin sees all orders, customer sees own (by `x-user-role`)
- `PUT /order/:id/accept` — admin accept order
- `PUT /order/:id/status` — admin update status

**payment-service** (collection `payments`)
- `POST /payment` — customer make payment (`paymentMethod`: cash/card)
- `GET /payment/status` — customer view own payment status
- `GET /payment/history` — customer view own payment history
- `GET /payment` — admin view all payments
- `PUT /payment/:id` — admin change payment status (e.g. confirm cash)

### Gateway access-control table

| Method | Gateway route                 | Role     | Target          |
|--------|-------------------------------|----------|-----------------|
| POST   | /auth/reg                     | public   | auth-service    |
| POST   | /auth/login                   | public   | auth-service    |
| POST   | /admin/menu                   | admin    | menu-service    |
| PUT    | /admin/menu/:id               | admin    | menu-service    |
| DELETE | /admin/menu/:id               | admin    | menu-service    |
| GET    | /admin/order                  | admin    | order-service   |
| PUT    | /admin/order/:id/accept       | admin    | order-service   |
| PUT    | /admin/order/:id/status       | admin    | order-service   |
| GET    | /admin/payment                | admin    | payment-service |
| PUT    | /admin/payment/:id            | admin    | payment-service |
| GET    | /customer/menu                | customer | menu-service    |
| POST   | /customer/cart                | customer | menu-service    |
| POST   | /customer/order               | customer | order-service   |
| GET    | /customer/order               | customer | order-service   |
| POST   | /customer/payment             | customer | payment-service |
| GET    | /customer/payment/status      | customer | payment-service |
| GET    | /customer/payment/history     | customer | payment-service |

## 3. Screenshots to capture (for submission)

### (a) Each collection name + its schema code

Capture the four `models/*.js` files showing the explicit `collection:` option, plus the
collections in MongoDB Atlas (Browse Collections) named exactly:
- `users` — `auth-service/models/User.js`
- `menu` — `menu-service/models/Menu.js`
- `orders` — `order-service/models/Order.js`
- `payments` — `payment-service/models/Payment.js`

Also screenshot one document inside each collection in Atlas to prove writes land in
`foodordering` (not `test`).

### (b) Postman call for every endpoint

Base URL: `http://localhost:3000` (local) or `http://<gateway-public-ip>:3000` (EC2).

| # | Request | Auth header |
|---|---------|-------------|
| 1 | POST /auth/reg (admin)              | none |
| 2 | POST /auth/reg (customer)           | none |
| 3 | POST /auth/login (admin)            | none → copy token |
| 4 | POST /auth/login (customer)         | none → copy token |
| 5 | POST /admin/menu                    | Bearer admin |
| 6 | PUT /admin/menu/:id                 | Bearer admin |
| 7 | DELETE /admin/menu/:id              | Bearer admin |
| 8 | GET /customer/menu                  | Bearer customer |
| 9 | POST /customer/cart                 | Bearer customer |
| 10 | POST /customer/order               | Bearer customer |
| 11 | GET /customer/order                | Bearer customer |
| 12 | GET /admin/order                   | Bearer admin |
| 13 | PUT /admin/order/:id/accept        | Bearer admin |
| 14 | PUT /admin/order/:id/status        | Bearer admin |
| 15 | POST /customer/payment             | Bearer customer |
| 16 | GET /customer/payment/status       | Bearer customer |
| 17 | GET /customer/payment/history      | Bearer customer |
| 18 | GET /admin/payment                 | Bearer admin |
| 19 | PUT /admin/payment/:id             | Bearer admin |

Example bodies:
- `POST /admin/menu` → `{ "name": "Fried Rice", "price": 3.5, "available": true }`
- `POST /customer/cart` → `{ "itemId": "<menuId>", "quantity": 2 }`
- `POST /customer/order` → `{ "items": [ { "name": "Fried Rice", "price": 3.5, "quantity": 2 } ] }`
- `POST /customer/payment` → `{ "orderId": "<orderId>", "amount": 7.0, "paymentMethod": "cash" }`
- `PUT /admin/order/:id/status` → `{ "status": "completed" }`
- `PUT /admin/payment/:id` → `{ "status": "paid" }`

### (c) Load-balancing code in the gateway

Screenshot `api-gateway/proxy/loadBalancer.js` (the round-robin `pickMenuTarget`) and the
`resolveTarget` function in `api-gateway/server.js`. Then hit `GET /customer/menu` several
times and screenshot the gateway logs alternating:

```
[GATEWAY][LB] /customer /menu/menu -> http://menu-service-1:3002
[GATEWAY][LB] /customer /menu/menu -> http://menu-service-2:3002
[GATEWAY][LB] /customer /menu/menu -> http://menu-service-1:3002
```

and the per-replica logs from `menu-service-1` / `menu-service-2` showing the requests
landed on different instances.

## 4. Testing — required failure tests

| Test | Request | Expected status |
|------|---------|-----------------|
| Wrong username or password | `POST /auth/login` with a bad password | **401** |
| Invalid / expired token | any `/admin/*` or `/customer/*` route with `Authorization: Bearer badtoken` | **401** |
| Wrong-role token | `POST /admin/menu` using a **customer** token | **403** |

Extra (optional) demonstrations:
- No `Authorization` header on a protected route → **401**.
- Exceed the login limiter (6+ logins in a minute) → **429**.
- Exceed the global limiter (100+ requests in 15 min from one IP) → **429**.

### Why each status

- **401** comes from the gateway's `authenticate` middleware (missing/invalid/expired token)
  and from `auth-service` login (bad credentials).
- **403** comes from the gateway's `requireRole` middleware when the token's role does not
  match the route group.
- **429** comes from `express-rate-limit` in the gateway.

## 5. Rubric mapping

- **Distributed architecture + Docker (10):** 5 independent services, each with its own
  `Dockerfile` (`node:24-alpine`, non-root `node` user), orchestrated by `docker-compose.yml`
  with healthchecks, `restart: unless-stopped`, and env-driven config.
- **JWT + RBAC via API Gateway (10):** auth-service issues the JWT; the gateway verifies it,
  checks the role, and forwards `x-user-id` / `x-user-role`. Services contain no auth code.
- **Database connectivity + CRUD (10):** MongoDB Atlas via Mongoose, DB name `foodordering`
  in the URI, explicit `collection` on every schema, full CRUD across menu/order/payment.
- **Documentation & demonstration (5):** this file (architecture, schemas, Postman list,
  3 failure tests).
- **Load balancer (5):** menu-service runs as 2 replicas; the gateway round-robins between
  them and logs each routing decision.
