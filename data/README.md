# Confirmed product catalogue data

`confirmed-product-catalogue.csv` is the normalized form of the owner-uploaded `Milk vendor and pricing - updated.csv`.

- 16 non-milk records.
- Categories: Ghee (4), Butter (5), Cheese (4), Doi (2), Sweets (1).
- Monetary fields are INR in this CSV; application/database code converts them to integer paise.
- `final_selling_price_inr` matches `final_price_in_sheet_inr` for every row.
- `purchase_price_inr + sheet_delivery_component_inr = final_selling_price_inr` for every row.

The original unmodified upload is preserved in `project-documents/`.
