-- Fresh AI generations per person (browser ID or salted address hash) for the rolling daily limit.
CREATE TABLE IF NOT EXISTS daily_generations (
  subject TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS daily_generations_subject ON daily_generations(subject, created_at);
CREATE INDEX IF NOT EXISTS daily_generations_age ON daily_generations(created_at);
