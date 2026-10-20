PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('Study Notes','Question Paper','Solved Examples','Formula Sheet')),
  paper_type TEXT NOT NULL DEFAULT '',
  study_level TEXT NOT NULL,
  course TEXT NOT NULL,
  board_exam TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_status_type ON content(status, content_type);
CREATE INDEX IF NOT EXISTS idx_content_level_course ON content(study_level, course);
CREATE INDEX IF NOT EXISTS idx_content_updated ON content(updated_at DESC);
