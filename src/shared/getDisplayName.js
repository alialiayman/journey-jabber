export const getDisplayName = (cities) => {
  if (!Array.isArray(cities) || cities.length === 0) return "";
  const neighborhood = cities.find((city) => city[1]["neighborhood"]);
  if (neighborhood) return neighborhood[0];
  return cities?.[0]?.[0];
};
