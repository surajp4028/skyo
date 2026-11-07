# SKYO · Train API — curl reference

Generated alongside `SKYO-Train-API.postman_collection.json`.

```bash
export SKYO=http://localhost:3000
export RC=https://ir.railcore.tech/v1
# never commit the key; load it from your shell:
export RAILCORE_KEY="$(grep '^RK_LIVE' .env.local | cut -d= -f2- | tr -d " '\"")"
```

> Free plan: 2,500 credits/month · 20 req/min · 300 req/day. Costs are noted per call. Login-required SKYO calls need the session cookie (`-b cookies.txt`).

## SKYO backend (/api/train)

## 0 · Auth (gets the session cookie)

### Send login OTP
```bash
curl -sS -X POST -b cookies.txt -c cookies.txt -H 'X-Requested-With: skyo' -H 'Content-Type: application/json' "$SKYO/api/auth/otp/send" -d '{"identifier": "9876543210"}'
```

### Verify OTP (logs in)
```bash
curl -sS -X POST -b cookies.txt -c cookies.txt -H 'X-Requested-With: skyo' -H 'Content-Type: application/json' "$SKYO/api/auth/otp/verify" -d '{"challengeId": "<from send response>", "code": "123456"}'
```

### Who am I
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/auth/me"
```

## 1 · Stations

### Station autocomplete (local first, 0–1 credit)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/stations/search?q=pune"
```

### Station details (1 credit)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/stations/NDLS"
```

### Live station board (4 credits · login)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/stations/NDLS/live?window_hours=4"
```

## 2 · Trains

### Search trains by name/number (1 credit)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/trains/search?q=rajdhani"
```

### Train details (1 credit)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/trains/12952"
```

### Schedule (2 credits)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/trains/12952/schedule?view=schedule"
```

### Live running status (5 credits · login)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/trains/12952/live?date=2026-11-07"
```

### Coach position (2 credits)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/trains/12952/coach-position"
```

## 3 · Journeys

### Trains between stations (5 credits)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/between?from=NDLS&to=MMCT&date=2026-11-20&quota=GN"
```

## 4 · Availability

### Seat availability (5 credits · login)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/availability?train=12952&from=NDLS&to=MMCT&date=2026-11-20&class=3A&quota=GN"
```

### 7-day availability calendar (4 credits · login)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/availability/calendar?train=12952&from=NDLS&to=MMCT&class=3A&quota=GN&date=2026-11-20&days=7"
```

### Classes offered (3 credits)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/availability/classes?train=12952&from=NDLS&to=MMCT&date=2026-11-20"
```

## 5 · Fares

### Fare estimate (3 credits)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/fares?train=12952&from=NDLS&to=MMCT&class=3A&quota=GN"
```

### Fares across trains on a route (3 credits)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/fares/search?from=NDLS&to=MMCT&date=2026-11-20&quota=GN"
```

### Unreserved / season fare (3 credits)
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/fares/unreserved?from=NDLS&to=MMCT&class=II&train_type=O&ticket_type=J&adult=1&child=0"
```

## 6 · Charts (RailCore Scale plan only)

### Chart status
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/charts/status?train=12952&date=2026-11-07&station=NDLS"
```

### Vacant berths
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/charts/vacant-berths?train=12952&from=NDLS&to=MMCT&date=2026-11-07"
```

### Vacant berths + hopping
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/train/charts/hopping?train=12952&from=NDLS&to=MMCT&date=2026-11-07"
```

## 7 · Admin

### Agent login
```bash
curl -sS -X POST -b cookies.txt -c cookies.txt -H 'X-Requested-With: skyo' -H 'Content-Type: application/json' "$SKYO/api/admin/auth/login" -d '{"email": "admin@gmail.com", "password": "<password>"}'
```

### RailCore credit usage
```bash
curl -sS -X GET -b cookies.txt -c cookies.txt  "$SKYO/api/admin/train-usage"
```

## RailCore direct (v1) — debugging

## Stations

### Search stations (1 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/stations/search?q=pune&limit=10"
```

### Get station (1 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/stations/NDLS"
```

### Live station board (4 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/stations/NDLS/live?window_hours=4"
```

## Trains

### Search trains (1 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/trains/search?q=rajdhani&limit=10"
```

### Get train (1 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/trains/12952"
```

### Schedule (2 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/trains/12952/schedule?include_intermediate=false"
```

### Booking stops (2 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/trains/12952/stops"
```

### Full route (2 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/trains/12952/route"
```

### Coach position (2 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/trains/12952/coach-position"
```

### Live train status (5 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/trains/12952/live?date=2026-11-07&max_age=10"
```

## Journeys

### Trains between stations (5 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/routes/trains?from=NDLS&to=MMCT&date=2026-11-20&quota=GN"
```

### Journey search (5 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/journeys/search?from=NDLS&to=MMCT&date=2026-11-20"
```

### Compare journeys (5 cr)
```bash
curl -sS -X POST -H "X-RailCore-Key: $RAILCORE_KEY" -H 'Content-Type: application/json' "$RC/journeys/compare" -d '{"journeys": [{"from": "NDLS", "to": "MMCT", "date": "2026-11-20", "quota": "GN"}]}'
```

## Availability

### Seat availability (5 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/availability/seats?train_number=12952&from=NDLS&to=MMCT&date=2026-11-20&class=3A&quota=GN"
```

### Seat availability batch (max(5, 2×class combos) cr)
```bash
curl -sS -X POST -H "X-RailCore-Key: $RAILCORE_KEY" -H 'Content-Type: application/json' "$RC/availability/seats/batch" -d '{"items": [{"train_number": "12952", "from": "NDLS", "to": "MMCT", "date": "2026-11-20", "classes": ["3A"], "quota": "GN"}]}'
```

### Availability calendar (4 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/availability/calendar?train_number=12952&from=NDLS&to=MMCT&class=3A&quota=GN&date=2026-11-20&days=7"
```

### Available classes (3 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/availability/classes?train_number=12952&from=NDLS&to=MMCT&date=2026-11-20"
```

## Fares

### Fare estimate (3 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/fares/estimate?train_number=12952&from=NDLS&to=MMCT&class=3A&quota=GN"
```

### Fares on route (3 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/fares/search?from=NDLS&to=MMCT&date=2026-11-20&quota=GN"
```

### Unreserved fare (3 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/fares/unreserved?from=NDLS&to=MMCT&class=II&train_type=O&ticket_type=J&adult=1&child=0"
```

## Charts & jobs (Scale/Enterprise)

### Chart status (4 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/charts/status?train_number=12952&date=2026-11-07&station=NDLS"
```

### Vacant berths (8 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/charts/vacant-berths?train_number=12952&from=NDLS&to=MMCT&date=2026-11-07"
```

### Vacant berths hopping (10 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/charts/vacant-berths/hopping?train_number=12952&from=NDLS&to=MMCT&date=2026-11-07&max_hops=6"
```

### Route vacancy scan (25 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/charts/vacant-berths/route-scan?from=NDLS&to=MMCT&date=2026-11-07&max_trains=10"
```

### Submit route-scan job (25 cr)
```bash
curl -sS -X POST -H "X-RailCore-Key: $RAILCORE_KEY" -H 'Content-Type: application/json' "$RC/jobs/route-scan" -d '{"from": "NDLS", "to": "MMCT", "date": "2026-11-07", "max_trains": 10}'
```

### Submit hopping job (10 cr)
```bash
curl -sS -X POST -H "X-RailCore-Key: $RAILCORE_KEY" -H 'Content-Type: application/json' "$RC/jobs/hopping" -d '{"train_number": "12952", "from": "NDLS", "to": "MMCT", "date": "2026-11-07"}'
```

### Get job (0 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/jobs/<job_id>"
```

### List jobs (0 cr)
```bash
curl -sS -X GET -H "X-RailCore-Key: $RAILCORE_KEY" "$RC/jobs?limit=20"
```
