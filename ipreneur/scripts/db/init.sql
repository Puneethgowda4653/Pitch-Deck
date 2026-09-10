-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant privileges to application user
GRANT ALL PRIVILEGES ON DATABASE ipreneur TO ipreneur;

-- Multi-deck-type support. SQLAlchemy's create_all() cannot alter an existing
-- table, so this runs as a migration against any database created before the
-- deck-type registry landed. Existing rows are investor decks by definition.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deck_type VARCHAR(32) NOT NULL DEFAULT 'investor';
