import {
  Banknote,
  Bell,
  CalendarCheck,
  ChefHat,
  Cog,
  MessageSquare,
  Package,
  ShoppingCart,
  UserCog,
  Wallet,
  XCircle,
} from "lucide-react";
import type { AdminNotificationType } from "@/lib/api/types";

export function typeIcon(type: AdminNotificationType) {
  switch (type) {
    case "order_new":
      return ChefHat;
    case "order_cancelled":
      return XCircle;
    case "counter_payment":
      return Banknote;
    case "hall_enquiry":
      return MessageSquare;
    case "hall_booking":
      return CalendarCheck;
    case "stock":
      return Package;
    case "purchase":
      return ShoppingCart;
    case "account":
      return UserCog;
    case "wallet":
      return Wallet;
    case "system":
      return Cog;
    default:
      return Bell;
  }
}
