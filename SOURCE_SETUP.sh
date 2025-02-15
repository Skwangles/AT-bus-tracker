
# Exit on error
set -e

# Function to check command success
check_command() {
  if [ $? -ne 0 ]; then
    echo "Error occurred during: $1"
    exit 1
  fi
}

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )" # https://saturncloud.io/blog/how-to-get-the-directory-where-a-bash-script-is-located/#:~:text=The%20first%20method%20to%20get,directory%20name%20from%20the%20path.

if [ ! -z "$CV_HOME_DIR" ]; then
  echo "Already added to path, but updating in case changed"
fi



export CV_HOME_DIR=$SCRIPT_DIR
echo "CV_HOME_DIR=$CV_HOME_DIR"
export CV_OS=linux
echo "CV_OS=$CV_OS"


echo "CV_ENV_PATH=$CV_ENV_PATH"
if [ -n "$1" ]; then
  export CV_ENV_PATH=$1
else
  export CV_ENV_PATH=$SCRIPT_DIR/.env
fi
echo "Sourcing from $CV_ENV_PATH"
if [ ! -f $CV_ENV_PATH ]; then
  echo ".env not found - You MUST rename .env.example to .env and customise it!"
  echo "Aborting so you don't accidentally use the wrong config!"
  read -p "Press enter to continue"
  exit 1
fi

source $CV_ENV_PATH

echo "Exporting to Path"

export PATH="$CV_HOME_DIR/bin/scripts":$PATH
export PATH="$CV_HOME_DIR":$PATH

sudo chmod +x "$SCRIPT_DIR"/bin/scripts/*.sh
check_command "sudo chmod +x ./bin/scripts/*.sh"

if [ -z "$CV_HOME_DIR" ]; then
  echo "Failed to add environment variables to path - please look at cv_run_add_to_path.sh"
  read -p "Press enter to continue"
  exit 1
fi