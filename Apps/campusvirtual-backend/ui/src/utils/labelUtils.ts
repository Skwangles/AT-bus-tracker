import { Label, LabelType } from '../types';

export function getLabelLongName(label: Label): string {
  if (label.type === LabelType.Elevator) {
    return label.label; // Elevator labels are already formatted
  }
  if (label.type === LabelType.Toilet) {
    return label.label; // Toilet labels are already formatted
  }
  if (label.parents.length > 0) {
    return `${label.parents.join(' - ')} - ${label.label}`;
  }
  return label.label;
}

export function getLabelDisplayName(label: Label): string {
  // Return the label as is, since it's already formatted on the backend
  return label.label;
}

export function getLabelIcon(label: Label): string {
  switch (label.type) {
    case LabelType.Elevator:
      return 'elevator';
    case LabelType.Toilet:
      return 'toilet';
    case LabelType.GroupName:
      return 'building';
    default:
      return ''; // No icon for normal rooms
  }
}

export function getLabelColor(label: Label): string {
  switch (label.type) {
    case LabelType.Elevator:
      return 'text-blue-600';
    case LabelType.Toilet:
      return 'text-green-600';
    case LabelType.GroupName:
      return 'text-gray-600';
    default:
      return 'text-gray-800';
  }
}