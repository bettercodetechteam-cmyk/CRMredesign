/** ZICA / ZIMA centre office address — single source for receipts, messages, quotations, etc. */
export const ZICA_CENTRE_ADDRESS_LINES = [
  "C Tower, Office No. 701–706,",
  "Gera Imperium Gateway",
  "Near Nashik Phata Metro Station",
  "C.T.S. No. 2656 P, Nashik Phata Flyover",
  "Bhosari, Maharashtra – 411034",
] as const;

export const ZICA_CENTRE_ADDRESS = ZICA_CENTRE_ADDRESS_LINES.join("\n");

export const ZICA_CENTRE_ADDRESS_SINGLE_LINE = ZICA_CENTRE_ADDRESS_LINES.join(", ");
