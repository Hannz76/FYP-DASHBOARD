export const ROLES = {
  admin: { label: "Penyelaras", group: "staff" },
  counselor: { label: "Penyelaras", group: "staff" },
  user: { label: "Pelajar", group: "student" },
};

export const getRoleLabel = (role) => ROLES[role]?.label ?? role;

export const isStaff = (role) => ROLES[role]?.group === "staff";
