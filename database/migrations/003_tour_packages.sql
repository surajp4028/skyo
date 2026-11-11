-- Tour packages and split-payment bookings. Apply with npm run db:migrate-packages.
CREATE TABLE IF NOT EXISTS tour_packages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(180) NOT NULL,
  short_description VARCHAR(320) NOT NULL,
  detailed_description MEDIUMTEXT NOT NULL,
  duration_days SMALLINT UNSIGNED NOT NULL,
  duration_nights SMALLINT UNSIGNED NOT NULL,
  destinations JSON NOT NULL,
  itinerary JSON NOT NULL,
  accommodations JSON NOT NULL,
  original_price INT UNSIGNED NOT NULL,
  discounted_price INT UNSIGNED NOT NULL,
  pricing_type ENUM('per_person','per_couple') NOT NULL DEFAULT 'per_person',
  upfront_token_amount INT UNSIGNED NOT NULL DEFAULT 0,
  cover_photo VARCHAR(1000) NOT NULL,
  images JSON NOT NULL,
  video_link VARCHAR(1000) NULL,
  inclusions JSON NOT NULL,
  exclusions JSON NOT NULL,
  coupons JSON NOT NULL,
  cancellation_policy MEDIUMTEXT NOT NULL,
  price_notes VARCHAR(1000) NULL,
  support_contact JSON NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tour_packages_slug (slug),
  KEY idx_tour_packages_status (status, featured, updated_at),
  CONSTRAINT fk_tour_packages_admin FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tour_package_bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  booking_ref VARCHAR(20) NOT NULL,
  core_booking_ref VARCHAR(20) NOT NULL,
  package_id BIGINT UNSIGNED NOT NULL,
  package_title VARCHAR(180) NOT NULL,
  package_slug VARCHAR(160) NOT NULL,
  user_uid CHAR(12) NOT NULL,
  user_details_enc MEDIUMTEXT NOT NULL,
  travel_date DATE NOT NULL,
  total_guests SMALLINT UNSIGNED NOT NULL,
  pricing_type ENUM('per_person','per_couple') NOT NULL,
  package_price_paise BIGINT UNSIGNED NOT NULL,
  discount_paise BIGINT UNSIGNED NOT NULL DEFAULT 0,
  coupon_code VARCHAR(40) NULL,
  total_amount_paise BIGINT UNSIGNED NOT NULL,
  upfront_amount_paise BIGINT UNSIGNED NOT NULL,
  amount_paid_paise BIGINT UNSIGNED NOT NULL DEFAULT 0,
  payment_status ENUM('pending','partially_paid','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  booking_status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tour_package_booking_ref (booking_ref),
  UNIQUE KEY uq_tour_package_core_booking_ref (core_booking_ref),
  KEY idx_tour_package_booking_user (user_uid, created_at),
  KEY idx_tour_package_booking_package (package_id, created_at),
  KEY idx_tour_package_booking_status (payment_status, booking_status, created_at),
  CONSTRAINT fk_tour_package_booking_package FOREIGN KEY (package_id) REFERENCES tour_packages(id),
  CONSTRAINT fk_tour_package_core_booking FOREIGN KEY (core_booking_ref) REFERENCES bookings(booking_ref) ON DELETE CASCADE,
  CONSTRAINT fk_tour_package_booking_user FOREIGN KEY (user_uid) REFERENCES users(uid) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tour_package_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  booking_ref VARCHAR(20) NOT NULL,
  razorpay_order_id VARCHAR(64) NOT NULL,
  razorpay_payment_id VARCHAR(64) NULL,
  amount_paise BIGINT UNSIGNED NOT NULL,
  payment_type ENUM('upfront','balance','full') NOT NULL,
  status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  UNIQUE KEY uq_tour_package_order (razorpay_order_id),
  KEY idx_tour_package_payment_booking (booking_ref, status),
  CONSTRAINT fk_tour_package_payment_booking FOREIGN KEY (booking_ref) REFERENCES tour_package_bookings(booking_ref) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial customer-requested Kedarnath route. INSERT IGNORE preserves admin edits on reruns.
INSERT IGNORE INTO tour_packages
(slug,title,short_description,detailed_description,duration_days,duration_nights,destinations,itinerary,accommodations,original_price,discounted_price,pricing_type,upfront_token_amount,cover_photo,images,video_link,inclusions,exclusions,coupons,cancellation_policy,price_notes,support_contact,status,featured)
VALUES
('kedarnath-char-dham-4d','Kedarnath Road Journey','Haridwar se Himalaya tak — Mini Traveller road trip with a Kedarnath trek.','A 4-day mountain journey from Haridwar via Rudraprayag and Guptkashi to Kedarnath. The Guptkashi–Gaurikund road leg is by Mini Traveller; the final approach to Kedarnath is on foot from Gaurikund.\n\nThis test listing is priced at ₹10,000 per person. Accommodation, meals, registration, trek support and current route availability must be confirmed with the operator before payment; they are not included unless separately listed in writing. Mountain access and trek schedules depend on weather and official local advisories.',4,3,'["Haridwar","Rudraprayag","Guptkashi","Kedarnath"]',
'[{"dayNumber":1,"title":"Haridwar to Guptkashi via Rudraprayag","description":"Meet in Haridwar and travel by Mini Traveller through the Garhwal hills. Pause at Rudraprayag before continuing to Guptkashi.","activityDetails":["Haridwar pickup point and departure time confirmed after booking","Scenic drive via Rudraprayag","Overnight halt in Guptkashi — stay not included in the listed price"]},{"dayNumber":2,"title":"Guptkashi to Kedarnath","description":"Drive to Gaurikund, then begin the uphill trek to Kedarnath. The Gaurikund–Kedarnath leg is not accessible by Mini Traveller.","activityDetails":["Mini Traveller transfer to Gaurikund","Approx. 16 km trek each way; pace and access depend on official conditions","Overnight halt near Kedarnath — accommodation must be arranged separately"]},{"dayNumber":3,"title":"Kedarnath darshan and return","description":"Darshan and descent to Gaurikund, followed by road transfer towards Rudraprayag, subject to weather, trek pace and local operating hours.","activityDetails":["Temple entry / registration requirements to be confirmed","Trek down to Gaurikund","Road transfer and overnight halt near Rudraprayag — stay not included"]},{"dayNumber":4,"title":"Rudraprayag to Haridwar","description":"Continue by Mini Traveller from Rudraprayag to Haridwar. Arrival time depends on road and weather conditions.","activityDetails":["Mountain road transfer","Haridwar drop-off point confirmed after booking"]}]',
'[]',10000,10000,'per_person',0,'https://images.unsplash.com/photo-1772639340183-150d399c2085?auto=format&fit=crop&q=85&w=1600','["https://images.unsplash.com/photo-1612438214708-f428a707dd4e?auto=format&fit=crop&q=85&w=1200","https://images.unsplash.com/photo-1759262988017-199c93bacb6d?auto=format&fit=crop&q=85&w=1200","https://images.unsplash.com/photo-1698574996391-73f103113f60?auto=format&fit=crop&q=85&w=1200","https://images.unsplash.com/photo-1617860931879-19d32ec9912d?auto=format&fit=crop&q=85&w=1200"]',NULL,'["Mini Traveller road transfers on the listed road route"]','["Accommodation and meals unless confirmed in writing","Gaurikund–Kedarnath trek transport (the approach is on foot)","Registration, pony/palki/porter, personal expenses and travel insurance"]','[]','Before booking, confirm the operator terms and current official route access. Any cancellation or date-change deductions must be confirmed in writing before payment.','₹10,000 per person · Mini Traveller road transfers. Stays, meals, registration and trek support are not included unless confirmed separately. Weather and official access advisories may change the itinerary.',JSON_OBJECT('name','SKYO Package Desk','email','support@skyo.in','phone','+91 90000 00000'),'published',1);

-- Tungnath is intentionally a draft until its selling price, stays and inclusions are confirmed.
INSERT IGNORE INTO tour_packages
(slug,title,short_description,detailed_description,duration_days,duration_nights,destinations,itinerary,accommodations,original_price,discounted_price,pricing_type,upfront_token_amount,cover_photo,images,video_link,inclusions,exclusions,coupons,cancellation_policy,price_notes,support_contact,status,featured)
VALUES
('tungnath-chandrashila-3d','Tungnath & Chandrashila Escape','A slow mountain escape through Chopta to the world’s highest Shiva temple.','A draft 3-day, 2-night mountain itinerary from Rishikesh through Devprayag and Rudraprayag to Chopta, with a trek to Tungnath and an optional Chandrashila sunrise walk.\n\nThe price, accommodation, transport operator, trek support and seasonal access are placeholders and must be confirmed before publishing this package.',3,2,'["Rishikesh","Devprayag","Rudraprayag","Chopta","Tungnath","Chandrashila"]',
'[{"dayNumber":1,"title":"Rishikesh to Chopta","description":"Follow the Alaknanda valley through Devprayag and Rudraprayag towards Chopta.","activityDetails":["Pickup time and vehicle to be confirmed","Scenic mountain road stops","Overnight in Chopta — stay details to be confirmed"]},{"dayNumber":2,"title":"Trek to Tungnath","description":"Walk from Chopta to the Tungnath temple. Continue to Chandrashila only if weather, fitness and local access permit.","activityDetails":["Trek pacing and guide support to be confirmed","Optional Chandrashila summit walk","Overnight in Chopta — stay details to be confirmed"]},{"dayNumber":3,"title":"Return to Rishikesh","description":"Descend to Chopta and return by road to Rishikesh, with stops as time and road conditions allow.","activityDetails":["Road transfer details to be confirmed","Estimated arrival depends on mountain traffic and weather"]}]',
'[]',10000,10000,'per_person',0,'https://images.unsplash.com/photo-1692759873514-6514e8b7696d?auto=format&fit=crop&q=85&w=1600','["https://images.unsplash.com/photo-1698723985345-f1456340f0a0?auto=format&fit=crop&q=85&w=1200","https://images.unsplash.com/photo-1692759873463-2836aa5bf798?auto=format&fit=crop&q=85&w=1200","https://images.unsplash.com/photo-1699214101660-df4e21fbabcd?auto=format&fit=crop&q=85&w=1200","https://images.unsplash.com/photo-1705383851917-18bd74bb938a?auto=format&fit=crop&q=85&w=1200"]',NULL,'[]','["All services until the operator confirms the inclusions in writing"]','[]','Cancellation terms to be confirmed before publishing.','DRAFT PRICE PLACEHOLDER ₹10,000/person — not bookable until transport, stays, inclusions and cancellation terms are confirmed.',JSON_OBJECT('name','SKYO Package Desk','email','support@skyo.in','phone','+91 90000 00000'),'draft',0);
