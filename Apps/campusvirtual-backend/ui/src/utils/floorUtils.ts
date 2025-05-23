import { Label, LabelType, FloorGroup } from '../types';

export function getFloorOrder(floorName: string): number {
  const name = floorName.toLowerCase().trim();
  if (name === 'b') return -1;
  if (name === 'g') return 0;
  const num = parseInt(name);
  return isNaN(num) ? 999 : num; // Put unknown floors at the end
}

export function groupLabelsByFloor(labels: Label[]): FloorGroup[] {
  const floorGroups: { [key: string]: FloorGroup } = {};

  // Initialize floor groups
  labels.forEach(label => {
    if (label.type === LabelType.Group) {
      const floorName = label.label.trim();
      if (!floorGroups[floorName]) {
        floorGroups[floorName] = {
          name: floorName,
          order: getFloorOrder(floorName),
          items: {
            rooms: [],
            elevators: [],
            toilets: []
          }
        };
      }
    }
  });

  // Sort labels into their respective groups
  labels.forEach(label => {
    if (label.type === LabelType.Group) return; // Skip group labels

    // Skip staircase labels
    if (label.label.toLowerCase().endsWith('- staircase')) {
      return;
    }

    const floorName = label.group?.trim() || '';
    if (floorGroups[floorName]) {
      switch (label.type) {
        case LabelType.Elevator: {
          // Try to match elevator to a floor group
          let targetFloor = floorName;
          let labelLower = label.label.toLowerCase().trim();

          // If label is 'Floor X', convert to 'Level X'
          const floorMatch = labelLower.match(/^floor (.+)$/);
          if (floorMatch) {
            targetFloor = `Level ${floorMatch[1].toUpperCase()}`;
          }

          // If label is 'Level X Elevator', strip ' Elevator'
          const levelElevatorMatch = labelLower.match(/^(level .+) elevator$/);
          if (levelElevatorMatch) {
            targetFloor = levelElevatorMatch[1]
              .split(' ')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
          }

          // If label is 'Floor G', convert to 'Level G'
          if (labelLower === 'floor g') {
            targetFloor = 'Level G';
          }

          if (floorGroups[targetFloor]) {
            floorGroups[targetFloor].items.elevators.push(label);
          }
          break;
        }
        case LabelType.Toilet:
          floorGroups[floorName].items.toilets.push(label);
          break;
        default:
          floorGroups[floorName].items.rooms.push(label);
      }
    }
  });

  // Convert to array and sort by floor order
  return Object.values(floorGroups).sort((a, b) => a.order - b.order);
}

export function parseSpecialLabel(label: string): { type: LabelType; description: string } | null {
    console.log('Parsing special label:', label);
  const labelStr = label.toLowerCase().trim();
  
  if (labelStr.startsWith('!!elevator')) {
    console.log('Elevator label detected:', label);
    const parts = labelStr.split('-');
    if (parts.length >= 2) {
      return {
        type: LabelType.Elevator,
        description: parts.slice(1).join('-').trim()
      };
    }
  }
  
  if (labelStr.startsWith('!!toilet')) {
    const parts = labelStr.split('-');
    if (parts.length >= 2) {
      return {
        type: LabelType.Toilet,
        description: parts.slice(1).join('-').trim()
      };
    }
  }
  
  return null;
} 