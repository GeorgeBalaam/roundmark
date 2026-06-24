-- Whether players' scorecards show a "live leaderboard" link. Some organisers
-- prefer to keep the leaderboard off the scoring screen. Null is treated as on
-- by the client. Run after 0017_event_start_time.sql.
alter table public.events add column if not exists show_leaderboard boolean;
