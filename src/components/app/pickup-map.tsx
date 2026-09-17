import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";
import "leaflet/dist/leaflet.css";

/** Viewport when no pickup pin has been set yet (Mohali). */
const DEFAULT_CENTER: [number, number] = [30.7046, 76.7179];
const DEFAULT_ZOOM = 13;

const PIN_HTML = `<span class="pickup-map-pin" aria-hidden="true"></span>`;

type LeafletNS = typeof import("leaflet");

type PickupMapProps = {
  latitude: string;
  longitude: string;
  popupLabel: string;
  onPick: (lat: number, lng: number) => void;
  /** Called when a search result is chosen, so an empty address can be filled. */
  onPlaceLabel?: (label: string) => void;
};

type PlaceHit = {
  id: string;
  label: string;
  lat?: number;
  lng?: number;
};

function parseCoordPair(lat: string, lng: string): [number, number] | null {
  if (lat.trim() === "" || lng.trim() === "") return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [a, b];
}

function parseTypedCoords(query: string): PlaceHit | null {
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { id: "typed", label: `${lat}, ${lng}`, lat, lng };
}

type SearchBias = { lat: number; lng: number };

function formatPlaceLabel(attrs: Record<string, unknown>, fallback: string): string {
  const text = (key: string) => (typeof attrs[key] === "string" ? attrs[key].trim() : "");
  const parts = [text("PlaceName") || fallback, text("City"), text("Region")].filter(Boolean);
  return [...new Set(parts)].join(", ");
}

/** India business search. OpenStreetMap does not list this restaurant; Esri does. */
async function searchPlaces(
  query: string,
  signal: AbortSignal,
  bias: SearchBias,
): Promise<PlaceHit[]> {
  const typed = parseTypedCoords(query);
  if (typed) return [typed];

  const url = new URL(
    "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
  );
  url.searchParams.set("f", "json");
  url.searchParams.set("SingleLine", query);
  url.searchParams.set("maxLocations", "8");
  url.searchParams.set("countryCode", "IND");
  url.searchParams.set("outFields", "PlaceName,City,Region,Match_addr");
  url.searchParams.set("location", `${bias.lng},${bias.lat}`);

  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("search_failed");
  const data = (await response.json()) as {
    candidates?: Array<{
      address?: string;
      score?: number;
      location?: { x?: number; y?: number };
      attributes?: Record<string, unknown>;
    }>;
  };

  const seen = new Set<string>();
  const hits: PlaceHit[] = [];
  for (const candidate of data.candidates ?? []) {
    const lat = candidate.location?.y;
    const lng = candidate.location?.x;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if ((candidate.score ?? 0) < 70) continue;
    const label = formatPlaceLabel(candidate.attributes ?? {}, candidate.address ?? "");
    if (!label || seen.has(label)) continue;
    seen.add(label);
    hits.push({ id: label, label, lat, lng });
  }
  return hits;
}

export function PickupMap({
  latitude,
  longitude,
  popupLabel,
  onPick,
  onPlaceLabel,
}: PickupMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<LeafletNS | null>(null);
  const onPickRef = useRef(onPick);
  const pendingZoomRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [open, setOpen] = useState(false);

  onPickRef.current = onPick;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    void import("leaflet").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const L = mod.default;
      leafletRef.current = L;

      const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      map.on("click", (event) => {
        onPickRef.current(event.latlng.lat, event.latlng.lng);
      });

      requestAnimationFrame(() => map.invalidateSize());
      setReady(true);
    });

    return () => {
      cancelled = true;
      setReady(false);
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!ready || !map || !L) return;

    const pos = parseCoordPair(latitude, longitude);
    if (!pos) return;

    const zoomTo = pendingZoomRef.current;
    pendingZoomRef.current = null;

    const label = popupLabel.trim() || "Pickup location";
    const existing = markerRef.current;
    if (existing) {
      const current = existing.getLatLng();
      if (current.lat !== pos[0] || current.lng !== pos[1]) {
        existing.setLatLng(pos);
        if (zoomTo) map.setView(pos, zoomTo);
        else map.panTo(pos);
      }
      existing.setPopupContent(label);
      return;
    }

    const icon = L.divIcon({
      className: "pickup-map-icon",
      html: PIN_HTML,
      iconSize: [28, 36],
      iconAnchor: [14, 34],
      popupAnchor: [0, -30],
    });
    const marker = L.marker(pos, { icon, draggable: true }).addTo(map);
    marker.bindPopup(label).openPopup();
    marker.on("dragend", () => {
      const next = marker.getLatLng();
      onPickRef.current(next.lat, next.lng);
    });
    markerRef.current = marker;
    map.setView(pos, zoomTo ?? Math.max(map.getZoom(), DEFAULT_ZOOM));
  }, [ready, latitude, longitude, popupLabel]);

  function choosePlace(hit: PlaceHit) {
    pendingZoomRef.current = 16;
    onPick(hit.lat!, hit.lng!);
    onPlaceLabel?.(hit.label);
    setQuery(hit.label);
    setHits([]);
    setOpen(false);
    setSearchError("");
  }

  async function runSearch(raw: string) {
    const trimmed = raw.trim();
    if (trimmed.length < 3) {
      setHits([]);
      setSearchError("Type at least 3 characters.");
      setOpen(true);
      return;
    }
    setSearching(true);
    setSearchError("");
    setOpen(true);
    try {
      const center = mapRef.current?.getCenter();
      const bias = center
        ? { lat: center.lat, lng: center.lng }
        : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
      const results = await searchPlaces(trimmed, AbortSignal.timeout(8000), bias);
      setHits(results);
      if (results.length === 0) setSearchError("No places found.");
    } catch {
      setHits([]);
      setSearchError("Couldn't search places. Try again.");
    } finally {
      setSearching(false);
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void runSearch(query);
    }
  }

  const hasPin = parseCoordPair(latitude, longitude) != null;

  return (
    <div>
      <Label htmlFor="pickup-search">Search location</Label>
      <div className="relative mt-1">
        <div className="flex gap-2">
          <Input
            id="pickup-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (searchError) setSearchError("");
            }}
            onKeyDown={onSearchKeyDown}
            placeholder="Daawat Restaurant, Rajpura"
            className="rounded-xl"
            autoComplete="off"
          />
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => void runSearch(query)}
            disabled={searching}
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </div>
        {open && (searching || searchError || hits.length > 0) && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-md">
            {searching && <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>}
            {!searching && searchError && (
              <div className="px-3 py-2 text-sm text-muted-foreground">{searchError}</div>
            )}
            {!searching &&
              hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => choosePlace(hit)}
                >
                  {hit.label}
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="mt-3">
        <Label>Pickup on map</Label>
        <div
          ref={containerRef}
          className="pickup-map mt-1 h-72 w-full overflow-hidden rounded-xl border"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {hasPin
            ? "Search a place, drag the pin, or click the map to move pickup."
            : "Search a place, or click the map to drop the pickup pin."}
        </p>
      </div>
    </div>
  );
}
