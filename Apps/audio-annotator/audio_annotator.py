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
from api_annotator import APIAnnotator


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
    parser.add_argument(
        "--use-transcribe",
        action="store_true",
        help="Use gpt-4o with audio input to process audio directly with system prompt (combines transcription and annotation)"
    )
    
    args = parser.parse_args()
    
    # Validate input file
    if not os.path.exists(args.input_file):
        print(f"Error: Input file not found: {args.input_file}", file=sys.stderr)
        sys.exit(1)
    
    # Create output directory if needed
    output_path = Path(args.output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Get API key
    api_key = args.api_key
    if api_key is None:
        api_key = os.getenv("OPENAI_API_KEY")
    
    # Use gpt-4o-transcribe for direct audio processing
    if args.use_transcribe:
        if not api_key:
            print("Error: OPENAI_API_KEY environment variable is not set and --api-key not provided.", file=sys.stderr)
            sys.exit(1)
        
        print("Using gpt-4o with audio input for direct audio processing...")
        try:
            annotator = APIAnnotator(api_key=api_key)
            result = annotator.processAudio(args.input_file)
            print(f"Generated {len(result['data'])} data entries, "
                  f"{len(result['user_defined'])} user_defined entries, "
                  f"{len(result['disable_loop'])} disable_loop entries")
        except Exception as e:
            print(f"Error during audio processing: {e}", file=sys.stderr)
            sys.exit(1)
    else:
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

