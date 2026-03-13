export const MILESTONE_TYPES = [
  'SIGNUP_DEADLINE',
  'GRAPHICS_DUE',
  'FOLDER_TO_REVIEWERS',
  'WRAP_UP',
] as const;

export type MilestoneType = (typeof MILESTONE_TYPES)[number];
