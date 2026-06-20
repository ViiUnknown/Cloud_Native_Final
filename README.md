# Food Ordering System — Microservices

Five-service food ordering platform. **All client traffic goes through the API Gateway only.**
JWT verification, role-based access control, rate limiting, and round-robin load balancing
all live in the gateway. Downstream services trust the gateway's `x-user-id` / `x-user-role`
headers and contain no auth logic.

## Services

| Service          | Port | Role                                                        |
|------------------|------|-------------------------------------------------------------|
| api-gateway      | 3000 | Single entry point: JWT, RBAC, rate limit, LB, proxy        |
| auth-service     | 3001 | Register + login, issues JWT (`userId`, `role`)             |
| menu-service     | 3002 | Admin CRUD + customer browse/cart (runs as 2 replicas)      |
| order-service    | 3003 | Customer create/view + admin view/accept/update-status      |
| payment-service  | 3004 | Customer make/view/history + admin view/change-status       |

## Run locally (Docker Compose)

```bash
cp .env.example .env          # fill in MONGO_URI (with /foodordering) and JWT_SECRET
docker compose build
docker compose up
```

Gateway is now at `http://localhost:3000`. The downstream service ports are **not** published —
clients can only reach them through the gateway.

### Quick smoke test

```bash
# register an admin and a customer
curl -X POST http://localhost:3000/auth/reg -H "Content-Type: application/json" \
  -d '{"username":"admin1","password":"pass123","role":"admin"}'
curl -X POST http://localhost:3000/auth/reg -H "Content-Type: application/json" \
  -d '{"username":"cust1","password":"pass123","role":"customer"}'

# login -> copy the token from the response
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"username":"admin1","password":"pass123"}'

# admin adds a menu item (replace <ADMIN_TOKEN>)
curl -X POST http://localhost:3000/admin/menu -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"name":"Fried Rice","price":3.5,"available":true}'

# customer browses (hit it a few times and watch the gateway log alternate
# between menu-service-1 and menu-service-2 -> load balancing proof)
curl http://localhost:3000/customer/menu -H "Authorization: Bearer <CUSTOMER_TOKEN>"
```

## EC2 deployment (3 instances, Docker Hub as the registry)

Build locally, push to Docker Hub, pull on each EC2 box. GitHub is not required.

### 1. Build and push (run locally; replace `youruser`)

```bash
docker build -t youruser/api-gateway     ./api-gateway
docker build -t youruser/auth-service    ./auth-service
docker build -t youruser/menu-service    ./menu-service
docker build -t youruser/order-service   ./order-service
docker build -t youruser/payment-service ./payment-service

docker login
docker push youruser/api-gateway
docker push youruser/auth-service
docker push youruser/menu-service
docker push youruser/order-service
docker push youruser/payment-service
```

### 2. Suggested split across 3 instances

- **Instance 1:** api-gateway + auth-service
- **Instance 2:** menu-service (×2 for load balancing) + order-service
- **Instance 3:** payment-service

Use each instance's **private IP** for service-to-service URLs (or public IP if the
instances are in different VPCs). Pass them to the gateway via `MENU_SERVICE_URLS`,
`ORDER_SERVICE_URL`, `PAYMENT_SERVICE_URL`, and `AUTH_SERVICE_URL`.

### 3. Pull and run on each instance

```bash
docker login

# --- Instance 1 (gateway + auth) ---
docker pull youruser/auth-service
docker pull youruser/api-gateway

docker run -d --name auth-service --restart unless-stopped \
  -p 3001:3001 \
  -e MONGO_URI="mongodb+srv://.../foodordering?retryWrites=true&w=majority" \
  -e JWT_SECRET="your_secret" -e PORT=3001 \
  youruser/auth-service

docker run -d --name api-gateway --restart unless-stopped \
  -p 3000:3000 \
  -e JWT_SECRET="your_secret" -e PORT=3000 \
  -e AUTH_SERVICE_URL="http://<INSTANCE1_PRIVATE_IP>:3001" \
  -e MENU_SERVICE_URLS="http://<INSTANCE2_PRIVATE_IP>:3002,http://<INSTANCE2_PRIVATE_IP>:3012" \
  -e ORDER_SERVICE_URL="http://<INSTANCE2_PRIVATE_IP>:3003" \
  -e PAYMENT_SERVICE_URL="http://<INSTANCE3_PRIVATE_IP>:3004" \
  youruser/api-gateway

# --- Instance 2 (two menu replicas + order) ---
docker pull youruser/menu-service
docker pull youruser/order-service

docker run -d --name menu-service-1 --restart unless-stopped -p 3002:3002 \
  -e MONGO_URI="..." -e PORT=3002 -e INSTANCE_NAME=menu-service-1 youruser/menu-service
docker run -d --name menu-service-2 --restart unless-stopped -p 3012:3002 \
  -e MONGO_URI="..." -e PORT=3002 -e INSTANCE_NAME=menu-service-2 youruser/menu-service
docker run -d --name order-service --restart unless-stopped -p 3003:3003 \
  -e MONGO_URI="..." -e PORT=3003 youruser/order-service

# --- Instance 3 (payment) ---
docker pull youruser/payment-service
docker run -d --name payment-service --restart unless-stopped -p 3004:3004 \
  -e MONGO_URI="..." -e PORT=3004 youruser/payment-service
```

(Note: the second menu replica is published on host port `3012` since both map to
container port `3002`; the gateway's `MENU_SERVICE_URLS` points at `:3002` and `:3012`.)

### 4. Security group ports to open

- **Instance 1:** inbound `3000` (gateway, from anywhere / your Postman) and `3001`
  (auth, from Instance 1's gateway — restrict to the gateway/VPC).
- **Instance 2:** inbound `3002`, `3012`, `3003` (from Instance 1's security group only).
- **Instance 3:** inbound `3004` (from Instance 1's security group only).
- All instances: outbound `443` so they can reach MongoDB Atlas.

Only `3000` needs to be open to the public — everything else should be restricted to
the gateway's security group / VPC.

### 5. Postman base URL

```
http://<gateway-public-ip>:3000/...
e.g.  http://<gateway-public-ip>:3000/auth/login
      http://<gateway-public-ip>:3000/customer/menu
```

### 6. Windows `.pem` permission fix (PowerShell)

Before `ssh -i key.pem`, clear inherited permissions or SSH rejects the key:

```powershell
icacls.exe key.pem /reset
icacls.exe key.pem /grant:r "$($env:USERNAME):(R)"
icacls.exe key.pem /inheritance:r
ssh -i key.pem ec2-user@<INSTANCE_PUBLIC_IP>
```
