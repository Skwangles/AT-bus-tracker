"""
LLM processing module for converting transcriptions to annotator JSON format.

This module processes timestamped transcription segments using OpenAI GPT-4o
to convert spoken instructions into structured JSON matching the annotator format.
"""

import json
import os
import re
from typing import List, Tuple, Dict, Any
from openai import OpenAI


def getSystemPrompt() -> str:
    """
    Generate the system prompt for GPT-4o to convert transcriptions to JSON.
    
    Returns:
        System prompt string explaining the annotator JSON format and rules.
    """
    return """You are a high-precision transcription processor. Your sole function is to convert transcription segments into a structured JSON object. You must be rigid, precise, and follow all rules without deviation.

Your output MUST be a single, raw JSON object and nothing else.

## JSON Structure
The output JSON MUST adhere to this exact structure:
{
  "data": [...],
  "user_defined": [...],
  "disable_loop": [...]
}

---

## 1. `data` Array (Movement & Transitions)
* **Purpose**: Logs movement between areas.
* **Triggers**: "Starting in", "Moving to", "Entering".
* **Format**: `{"g": "<Area Name>", "t": <timestamp>}`
* **CRITICAL RULE**: The first entry added to the `data` array (chronologically) MUST have its timestamp set to `0`. `{"g": "Starting Area", "t": 0}`. This applies even if the transcription timestamp is different.

---

## 2. `user_defined` Array (Static Markers)
* **Purpose**: Logs static, labeled points.
* **Triggers**: "This is the", "Mark this as".
* **Format**: `{"g": "<Label>", "t": <timestamp>}`

* **Special Formats (MUST be used):**
    * **Toilets**: `{"g": "!!toilet, <Description>", "t": <timestamp>}`
        * Example: "This is the western toilet" → `{"g": "!!toilet, Western Toilet", "t": 1500}`
    * **Elevators**: `{"g": "!!elevator,<Shaft Name>,<Current Area>", "t": <timestamp>}`
        * Example: "This is an elevator in the main shaft" (while in "Floor 1") → `{"g": "!!elevator,Main Shaft,Floor 1", "t": 2500}`
        * You MUST infer `<Current Area>` from the most recent `data` entry.
    * **Merge Points**: `{"g": "$$<Area Name>", "t": <timestamp>}`
        * Example: "This is a merge point for western hall" → `{"g": "$$Western Hall", "t": 3500}`
    * **Anchor Points**: `{"g": "!!anchor", "t": <timestamp>}`
        * Example: "Mark an anchor point" → `{"g": "!!anchor", "t": 4500}`

---

## 3. `disable_loop` Array (Loop Control)
* **Purpose**: Controls loop detection.
* **Triggers**:
    * "Stop loop detection" → `{"disable": true, "t": <timestamp>}`
    * "Start loop detection" / "Enable loop detection" → `{"disable": false, "t": <timestamp>}`

---

## 4. Non-Negotiable Rules
1.  **Output**: Return ONLY the raw JSON object. No explanations, apologies, or pre-text.
2.  **Timestamps**: `t` MUST be the **start timestamp** of the transcription segment, in milliseconds. The only exception is the `t: 0` rule for the first `data` entry.
3.  **Casing**: ALL text in the `g` field MUST be converted to **Title Case**. (e.g., "tech bar" → "Tech Bar").
4.  **Normalization**: Standardize common area names (e.g., "1st Level" and "Level 1" must both be "Level 1").
5.  **Omission**: If a transcription segment is unclear, conversational, or does not match any trigger, you MUST ignore it. Do not generate an entry.
6.  **Validity**: The output must always be valid JSON, even if arrays are empty."""


class LLMProcessor:
    """Processes transcription segments using OpenAI GPT models to generate JSON annotations."""
    
    def __init__(self, api_key: str = None, model: str = "gpt-5"):
        """
        Initialise the LLM processor.
        
        Args:
            api_key: OpenAI API key. If None, will try to get from OPENAI_API_KEY environment variable.
            model: OpenAI model to use (default: "gpt-5").
        """
        if api_key is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError(
                    "OpenAI API key not provided. Set OPENAI_API_KEY environment variable "
                    "or pass api_key parameter."
                )
        
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.system_prompt = getSystemPrompt()
    
    def processSegments(
        self, 
        segments: List[Tuple[str, float, float]]
    ) -> Dict[str, Any]:
        """
        Process transcription segments and convert to annotator JSON format.
        
        Args:
            segments: List of (text, start_time_ms, end_time_ms) tuples
        
        Returns:
            Dictionary with 'data', 'user_defined', and 'disable_loop' arrays
        """
        if not segments:
            return {
                "data": [],
                "user_defined": [],
                "disable_loop": []
            }
        
        # Build a single user message with all transcription segments
        transcription_lines = []
        for text, start_time_ms, end_time_ms in segments:
            transcription_lines.append(f"[{int(start_time_ms)}ms] {text}")
        
        user_message = "Full transcription with timestamps:\n" + "\n".join(transcription_lines)
        print("LLM Prompt:\n", user_message)
        try:
            # Call OpenAI API once with the full transcription
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_message}
                ],
                response_format={"type": "json_object"}
            )
            
            # Parse the response
            response_text = response.choices[0].message.content
            result = json.loads(response_text)
            
            # Ensure all required keys exist
            if "data" not in result:
                result["data"] = []
            if "user_defined" not in result:
                result["user_defined"] = []
            if "disable_loop" not in result:
                result["disable_loop"] = []
        
        except json.JSONDecodeError as e:
            print(f"Warning: Failed to parse JSON response: {e}")
            return {
                "data": [],
                "user_defined": [],
                "disable_loop": []
            }
        except Exception as e:
            print(f"Warning: Error processing transcription: {e}")
            return {
                "data": [],
                "user_defined": [],
                "disable_loop": []
            }
        
        # Sort all arrays by timestamp
        result["data"].sort(key=lambda x: x.get("t", 0))
        result["user_defined"].sort(key=lambda x: x.get("t", 0))
        result["disable_loop"].sort(key=lambda x: x.get("t", 0))
        
        # Ensure the first area in data array always has timestamp 0ms
        if result["data"]:
            # Remove any existing 0ms entries (we'll set the first one to 0ms)
            result["data"] = [e for e in result["data"] if e.get("t", 0) != 0]
            # Re-sort after removing 0ms entries
            result["data"].sort(key=lambda x: x.get("t", 0))
            # Set the first (earliest) entry to 0ms
            if result["data"]:
                result["data"][0]["t"] = 0
        
        return result

