# Grid Pruning Changes: Reference Redirection

## Overview
Modified the `_select_representatives` method in `grid_pruner.py` to select only the sharpest node per grid box instead of preserving all referenced nodes. All references in the `other_nodes` table are now redirected to the chosen representative.

## Key Changes

### 1. Modified `_select_representatives` Method
- **Before**: Preserved ALL referenced nodes + selected sharpest unreferenced node
- **After**: Selects ONLY the sharpest node per grid box (regardless of reference status)

### 2. Added `_redirect_references` Method
- Redirects all references in `other_nodes` table from removed nodes to their representatives
- Updates `ref_id` field to point to the chosen representative node

### 3. Updated Pruning Process
- Reference redirection now happens during pruning (not just during database save)
- Ensures references are properly maintained before nodes are deleted

## Example Scenario

```
Grid Box (0,0,0) contains:
- Node 1: sharpness=0.9, referenced=false  ← SELECTED (sharpest)
- Node 2: sharpness=0.7, referenced=true   ← REMOVED
- Node 3: sharpness=0.8, referenced=true   ← REMOVED

other_nodes table:
- ref_id=2, label="ref1"  → redirected to ref_id=1
- ref_id=3, label="ref2"  → redirected to ref_id=1
```

## Benefits
1. **Better Pruning**: More aggressive node reduction by not preserving all referenced nodes
2. **Maintained References**: All references are preserved by redirecting to representatives
3. **Sharpness-Based Selection**: Always selects the highest quality image per grid box
4. **Data Integrity**: No orphaned references after pruning

## Testing
- Created comprehensive test that verifies reference redirection works correctly
- Test confirms that references are properly updated to point to the sharpest representative node
