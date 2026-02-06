#!/bin/bash

echo "JSON ANNOTATION PROCESSING"

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

ORIGINAL_DIR=$(pwd)

# Check if SX_HOME_DIR is set
[[ -z "$SX_HOME_DIR" ]] && error_exit "SX_HOME_DIR environment variable is not set"

# Main menu
echo ""
echo "Select annotation method:"
echo "1) Use existing JSON annotations for a video"
echo "2) Create annotations from an audio recording"
echo "3) Manual annotation with the annotator web tool"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "=== Using Existing JSON Annotations ==="
        read -p "Enter path to JSON annotation file: " json_path
        
        # Expand tilde and resolve path
        json_path="${json_path/#\~/$HOME}"
        json_path=$(realpath "$json_path" 2>/dev/null || echo "$json_path")
        
        if [[ ! -f "$json_path" ]]; then
            error_exit "JSON file not found: $json_path"
        fi
        
        echo "JSON file found: $json_path"
        echo "You can now use this file with your video annotation workflow."
        ;;
    
    2)
        echo ""
        echo "=== Create Annotations from Audio Recording ==="
        
        # Get audio file path
        read -p "Enter path to audio file (mp3, m4a, wav, etc.): " audio_path
        
        # Expand tilde and resolve path
        audio_path="${audio_path/#\~/$HOME}"
        audio_path=$(realpath "$audio_path" 2>/dev/null || echo "$audio_path")
        
        if [[ ! -f "$audio_path" ]]; then
            error_exit "Audio file not found: $audio_path"
        fi
        
        # Get output file path
        read -p "Enter output JSON file path: " output_path
        
        # Expand tilde and resolve path
        output_path="${output_path/#\~/$HOME}"
        output_dir=$(dirname "$output_path")
        
        # Create output directory if needed
        if [[ ! -d "$output_dir" ]]; then
            echo "Creating output directory: $output_dir"
            mkdir -p "$output_dir" || error_exit "Failed to create output directory"
        fi
        
        # Accuracy selection (Whisper model only, GPT always uses gpt-5)
        echo ""
        echo "Select accuracy level:"
        echo "1) Quick (Whisper: tiny) - Fastest, lower accuracy"
        echo "2) Balanced (Whisper: base) - Good balance of speed and accuracy"
        echo "3) Accurate (Whisper: large) - Slowest, highest accuracy"
        echo ""
        read -p "Enter your choice (1-3) [default: 2]: " accuracy_choice
        
        # Set Whisper model based on accuracy choice
        case $accuracy_choice in
            1)
                whisper_model="tiny"
                ;;
            2|"")
                whisper_model="base"
                ;;
            3)
                whisper_model="large"
                ;;
            *)
                error_exit "Invalid choice. Please select 1, 2, or 3."
                ;;
        esac
        
        gpt_model="gpt-5"
        
        echo ""
        echo "Using: Whisper model=$whisper_model, GPT model=$gpt_model"
        
        # Check for OpenAI API key
        if [[ -z "$OPENAI_API_KEY" ]]; then
            error_exit "OPENAI_API_KEY environment variable is not set. Please set it before running."
        fi
        
        # Change to audio-annotator directory
        cd "$SX_HOME_DIR/Apps/audio-annotator" || error_exit "Failed to change directory to audio-annotator"
        
        # Create virtual environment if it doesn't exist
        echo ""
        echo "Checking Python dependencies..."
        if [[ ! -d "$SX_HOME_DIR/py-venv" ]]; then
            echo "Creating Python virtual environment..."
            python3 -m venv "$SX_HOME_DIR/py-venv"
            python -m ensurepip --default-pip
        fi
        
        echo "Activating virtual environment..."
        source "$SX_HOME_DIR/py-venv/bin/activate"
        
        echo "Installing Python dependencies..."
        python -m ensurepip --default-pip
        pip install -q -r requirements.txt || error_exit "pip install failed"
        
        # Run the audio annotator
        echo ""
        echo "Processing audio file..."
        python audio_annotator.py "$audio_path" "$output_path" --model-size "$whisper_model" --model "$gpt_model" || error_exit "Audio annotation failed"
        
        # Deactivate virtual environment
        deactivate
        
        echo ""
        echo "Success! Annotations saved to: $output_path"
        ;;
    
    3)
        echo ""
        echo "=== Manual Annotation with Annotator Web Tool ==="
        echo ""
        echo "To use the manual annotator:"
        echo "1. Open the annotator HTML file in your web browser:"
        echo "   $SX_HOME_DIR/Apps/annotator/index.html"
        echo ""
        echo "2. Load your video file using drag-and-drop or file path"
        echo ""
        echo "3. Use the annotation buttons to add:"
        echo "   - Areas (data array)"
        echo "   - Markers (user_defined array)"
        echo "   - Loop detection controls (disable_loop array)"
        echo ""
        echo "4. Click 'Download JSON' to export your annotations"
        echo ""
        
        # Ask if user wants to open the file
        read -p "Open annotator in default browser? (y/n) [default: n]: " open_browser
        if [[ "$open_browser" == "y" || "$open_browser" == "Y" ]]; then
            if command -v xdg-open > /dev/null; then
                xdg-open "$SX_HOME_DIR/Apps/annotator/index.html"
            elif command -v open > /dev/null; then
                open "$SX_HOME_DIR/Apps/annotator/index.html"
            else
                echo "Could not automatically open browser. Please open manually:"
                echo "$SX_HOME_DIR/Apps/annotator/index.html"
            fi
        fi
        ;;
    
    *)
        error_exit "Invalid choice. Please select 1, 2, or 3."
        ;;
esac

cd "$ORIGINAL_DIR" || error_exit "Failed to change back to original directory"

echo ""
echo "Done!"

