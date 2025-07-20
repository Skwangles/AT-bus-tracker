# Toolbar Features Documentation

## Overview

The Toolbar component in the FloorplanEditor now includes two tabs with comprehensive functionality for managing floorplan points and their connections.

## Tab 1: Transform

The Transform tab contains all the existing transformation operations for manipulating points on the floorplan.

### Scale Operations
- **Scale All Up/Down**: Scale all points by a factor of 1.1 or 0.909
- **Scale Selected Up/Down**: Scale only selected points

### X-Axis Scale
- **Scale X All Up/Down**: Scale all points horizontally
- **Scale X Selected Up/Down**: Scale selected points horizontally

### Y-Axis Scale
- **Scale Y All Up/Down**: Scale all points vertically
- **Scale Y Selected Up/Down**: Scale selected points vertically

### Rotation
- **Rotate All CW/CCW**: Rotate all points by 15 degrees
- **Rotate Selected CW/CCW**: Rotate selected points by 15 degrees

### Movement
- **Move All/Selected Left/Right/Up/Down**: Move points by 0.01 units relative to image size

### Flip Operations
- **Flip All/Selected H**: Flip points horizontally
- **Flip All/Selected V**: Flip points vertically

## Tab 2: Connect & Hide

The Connect & Hide tab provides functionality for managing point connections and visibility.

### Connect Points by ID
- **Point 1 ID**: Input field for the first point ID
- **Point 2 ID**: Input field for the second point ID
- **Connect Points**: Creates a connection between the two specified points
- **Disconnect Points**: Removes the connection between the two specified points

### Selected Points Operations
- **Connect Selected**: Connects the two currently selected points
- **Disconnect Selected**: Disconnects the two currently selected points
- **Hide Selected**: Hides all selected points from the map (removes from floorplan_points table)

### Selection Info
- Displays the number of currently selected points
- Shows the IDs of all selected points

## Usage Instructions

### Connecting Points
1. **By ID**: Enter the two point IDs in the input fields and click "Connect Points"
2. **By Selection**: Select exactly 2 points on the canvas and click "Connect Selected"

### Disconnecting Points
1. **By ID**: Enter the two point IDs in the input fields and click "Disconnect Points"
2. **By Selection**: Select exactly 2 points on the canvas and click "Disconnect Selected"

### Hiding Points
1. Select one or more points on the canvas
2. Click "Hide Selected" to remove them from the map
3. Confirm the action when prompted

### Point Selection
- **Single Click**: Select a single point
- **Ctrl+Click**: Add/remove points from selection
- **Shift+Click**: Select a path between two points
- **Drag Selection**: Click and drag to create a selection box

## API Endpoints Used

### Connect/Disconnect Points
- `POST /api/v1/authoring/point/{id1}/connect/{id2}` - Connect two points
- `DELETE /api/v1/authoring/point/{id1}/connect/{id2}` - Disconnect two points

### Hide Points
- `DELETE /api/v1/maps/{floorplan}/points` - Hide points from map

## Error Handling

The toolbar includes comprehensive error handling for:
- Invalid point IDs (non-numeric values)
- Points not on the same level
- Points already connected/disconnected
- Network errors
- Server errors

All errors are displayed to the user via alert dialogs with descriptive messages.

## Technical Notes

- All operations are performed asynchronously with loading states
- The floorplan data is automatically refreshed after successful operations
- Input fields are disabled during loading operations
- Buttons are disabled when their prerequisites are not met (e.g., no selection, wrong number of selected points)
- The component follows British English spelling conventions
- All TypeScript types are properly defined with no `any` types 