"""
API Annotator - Direct audio-to-annotation using gpt-4o-transcribe.

This module uses OpenAI's transcription API with gpt-4o-transcribe model to transcribe audio,
then processes the transcription with the LLM to generate annotations in a single workflow.
"""

import json
import os
import re
from typing import Dict, Any, Optional
from openai import OpenAI
from llm_processor import LLMProcessor, getSystemPrompt


class APIAnnotator:
    """Processes audio files using gpt-4o-transcribe transcription API then LLM processing."""
    
    def __init__(self, api_key: Optional[str] = None, llm_model: str = "gpt-5"):
        """
        Initialise the API annotator.
        
        Args:
            api_key: OpenAI API key. If None, will try to get from OPENAI_API_KEY environment variable.
            llm_model: Model to use for LLM processing (default: "gpt-5").
        """
        if api_key is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError(
                    "OpenAI API key not provided. Set OPENAI_API_KEY environment variable "
                    "or pass api_key parameter."
                )
        
        self.client = OpenAI(api_key=api_key)
        self.llm_processor = LLMProcessor(api_key=api_key, model=llm_model)
    
    def processAudio(self, audio_path: str) -> Dict[str, Any]:
        """
        Process an audio file to generate annotations.
        
        This method uses the transcription API with gpt-4o-transcribe to transcribe the audio,
        then processes the transcription with the LLM to generate annotations.
        
        Args:
            audio_path: Path to the audio file (mp3, m4a, wav, etc.)
        
        Returns:
            Dictionary with 'data', 'user_defined', and 'disable_loop' arrays
        
        Raises:
            FileNotFoundError: If the audio file doesn't exist
            Exception: If processing fails
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        # Step 1: Transcribe using gpt-4o-transcribe via transcription API
        audio_filename = os.path.basename(audio_path)
        
        print(f"Transcribing audio file: {audio_filename} (this may take a while for long files)...")
        
        with open(audio_path, 'rb') as audio_file:
            try:
                # Use the transcription API with gpt-4o-transcribe model
                # Pass file as tuple (filename, file_object) so API can detect format from filename
                # Note: gpt-4o-transcribe only supports "json" format (not verbose_json)
                # The API will detect the format from the file extension in the filename
                # For long files (30+ minutes), the API will handle chunking automatically
                transcript = self.client.audio.transcriptions.create(
                    model="gpt-4o-transcribe",
                    file=(audio_filename, audio_file),
                    response_format="json"
                )
                print("Transcription completed.")
            except Exception as e:
                raise RuntimeError(f"Error during transcription: {e}")
        
        # Step 2: Extract text from transcription
        # gpt-4o-transcribe with json format returns just the text, no timestamps
        # We'll need to split the text into segments and estimate timestamps
        segments = []
        
        # Get the transcription text
        if isinstance(transcript, dict):
            text = transcript.get('text', '').strip()
        elif hasattr(transcript, 'text'):
            text = str(transcript.text).strip()
        else:
            text = str(transcript).strip()
        
        if not text:
            # Return empty result if no transcription
            return {
                "data": [],
                "user_defined": [],
                "disable_loop": []
            }
        
        # Split text into sentences/phrases for better processing
        # Use simple sentence splitting (period, exclamation, question mark)
        sentences = re.split(r'[.!?]+\s+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Estimate timestamps based on text length
        # Rough estimate: ~150 words per minute = 2.5 words per second
        # Average word length: ~5 characters
        current_time_ms = 0
        for sentence in sentences:
            # Estimate duration: ~2.5 words/second, average 5 chars/word
            # So roughly 12.5 chars/second or 0.08 seconds per char
            estimated_duration_ms = int(len(sentence) * 80)  # milliseconds
            end_time_ms = current_time_ms + estimated_duration_ms
            
            segments.append((sentence, current_time_ms, end_time_ms))
            current_time_ms = end_time_ms + 500  # Add 500ms pause between sentences
        
        if not segments:
            # Return empty result if no transcription
            return {
                "data": [],
                "user_defined": [],
                "disable_loop": []
            }
        
        # Step 3: Process transcription segments with LLM
        try:
            result = self.llm_processor.processSegments(segments)
            return result
        except Exception as e:
            raise RuntimeError(f"Error during LLM processing: {e}")
    
    def _get_audio_format(self, audio_path: str) -> str:
        """
        Determine audio format from file extension.
        
        Args:
            audio_path: Path to audio file
        
        Returns:
            Audio format string (m4a, mp3, wav, etc.)
        """
        ext = os.path.splitext(audio_path)[1].lower().lstrip('.')
        
        # Map common extensions to format names
        format_map = {
            'm4a': 'm4a',
            'mp3': 'mp3',
            'wav': 'wav',
            'mp4': 'mp4',
            'flac': 'flac',
            'ogg': 'ogg',
            'oga': 'oga',
            'webm': 'webm',
            'mpga': 'mpga',
            'mpeg': 'mpeg'
        }
        
        return format_map.get(ext, 'm4a')  # Default to m4a if unknown

