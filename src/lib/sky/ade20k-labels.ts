/**
 * ADE20K id → label for nvidia/segformer-b0-finetuned-ade-512-512.
 * Sky is class id 2.
 */
export const ADE20K_SKY_CLASS_ID = 2;

export const ADE20K_ID2LABEL: Record<number, string> = {
  0: "wall",
  1: "building",
  2: "sky",
  3: "floor",
  4: "tree",
  5: "ceiling",
  6: "road",
  7: "bed",
  8: "windowpane",
  9: "grass",
  10: "cabinet",
  11: "sidewalk",
  12: "person",
  13: "earth",
  14: "door",
  15: "table",
  16: "mountain",
  17: "plant",
  18: "curtain",
  19: "chair",
  20: "car",
  21: "water",
  22: "painting",
  23: "sofa",
  24: "shelf",
  25: "house",
  26: "sea",
  27: "mirror",
  28: "rug",
  29: "field",
  30: "armchair",
  31: "seat",
  32: "fence",
  33: "desk",
  34: "rock",
  35: "wardrobe",
  36: "lamp",
  37: "bathtub",
  38: "railing",
  39: "cushion",
  40: "base",
  41: "box",
  42: "column",
  43: "signboard",
  44: "chest of drawers",
  45: "counter",
  46: "sand",
  47: "sink",
  48: "skyscraper",
  49: "fireplace",
  50: "refrigerator",
  51: "grandstand",
  52: "path",
  53: "stairs",
  54: "runway",
  55: "case",
  56: "pool table",
  57: "pillow",
  58: "screen door",
  59: "stairway",
  60: "river",
  61: "bridge",
  62: "bookcase",
  63: "blind",
  64: "coffee table",
  65: "toilet",
  66: "flower",
  67: "book",
  68: "hill",
  69: "bench",
  70: "countertop",
  71: "stove",
  72: "palm",
  73: "kitchen island",
  74: "computer",
  75: "swivel chair",
  76: "boat",
  77: "bar",
  78: "arcade machine",
  79: "hovel",
  80: "bus",
  81: "towel",
  82: "light",
  83: "truck",
  84: "tower",
  85: "chandelier",
  86: "awning",
  87: "streetlight",
  88: "booth",
  89: "television receiver",
  90: "airplane",
  91: "dirt track",
  92: "apparel",
  93: "pole",
  94: "land",
  95: "bannister",
  96: "escalator",
  97: "ottoman",
  98: "bottle",
  99: "buffet",
  100: "poster",
  101: "stage",
  102: "van",
  103: "ship",
  104: "fountain",
  105: "conveyer belt",
  106: "canopy",
  107: "washer",
  108: "plaything",
  109: "swimming pool",
  110: "stool",
  111: "barrel",
  112: "basket",
  113: "waterfall",
  114: "tent",
  115: "bag",
  116: "minibike",
  117: "cradle",
  118: "oven",
  119: "ball",
  120: "food",
  121: "step",
  122: "tank",
  123: "trade name",
  124: "microwave",
  125: "pot",
  126: "animal",
  127: "bicycle",
  128: "lake",
  129: "dishwasher",
  130: "screen",
  131: "blanket",
  132: "sculpture",
  133: "hood",
  134: "sconce",
  135: "vase",
  136: "traffic light",
  137: "tray",
  138: "ashcan",
  139: "fan",
  140: "pier",
  141: "crt screen",
  142: "plate",
  143: "person",
  144: "bulletin board",
  145: "shower",
  146: "radiator",
  147: "glass",
  148: "clock",
  149: "flag",
};

export const adeLabelName = (classId: number): string =>
  ADE20K_ID2LABEL[classId] ?? `class ${classId}`;

export type AdeClassStat = {
  id: number;
  name: string;
  rgb: [number, number, number];
  pixels: number;
  pct: number;
};

/** Histogram of ADE20K classes in a class map, sorted by pixel count desc. */
export const summarizeClassMap = (
  classMap: Uint16Array,
  limit = 12,
): AdeClassStat[] => {
  const counts = new Map<number, number>();
  for (let i = 0; i < classMap.length; i++) {
    const id = classMap[i];
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const total = classMap.length || 1;
  return [...counts.entries()]
    .map(([id, pixels]) => ({
      id,
      name: adeLabelName(id),
      rgb: classIdToRgb(id),
      pixels,
      pct: (100 * pixels) / total,
    }))
    .toSorted((a, b) => b.pixels - a.pixels)
    .slice(0, limit);
};

/** Deterministic RGB for a class id (sky forced to cyan for readability). */
export const classIdToRgb = (classId: number): [number, number, number] => {
  if (classId === ADE20K_SKY_CLASS_ID) return [56, 189, 248];
  const hue = ((classId * 47) % 360) / 360;
  const sat = 0.55 + ((classId * 13) % 30) / 100;
  const light = 0.42 + ((classId * 17) % 25) / 100;
  return hslToRgb(hue, sat, light);
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  if (s === 0) {
    const g = Math.round(l * 255);
    return [g, g, g];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h + 1 / 3);
  const g = hueToRgb(p, q, h);
  const b = hueToRgb(p, q, h - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

const hueToRgb = (p: number, q: number, t: number): number => {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
};
