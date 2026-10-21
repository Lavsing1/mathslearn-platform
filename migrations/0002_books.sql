-- MathsLearn Book Studio. Apply once to the existing mathslearn-db D1 database.
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  org TEXT NOT NULL DEFAULT '',
  page_size TEXT NOT NULL DEFAULT 'a4',
  book_json TEXT NOT NULL,
  lectures_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_books_status_updated ON books(status, updated_at DESC);
