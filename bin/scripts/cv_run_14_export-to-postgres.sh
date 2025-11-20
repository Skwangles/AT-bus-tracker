#!/bin/bash

function error_exit {
  echo "Error: $1"
  exit 1
}

# Exit on error
set -e

# Function to check command success
check_command() {
  if [ $? -ne 0 ]; then
    echo "Error occurred during: $1"
    exit 1
  fi
}

echo "EXPORTING SQLITE DATABASE TO POSTGRESQL"

# Check required environment variables
[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"
[[ -z "$CV_DB_DIR" ]] && error_exit "CV_DB_DIR is not set"
[[ -z "$CV_PG_DATABASE" ]] && error_exit "CV_PG_DATABASE is not set"

# Get database name from configuration
# Priority: server_db_name > authoring_db_name > export_db_name
DB_NAME=""
if [[ ! -z "$CV_SERVER_DB_NAME" ]]; then
    DB_NAME="$CV_SERVER_DB_NAME"
elif [[ ! -z "$CV_AUTHORING_DB_NAME" ]]; then
    DB_NAME="$CV_AUTHORING_DB_NAME"
elif [[ ! -z "$CV_EXPORT_DB_NAME" ]]; then
    DB_NAME="$CV_EXPORT_DB_NAME"
else
    error_exit "No database name found in configuration (CV_SERVER_DB_NAME, CV_AUTHORING_DB_NAME, or CV_EXPORT_DB_NAME must be set)"
fi

SQLITE_DB_PATH="$CV_DB_DIR/$DB_NAME"

# Check if SQLite database exists
if [[ ! -f "$SQLITE_DB_PATH" ]]; then
    error_exit "SQLite database file not found: $SQLITE_DB_PATH"
fi

# Set PostgreSQL connection defaults
PG_HOST="${CV_PG_HOST:-localhost}"
PG_PORT="${CV_PG_PORT:-5432}"
PG_USER="${CV_PG_USER:-postgres}"
PG_PASSWORD="${CV_PG_PASSWORD:-}"

echo "SQLite database: $SQLITE_DB_PATH"
echo "PostgreSQL host: $PG_HOST"
echo "PostgreSQL port: $PG_PORT"
echo "PostgreSQL database: $CV_PG_DATABASE"
echo "PostgreSQL user: $PG_USER"

ORIGINAL_DIR=$(pwd)

cd "$CV_HOME_DIR/Apps/sqlite-to-postgres" || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/sqlite-to-postgres"

# Check if Python script exists
if [[ ! -f "migrate.py" ]]; then
    error_exit "migrate.py not found in $CV_HOME_DIR/Apps/sqlite-to-postgres"
fi

# Build command arguments
ARGS=(
    "$SQLITE_DB_PATH"
    --pg-host "$PG_HOST"
    --pg-port "$PG_PORT"
    --pg-database "$CV_PG_DATABASE"
    --pg-user "$PG_USER"
)

# Add password if provided
if [[ ! -z "$PG_PASSWORD" ]]; then
    ARGS+=(--pg-password "$PG_PASSWORD")
fi

# Execute migration
python3 migrate.py "${ARGS[@]}"
check_command "Exporting SQLite database to PostgreSQL"

cd "$ORIGINAL_DIR" || error_exit "Failed to change directory back to $ORIGINAL_DIR"

echo "SQLite to PostgreSQL export completed successfully!"

