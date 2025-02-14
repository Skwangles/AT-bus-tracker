## Example

python strip_restricted_nodes.py input.db output.db --remove='["floor1", "floor2"]' --keep_id='[15, 16, 17]' --keep_labels='["reserved"]'

## Notes:

The --remove, --keep_id, and --keep_labels arguments are expected to be provided in valid JSON format (e.g., lists).
The script assumes the tables refined_nodes, refined_node_locations, and refined_special_labels exist with the expected structure (e.g., refined_node_locations containing a location column and refined_special_labels containing a label column).

## Installation

All libs are pre-installed, so no need to make an environment or pip install
