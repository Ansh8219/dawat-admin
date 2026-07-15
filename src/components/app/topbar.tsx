import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Search, Menu, Moon, Sun, ChevronDown, LogOut, UserCircle, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { branches, notifications } from "@/lib/mock/data";
import { StatusBadge } from "./status-badge";
import { toast } from "sonner";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function TopBar({ onMenu }: { onMenu?: () => void }) {
  const navigate = useNavigate();
  const { branch, setBranch, dark, toggleDark } = useApp();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const currentBranch = branches.find((b) => b.id === branch);
  const unread = notifications.filter((n) => !n.read).length;
  const displayName = user?.name ?? "Admin";
  const displayRole = user?.role ?? "Admin";

  const confirmSignOut = () => {
    logout();
    setSignOutOpen(false);
    void navigate({ to: "/login" });
  };

  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 w-full items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      {onMenu && (
        <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={onMenu}>
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <div className="relative hidden min-w-0 max-w-md flex-1 md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search orders, customers, items…"
          className="w-full rounded-xl border-border/70 bg-muted/40 pl-9"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              toast.message(searchQ.trim() ? `Search: ${searchQ.trim()}` : "Enter a search term");
            }
          }}
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
      {/* Branch switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="rounded-xl gap-2">
            <Store className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline text-sm">
              {currentBranch ? currentBranch.label : "All Branches"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Business Branch</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setBranch("all")}>All Branches</DropdownMenuItem>
          {branches.map((b) => (
            <DropdownMenuItem key={b.id} onClick={() => setBranch(b.id)}>
              <div>
                <div>{b.label}</div>
                <div className="text-[10px] text-muted-foreground">GST · {b.gst}</div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon" onClick={toggleDark} title="Toggle theme">
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="border-b p-3">
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-xs text-muted-foreground">{unread} unread</div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.slice(0, 5).map((n) => (
              <button
                key={n.id}
                type="button"
                className="w-full border-b p-3 text-left text-sm hover:bg-muted/40"
                onClick={() => {
                  toast.message(n.title);
                  void navigate({ to: "/notifications" });
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{n.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>
                  </div>
                  <StatusBadge status={n.priority === "high" ? "Pending" : "Ready"} />
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">{n.time}</div>
              </button>
            ))}
          </div>
          <div className="border-t p-2">
            <Button
              variant="ghost"
              className="w-full rounded-lg text-xs"
              onClick={() => void navigate({ to: "/notifications" })}
            >
              View all notifications
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-xl border border-border/60 py-1 pr-2 pl-1 transition-colors hover:bg-muted">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left text-xs sm:block">
              <div className="font-medium leading-tight">{displayName}</div>
              <div className="text-muted-foreground">{displayRole}</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => void navigate({ to: "/settings" })}>
            <UserCircle className="mr-2 h-4 w-4" /> My Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setSignOutOpen(true);
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>

    <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
      <AlertDialogContent className="rounded-2xl sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            You’ll be signed out of the Daawat Baker’s admin panel and will need to log in again to continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={confirmSignOut}
          >
            Sign out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
