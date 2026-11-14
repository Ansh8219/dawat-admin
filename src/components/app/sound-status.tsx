import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isAudioUnlocked, subscribeAudioState } from "@/lib/realtime/new-order-chime";
import { cn } from "@/lib/utils";

/** Topbar indicator: are order / late alert sounds active, plus what users should know. */
export function SoundStatus() {
  const on = useSyncExternalStore(subscribeAudioState, isAudioUnlocked, () => false);

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
        <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
          <li>Rings for new orders, customer cancellations, stock alerts and late orders.</li>
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
