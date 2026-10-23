-- Add permanent, SEO-friendly paths without changing existing content IDs.
ALTER TABLE content ADD COLUMN slug TEXT NOT NULL DEFAULT '';
ALTER TABLE content ADD COLUMN url_path TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_url_path_unique
  ON content(url_path) WHERE url_path <> '';

-- Book Studio gets its own URL namespace.
ALTER TABLE books ADD COLUMN slug TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN url_path TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_url_path_unique
  ON books(url_path) WHERE url_path <> '';
