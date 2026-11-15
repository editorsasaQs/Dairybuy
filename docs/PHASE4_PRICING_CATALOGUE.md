# Dairybuy Phase 4 — Confirmed Pricing & Product Catalogue

## 1. Overview & Business Authority

All milk and non-milk pricing records in Dairybuy Phase 4 are sourced verbatim from **"Milk vendor and pricing - updated.csv" (non-milk catalogue) plus previously owner-confirmed milk vendor pricing** as confirmed by the business owner.

- **Monetary Unit**: Stored and calculated strictly in **integer paise** (`100 paise = ₹1.00`).
- **Subscription Rule**: As confirmed by the owner, workbook milk prices apply to both one-time orders and recurring subscription plans.
- **Non-Milk Ordering Rule**: Non-milk products use the workbook's single-quantity daily sale final price. Unprovided non-milk subscription rates are not invented.
- **Price History Rule**: All historical vendor prices are preserved with effective timestamps (`effective_from`, `effective_to`). Prior prices are never overwritten.

---

## 2. Confirmed Milk Pricing Matrix

### Cow Milk

| Vendor | Pack Size | Per Delivery Price | 7-Day Plan | 30-Day Plan | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Healthy Haryana Milk Centre** | 500 ml | ₹42 (4,200 paise) | ₹294 (29,400 paise) | ₹1,260 (126,000 paise) | Verified · Available |
| **Healthy Haryana Milk Centre** | 1 L | ₹75 (7,500 paise) | ₹525 (52,500 paise) | ₹2,250 (225,000 paise) | Verified · Available |
| **VIP Pure Milk** | 500 ml | ₹49 (4,900 paise) | ₹343 (34,300 paise) | ₹1,470 (147,000 paise) | Verified · Available |
| **VIP Pure Milk** | 1 L | ₹89 (8,900 paise) | ₹623 (62,300 paise) | ₹2,670 (267,000 paise) | Verified · Available |
| **Ghosh Dairy** | 500 ml | ₹59 (5,900 paise) | ₹413 (41,300 paise) | ₹1,770 (177,000 paise) | Verified · Available |
| **Ghosh Dairy** | 1 L | ₹109 (10,900 paise) | ₹763 (76,300 paise) | ₹3,270 (327,000 paise) | Verified · Available |

### Buffalo Milk

| Vendor | Pack Size | Per Delivery Price | 7-Day Plan | 30-Day Plan | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Healthy Haryana Milk Centre** | 500 ml | ₹42 (4,200 paise) | ₹294 (29,400 paise) | ₹1,260 (126,000 paise) | Verified · Available |
| **Healthy Haryana Milk Centre** | 1 L | ₹75 (7,500 paise) | ₹525 (52,500 paise) | ₹2,250 (225,000 paise) | Verified · Available |
| **VIP Pure Milk** | 500 ml | ₹59 (5,900 paise) | ₹413 (41,300 paise) | ₹1,770 (177,000 paise) | Verified · Available |
| **VIP Pure Milk** | 1 L | ₹109 (10,900 paise) | ₹763 (76,300 paise) | ₹3,270 (327,000 paise) | Verified · Available |
| **Ghosh Dairy** | 500 ml | ₹64 (6,400 paise) | ₹448 (44,800 paise) | ₹1,920 (192,000 paise) | Verified · Available |
| **Ghosh Dairy** | 1 L | ₹119 (11,900 paise) | ₹833 (83,300 paise) | ₹3,570 (357,000 paise) | Verified · Available |

*Note on Vendor Equalities*: Per confirmed business notes, Healthy Haryana's Cow and Buffalo milk prices are intentionally equal. VIP Pure Milk and Ghosh Dairy have distinct buffalo pricing.

---

## 3. Confirmed Canteen Milk Pricing

Operated under a separate, single-vendor canteen arrangement via **Canteen Milk Centre**:

| Size | Milk Base Price | Delivery Fee | Per-Delivery Customer Total | 7-Day Plan | 30-Day Plan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **500 ml** | ₹24 (2,400 paise) | ₹4 (400 paise) | **₹28** (2,800 paise) | ₹196 (19,600 paise) | ₹840 (84,000 paise) |
| **1 L** | ₹45 (4,500 paise) | ₹4 (400 paise) | **₹49** (4,900 paise) | ₹343 (34,300 paise) | ₹1,470 (147,000 paise) |

**Mathematical Verification**:
- 500 ml 7-day: $28 \times 7 = ₹196$
- 500 ml 30-day: $28 \times 30 = ₹840$
- 1 L 7-day: $49 \times 7 = ₹343$
- 1 L 30-day: $49 \times 30 = ₹1,470$

The ₹4 (400 paise) delivery fee is already included in the customer per-delivery total for Canteen Milk; the checkout engine never adds the fee twice.

---

## 4. Other Product Categories & Confirmed Pricing (16 Variants)

The non-milk catalogue contains exactly **16 product variants** across 5 categories, matching the workbook records:

$$\text{Final Customer Price} = \text{Purchase Price} + \text{Sheet Delivery Component}$$

### Ghee (4 Variants)
| Brand | Pack Size | Purchase Price | Sheet Delivery Component | Final Selling Price |
| :--- | :--- | :--- | :--- | :--- |
| **Red Cow** | 200 ml | ₹170 (17,000 paise) | ₹9 (900 paise) | **₹179** (17,900 paise) |
| **Red Cow** | 500 ml | ₹390 (39,000 paise) | ₹9 (900 paise) | **₹399** (39,900 paise) |
| **Ashirvaad** | 200 ml | ₹182 (18,200 paise) | ₹9 (900 paise) | **₹191** (19,100 paise) |
| **Ashirvaad** | 500 ml | ₹437 (43,700 paise) | ₹9 (900 paise) | **₹446** (44,600 paise) |

### Butter (5 Variants)
| Brand | Pack Size | Purchase Price | Sheet Delivery Component | Final Selling Price |
| :--- | :--- | :--- | :--- | :--- |
| **Amul** | 100 g | ₹66 (6,600 paise) | ₹9 (900 paise) | **₹75** (7,500 paise) |
| **Amul** | 200 g | ₹130 (13,000 paise) | ₹9 (900 paise) | **₹139** (13,900 paise) |
| **Amul** | 500 g | ₹305 (30,500 paise) | ₹9 (900 paise) | **₹314** (31,400 paise) |
| **Delicious** | 100 g | ₹22 (2,200 paise) | ₹11 (1,100 paise) | **₹33** (3,300 paise) |
| **Delicious** | 500 g | ₹117 (11,700 paise) | ₹9 (900 paise) | **₹126** (12,600 paise) |

### Cheese (4 Variants)
| Brand / Item | Pack Size | Purchase Price | Sheet Delivery Component | Final Selling Price |
| :--- | :--- | :--- | :--- | :--- |
| **Amul Cheese Slices** (first list) | 100 g | ₹82 (8,200 paise) | ₹11 (1,100 paise) | **₹93** (9,300 paise) |
| **Amul Cheese Slices** (first list) | 200 g | ₹145 (14,500 paise) | ₹9 (900 paise) | **₹154** (15,400 paise) |
| **Amul Cheese Blocs** (second list) | 200 g | ₹130 (13,000 paise) | ₹11 (1,100 paise) | **₹141** (14,100 paise) |
| **Amul Cheese Blocs** (second list) | 500 g | ₹300 (30,000 paise) | ₹9 (900 paise) | **₹309** (30,900 paise) |

### Doi (2 Variants)
| Item | Pack Size | Purchase Price | Sheet Delivery Component | Final Selling Price |
| :--- | :--- | :--- | :--- | :--- |
| **Misti Doi** | 100 g | ₹35 (3,500 paise) | ₹9 (900 paise) | **₹44** (4,400 paise) |
| **Tok Doi** | 100 g | ₹25 (2,500 paise) | ₹9 (900 paise) | **₹34** (3,400 paise) |

### Sweets (1 Variant)
| Item | Pack Size | Purchase Price | Sheet Delivery Component | Final Selling Price |
| :--- | :--- | :--- | :--- | :--- |
| **Firni** | 1 piece | ₹35 (3,500 paise) | ₹9 (900 paise) | **₹44** (4,400 paise) |

---

## 5. Non-Milk Pricing Architecture & Rules

1. **Sheet Delivery Component vs. Order Delivery Fee**:
   - The sheet delivery component (₹9 or ₹11) is an internal margin/cost allocation that is **already embedded** in the customer final selling price.
   - It is never added on top of the checkout cart.
2. **Order-Level Delivery Fee**:
   - The current development setting is `app_settings.delivery_fee_paise=0`.
   - The customer-facing vendor CSV totals already include the delivery component. Do not add another order-level fee on top of these final prices.
3. **Strict Catalogue Boundary**:
   - No additional unverified brands, non-milk products, unofficial pack sizes, or fabricated vendor links have been created.


## 6. Phase 4.1 CSV reconciliation

The latest uploaded CSV contains 16 non-milk records:
- Ghee: 4
- Butter: 5
- Cheese: 4
- Doi: 2
- Sweets: 1

All 16 rows satisfy `purchase_price_inr + sheet_delivery_component_inr = final_selling_price_inr`, and the CSV's two final-price columns match for every row.

The latest CSV contains no milk vendor prices. The active milk vendor pricing remains sourced from the owner-confirmed vendor price records in `vendor_prices`.

The CSV does not confirm Bread, Eggs, Banana, Fruit Juice or Jam. These items have been removed from the active customer catalogue and fresh seed. A forward migration disables previously seeded records without deleting historical rows.

The CSV lists the ghee brand as **Ashirvaad** and Firni pack as **1 piece**; customer-facing catalogue, seed and docs now use those exact labels.
