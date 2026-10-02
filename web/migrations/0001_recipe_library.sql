CREATE TABLE IF NOT EXISTS recipe_budget (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  used_bytes INTEGER NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  limit_bytes INTEGER NOT NULL DEFAULT 200000000 CHECK (limit_bytes > 0)
);
INSERT OR IGNORE INTO recipe_budget (id) VALUES (1);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'pl' CHECK (locale IN ('pl', 'en')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  bytes INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 65536),
  pending_json TEXT,
  ready INTEGER NOT NULL DEFAULT 0 CHECK (ready IN (0, 1)),
  PRIMARY KEY (id, locale)
);
CREATE INDEX IF NOT EXISTS recipes_recent ON recipes(locale, ready, created_at DESC, id);
CREATE TRIGGER IF NOT EXISTS recipes_capacity BEFORE INSERT ON recipes
WHEN (SELECT used_bytes + NEW.bytes > limit_bytes FROM recipe_budget WHERE id = 1)
BEGIN SELECT RAISE(ABORT, 'recipe_capacity'); END;
CREATE TRIGGER IF NOT EXISTS recipes_reserve AFTER INSERT ON recipes
BEGIN UPDATE recipe_budget SET used_bytes = used_bytes + NEW.bytes WHERE id = 1; END;

CREATE TABLE IF NOT EXISTS recipe_votes (
  recipe_id TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'pl' CHECK (locale IN ('pl', 'en')),
  voter TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (recipe_id, locale, voter),
  FOREIGN KEY (recipe_id, locale) REFERENCES recipes(id, locale)
);
CREATE TABLE IF NOT EXISTS generation_leases (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS generation_attempts (
  id TEXT PRIMARY KEY,
  voter TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_by_voter ON generation_attempts(voter, created_at);
