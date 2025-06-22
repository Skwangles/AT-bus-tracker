export const API_PREFIX = "";

export const FLOOR_ORDERING_STRATEGY = "tga"; // tga for <floor>.<room>  (or 'waikato' for <block>.<floor>.<room> stratgey)
export const COORDS_TO_METRES = 1; // metres per coordinate - the backend should apply their version automatically, but this is a manual adjustment

export const MOVE_SPEED = 10;
export const MOVE_FOV_CHECK = Math.PI / 4; // 45 degrees

export const SPHERE_SIZE = 0.15;
export const HOTSPOT_Y_ADJUSTMENT_DOWN_TO_FLOOR_LEVEL = 2;

export const showMap = true;
export const showList = true;
export const SHOW_NAV_SEARCH = true;
export const HIDE_EDGES = false;

// Usability fixes - WIP, do not use!
export const HIDE_POINTS_DURING_HIGHLIGHT = true;
export const HIDE_POINTS_ON_MAP_DURING_HIGHLIGHT = true;
export const USE_GLB_MARKER_OBJECT = false;

export const USE_ORANGE_PERSON = true;

export const MAP_LINE_WIDTH = 8;
export const MAP_LINE_COLOUR = "black";
export const MAP_LINE_HIGHLIGHT_COLOUR = "blue";

export const addQuotationMarks = false;
export const MAX_MAP_HEIGHT_PERCENT = 0.7;
export const PROJECT_NAME = 'Sitexplorer';

export const OUTDOORS_LOCATION = "outdoors";
export const WAIKATO_UNI_LEVELS_ORDER = [
  "Level B",
  "Level G",
  "Level 0",
  "Level 1",
  "Level 2",
  "Level 3",
  "Level 4",
];

export const STARTING_LOCATION_GROUP = "Level 1";

export const HOTSPOT_COLOUR = "#E1251B";
export const HOTSPOT_OUTLINE = "#FFFFFF";
export const HOTSPOT_HIGHLIGHTED = "#0F0FF0";
export const HOTSPOT_HOVERED = "#2196F3"; // MUI primary blue color for better selection indication

export const REPORT_PROBLEM_FORM_URL = 'https://forms.google.com/your-form-id';
