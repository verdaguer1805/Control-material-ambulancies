# Stock deployment by lot and zone

## Enabled deployments

`src/warehouse-config.mjs` owns the enabled stock deployments. The shared admin
stock screens resolve the exact selected lot and zone, without falling back to
Olot. Olot, Figueres, Girona and Blanes are enabled in Lot 5 after database
validation. Other lots remain selectors, not active stock deployments.
See `warehouse-expansion-review.md` for migration and integration-test results.

Existing Olot warehouse IDs, all nine unit assignments and production RPC names
are preserved. Unit consumption and SQL functions have not been changed. The
minimum calculation still runs in Supabase with the existing Olot formula:
`(Camprodon * 4 + Campdevànol + Banyoles) * (1 + safety / 100)`, rounded upward.
G205, G215 and G305 remain assigned for consumption but excluded from this formula.

The obsolete local demo initializer and hidden reset were removed from the admin
stock flow. No browser storage is erased; real data is still loaded from Supabase.

## Shared behavior

- Inventory queries, receipts, transfers and exports use the selected config's IDs.
- History filters by the selected zone's warehouse IDs, including when destination
  is "Todos". Transfers are counted by `transfer_in`, not again by `transfer_out`.
- Changing scope closes dialogs, clears drafts/targets and invalidates pending loads.
- Unknown/unconfigured zones cannot initialize or mutate stock.
- Supervisor checks are UI defense only; Supabase RLS/RPC permissions remain authoritative.

## Requirements for future deployments

1. Confirm central/subwarehouses, names, assignments, actual opening inventory,
   minimum rules and supervisor permissions. Never copy an inventory automatically.
2. Create/review the server warehouse rows and assignments. Current assignment
   schema uses `unit` as the primary key; resolve repeated unit codes across lots
   before enabling any lot that would collide.
3. Provision/test initialization and central safety RPCs. Olot-specific SQL must
   not be invoked for another zone. The config exposes RPC names for this purpose.
4. Review lot-scoped access: the existing supervisor server sessions are zone-based.
   Do not activate overlapping zone names in different lots without server changes.
5. Test consumption, receipt, transfer, inventory/minimum edits, history, Excel/PDF
   and authorization in an isolated test environment. Classification in
   `material_settings` is currently shared globally, not independently per zone.
6. Enable config only after those server checks. No other zone is enabled by this change.

## Verification

Run `npm run test:warehouses` and `npm run build`.
Tests use synthetic warehouse configurations and mocked Supabase (no real writes).
They exercise the application handlers, not just the configuration helper.
They do not replace browser/mobile and live permission checks.

Before publishing: review changing scope with a modal open, failed loads, Olot
inventory/minimums, receipt/transfer dialogs and Excel/PDF exports in local preview.
Obtain the owner's explicit publication approval. The live app remains unchanged
until then.
