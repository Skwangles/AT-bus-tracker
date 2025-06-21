import { Label, LabelType } from '../types';

export function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}

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
  return toTitleCase(label.label);
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
      return 'primary.main'; // MUI primary color
    case LabelType.Toilet:
      return 'success.main'; // MUI success color
    case LabelType.GroupName:
      return 'text.secondary'; // MUI secondary text color
    default:
      return 'text.primary'; // MUI primary text color
  }
}