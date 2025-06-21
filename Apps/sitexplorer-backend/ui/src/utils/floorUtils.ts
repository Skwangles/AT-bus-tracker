import { Label, LabelType } from '../types';

export function getFloorOrder(floorName: string): number {
  if (floorName === 'B') return -1;
  if (floorName === 'G') return 0;
  return parseInt(floorName);
}

export function groupLabelsByFloor(labels: Label[]) {
  const floorGroups: { [key: string]: Label[] } = {};

  // First, group by the first parent (which should be the floor)
  labels.forEach((label) => {
    if (label.type === LabelType.GroupName) {
      return; // Skip group labels
    }

    const floorName = label.parents[0]?.trim() || '';
    if (!floorName) return;

    if (!floorGroups[floorName]) {
      floorGroups[floorName] = [];
    }
    floorGroups[floorName].push(label);
  });

  // Convert to array and sort by floor order
  return Object.entries(floorGroups)
    .map(([name, items]) => ({
      name,
      order: getFloorOrder(name),
      items: {
        rooms: items.filter(item => item.type === LabelType.Normal),
        elevators: items.filter(item => item.type === LabelType.Elevator),
        toilets: items.filter(item => item.type === LabelType.Toilet)
      }
    }))
    .sort((a, b) => a.order - b.order);
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