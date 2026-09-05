export const LOGO_SRC = "/final_logo.png";
export const BRAND_NAME = "Daawat Baker's";
export const BRAND_TAGLINE = "A Designer Bakery Studio";

/** Demo credentials for the admin panel (mock auth — UI branch). */
export const DEMO_ADMIN = {
  email: "admin@daawat.com",
  password: "admin123",
  name: "Rajeev Malhotra",
  role: "super_admin",
} as const;

export const DEMO_MANAGER = {
  email: "manager@daawat.com",
  password: "manager123",
  name: "Sunita Kapoor",
  role: "manager",
} as const;

export const DEMO_ACCOUNTS = [DEMO_ADMIN, DEMO_MANAGER] as const;
