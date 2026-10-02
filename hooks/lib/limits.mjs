// Source-file size limits shared by the pre-write gate and the structure audit.
// SOFT warns (nudge to small files — token use + code-graph navigation, KIT-T087);
// HARD blocks (split the genuinely huge).
export const FILE_SOFT = 300;
export const FILE_HARD = 600;
