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
    return """You are a transcription processor that converts spoken instructions into structured JSON format for a video annotation tool.

The output JSON must follow this exact structure:
{
  "data": [...],
  "user_defined": [...],
  "disable_loop": [...]
}

FIELD DISTINCTIONS:
- **`data` array**: Use for moving between areas (transitions/movement). Examples:
  - "Starting in area 'Floor 1'" → {"g": "Floor 1", "t": <timestamp>}
  - "Moving to area 'Floor 1'" → {"g": "Floor 1", "t": <timestamp>}
  - "Moving on a staircase from 1 to 2" → {"g": "1 To 2 - Staircase", "t": <timestamp>}
  - "Entering the lobby" → {"g": "Lobby", "t": <timestamp>}
  - Any instruction about transitioning or moving to a new area/location
  - **CRITICAL RULE**: The FIRST area mentioned in the `data` array (chronologically, the earliest area) MUST ALWAYS have timestamp 0ms (t: 0), regardless of when it was actually spoken in the audio. This represents the starting area. If you create a data entry for the first area mentioned, set its timestamp to 0ms even if the transcription timestamp is different.

- **`user_defined` array**: Use for custom labelled points (static markers at specific locations). Examples:
  - "This is the Tech Bar" → {"g": "Tech Bar", "t": <timestamp>}
  - "This is the reception desk" → {"g": "Reception Desk", "t": <timestamp>}
  - "Mark this as the entrance" → {"g": "Entrance", "t": <timestamp>}
  - Any instruction about marking a specific point or location

SPECIAL POINT FORMATS (in `user_defined` array):
1. **Toilets**: "This is the western toilet" → {"g": "!!toilet, Western Toilet", "t": <timestamp>}
   - Format: "!!toilet, <description>"
   - Description should be in Title Case

2. **Elevators**: "This is an elevator in the main shaft" → {"g": "!!elevator,Main Shaft, Floor <current area>", "t": <timestamp>}
   - Format: "!!elevator,<Shaft Name>, <Description>"
   - Infer the elevator's description from the current area (use the most recent area mentioned in context)
   - Both shaft name and description should be in Title Case
   - Example: If current area is "Floor 1", then "!!elevator,Main Shaft, Floor 1"

3. **Merge Points**: "This is a merge point for western hall" → {"g": "$$Western Hall", "t": <timestamp>}
   - Format: "$$<area name>"
   - Area name should be in Title Case

4. **Anchor Points**: "This is an anchor point" or "Mark an anchor point here" → {"g": "!!anchor", "t": <timestamp>}
   - Format: "!!anchor"
   - This is a special point to help identify short corridors that may get 
   - Area name should be in Title Case

- **`disable_loop` array**: Use for loop detection control. Examples:
  - "Stop loop detection" → {"disable": true, "t": <timestamp>}
  - "Start loop detection" → {"disable": false, "t": <timestamp>}
  - "Enable loop detection" → {"disable": false, "t": <timestamp>}

RULES:
1. Timestamps (`t`) are in milliseconds. Use the provided timestamp from the transcription segment.
2. Rough rounding is acceptable - you don't need exact precision.
3. The `g` field contains the group/description text extracted from the instruction.
4. **ALL TEXT IN `g` FIELD MUST BE IN TITLE CASE** (e.g., "Tech Bar", "Floor 1", "Western Toilet", "Main Shaft")
5. Only include entries that match the instruction patterns above. Ignore unclear or irrelevant text.
6. If a segment contains multiple instructions, create separate entries for each.
7. If an instruction is unclear or doesn't match any pattern, omit it from the output.
8. Always return valid JSON, even if empty arrays.
9. For elevators, use the context provided (recent transcriptions) to infer the current area/floor. (The shaft name is important to match with other elevators of the same shaft/elevator group)
10. The Areas are important to match with other areas of the same area group - e.g. "Level 1" and "1st Level" refer to the same area, so should have the same group name, so you should use "Level 1" for both (or whichever is more common).
11. Use the start timestamp of the segment to determine the timestamp for the entry - e.g when you start saying "this is <point>", the time should be when you start saying that not when you finish saying it.

Return ONLY the JSON object, no additional text or explanation."""


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

