#!/usr/bin/env python3
"""
SQLite to PostgreSQL migration script using pgloader.

This script migrates data from an SQLite3 database to a PostgreSQL database
using pgloader. It generates a temporary pgloader command file and executes it.
"""

import argparse
import os
import sys
import tempfile
import subprocess
import shutil
from pathlib import Path


def check_pgloader_installed():
    """Check if pgloader is installed and available."""
    pgloader_path = shutil.which('pgloader')
    if not pgloader_path:
        print("Error: pgloader is not installed or not in PATH", file=sys.stderr)
        print("Please install pgloader: https://github.com/dimitri/pgloader", file=sys.stderr)
        return False
    return True


def validate_sqlite_file(sqlite_path):
    """Validate that the SQLite database file exists and is readable."""
    sqlite_path_obj = Path(sqlite_path)
    if not sqlite_path_obj.exists():
        print(f"Error: SQLite database file does not exist: {sqlite_path}", file=sys.stderr)
        return False
    if not sqlite_path_obj.is_file():
        print(f"Error: SQLite database path is not a file: {sqlite_path}", file=sys.stderr)
        return False
    if not os.access(sqlite_path_obj, os.R_OK):
        print(f"Error: SQLite database file is not readable: {sqlite_path}", file=sys.stderr)
        return False
    return True


def build_postgresql_connection_string(host, port, database, user, password):
    """
    Build PostgreSQL connection string.
    
    Args:
        host: PostgreSQL host
        port: PostgreSQL port
        database: Database name
        user: Username
        password: Password (optional, can use .pgpass)
    
    Returns:
        Connection string for PostgreSQL
    """
    if password:
        return f"postgresql://{user}:{password}@{host}:{port}/{database}"
    else:
        return f"postgresql://{user}@{host}:{port}/{database}"


def generate_pgloader_command_file(sqlite_path, pg_conn_string, output_file):
    """
    Generate a pgloader command file.
    
    Args:
        sqlite_path: Path to SQLite database file
        pg_conn_string: PostgreSQL connection string
        output_file: Path to write the pgloader command file
    """
    sqlite_uri = f"sqlite:///{sqlite_path}"
    
    pgloader_commands = f"""LOAD DATABASE
  FROM {sqlite_uri}
  INTO {pg_conn_string}

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB', maintenance_work_mem to '512 MB';
"""
    
    with open(output_file, 'w') as f:
        f.write(pgloader_commands)


def test_postgresql_connection(host, port, database, user, password):
    """
    Test PostgreSQL connectivity using psql if available.
    
    Args:
        host: PostgreSQL host
        port: PostgreSQL port
        database: Database name
        user: Username
        password: Password (optional)
    
    Returns:
        True if connection test passes or psql is not available, False otherwise
    """
    psql_path = shutil.which('psql')
    if not psql_path:
        # psql not available, skip connection test
        print("Warning: psql not found, skipping PostgreSQL connection test")
        return True
    
    # Build connection string for psql
    if password:
        env = os.environ.copy()
        env['PGPASSWORD'] = password
        cmd = [
            psql_path,
            '-h', host,
            '-p', str(port),
            '-U', user,
            '-d', database,
            '-c', 'SELECT 1;'
        ]
    else:
        cmd = [
            psql_path,
            '-h', host,
            '-p', str(port),
            '-U', user,
            '-d', database,
            '-c', 'SELECT 1;'
        ]
        env = os.environ.copy()
    
    try:
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            timeout=10,
            check=False
        )
        if result.returncode != 0:
            print(f"Warning: PostgreSQL connection test failed: {result.stderr.decode()}", file=sys.stderr)
            print("Continuing anyway - pgloader will handle connection errors", file=sys.stderr)
        return True
    except subprocess.TimeoutExpired:
        print("Warning: PostgreSQL connection test timed out", file=sys.stderr)
        print("Continuing anyway - pgloader will handle connection errors", file=sys.stderr)
        return True
    except Exception as e:
        print(f"Warning: Could not test PostgreSQL connection: {e}", file=sys.stderr)
        print("Continuing anyway - pgloader will handle connection errors", file=sys.stderr)
        return True


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description='Migrate SQLite database to PostgreSQL using pgloader'
    )
    parser.add_argument(
        'sqlite_db_path',
        type=str,
        help='Path to SQLite database file'
    )
    parser.add_argument(
        '--pg-host',
        type=str,
        default='localhost',
        help='PostgreSQL host (default: localhost)'
    )
    parser.add_argument(
        '--pg-port',
        type=int,
        default=5432,
        help='PostgreSQL port (default: 5432)'
    )
    parser.add_argument(
        '--pg-database',
        type=str,
        required=True,
        help='PostgreSQL database name (required)'
    )
    parser.add_argument(
        '--pg-user',
        type=str,
        default='postgres',
        help='PostgreSQL username (default: postgres)'
    )
    parser.add_argument(
        '--pg-password',
        type=str,
        default=None,
        help='PostgreSQL password (optional, can use .pgpass file)'
    )
    
    args = parser.parse_args()
    
    # Validate prerequisites
    if not check_pgloader_installed():
        sys.exit(1)
    
    if not validate_sqlite_file(args.sqlite_db_path):
        sys.exit(1)
    
    # Test PostgreSQL connection (non-fatal)
    test_postgresql_connection(
        args.pg_host,
        args.pg_port,
        args.pg_database,
        args.pg_user,
        args.pg_password
    )
    
    # Build PostgreSQL connection string
    pg_conn_string = build_postgresql_connection_string(
        args.pg_host,
        args.pg_port,
        args.pg_database,
        args.pg_user,
        args.pg_password
    )
    
    # Generate temporary pgloader command file
    temp_file = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.load', delete=False) as f:
            temp_file = f.name
            generate_pgloader_command_file(
                args.sqlite_db_path,
                pg_conn_string,
                temp_file
            )
        
        print(f"Generated pgloader command file: {temp_file}")
        print(f"Migrating from SQLite: {args.sqlite_db_path}")
        print(f"Migrating to PostgreSQL: {args.pg_host}:{args.pg_port}/{args.pg_database}")
        
        # Execute pgloader
        cmd = ['pgloader', temp_file]
        result = subprocess.run(cmd, check=False)
        
        if result.returncode != 0:
            print(f"Error: pgloader exited with code {result.returncode}", file=sys.stderr)
            sys.exit(1)
        
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}", file=sys.stderr)
        sys.exit(1)
    
    finally:
        # Clean up temporary file
        if temp_file and os.path.exists(temp_file):
            try:
                os.unlink(temp_file)
            except Exception as e:
                print(f"Warning: Could not delete temporary file {temp_file}: {e}", file=sys.stderr)


if __name__ == '__main__':
    main()

