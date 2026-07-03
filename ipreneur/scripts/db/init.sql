-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant privileges to application user
GRANT ALL PRIVILEGES ON DATABASE ipreneur TO ipreneur;
