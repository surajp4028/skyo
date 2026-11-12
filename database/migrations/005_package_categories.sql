-- Admin-chosen categories for each package (["pilgrimage","mountains",…]). Empty/NULL = placed automatically.
-- Safe to re-run. Apply with npm run db:migrate-packages.
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS categories JSON NULL AFTER destinations;
