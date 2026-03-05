// ── state.js ─────────────────────────────────────────────────
// Single source of truth. Exposes a getter/setter so all modules
// always read the same object without circular import issues.

let _state = { categories: [] };

export const getState  = ()          => _state;
export const updateState = newState  => { _state = newState; };

export const uid = () => crypto.randomUUID();

export const PRESET_CATEGORIES = [
  { name: "Electrical",          icon: "⚡", description: "Battery, inverter, solar, wiring" },
  { name: "Solar",               icon: "☀️", description: "Panels, charge controllers, mounts" },
  { name: "Plumbing",            icon: "🚿", description: "Water tank, pump, pipes, sink" },
  { name: "Insulation",          icon: "🧱", description: "Foam board, spray foam, vapour barrier" },
  { name: "Flooring",            icon: "🪵", description: "Subfloor, vinyl, wood, carpet" },
  { name: "Wall Cladding",       icon: "🪣", description: "Ply lining, tongue & groove, panelling" },
  { name: "Ceiling",             icon: "🏠", description: "Lining, lighting recesses, headlining" },
  { name: "Bed & Sleeping",      icon: "🛏️", description: "Bed frame, mattress, storage underneath" },
  { name: "Cabinetry",           icon: "🗄️", description: "Kitchen units, overhead storage, shelving" },
  { name: "Kitchen",             icon: "🍳", description: "Hob, sink, worktop, utensil storage" },
  { name: "Heating",             icon: "🔥", description: "Diesel heater, gas, underfloor heating" },
  { name: "Ventilation",         icon: "💨", description: "Roof fan, vents, condensation control" },
  { name: "Lighting",            icon: "💡", description: "LED strips, spotlights, switches" },
  { name: "Windows & Skylights", icon: "🪟", description: "Side windows, roof lights, blinds" },
  { name: "Doors",               icon: "🚪", description: "Barn doors, sliding, sliding mechanism" },
  { name: "Garage & Storage",    icon: "📦", description: "Rear garage, under-bed, racking" },
  { name: "Seating & Lounge",    icon: "🛋️", description: "Seat cushions, sofa conversion, table" },
  { name: "Exterior",            icon: "🚐", description: "Roof rack, awning, bodywork, paint" },
  { name: "Safety & Security",   icon: "🔒", description: "Locks, alarm, CO detector, fire ext." },
  { name: "Connectivity",        icon: "📡", description: "WiFi booster, mobile data, TV aerial" },
  { name: "Tools & Equipment",   icon: "🔧", description: "Build tools, fixings, adhesives" },
  { name: "Custom",              icon: "✏️", description: "Add your own category" },
];

// "Wall Cladding" → "wall-cladding"
export const categorySlug = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");