import axios from 'axios';
import { Label, LabelType } from '../types';
import { nullIdValue } from './updateUrl';
import { API_PREFIX } from '../consts';

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



export async function fetchLabelsData(setAllSearchableLocations: any, currentId: string, setCurrentId: any, updateHistory: any, currentLocationGroup: string) {
      try {
        // Fetch labels
        const labelsResult = await axios.get<Label[]>(`${API_PREFIX}/api/v1/locationgroup/labels`)
        setAllSearchableLocations(labelsResult.data)

        // If ID is -1, fetch first point ID from backend
        if (nullIdValue(currentId)) {
          const defaultIdResult = await axios.get(`${API_PREFIX}/api/v1/point/first`)
          const defaultId = defaultIdResult.data
          setCurrentId(defaultId)
          updateHistory(currentLocationGroup, 'Sitexplorer', defaultId)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }