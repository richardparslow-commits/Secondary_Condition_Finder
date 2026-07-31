export const VALID_RATINGS = [
  "0%", "10%", "20%", "30%", "40%", "50%",
  "60%", "70%", "80%", "90%", "100%", "100% P&T"
] as const;

export type ValidRating = typeof VALID_RATINGS[number];
