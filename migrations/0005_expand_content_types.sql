-- Expand content_type values for the current Admin Studio.
-- Rebuild the table because SQLite CHECK constraints cannot be altered in place.
-- This migration is intentionally safe whether migration 0004 was previously applied or not.
CREATE TABLE content_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('Study Notes','Question Paper','Solved Examples','Formula Sheet','Solved Paper','Unsolved Questions','Important Questions')),
  paper_type TEXT NOT NULL DEFAULT '',
  study_level TEXT NOT NULL,
  course TEXT NOT NULL,
  board_exam TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  chapter TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT ''
);
INSERT INTO content_new (
  id,title,content_type,paper_type,study_level,course,board_exam,topic,seo_description,
  body_html,status,created_at,updated_at,subject,chapter,excerpt,thumbnail_url
)
SELECT
  id,title,content_type,paper_type,study_level,course,board_exam,topic,seo_description,
  body_html,status,created_at,updated_at,subject,chapter,excerpt,thumbnail_url
FROM content;
DROP TABLE content;
ALTER TABLE content_new RENAME TO content;
CREATE INDEX IF NOT EXISTS idx_content_status_type ON content(status, content_type);
CREATE INDEX IF NOT EXISTS idx_content_level_course ON content(study_level, course);
CREATE INDEX IF NOT EXISTS idx_content_updated ON content(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_subject_chapter ON content(subject, chapter);
