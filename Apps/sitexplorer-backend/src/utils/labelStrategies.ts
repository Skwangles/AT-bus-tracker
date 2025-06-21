import { LabelType } from '../types';

export interface LabelProcessingStrategy {
  processLabel(query: string, location?: string): {
    label: string;
    parents: string[];
    type: number;
  };
}

// Strategy for 3-part names (G.1.1)
export class ThreePartLabelStrategy implements LabelProcessingStrategy {
  processLabel(query: string, location?: string) {
    const type = this.determineType(query);
    let label = query;
    
    // Format special label types
    if (type === LabelType.Elevator) {
      const parts = query.split(',');
      if (parts.length >= 3) {
        const shaft = parts[1].trim();
        const description = parts[2].trim();
        label = `Elevator: ${description} (${shaft})`;
      }
    } else if (type === LabelType.Toilet) {
      const parts = query.split(',');
      if (parts.length >= 2) {
        const description = parts[1].trim();
        label = `Toilet: ${description}`;
      }
    }
  
    let parents: string[] = [];

      const locationParts = query.split('.');

      if (!location || location.length === 0) {
        parents = locationParts[0] ? [locationParts[0]] : [];
      } else if (locationParts.length >= 2) {
          parents = [locationParts[0], location]; // [building, <map group - likely floor>]
      } else if (location){
        parents = [location]; // Fallback if query doesn't have expected format
      }
    
    
    return {
      label,
      parents,
      type
    };
  }

  private determineType(label: string): number {
    const labelStr = label.toLowerCase().trim();
    
    if (labelStr.startsWith('!!elevator')) {
      return LabelType.Elevator;
    }
    if (labelStr.startsWith('!!toilet')) {
      return LabelType.Toilet;
    }
    return LabelType.Normal;
  }
}

// Strategy for 2-part names
export class TwoPartLabelStrategy implements LabelProcessingStrategy {
  processLabel(query: string, location?: string) {
    const type = this.determineType(query);
    let label = query;
    
    // Format special label types
    if (type === LabelType.Elevator) {
      const parts = query.split(',');
      if (parts.length >= 3) {
        const shaft = parts[1].trim();
        const description = parts[2].trim();
        label = `Elevator: ${description} (${shaft})`;
      }
    } else if (type === LabelType.Toilet) {
      const parts = query.split(',');
      if (parts.length >= 2) {
        const description = parts[1].trim();
        label = `Toilet: ${description}`;
      }
    }
    
    // Calculate parents from location only
    let parents: string[] = [];
    if (location) {
      parents.push(location);
    }
    
    return {
      label,
      parents,
      type
    };
  }

  private determineType(label: string): number {
    const labelStr = label.toLowerCase().trim();
    
    if (labelStr.startsWith('!!elevator')) {
      return LabelType.Elevator;
    }
    if (labelStr.startsWith('!!toilet')) {
      return LabelType.Toilet;
    }
    return LabelType.Normal;
  }
}

// Factory to create the appropriate strategy based on location format
export class LabelStrategyFactory {
  static createStrategy(locationFormat: string): LabelProcessingStrategy {
    const locationParts = locationFormat.split('.');
    return locationParts.length >= 2 ? new ThreePartLabelStrategy() : new TwoPartLabelStrategy();
  }
} 