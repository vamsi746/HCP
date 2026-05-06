/**
 * Formats a rank into a short prefix (e.g., INSPECTOR -> Insp.)
 */
export const rankPrefix = (rank) => {
  if (!rank) return "";
  const map = {
    COMMISSIONER: "CP",
    INSPECTOR: "Insp.",
    CI: "Insp.",
    SI: "SI",
    WSI: "WSI",
    PSI: "PSI",
    ASI: "ASI",
    HEAD_CONSTABLE: "HC",
    CONSTABLE: "Const.",
  };
  return map[rank] || rank;
};

/**
 * Returns the full designation label for a rank
 */
export const designationLabel = (rank) => {
  if (!rank) return "-";
  const map = {
    COMMISSIONER: "Commissioner of Police",
    INSPECTOR: "Inspector of Police",
    CI: "Inspector of Police",
    SI: "Sub-Inspector of Police",
    WSI: "Woman Sub-Inspector of Police",
    PSI: "Probationary Sub-Inspector of Police",
    ASI: "Assistant Sub-Inspector of Police",
    HEAD_CONSTABLE: "Head Constable",
    CONSTABLE: "Constable",
  };
  return map[rank] || rank;
};
