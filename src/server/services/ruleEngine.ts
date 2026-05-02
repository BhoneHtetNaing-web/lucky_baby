export const rules = {
  maxPrice: 500000,
  minBalance: 0,
  blockedKeywords: ["war", "illegal", "restricted"],
};

export const validateFlight = (flight: any) => {
  if (!flight) return false;
  if (flight.price > rules.maxPrice) return false;
  return true;
};

export const validateUserAction = (text: string) => {
  return !rules.blockedKeywords.some((b) =>
    text.toLowerCase().includes(b)
  );
};