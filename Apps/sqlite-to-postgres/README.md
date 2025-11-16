# SQLite to PostgreSQL Migration

This tool migrates SQLite3 databases to PostgreSQL using `pgloader`.

## Overview

The migration tool consists of two components:

1. **Python script** (`migrate.py`): Core migration logic using pgloader
2. **Bash wrapper** (`bin/scripts/cv_run_14_export-to-postgres.sh`): Extracts environment variables and calls the Python script

## Prerequisites

- `pgloader` must be installed on the system
  - Installation: https://github.com/dimitri/pgloader
  - On Ubuntu/Debian: `sudo apt-get install pgloader`
  - On macOS: `brew install pgloader`

- PostgreSQL server must be running and accessible
- SQLite database file must exist and be readable

## Usage

### Via Wrapper Script (Recommended)

The wrapper script extracts configuration from environment variables:

```bash
# Set required environment variables (or load from config JSON)
export CV_HOME_DIR="/path/to/sitexplorer"
export CV_DB_DIR="/path/to/databases"
export CV_SERVER_DB_NAME="database.db"
export CV_PG_DATABASE="postgres_database_name"
export CV_PG_HOST="localhost"  # optional, default: localhost
export CV_PG_PORT="5432"        # optional, default: 5432
export CV_PG_USER="postgres"    # optional, default: postgres
export CV_PG_PASSWORD="secret"  # optional, can use .pgpass file

# Run migration
bin/scripts/cv_run_14_export-to-postgres.sh
```

### Direct Python Script Usage

You can also call the Python script directly:

```bash
python3 Apps/sqlite-to-postgres/migrate.py \
    /path/to/source.db \
    --pg-host localhost \
    --pg-port 5432 \
    --pg-database mydb \
    --pg-user postgres \
    --pg-password secret
```

### Command-Line Arguments

- `sqlite_db_path` (required): Path to SQLite database file
- `--pg-host` (default: localhost): PostgreSQL host
- `--pg-port` (default: 5432): PostgreSQL port
- `--pg-database` (required): PostgreSQL database name
- `--pg-user` (default: postgres): PostgreSQL username
- `--pg-password` (optional): PostgreSQL password (can use `.pgpass` file if not provided)

## Configuration

PostgreSQL connection settings can be configured in the profile JSON files (`configs/*.json`) under the `config` section:

```json
{
  "config": {
    "pg_host": "localhost",
    "pg_port": 5432,
    "pg_database": "mydb",
    "pg_user": "postgres",
    "pg_password": ""
  }
}
```

These values are automatically converted to `CV_PG_*` environment variables by the configuration system.

## How It Works

1. **Validation**: Checks that pgloader is installed, SQLite file exists, and PostgreSQL is accessible
2. **Command File Generation**: Creates a temporary pgloader command file with:
   - SQLite source connection
   - PostgreSQL target connection
   - Migration settings (drop existing tables, create tables, create indexes, reset sequences)
3. **Migration**: Executes pgloader to migrate schema and data
4. **Cleanup**: Removes temporary files

## Migration Behaviour

- **Drops existing tables**: If tables already exist in PostgreSQL, they will be dropped before migration
- **Creates tables**: Automatically creates tables from SQLite schema
- **Creates indexes**: Migrates indexes from SQLite
- **Resets sequences**: Resets PostgreSQL sequences to match SQLite data

## Error Handling

The script will exit with an error code if:
- pgloader is not installed
- SQLite database file does not exist or is not readable
- Required PostgreSQL connection parameters are missing
- pgloader migration fails

## Security Notes

- Passwords can be provided via:
  - `CV_PG_PASSWORD` environment variable
  - `.pgpass` file (recommended for production)
  - Command-line argument (less secure)

- The `.pgpass` file format:
  ```
  hostname:port:database:username:password
  ```
  File should be readable only by the user: `chmod 600 ~/.pgpass`

## Troubleshooting

### pgloader not found
Install pgloader using your system's package manager or from source.

### Connection refused
Ensure PostgreSQL is running and accessible at the specified host and port.

### Permission denied
Check that:
- SQLite database file is readable
- PostgreSQL user has permissions to create/drop tables in the target database
- `.pgpass` file has correct permissions (600)

### Migration fails
Check pgloader output for specific error messages. Common issues:
- Type incompatibilities (pgloader handles most automatically)
- Constraint violations
- Insufficient PostgreSQL resources (work_mem, etc.)

