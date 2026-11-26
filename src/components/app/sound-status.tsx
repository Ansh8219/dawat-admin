import { useSyncExternalStore } from "react";
import { BellRing, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isAudioUnlocked, subscribeAudioState } from "@/lib/realtime/new-order-chime";
import {
  desktopAlertsState,
  disableDesktopAlerts,
  enableDesktopAlerts,
  subscribeDesktopAlerts,
  type DesktopAlertsState,
} from "@/lib/realtime/attention";
import { cn } from "@/lib/utils";

/** Topbar indicator: are order / late alert sounds active, plus what users should know. */
function DesktopAlertsToggle() {
  const state = useSyncExternalStore<DesktopAlertsState>(
    subscribeDesktopAlerts,
    desktopAlertsState,
    () => "unsupported",
  );
  if (state === "unsupported") return null;

  const hint: Record<Exclude<DesktopAlertsState, "unsupported">, string> = {
    on: "You'll get a system notification when this tab is in the background.",
    off: "Turned off on this device.",
    ask: "Get a system notification even when this tab is minimised.",
    denied: "Blocked by the browser. Allow notifications for this site in the address bar.",
  };

  return (
    <div className="flex items-start gap-2.5 rounded-xl border p-2.5">
      <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold">Desktop alerts</div>
        <div className="text-[11px] text-muted-foreground">{hint[state]}</div>
      </div>
      {state !== "denied" && (
        <Button
          size="sm"
          variant={state === "on" ? "outline" : "default"}
          className="h-7 shrink-0 rounded-lg px-2.5 text-xs"
          onClick={async () => {
            if (state === "on") {
              disableDesktopAlerts();
              return;
            }
            const next = await enableDesktopAlerts();
            if (next === "on") toast.success("Desktop alerts are on");
            else if (next === "denied") toast.error("The browser blocked notifications");
          }}
        >
          {state === "on" ? "Turn off" : "Turn on"}
        </Button>
      )}
    </div>
  );
}

export function SoundStatus() {
  const on = useSyncExternalStore(subscribeAudioState, isAudioUnlocked, () => false);
  const desktop = useSyncExternalStore<DesktopAlertsState>(
    subscribeDesktopAlerts,
    desktopAlertsState,
    () => "unsupported",
  );
  const needsAction = !on || desktop === "ask";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={on ? "Order sounds are on" : "Click anywhere on the page to enable order sounds"}
          className={cn("relative", !on && "text-warning")}
        >
          {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 animate-pulse" />}
          {on && needsAction && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warning" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <span
            className={cn("h-2 w-2 rounded-full", on ? "bg-success" : "bg-warning animate-pulse")}
          />
          {on ? "Order sounds are ON" : "Sounds are waiting for a click"}
        </div>
        {!on && (
          <p className="text-xs text-muted-foreground">
            Your browser blocks sound until you interact with the page. Click anywhere once and
            alerts will start ringing.
          </p>
        )}
        <DesktopAlertsToggle />
        <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
          <li>
            Rings for new orders, cancellations, counter payments, hall enquiries, stock alerts and
            late orders, from every business, whichever panel you are on.
          </li>
          <li>Each business has its own ring: Restaurant classic, Bakery higher, Hall chime.</li>
          <li>Orders or counter payments left waiting 2+ minutes ring again every 2 minutes.</li>
          <li>
            Keep this tab open. Browsers can slow down or mute sound and timers in background tabs
            or minimised windows.
          </li>
          <li>Late means: not accepted in 5 min, or preparing longer than the set prep time.</li>
          <li>Late alerts refresh every minute, and instantly when there is new activity.</li>
          <li>Make sure your device volume is up and the tab is not muted.</li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}
