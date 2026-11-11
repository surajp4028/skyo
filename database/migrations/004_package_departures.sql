-- Fixed departures, trip details and cancellation slabs for tour packages (all admin-managed).
-- Safe to re-run (MariaDB IF NOT EXISTS). Apply with npm run db:migrate-packages.
--   departures          [{id,startDate,startTime,endDate,endTime,seats,price,status,note}]
--   trip_info           {origin,reportingPoint,returnPoint,travelMode,mealPlan}
--   cancellation_rules  [{daysBefore,deductionPct}]  — "daysBefore or more days before departure → deductionPct % deducted"
ALTER TABLE tour_packages
  ADD COLUMN IF NOT EXISTS departures JSON NULL AFTER itinerary,
  ADD COLUMN IF NOT EXISTS trip_info JSON NULL AFTER departures,
  ADD COLUMN IF NOT EXISTS cancellation_rules JSON NULL AFTER cancellation_policy;

ALTER TABLE tour_package_bookings
  ADD COLUMN IF NOT EXISTS departure_id VARCHAR(24) NULL AFTER travel_date,
  ADD COLUMN IF NOT EXISTS return_date DATE NULL AFTER departure_id,
  ADD INDEX IF NOT EXISTS idx_tour_package_booking_departure (package_id, departure_id, booking_status);

-- Starter schedule for the two launch packages (only when the admin hasn't set one yet).
-- Kedarnath temple is closed in winter, so its departures start after the summer opening — verify dates before publishing.
UPDATE tour_packages SET
  departures = '[{"id":"ked-270514","startDate":"2027-05-14","startTime":"06:00","endDate":"2027-05-17","endTime":"19:00","seats":12,"price":null,"status":"open","note":""},{"id":"ked-270528","startDate":"2027-05-28","startTime":"06:00","endDate":"2027-05-31","endTime":"19:00","seats":12,"price":null,"status":"open","note":""},{"id":"ked-270611","startDate":"2027-06-11","startTime":"06:00","endDate":"2027-06-14","endTime":"19:00","seats":12,"price":11500,"status":"open","note":"Peak season"}]',
  trip_info = '{"origin":"Haridwar","reportingPoint":"Haridwar Railway Station, main gate","returnPoint":"Haridwar Railway Station","travelMode":"Mini Traveller + trek","mealPlan":"Not included"}',
  cancellation_rules = '[{"daysBefore":30,"deductionPct":10},{"daysBefore":15,"deductionPct":25},{"daysBefore":7,"deductionPct":50},{"daysBefore":0,"deductionPct":100}]'
WHERE slug = 'kedarnath-char-dham-4d' AND departures IS NULL;

UPDATE tour_packages SET
  departures = '[{"id":"tun-261205","startDate":"2026-12-05","startTime":"06:30","endDate":"2026-12-07","endTime":"18:30","seats":10,"price":null,"status":"open","note":""},{"id":"tun-261219","startDate":"2026-12-19","startTime":"06:30","endDate":"2026-12-21","endTime":"18:30","seats":10,"price":null,"status":"open","note":"Snow likely"},{"id":"tun-270109","startDate":"2027-01-09","startTime":"06:30","endDate":"2027-01-11","endTime":"18:30","seats":10,"price":null,"status":"open","note":"Snow likely"}]',
  trip_info = '{"origin":"Rishikesh","reportingPoint":"Rishikesh bus stand","returnPoint":"Rishikesh bus stand","travelMode":"Tempo Traveller + trek","mealPlan":"Breakfast & dinner"}',
  cancellation_rules = '[{"daysBefore":21,"deductionPct":10},{"daysBefore":10,"deductionPct":30},{"daysBefore":3,"deductionPct":60},{"daysBefore":0,"deductionPct":100}]'
WHERE slug = 'tungnath-chandrashila-3d' AND departures IS NULL;
