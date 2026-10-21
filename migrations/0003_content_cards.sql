-- Additive content-card metadata. Existing rows remain valid and default to empty values.
ALTER TABLE content ADD COLUMN subject TEXT NOT NULL DEFAULT '';
ALTER TABLE content ADD COLUMN chapter TEXT NOT NULL DEFAULT '';
ALTER TABLE content ADD COLUMN excerpt TEXT NOT NULL DEFAULT '';
ALTER TABLE content ADD COLUMN thumbnail_url TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_content_subject_chapter ON content(subject, chapter);
