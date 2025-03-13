export function getLabelLongName(group, label) {
  return group ? String(group).trim().toLowerCase() + ' - ' + String(label).trim().toLowerCase() : String(label).trim().toLowerCase()
}