"""
Whisper transcription module for audio files.

This module provides functionality to transcribe audio files using OpenAI Whisper,
extracting timestamped segments for further processing with fine-grained timestamps.
"""

import whisper
from typing import List, Tuple
import os
import re


class WhisperTranscriber:
    """Handles audio transcription using OpenAI Whisper with timestamp extraction."""
    
    def __init__(self, model_size: str = "base"):
        """
        Initialise the Whisper transcriber.
        
        Args:
            model_size: Whisper model size to use (tiny, base, small, medium, large).
                       Default is 'base' for a balance of speed and accuracy.
        """
        self.model = whisper.load_model(model_size)
    
    def transcribe(self, audio_path: str) -> List[Tuple[str, float, float]]:
        """
        Transcribe an audio file and return timestamped segments with fine-grained timestamps.
        
        Args:
            audio_path: Path to the audio file (mp3, m4a, wav, etc.)
        
        Returns:
            List of tuples containing (text, start_time_ms, end_time_ms)
            where times are in milliseconds.
        
        Raises:
            FileNotFoundError: If the audio file doesn't exist
            Exception: If transcription fails
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        # Transcribe with word-level timestamps
        result = self.model.transcribe(
            audio_path,
            word_timestamps=True
        )
        
        # Extract and split segments with fine-grained timestamps
        all_segments = []
        for segment in result.get("segments", []):
            all_segments.append((segment.get("text", "").strip(), segment.get("start", 0.0) * 1000, segment.get("end", 0.0) * 1000))
        
        print(f"Transcribed {len(all_segments)} segments using local Whisper model")
        for segment in all_segments:
            print(f"Segment: {segment[0]} - {segment[1]}ms to {segment[2]}ms")
        
        return all_segments

