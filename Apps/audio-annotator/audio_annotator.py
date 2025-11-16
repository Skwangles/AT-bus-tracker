#!/usr/bin/env python3
"""
Audio Annotator - CLI application for converting audio transcriptions to annotations.

This application processes audio files (mp3, m4a, etc.) using OpenAI Whisper for
transcription, then uses OpenAI GPT-4o to convert the transcriptions into the
JSON format expected by the annotator tool.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from whisper_transcriber import WhisperTranscriber
from llm_processor import LLMProcessor


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Convert audio files to annotator JSON format using Whisper and GPT-4o"
    )
    parser.add_argument(
        "input_file",
        type=str,
        help="Path to input audio file (mp3, m4a, wav, etc.)"
    )
    parser.add_argument(
        "output_file",
        type=str,
        help="Path to output JSON file"
    )
    parser.add_argument(
        "--model-size",
        type=str,
        default="base",
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size (default: base)"
    )
    parser.add_argument(
        "--api-key",
        type=str,
        default=None,
        help="OpenAI API key (default: from OPENAI_API_KEY environment variable)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gpt-5",
        help="OpenAI GPT model to use (default: gpt-5)"
    )
    
    args = parser.parse_args()
    
    # Validate input file
    if not os.path.exists(args.input_file):
        print(f"Error: Input file not found: {args.input_file}", file=sys.stderr)
        sys.exit(1)
    
    # Create output directory if needed
    output_path = Path(args.output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"Loading Whisper model ({args.model_size})...")
    transcriber = WhisperTranscriber(model_size=args.model_size)
    
    print(f"Transcribing audio file: {args.input_file}")
    try:
        segments = transcriber.transcribe(args.input_file)
        print(f"Transcribed {len(segments)} segments")
    except Exception as e:
        print(f"Error during transcription: {e}", file=sys.stderr)
        sys.exit(1)
    
    if not segments:
        print("Warning: No transcription segments found. Creating empty JSON file.")
        result = {
            "data": [],
            "user_defined": [],
            "disable_loop": []
        }
    else:
        print(f"Processing transcriptions with {args.model}...")
        try:
            processor = LLMProcessor(api_key=args.api_key, model=args.model)
            result = processor.processSegments(segments)
            print(f"Generated {len(result['data'])} data entries, "
                  f"{len(result['user_defined'])} user_defined entries, "
                  f"{len(result['disable_loop'])} disable_loop entries")
        except Exception as e:
            print(f"Error during LLM processing: {e}", file=sys.stderr)
            sys.exit(1)
    
    # Write output JSON
    print(f"Writing output to: {args.output_file}")
    try:
        with open(args.output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print("Success!")
    except Exception as e:
        print(f"Error writing output file: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

