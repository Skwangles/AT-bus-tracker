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
    
    # Patterns that indicate instruction boundaries
    INSTRUCTION_PATTERNS = [
        r'\b(?:starting in|starting at|starting from)\b',
        r'\b(?:entered|entering|moving to|moving on|going to)\b',
        r'\bthis (?:here is|is)\b',
        r'\b(?:this point is|mark this as|this location is)\b',
        r'\bmerge point (?:for|at)\b',
        r'\belevator\b',
        r'\b(?:stop|start|enable|disable) loop detection\b',
    ]
    
    def __init__(self, model_size: str = "base"):
        """
        Initialise the Whisper transcriber.
        
        Args:
            model_size: Whisper model size to use (tiny, base, small, medium, large).
                       Default is 'base' for a balance of speed and accuracy.
        """
        self.model = whisper.load_model(model_size)
    
    def _findInstructionBoundaries(self, words: List[dict]) -> List[int]:
        """
        Find word indices that mark the start of new instructions.
        
        Args:
            words: List of word dictionaries with 'word' and 'start' keys
        
        Returns:
            List of word indices where new instructions start
        """
        boundaries = [0]  # Always start at the first word
        
        # Build full text and track word positions
        full_text = ""
        word_positions = []  # (start_char, end_char, word_idx)
        
        for i, word_info in enumerate(words):
            word = word_info.get("word", "").strip()
            if not word:
                continue
            
            start_char = len(full_text)
            if full_text:
                full_text += " "
            full_text += word
            end_char = len(full_text)
            word_positions.append((start_char, end_char, i))
        
        # Find all pattern matches in the full text
        for pattern in self.INSTRUCTION_PATTERNS:
            for match in re.finditer(pattern, full_text, re.IGNORECASE):
                match_start = match.start()
                # Find which word this match starts at
                for start_char, end_char, word_idx in word_positions:
                    if start_char <= match_start < end_char:
                        if word_idx not in boundaries:
                            boundaries.append(word_idx)
                        break
        
        return sorted(boundaries)
    
    def _splitSegmentAtBoundaries(
        self, 
        segment: dict, 
        words: List[dict]
    ) -> List[Tuple[str, float, float]]:
        """
        Split a segment into finer-grained segments at instruction boundaries.
        
        Args:
            segment: Segment dictionary with 'text', 'start', 'end'
            words: List of word dictionaries with 'word' and 'start' keys
        
        Returns:
            List of (text, start_time_ms, end_time_ms) tuples
        """
        if not words:
            # Fallback to segment-level timestamps
            text = segment.get("text", "").strip()
            start_time_ms = int(segment.get("start", 0.0) * 1000)
            end_time_ms = int(segment.get("end", 0.0) * 1000)
            return [(text, start_time_ms, end_time_ms)] if text else []
        
        boundaries = self._findInstructionBoundaries(words)
        if len(boundaries) <= 1:
            # No boundaries found, return original segment
            text = segment.get("text", "").strip()
            start_time_ms = int(segment.get("start", 0.0) * 1000)
            end_time_ms = int(segment.get("end", 0.0) * 1000)
            return [(text, start_time_ms, end_time_ms)] if text else []
        
        # Split at boundaries
        sub_segments = []
        for i in range(len(boundaries)):
            start_idx = boundaries[i]
            end_idx = boundaries[i + 1] if i + 1 < len(boundaries) else len(words)
            
            # Extract words for this sub-segment
            sub_words = words[start_idx:end_idx]
            if not sub_words:
                continue
            
            # Build text from words
            sub_text = " ".join(w.get("word", "").strip() for w in sub_words if w.get("word", "").strip())
            sub_text = sub_text.strip()
            
            if not sub_text:
                continue
            
            # Get timestamps from first and last word
            first_word = sub_words[0]
            last_word = sub_words[-1]
            
            start_time_ms = int(first_word.get("start", segment.get("start", 0.0)) * 1000)
            # Use end time from last word if available, otherwise estimate
            if "end" in last_word:
                end_time_ms = int(last_word.get("end", last_word.get("start", 0.0)) * 1000)
            else:
                # Estimate: use start time of last word + average word duration (0.3s)
                last_word_start = last_word.get("start", segment.get("start", 0.0))
                end_time_ms = int((last_word_start + 0.3) * 1000)
            
            sub_segments.append((sub_text, start_time_ms, end_time_ms))
        
        return sub_segments
    
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
        
        print(f"Transcribed {len(all_segments)} segments (after splitting)")
        for segment in all_segments:
            print(f"Segment: {segment[0]} - {segment[1]}ms to {segment[2]}ms")
        
        return all_segments

