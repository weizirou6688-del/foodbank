import { useEffect, useRef } from "react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { FoodBank } from "@/shared/types/foodBanks";
import {
  canViewFoodBankPackages,
  getFoodBankKey,
} from "./findFoodBank.shared";
import styles from "./FindFoodBank.module.css";
const UK_CENTER: [number, number] = [54.5, -3.5];
const UK_ZOOM = 6;

interface FoodBankMapProps {
  foodBanks: FoodBank[];
  searchedLocation: { lat: number; lng: number } | null;
  selectedFoodBankKey: string | null;
  onSelectFoodBank: (foodBank: FoodBank) => void;
}
// Leaflet 仍然依赖默认原型上的图标 URL,因此在此统一为 Vite 资产管道重新指定一次。
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
const defaultIcon = new L.Icon.Default();
function buildPopupContent(title: string, lines: string[]) {
  const wrapper = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  wrapper.append(heading);
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.textContent = line;
    wrapper.append(row);
  });
  return wrapper;
}
export default function FoodBankMap({
  foodBanks,
  searchedLocation,
  selectedFoodBankKey,
  onSelectFoodBank,
}: FoodBankMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }
    const map = L.map(mapElementRef.current, {
      center: UK_CENTER,
      zoom: UK_ZOOM,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    window.requestAnimationFrame(() => {
      map.invalidateSize();
    });
    return () => {
      markerLayerRef.current?.clearLayers();
      markerLayerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const mapElement = mapElementRef.current;

    if (!map || !mapElement || typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        map.invalidateSize();
      });
    });

    resizeObserver.observe(mapElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;

    if (!map || !markerLayer) {
      return;
    }
    // 每次结果集变化时从头重建标记;列表较小,这样能让选中状态保持简单清晰。
    markerLayer.clearLayers();
    const points: L.LatLngExpression[] = [];
    if (searchedLocation) {
      points.push([searchedLocation.lat, searchedLocation.lng]);
      L.marker([searchedLocation.lat, searchedLocation.lng], {
        icon: defaultIcon,
        zIndexOffset: 900,
      })
        .bindPopup(
          buildPopupContent("Your searched location", [
            "This postcode is used as the centre point for nearby results.",
          ]),
        )
        .addTo(markerLayer);
    }
    foodBanks.forEach((foodBank) => {
      points.push([foodBank.lat, foodBank.lng]);
      L.marker([foodBank.lat, foodBank.lng], {
        icon: defaultIcon,
        zIndexOffset:
          getFoodBankKey(foodBank) === selectedFoodBankKey ? 800 : 400,
      })
        .bindPopup(
          buildPopupContent(foodBank.name, [
            foodBank.address,
            canViewFoodBankPackages(foodBank)
              ? "Local package inventory available"
              : "No linked local admin account for package viewing yet",
          ]),
        )
        .on("click", () => {
          onSelectFoodBank(foodBank);
        })
        .addTo(markerLayer);
    });
    if (points.length === 0) {
      map.setView(UK_CENTER, UK_ZOOM);
    } else {
      map.fitBounds(L.latLngBounds(points), {
        padding: [48, 48],
        maxZoom: points.length === 1 ? 14 : 13,
      });
    }
    window.requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [foodBanks, searchedLocation, selectedFoodBankKey, onSelectFoodBank]);
  return (
    <div className={styles.mapShell}>
      <div ref={mapElementRef} className={styles.mapCanvas} />
      <div className={styles.legendWrap}>
        <div className={styles.legend}>
          <div className={styles.legendRow}>
            <img
              src={markerIcon}
              className={styles.legendMarkerIcon}
              alt="marker"
            />
            <span className={styles.legendLabel}>Food bank location</span>
          </div>
        </div>
      </div>
    </div>
  );
}
