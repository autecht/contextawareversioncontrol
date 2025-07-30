-- CREATE DATABASE context_aware_version_control;
-- USE context_aware_version_control;

-- in psql, CREATE DATABASE context_aware_version_control;
-- from command line, psql -U postgres -d context_aware_version_control -f "C:\Files\Projects\contextawareversioncontrol\database\schema.sql"
CREATE TABLE IF NOT EXISTS comments(
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  repo_url VARCHAR(255) NOT NULL,
  commit_id VARCHAR(255) NOT NULL
);