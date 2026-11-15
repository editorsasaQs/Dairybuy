# Dairybuy Phase 4 — Backend API Reference

## 1. Overview

All API endpoints are implemented in the Next.js App Router under `/src/app/api/`.

- **Base URL**: `/api`
- **Content-Type**: `application/json`
- **Timezone**: `Asia/Kolkata`
- **Monetary Convention**: Raw database values returned in **paise**, accompanied by human-readable formatted INR strings (e.g. `finalPricePaise: 17900`, `formattedFinalPrice: "₹179"`).

---

## 2. API Endpoints

### 1. `GET /api/catalogue`
Returns the 8 catalogue categories and the 16 confirmed non-milk product variants.

**Query Parameters:**
- `category` *(optional)*: Filter by category slug (e.g. `ghee`, `butter`, `cheese`, `doi`, `sweets`). Defaults to `all`.

**Sample Request:**
```http
GET /api/catalogue?category=ghee HTTP/1.1
Host: localhost:3000
```

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "categories": [
      { "id": "ghee", "name": "Ghee", "slug": "ghee", "description": "Pure cow and dairy ghee", "sortOrder": 2 }
    ],
    "products": [
      {
        "id": "ghee-red-cow",
        "name": "Red Cow Ghee",
        "brand": "Red Cow",
        "categoryId": "ghee",
        "description": "Premium pure dairy ghee crafted with traditional aroma.",
        "image": "/images/products/ghee.jpg",
        "variants": [
          {
            "id": "ghee-red-cow-200ml",
            "packSize": "200 ml",
            "purchasePricePaise": 17000,
            "sheetDeliveryComponentPaise": 900,
            "finalPricePaise": 17900,
            "formattedPurchasePrice": "₹170",
            "formattedDeliveryComponent": "₹9",
            "formattedFinalPrice": "₹179",
            "isActive": true
          },
          {
            "id": "ghee-red-cow-500ml",
            "packSize": "500 ml",
            "purchasePricePaise": 39000,
            "sheetDeliveryComponentPaise": 900,
            "finalPricePaise": 39900,
            "formattedPurchasePrice": "₹390",
            "formattedDeliveryComponent": "₹9",
            "formattedFinalPrice": "₹399",
            "isActive": true
          }
        ]
      }
    ],
    "count": 1
  }
}
```

---

### 2. `GET /api/vendors/milk`
Returns the 3 approved regular milk vendors, their cow/buffalo availability, and current workbook pricing. Canteen Milk Centre is exposed through its dedicated endpoint.

**Sample Request:**
```http
GET /api/vendors/milk HTTP/1.1
Host: localhost:3000
```

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "vendors": [
      {
        "id": "healthy-haryana",
        "name": "Healthy Haryana Milk Centre",
        "isApproved": true,
        "orderingEnabled": true
      },
      {
        "id": "vip-pure",
        "name": "VIP Pure Milk",
        "isApproved": true,
        "orderingEnabled": true
      },
      {
        "id": "ghosh-dairy",
        "name": "Ghosh Dairy",
        "isApproved": true,
        "orderingEnabled": true
      }
    ],
    "count": 3
  }
}
```

---

### 3. `GET /api/canteen`
Returns the dedicated single-vendor contract, packaging rules, and pricing structure for Canteen Milk.

**Sample Request:**
```http
GET /api/canteen HTTP/1.1
Host: localhost:3000
```

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "vendor": {
      "id": "canteen-milk-centre",
      "name": "Canteen Milk Centre",
      "isCanteenVendor": true,
      "orderingEnabled": true
    },
    "options": [
      {
        "size": "500 ml",
        "milkPricePaise": 2400,
        "deliveryFeePaise": 400,
        "totalPerDeliveryPaise": 2800,
        "plan7DayPaise": 19600,
        "plan30DayPaise": 84000,
        "formattedMilkPrice": "₹24",
        "formattedDeliveryFee": "₹4",
        "formattedTotalPerDelivery": "₹28",
        "formatted7DayPlan": "₹196",
        "formatted30DayPlan": "₹840"
      },
      {
        "size": "1 L",
        "milkPricePaise": 4500,
        "deliveryFeePaise": 400,
        "totalPerDeliveryPaise": 4900,
        "plan7DayPaise": 34300,
        "plan30DayPaise": 147000,
        "formattedMilkPrice": "₹45",
        "formattedDeliveryFee": "₹4",
        "formattedTotalPerDelivery": "₹49",
        "formatted7DayPlan": "₹343",
        "formatted30DayPlan": "₹1,470"
      }
    ],
    "rules": {
      "separateVendor": true,
      "deliveryFeeIncludedInPerDeliveryTotal": true,
      "doNotAddDeliveryFeeTwice": true
    }
  }
}
```

---

### 4. `POST /api/cart/validate`
Validates shopping bag line items and recalculates authoritative pricing server-side in integer paise.

**Sample Request:**
```http
POST /api/cart/validate HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "items": [
    {
      "productId": "ghee-red-cow-200ml",
      "kind": "catalogue",
      "quantity": 2
    },
    {
      "productId": "milk-healthy-haryana-cow",
      "kind": "milk",
      "vendorId": "healthy-haryana",
      "milkType": "cow",
      "packSize": "1L",
      "quantity": 1
    }
  ]
}
```

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": [],
    "subtotalPaise": 43300,
    "deliveryFeePaise": 400,
    "totalPaise": 43700,
    "formattedSubtotal": "₹433",
    "formattedDeliveryFee": "₹4",
    "formattedTotal": "₹437",
    "items": [
      {
        "productId": "ghee-red-cow-200ml",
        "name": "Red Cow Ghee (200 ml)",
        "kind": "catalogue",
        "quantity": 2,
        "unitPricePaise": 17900,
        "lineTotalPaise": 35800,
        "formattedUnitPrice": "₹179",
        "formattedLineTotal": "₹358"
      },
      {
        "productId": "milk-healthy-haryana-cow",
        "name": "Healthy Haryana Milk Centre - Cow Milk (1L)",
        "kind": "milk",
        "quantity": 1,
        "unitPricePaise": 7500,
        "lineTotalPaise": 7500,
        "formattedUnitPrice": "₹75",
        "formattedLineTotal": "₹75"
      }
    ]
  }
}
```

**Sample Error Response (`400 Bad Request`):**
```json
{
  "success": false,
  "data": {
    "isValid": false,
    "errors": [
      "Unknown or removed milk vendor IDs are rejected by server-side validation."
    ],
    "subtotalPaise": 0,
    "deliveryFeePaise": 0,
    "totalPaise": 0,
    "items": []
  }
}
```

---

### 5. `GET /api/service-areas/check`
Verifies whether a given Indian 6-digit PIN code is within Dairybuy's active service territory.

**Query Parameters:**
- `pincode` *(required)*: 6-digit postal code.

**Sample Request:**
```http
GET /api/service-areas/check?pincode=700046 HTTP/1.1
Host: localhost:3000
```

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "pincode": "700046",
    "isServiceable": true,
    "serviceArea": "Topsia",
    "city": "Kolkata",
    "message": "Service is available in Topsia, Kolkata (700046)."
  }
}
```

---

### 6. `GET /api/health`
Monitors backend health, application mode, and active database connection state.

**Sample Request:**
```http
GET /api/health HTTP/1.1
Host: localhost:3000
```

**Sample Response (`200 OK`):**
```json
{
  "status": "healthy",
  "app": "Dairybuy",
  "version": "Phase 4 - Complete Backend Foundation",
  "timezone": "Asia/Kolkata",
  "currency": "INR (Paise)",
  "businessModel": "Centrally managed dairy delivery service",
  "serviceArea": "Topsia, Kolkata",
  "timestamp": "2026-10-31T20:55:00.000Z"
}
```


## Current backend status

The customer catalogue, milk-vendor catalogue, serviceability and cart-validation route handlers now read authoritative rows from Supabase through request-scoped server clients. Cart prices are recalculated from active database products, variants, vendor mappings and current vendor-price rows; browser-submitted prices are ignored. Authenticated cart persistence is implemented through the owner-scoped `sync_active_cart(jsonb)` RPC. Runtime E2E verification remains a release gate. Address/slot/checkout validation, order creation, payment verification, COD/refunds and subscription lifecycle are not activated yet. The health endpoint explicitly reports this state.
