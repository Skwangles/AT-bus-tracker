#!/bin/bash

# Function to print error message and exit
function error_exit {
    echo "Error: $1"
    exit 1
}

# Function to check if a command exists
function command_exists {
    command -v "$1" >/dev/null 2>&1
}

# Function to load and validate JSON
function load_json {
    if ! command_exists jq; then
        error_exit "jq is required but not installed. Please install jq first."
    fi
    
    local json_file="$1"
    if [ ! -f "$json_file" ]; then
        error_exit "Configuration file $json_file not found"
    fi
    
    # Validate JSON
    if ! jq empty "$json_file" 2>/dev/null; then
        error_exit "Invalid JSON in $json_file"
    fi
    
    echo "$json_file"
}

# Function to load environment variables from a file
function load_env_file {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        set -a
        source "$env_file"
        set +a
    fi
}

# Function to process environment variables
function process_env_vars {
    local value="$1"
    # Replace ${VAR} with actual environment variable values
    while [[ $value =~ \$\{([^}]+)\} ]]; do
        local var_name="${BASH_REMATCH[1]}"
        local var_value="${!var_name}"
        if [ -z "$var_value" ]; then
            error_exit "Environment variable $var_name is not set"
        fi
        value="${value//\$\{$var_name\}/$var_value}"
    done
    echo "$value"
}

# Function to convert JSON array to bash array
function json_array_to_bash {
    local json_array="$1"
    echo "$json_array" | jq -r '.[]'
}

# Function to copy environment files to Node.js projects
function copy_env_to_node_projects {
    local env_file="$1"
    local home_dir="$2"
    
    # List of Node.js project directories
    local node_projects=(
        "Apps/authoring-backend"
        "Apps/ImageProcessor"
        "Apps/GraphPruner"
        "Apps/map_data_init"
    )
    
    for project in "${node_projects[@]}"; do
        local project_dir="$home_dir/$project"
        if [ -d "$project_dir" ]; then
            echo "Copying environment file to $project_dir"
            cp "$env_file" "$project_dir/.env"
        fi
    done
}

# Function to apply configuration
function apply_configuration {
    local config_file="$1"
    local profile_name="$2"
    
    # Load the configuration
    local config_json=$(cat "$config_file")
    
    # Process features
    local features=$(echo "$config_json" | jq -r '.features | to_entries | .[] | "CV_\(.key | ascii_upcase)=\(.value)"')
    while IFS= read -r feature; do
        if [ ! -z "$feature" ]; then
            export "$feature"
        fi
    done <<< "$features"
    
    # Process paths
    local paths=$(echo "$config_json" | jq -r '.paths | to_entries | .[] | "CV_\(.key | ascii_upcase)=\(.value)"')
    while IFS= read -r path; do
        if [ ! -z "$path" ]; then
            local key=$(echo "$path" | cut -d'=' -f1)
            local value=$(echo "$path" | cut -d'=' -f2-)
            value=$(process_env_vars "$value")
            export "$key=$value"
        fi
    done <<< "$paths"
    
    # Process config
    local configs=$(echo "$config_json" | jq -r '.config | to_entries | .[] | "CV_\(.key | ascii_upcase)=\(.value)"')
    while IFS= read -r config; do
        if [ ! -z "$config" ]; then
            local key=$(echo "$config" | cut -d'=' -f1)
            local value=$(echo "$config" | cut -d'=' -f2-)
            
            # Handle arrays - keep them as JSON arrays for Python scripts
            if [[ "$value" == "["*"]" ]]; then
                # For Python scripts that expect JSON arrays, keep the JSON format
                if [[ "$key" == *"STRIP_"* ]]; then
                    value=$(echo "$value" | jq -c '.')
                else
                    # For other uses, convert to comma-separated
                    value=$(json_array_to_bash "$value" | tr '\n' ',' | sed 's/,$//')
                fi
            fi
            
            export "$key=$value"
        fi
    done <<< "$configs"
}

# Main script
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <profile_name> [custom_env_file]"
    exit 1
fi

PROFILE_NAME="$1"
CUSTOM_ENV_FILE="$2"

# Set up paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
CV_HOME_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
CONFIG_DIR="$CV_HOME_DIR/configs"

# Load base environment
load_env_file "$CV_HOME_DIR/.env"

# Load profile configuration
PROFILE_FILE="$CONFIG_DIR/$PROFILE_NAME.json"
if [ ! -f "$PROFILE_FILE" ]; then
    error_exit "Profile $PROFILE_NAME not found in $CONFIG_DIR"
fi

# Apply profile configuration
apply_configuration "$PROFILE_FILE" "$PROFILE_NAME"

# Load sensitive data
load_env_file "$CV_HOME_DIR/.env.secrets"

# Load custom environment file if provided
if [ ! -z "$CUSTOM_ENV_FILE" ]; then
    load_env_file "$CUSTOM_ENV_FILE"
fi

# Load project-specific secrets
for project in Apps/*; do
    if [ -d "$project" ]; then
        load_env_file "$project/.env.secrets"
    fi
done

# Export all variables
set -a
source <(env | grep -v '^_' | awk -F= '{print "export " $1}')
set +a

# Copy environment files to Node.js projects
copy_env_to_node_projects "$CV_HOME_DIR/.env" "$CV_HOME_DIR"

echo "Configuration loaded successfully for profile: $PROFILE_NAME" 