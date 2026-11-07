/** Types mirroring the RailCore OpenAPI 3.1 schemas we use (subset, null-safe). */
export type ClassCode = "1A" | "2A" | "3A" | "3E" | "CC" | "EC" | "SL" | "2S" | "GS" | "GEN" | "SLR" | "PC" | "HP" | "GEN_RSVD" | "FC" | "UNKNOWN";
export type Quota = "GN" | "TQ" | "PT" | "LD" | "SS" | "HP" | "DP" | "HO" | "YU" | "FT";
export type RunningDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export type Confidence = "high" | "medium" | "low";
export type SeatStatus = "AVAILABLE" | "RAC" | "WAITLIST" | "REGRET" | "NOT_AVAILABLE" | "TRAIN_CANCELLED" | "TRAIN_DEPARTED" | "UNKNOWN";

export type Meta = {
  api_version: string;
  request_id: string;
  trace_id: string;
  timestamp: string;
  freshness?: { mode?: "live"; retrieved_at?: string; sources?: { confidence?: Confidence; last_reported_at?: string }[] };
};
export type Envelope<T> = { success: true; data: T; meta: Meta };
export type ErrorEnvelope = { success: false; error: { code: string; message: string; category: string; retryable: boolean; details?: unknown[] }; meta: Meta };

export type Station = {
  station_code: string; station_name: string; display_name?: string; city?: string | null; state?: string | null;
  latitude?: number | null; longitude?: number | null; aliases?: string[]; is_major?: boolean; confidence?: number;
};
export type Train = {
  train_number: string; train_name: string; display_name?: string; source_station_code: string; destination_station_code: string;
  train_type?: string; running_days?: RunningDay[];
};
export type ScheduleStop = {
  sequence: number; station_code: string; station_name: string; arrival_time: string | null; departure_time: string | null;
  halt_minutes: number | null; day: number; distance_km: number; platform_number: string | null; is_stop: boolean;
  arrival_delay_minutes?: number | null; departure_delay_minutes?: number | null;
  latitude?: number | null; longitude?: number | null;
};
export type TrainSchedule = {
  train_number: string; train_name: string; source_station_code: string; destination_station_code: string;
  running_days: RunningDay[]; classes: ClassCode[]; total_duration_minutes: number | null; distance_km: number | null; stops: ScheduleStop[];
  rake_type?: string | null; pantry?: boolean | null; catering?: boolean | null;
};
export type CoachSlot = { sequence: number; coach_name: string; class_code: ClassCode; position_from_engine: number };
export type CoachPosition = { train_number: string; coach_position: CoachSlot[] };

export type AvailabilityMini = { class_code: ClassCode; status: SeatStatus; text: string; fare: number | null; confidence: Confidence; last_updated_at: string | null };
export type RouteTrain = {
  train_number: string; train_name: string;
  from_station_code?: string; from_station_name?: string; to_station_code?: string; to_station_name?: string; extended_train_name?: string | null; departure_time: string; arrival_time: string;
  duration_minutes: number; distance_km: number | null; train_type: string; classes: ClassCode[]; running_days: RunningDay[];
  has_pantry: boolean | null; on_time_rating: number | null; availability_summary?: AvailabilityMini[];
};
export type RouteTrains = { from_station_code: string; to_station_code: string; journey_date: string; quota: Quota; trains: RouteTrain[] };

export type ConfirmationProbability = { percentage: number; label: "LOW" | "MEDIUM" | "HIGH"; text: string } | null;
export type AvailabilityDetail = {
  class_code: ClassCode; status: SeatStatus; availability_text: string; available_count: number | null; waitlist_count: number | null;
  rac_count: number | null; wl_pool: string | null; wl_pool_position: number | null; fare: number | null; catering_charge?: number;
  total_fare: number | null; confirmation_probability: ConfirmationProbability; last_updated_at: string | null;
};
export type AvailabilityResponse = {
  train_number: string; from_station_code: string; to_station_code: string; journey_date: string; quota: Quota;
  classes: AvailabilityDetail[]; enquiry_checked_at: string; enquiry_completed_at?: string; inventory_updated_at: string | null;
};
export type AvailabilityCalendarDay = {
  date: string; day_of_week: RunningDay; status: string; availability_text: string; available_count: number | null;
  waitlist_count: number | null; fare: number | null; confirmation_probability: ConfirmationProbability; last_updated_at: string | null;
};
export type AvailabilityCalendar = { train_number: string; from_station_code: string; to_station_code: string; class_code: ClassCode; quota: Quota; days: AvailabilityCalendarDay[] };
export type FareItem = { class_code: ClassCode; fare: number; currency: "INR" };
export type FareEstimate = { train_number: string; from_station_code: string; to_station_code: string; quota: Quota; fares: FareItem[] };

export type LiveTrainStop = {
  sequence: number; station_code: string; station_name: string | null; scheduled_arrival: string | null; scheduled_departure: string | null;
  eta: string | null; etd: string | null; actual_arrival: string | null; actual_departure: string | null;
  delay_arrival_minutes: number | null; delay_departure_minutes: number | null; platform_number: string | null; halt_minutes: number | null;
  day: number | null; distance_km: number | null; is_stopping: boolean; is_diverted: boolean; has_arrived: boolean; has_departed: boolean; travelled: boolean;
};
export type LiveTrainStatus = {
  train_number: string; train_name: string | null; journey_date: string; source_station_code: string | null; destination_station_code: string | null;
  status: "NOT_STARTED" | "RUNNING" | "AT_STATION" | "COMPLETED" | "CANCELLED" | "DIVERTED" | "UNKNOWN";
  status_text: string | null; current_station_code: string | null; current_station_name: string | null; next_station_code: string | null;
  approaching_station_name: string | null; progress_percent: number | null; distance_covered_km: number | null; total_distance_km: number | null;
  delay_minutes: number | null; eta_destination_at: string | null; last_reported_at: string | null; confidence: Confidence;
  cancellation: { fully_cancelled: boolean; from_station_code: string | null; to_station_code: string | null } | null;
  official_notice: { reason: string | null; message: string | null } | null;
  next_stop: LiveTrainStop | null; stations: LiveTrainStop[];
  freshness: { railcore_cache: "bypassed" | "reused"; retrieved_at: string; age_seconds: number | null; state: "fresh" | "aging" | "stale" | "unknown" };
};
export type StationBoardTrain = {
  train_number: string; train_name: string; source_station_name: string | null; destination_station_name: string | null;
  scheduled_arrival: string | null; scheduled_departure: string | null; estimated_arrival: string | null; estimated_departure: string | null;
  platform_number: string | null; arrival_delay_minutes: number | null; departure_delay_minutes: number | null; status: string; stop_type: string;
};
export type StationBoard = { station_code: string; window_hours: 4 | 8; trains: StationBoardTrain[] };
export type UnreservedFare = { from: string; to: string; date: string; routes: { route: string; fare: string }[] };

export type ChartStatusFlags = { chart_one_prepared: boolean; chart_two_prepared: boolean; chart_one_date: string | null; chart_two_date: string | null };
export type ChartCoachSummary = { coach_name: string; class_code: ClassCode; position_from_engine: number; vacant_berths: number };
export type VacantBerth = {
  coach_name: string; class_code: ClassCode; berth_number: number; berth_code: string; cabin_coupe: string | null;
  from_station_code: string; to_station_code: string; split_no: number; covers_requested_segment: boolean;
};
export type VacantBerthsResponse = {
  train_number: string; train_name: string; from_station_code: string; to_station_code: string; train_start_date: string;
  chart_status: ChartStatusFlags; coach_summary: ChartCoachSummary[]; vacant_berths: VacantBerth[];
};
