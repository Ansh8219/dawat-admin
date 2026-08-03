// Mock data for Daawat Baker's admin panel

export const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const branches = [
  { id: "bakery", label: "Bakery", gst: "07AABCU9603R1Z1" },
  { id: "restaurant", label: "Restaurant", gst: "07AABCU9603R1Z2" },
  { id: "banquet", label: "Banquet Hall", gst: "07AABCU9603R1Z3" },
] as const;

export type Branch = (typeof branches)[number]["id"];

export const salesDaily = [
  { day: "Mon", value: 42300 }, { day: "Tue", value: 38200 },
  { day: "Wed", value: 51200 }, { day: "Thu", value: 47800 },
  { day: "Fri", value: 68900 }, { day: "Sat", value: 82100 },
  { day: "Sun", value: 74200 },
];

export const salesMonthly = Array.from({ length: 12 }).map((_, i) => ({
  day: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  value: 800000 + Math.round(Math.random() * 500000),
}));

export const channelSplit = [
  { name: "Dine-In", value: 42, color: "var(--color-chart-1)" },
  { name: "Takeaway", value: 22, color: "var(--color-chart-2)" },
  { name: "Delivery", value: 24, color: "var(--color-chart-3)" },
  { name: "Online", value: 12, color: "var(--color-chart-4)" },
];

export const kpiSpark = [12, 18, 14, 22, 19, 28, 24, 32, 30, 38, 35, 44];
export const kpiSpark2 = [30, 28, 34, 26, 36, 32, 40, 38, 42, 45, 48, 52];
export const kpiSpark3 = [22, 24, 20, 26, 30, 28, 32, 30, 34, 36, 38, 40];
export const kpiSpark4 = [8, 10, 12, 11, 14, 13, 16, 18, 20, 22, 24, 28];

export type OrderStatus = "Pending" | "Preparing" | "Ready" | "Out for Delivery" | "Completed" | "Cancelled";
export type Channel = "Dine-In" | "Takeaway" | "Delivery" | "Online" | "Zomato";
export type PayMode = "UPI" | "Cash" | "Card" | "NetBanking" | "COD";

export interface Order {
  id: string;
  customer: string;
  channel: Channel;
  branch: Branch;
  items: { name: string; qty: number; price: number; code: number }[];
  amount: number;
  pay: PayMode;
  status: OrderStatus;
  time: string;
  address?: string;
  phone: string;
}

const customerNames = [
  "Aarav Sharma", "Priya Kapoor", "Rohan Mehta", "Ananya Iyer",
  "Vikram Singh", "Neha Reddy", "Aditya Verma", "Kavya Nair",
  "Arjun Malhotra", "Isha Choudhary", "Rahul Bhatia", "Meera Joshi",
];

export const menuItems = [
  { code: 22, name: "Daal Makhni",         cat: "Main Course",  price: 320, unit: "plate",   veg: true,  branch: "restaurant" as Branch },
  { code: 67, name: "Butter Chapati",      cat: "Breads",       price: 45,  unit: "pcs",     veg: true,  branch: "restaurant" as Branch },
  { code: 14, name: "Paneer Tikka Masala", cat: "Main Course",  price: 380, unit: "plate",   veg: true,  branch: "restaurant" as Branch },
  { code: 31, name: "Chicken Biryani",     cat: "Rice",         price: 420, unit: "plate",   veg: false, branch: "restaurant" as Branch },
  { code: 8,  name: "Garlic Naan",         cat: "Breads",       price: 80,  unit: "pcs",     veg: true,  branch: "restaurant" as Branch },
  { code: 45, name: "Veg Hakka Noodles",   cat: "Chinese",      price: 260, unit: "plate",   veg: true,  branch: "restaurant" as Branch },
  { code: 51, name: "Chocolate Truffle Cake", cat: "Cakes",     price: 890, unit: "kg",      veg: true,  branch: "bakery" as Branch },
  { code: 52, name: "Red Velvet Pastry",   cat: "Pastries",     price: 120, unit: "pcs",     veg: true,  branch: "bakery" as Branch },
  { code: 53, name: "Almond Croissant",    cat: "Breads",       price: 90,  unit: "pcs",     veg: true,  branch: "bakery" as Branch },
  { code: 54, name: "Blueberry Cheesecake", cat: "Cakes",       price: 1250, unit: "kg",     veg: true,  branch: "bakery" as Branch },
  { code: 55, name: "Sourdough Loaf",      cat: "Breads",       price: 220, unit: "pcs",     veg: true,  branch: "bakery" as Branch },
  { code: 56, name: "Macaron Box (6)",     cat: "Confectionery", price: 480, unit: "box",    veg: true,  branch: "bakery" as Branch },
  { code: 71, name: "Masala Chai",         cat: "Beverages",    price: 40,  unit: "cup",     veg: true,  branch: "restaurant" as Branch },
  { code: 72, name: "Cold Coffee",         cat: "Beverages",    price: 160, unit: "glass",   veg: true,  branch: "bakery" as Branch },
  { code: 81, name: "Gulab Jamun",         cat: "Desserts",     price: 90,  unit: "pcs",     veg: true,  branch: "restaurant" as Branch },
  { code: 82, name: "Rasmalai",            cat: "Desserts",     price: 140, unit: "pcs",     veg: true,  branch: "restaurant" as Branch },
];

export const categories = Array.from(new Set(menuItems.map(m => m.cat)));

/** Deterministic static orders so New / Preparing / Ready always have kitchen-board content. */
export const orders: Order[] = [
  // —— Restaurant: New (Pending) ——
  {
    id: "DB-2101",
    customer: "Aarav Sharma",
    channel: "Zomato",
    branch: "restaurant",
    items: [
      { name: "Butter Chapati", qty: 4, price: 45, code: 67 },
      { name: "Daal Makhni", qty: 1, price: 320, code: 22 },
      { name: "Paneer Tikka Masala", qty: 1, price: 380, code: 14 },
    ],
    amount: 880,
    pay: "UPI",
    status: "Pending",
    time: "1:12 PM",
    address: "214 MG Road, Sector 14, Gurugram",
    phone: "+91 9812340101",
  },
  {
    id: "DB-2102",
    customer: "Priya Kapoor",
    channel: "Delivery",
    branch: "restaurant",
    items: [
      { name: "Chicken Biryani", qty: 2, price: 420, code: 31 },
      { name: "Garlic Naan", qty: 2, price: 80, code: 8 },
    ],
    amount: 1000,
    pay: "COD",
    status: "Pending",
    time: "1:18 PM",
    address: "88 Cyber Hub, DLF Phase 2, Gurugram",
    phone: "+91 9823450202",
  },
  {
    id: "DB-2103",
    customer: "Rohan Mehta",
    channel: "Takeaway",
    branch: "restaurant",
    items: [
      { name: "Veg Hakka Noodles", qty: 1, price: 260, code: 45 },
      { name: "Masala Chai", qty: 2, price: 40, code: 71 },
    ],
    amount: 340,
    pay: "Cash",
    status: "Pending",
    time: "1:21 PM",
    phone: "+91 9834560303",
  },
  {
    id: "DB-2104",
    customer: "Ananya Iyer",
    channel: "Dine-In",
    branch: "restaurant",
    items: [
      { name: "Paneer Tikka Masala", qty: 1, price: 380, code: 14 },
      { name: "Garlic Naan", qty: 3, price: 80, code: 8 },
      { name: "Gulab Jamun", qty: 2, price: 90, code: 81 },
    ],
    amount: 800,
    pay: "Card",
    status: "Pending",
    time: "1:24 PM",
    phone: "+91 9845670404",
  },
  {
    id: "DB-2105",
    customer: "Neha Reddy",
    channel: "Online",
    branch: "restaurant",
    items: [
      { name: "Daal Makhni", qty: 2, price: 320, code: 22 },
      { name: "Butter Chapati", qty: 6, price: 45, code: 67 },
      { name: "Rasmalai", qty: 2, price: 140, code: 82 },
    ],
    amount: 1210,
    pay: "UPI",
    status: "Pending",
    time: "1:27 PM",
    address: "12 Golf Course Road, Sector 42, Gurugram",
    phone: "+91 9856780505",
  },
  // —— Restaurant: Preparing ——
  {
    id: "DB-2088",
    customer: "Vikram Singh",
    channel: "Zomato",
    branch: "restaurant",
    items: [
      { name: "Chicken Biryani", qty: 1, price: 420, code: 31 },
      { name: "Masala Chai", qty: 1, price: 40, code: 71 },
    ],
    amount: 460,
    pay: "UPI",
    status: "Preparing",
    time: "12:58 PM",
    address: "55 Sohna Road, Sector 48, Gurugram",
    phone: "+91 9867890606",
  },
  {
    id: "DB-2089",
    customer: "Aditya Verma",
    channel: "Delivery",
    branch: "restaurant",
    items: [
      { name: "Daal Makhni", qty: 1, price: 320, code: 22 },
      { name: "Butter Chapati", qty: 4, price: 45, code: 67 },
      { name: "Garlic Naan", qty: 2, price: 80, code: 8 },
    ],
    amount: 660,
    pay: "Card",
    status: "Preparing",
    time: "1:02 PM",
    address: "9 Palam Vihar, Gurugram",
    phone: "+91 9878900707",
  },
  {
    id: "DB-2090",
    customer: "Kavya Nair",
    channel: "Dine-In",
    branch: "restaurant",
    items: [
      { name: "Veg Hakka Noodles", qty: 2, price: 260, code: 45 },
      { name: "Cold Coffee", qty: 2, price: 160, code: 72 },
    ],
    amount: 840,
    pay: "UPI",
    status: "Preparing",
    time: "1:05 PM",
    phone: "+91 9889010808",
  },
  // —— Restaurant: Ready ——
  {
    id: "DB-2071",
    customer: "Arjun Malhotra",
    channel: "Zomato",
    branch: "restaurant",
    items: [
      { name: "Paneer Tikka Masala", qty: 1, price: 380, code: 14 },
      { name: "Butter Chapati", qty: 3, price: 45, code: 67 },
    ],
    amount: 515,
    pay: "UPI",
    status: "Ready",
    time: "12:40 PM",
    address: "301 Nirvana Country, Gurugram",
    phone: "+91 9890120909",
  },
  {
    id: "DB-2072",
    customer: "Isha Choudhary",
    channel: "Takeaway",
    branch: "restaurant",
    items: [
      { name: "Chicken Biryani", qty: 1, price: 420, code: 31 },
      { name: "Gulab Jamun", qty: 2, price: 90, code: 81 },
    ],
    amount: 600,
    pay: "Cash",
    status: "Ready",
    time: "12:45 PM",
    phone: "+91 9901231010",
  },
  // —— Restaurant: Completed / Cancelled ——
  {
    id: "DB-2050",
    customer: "Rahul Bhatia",
    channel: "Online",
    branch: "restaurant",
    items: [
      { name: "Daal Makhni", qty: 1, price: 320, code: 22 },
      { name: "Garlic Naan", qty: 2, price: 80, code: 8 },
    ],
    amount: 480,
    pay: "NetBanking",
    status: "Completed",
    time: "11:55 AM",
    address: "77 Sector 29, Gurugram",
    phone: "+91 9912341111",
  },
  {
    id: "DB-2051",
    customer: "Meera Joshi",
    channel: "Zomato",
    branch: "restaurant",
    items: [{ name: "Veg Hakka Noodles", qty: 1, price: 260, code: 45 }],
    amount: 260,
    pay: "UPI",
    status: "Cancelled",
    time: "12:10 PM",
    address: "18 Galleria Market, Gurugram",
    phone: "+91 9923451212",
  },
  {
    id: "DB-2052",
    customer: "Aarav Sharma",
    channel: "Delivery",
    branch: "restaurant",
    items: [
      { name: "Butter Chapati", qty: 8, price: 45, code: 67 },
      { name: "Daal Makhni", qty: 2, price: 320, code: 22 },
    ],
    amount: 1000,
    pay: "COD",
    status: "Out for Delivery",
    time: "12:30 PM",
    address: "42 Sector 56, Gurugram",
    phone: "+91 9934561313",
  },
  // —— Bakery: New (Pending) ——
  {
    id: "DB-3101",
    customer: "Priya Kapoor",
    channel: "Online",
    branch: "bakery",
    items: [
      { name: "Chocolate Truffle Cake", qty: 1, price: 890, code: 51 },
      { name: "Macaron Box (6)", qty: 1, price: 480, code: 56 },
    ],
    amount: 1370,
    pay: "UPI",
    status: "Pending",
    time: "1:15 PM",
    address: "5 Ambience Mall, Gurugram",
    phone: "+91 9945671414",
  },
  {
    id: "DB-3102",
    customer: "Rohan Mehta",
    channel: "Takeaway",
    branch: "bakery",
    items: [
      { name: "Almond Croissant", qty: 4, price: 90, code: 53 },
      { name: "Cold Coffee", qty: 2, price: 160, code: 72 },
    ],
    amount: 680,
    pay: "Cash",
    status: "Pending",
    time: "1:20 PM",
    phone: "+91 9956781515",
  },
  {
    id: "DB-3103",
    customer: "Ananya Iyer",
    channel: "Delivery",
    branch: "bakery",
    items: [
      { name: "Red Velvet Pastry", qty: 6, price: 120, code: 52 },
      { name: "Sourdough Loaf", qty: 1, price: 220, code: 55 },
    ],
    amount: 940,
    pay: "Card",
    status: "Pending",
    time: "1:26 PM",
    address: "120 Sector 15, Gurugram",
    phone: "+91 9967891616",
  },
  {
    id: "DB-3080",
    customer: "Vikram Singh",
    channel: "Online",
    branch: "bakery",
    items: [{ name: "Blueberry Cheesecake", qty: 1, price: 1250, code: 54 }],
    amount: 1250,
    pay: "UPI",
    status: "Preparing",
    time: "12:50 PM",
    address: "66 DLF Phase 1, Gurugram",
    phone: "+91 9978901717",
  },
  {
    id: "DB-3060",
    customer: "Neha Reddy",
    channel: "Takeaway",
    branch: "bakery",
    items: [
      { name: "Macaron Box (6)", qty: 2, price: 480, code: 56 },
      { name: "Almond Croissant", qty: 2, price: 90, code: 53 },
    ],
    amount: 1140,
    pay: "UPI",
    status: "Ready",
    time: "12:35 PM",
    phone: "+91 9989011818",
  },
  {
    id: "DB-3040",
    customer: "Aditya Verma",
    channel: "Delivery",
    branch: "bakery",
    items: [{ name: "Chocolate Truffle Cake", qty: 1, price: 890, code: 51 }],
    amount: 890,
    pay: "COD",
    status: "Completed",
    time: "11:40 AM",
    address: "3 HUDA City Centre, Gurugram",
    phone: "+91 9990121919",
  },
];

export const inventory = [
  { name: "Wheat Flour",      cat: "Bakery",     unit: "Kg",     opening: 200, current: 42,   reorder: 50 },
  { name: "Refined Flour (Maida)", cat: "Bakery", unit: "Kg",   opening: 180, current: 12,   reorder: 40 },
  { name: "Butter (Unsalted)", cat: "Bakery",    unit: "Kg",     opening: 60,  current: 28,   reorder: 20 },
  { name: "Sugar",             cat: "Bakery",    unit: "Kg",     opening: 100, current: 68,   reorder: 30 },
  { name: "Cocoa Powder",      cat: "Bakery",    unit: "Kg",     opening: 25,  current: 4,    reorder: 8 },
  { name: "Fresh Cream",       cat: "Bakery",    unit: "Litre",  opening: 40,  current: 22,   reorder: 15 },
  { name: "Basmati Rice",      cat: "Restaurant",unit: "Kg",     opening: 150, current: 88,   reorder: 40 },
  { name: "Paneer",            cat: "Restaurant",unit: "Kg",     opening: 30,  current: 6,    reorder: 10 },
  { name: "Chicken",           cat: "Restaurant",unit: "Kg",     opening: 40,  current: 18,   reorder: 12 },
  { name: "Onions",            cat: "Restaurant",unit: "Kg",     opening: 80,  current: 34,   reorder: 25 },
  { name: "Tomatoes",          cat: "Restaurant",unit: "Kg",     opening: 60,  current: 22,   reorder: 20 },
  { name: "Milk",              cat: "Restaurant",unit: "Litre",  opening: 80,  current: 44,   reorder: 25 },
  { name: "Ghee",              cat: "Restaurant",unit: "Litre",  opening: 25,  current: 9,    reorder: 8 },
  { name: "Cardamom",          cat: "Restaurant",unit: "Gram",   opening: 2000,current: 340,  reorder: 500 },
];

export const customers = Array.from({ length: 18 }).map((_, i) => {
  const tiers = ["Silver", "Gold", "Platinum"] as const;
  const totalOrders = 3 + Math.floor(Math.random() * 60);
  const ltv = totalOrders * (400 + Math.floor(Math.random() * 800));
  return {
    id: "CUST-" + String(1001 + i),
    name: customerNames[i % customerNames.length],
    phone: `+91 98${String(20000000 + i * 4321).slice(0,8)}`,
    email: customerNames[i % customerNames.length].toLowerCase().replace(" ", ".") + "@gmail.com",
    orders: totalOrders,
    ltv,
    tier: tiers[Math.min(2, Math.floor(ltv / 15000))],
    points: 200 + Math.floor(Math.random() * 2400),
    lastOrder: `${Math.floor(Math.random()*28)+1} Jun 2026`,
    birthday: `${Math.floor(Math.random()*28)+1} ${["Mar","Apr","May","Jul","Aug","Nov"][i%6]}`,
  };
});

export const drivers = Array.from({ length: 8 }).map((_, i) => ({
  id: "DRV-" + (101 + i),
  name: ["Ramesh Kumar","Suresh Yadav","Vinod Singh","Mahesh Gupta","Deepak Jha","Anil Sharma","Sanjay Mishra","Manoj Rai"][i],
  phone: `+91 90${String(10000000 + i * 3210).slice(0,8)}`,
  status: (["Online","On Delivery","Offline","Online","On Delivery","Online","Offline","On Delivery"] as const)[i],
  deliveries: 4 + Math.floor(Math.random() * 12),
  earnings: 800 + Math.floor(Math.random() * 2200),
  rating: (4 + Math.random()).toFixed(1),
}));

export const staff = [
  { id: "S-01", name: "Rajeev Malhotra", role: "Admin",       branch: "All",         status: "Active",  lastLogin: "2 min ago" },
  { id: "S-02", name: "Sunita Kapoor",   role: "Manager",     branch: "Bakery",      status: "Active",  lastLogin: "1 hour ago" },
  { id: "S-03", name: "Deepak Verma",    role: "Manager",     branch: "Restaurant",  status: "Active",  lastLogin: "24 min ago" },
  { id: "S-04", name: "Pooja Singh",     role: "Store Keeper",branch: "Bakery",      status: "Active",  lastLogin: "3 hours ago" },
  { id: "S-05", name: "Nikhil Rao",      role: "Store Keeper",branch: "Restaurant",  status: "Pending", lastLogin: "—" },
  { id: "S-06", name: "Ritika Sharma",   role: "Cashier",     branch: "Restaurant",  status: "Active",  lastLogin: "5 min ago" },
  { id: "S-07", name: "Mahesh Gupta",    role: "Driver",      branch: "Restaurant",  status: "Active",  lastLogin: "12 min ago" },
  { id: "S-08", name: "Farhan Ali",      role: "Chef",        branch: "Restaurant",  status: "Pending", lastLogin: "—" },
];

export const roles = ["Admin","Manager","Store Keeper","Cashier","Driver","Chef"];
export const modules = ["Dashboard","Orders","POS","Menu","Inventory","Bookings","Customers","Marketing","Drivers","Staff","Finance","Reports","Settings"];

export const offers = [
  { code: "WELCOME20",    type: "Percentage", value: 20, expiry: "31 Aug 2026", used: 142, active: true,  audience: "New Customers" },
  { code: "BAKERY100",    type: "Flat",       value: 100, expiry: "15 Jul 2026", used: 89,  active: true,  audience: "All" },
  { code: "BOGO-CAKE",    type: "BOGO",       value: 1,   expiry: "20 Jul 2026", used: 34,  active: true,  audience: "Gold+" },
  { code: "COMBO499",     type: "Combo",      value: 499, expiry: "10 Aug 2026", used: 210, active: true,  audience: "All" },
  { code: "DIWALI25",     type: "Percentage", value: 25,  expiry: "05 Nov 2026", used: 0,   active: false, audience: "All" },
  { code: "PLATINUM15",   type: "Percentage", value: 15,  expiry: "31 Dec 2026", used: 56,  active: true,  audience: "Platinum" },
];

export const notifications = [
  { id: 1, type: "inventory", title: "Cocoa Powder is critically low", body: "4 Kg remaining · Reorder level 8 Kg", time: "10 min ago", priority: "high",   read: false, group: "Today" },
  { id: 2, type: "booking",   title: "New banquet booking request",    body: "Anniversary — 180 guests · 24 Jul", time: "42 min ago",  priority: "medium", read: false, group: "Today" },
  { id: 3, type: "staff",     title: "Nikhil Rao awaiting approval",   body: "Store Keeper · Restaurant branch",    time: "2 hours ago", priority: "medium", read: false, group: "Today" },
  { id: 4, type: "order",     title: "Order DB-1198 delivery delayed", body: "Driver stuck in traffic · +18 min",   time: "3 hours ago", priority: "high",   read: true,  group: "Today" },
  { id: 5, type: "campaign",  title: "Diwali WhatsApp campaign sent",  body: "Delivered to 2,340 · 61% open",       time: "Yesterday",   priority: "low",    read: true,  group: "Earlier" },
  { id: 6, type: "inventory", title: "Paneer low stock",               body: "6 Kg remaining",                       time: "Yesterday",   priority: "medium", read: true,  group: "Earlier" },
];

export const tables = Array.from({ length: 18 }).map((_, i) => {
  const states = ["Available","Occupied","Reserved","Available","Available","Occupied"] as const;
  return {
    id: "T" + String(i + 1).padStart(2, "0"),
    seats: [2, 4, 4, 6, 8][i % 5],
    status: states[i % states.length],
    orderId: i % 6 === 1 ? "DB-" + (1100 + i) : undefined,
    amount: i % 6 === 1 ? 800 + i * 40 : undefined,
  };
});

export const banquetEvents = [
  { date: 12, title: "Sharma Wedding Reception", guests: 350, pkg: "Royal Gold",   advance: 25, total: 480000 },
  { date: 15, title: "Kapoor Anniversary",       guests: 120, pkg: "Silver Bloom", advance: 50, total: 210000 },
  { date: 18, title: "Corporate — Infosys",      guests: 200, pkg: "Executive",    advance: 75, total: 340000 },
  { date: 24, title: "Iyer Engagement",          guests: 180, pkg: "Royal Gold",   advance: 25, total: 320000 },
  { date: 27, title: "Birthday — Aarav (5)",     guests: 60,  pkg: "Silver Bloom", advance: 100,total: 95000  },
];

export const decorationPackages = [
  { name: "Silver Bloom", price: 45000, features: ["Fresh floral arch", "Basic lighting", "Cloth mandap"] },
  { name: "Royal Gold",   price: 95000, features: ["Premium floral", "LED chandeliers", "Gold mandap", "Photo booth"] },
  { name: "Executive",    price: 65000, features: ["Corporate stage", "AV setup", "Branded backdrops"] },
];

export const expenses = [
  { date: "07 Jul", head: "Vegetables (Wholesale)", vendor: "Azadpur Mandi",   amount: 8400, mode: "Cash" },
  { date: "07 Jul", head: "LPG Refill",             vendor: "Indane",          amount: 1650, mode: "UPI"  },
  { date: "06 Jul", head: "Bakery Ingredients",     vendor: "Modern Bakers",   amount: 22400,mode: "Bank" },
  { date: "06 Jul", head: "Electricity Bill",       vendor: "BSES",            amount: 18900,mode: "Bank" },
  { date: "05 Jul", head: "Staff Salary Advance",   vendor: "Ritika Sharma",   amount: 5000, mode: "Cash" },
];

export const vendorPayments = [
  { vendor: "Modern Bakers",  due: 42000, dueOn: "12 Jul", status: "Upcoming" },
  { vendor: "Azadpur Mandi",  due: 18400, dueOn: "09 Jul", status: "Overdue"  },
  { vendor: "Amul Dairy",     due: 24500, dueOn: "15 Jul", status: "Upcoming" },
  { vendor: "Reliance Fresh", due: 0,     dueOn: "—",      status: "Paid"     },
];
