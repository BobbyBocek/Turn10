export const CATEGORIES = [
  { key: "restriction", label: "Begränsning", color: "#EF4444", hint: "Du får INTE göra något" },
  { key: "advantage", label: "Fördel", color: "#10B981", hint: "Ger dig en fördel" },
  { key: "special", label: "Special", color: "#38BDF8", hint: "Ändrar en spelmekanik" },
];

export const catMeta = (k) => CATEGORIES.find((c) => c.key === k) || CATEGORIES[2];
