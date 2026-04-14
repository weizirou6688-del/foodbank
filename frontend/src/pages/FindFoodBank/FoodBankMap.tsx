import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import type { FoodBank } from '@/shared/types/foodBanks'
interface FoodBankMapProps {
  foodBanks: FoodBank[]
  searchedLocation: { lat: number; lng: number } | null
  selectedFoodBankKey: string | null
  onSelectFoodBank: (foodBank: FoodBank) => void
}
const UK_CENTER: [number, number] = [54.5, -3.5]
const UK_ZOOM = 6
// Leaflet's default marker assets need to be rebound explicitly in a Vite
// build, otherwise markers render as broken images.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})
const defaultIcon = new L.Icon.Default()
const getFoodBankKey = (foodBank: FoodBank) => `${foodBank.id}-${foodBank.name}-${foodBank.lat}-${foodBank.lng}`
function FitMapBounds({
  foodBanks,
  searchedLocation,
}: Pick<FoodBankMapProps, 'foodBanks' | 'searchedLocation'>) {
  const map = useMap()
  useEffect(() => {
    // The viewport is fitted against both the user's searched postcode and the
    // returned food bank markers so the search context stays visible.
    const points: [number, number][] = foodBanks.map((foodBank) => [foodBank.lat, foodBank.lng])
    if (searchedLocation) {
      points.push([searchedLocation.lat, searchedLocation.lng])
    }
    if (points.length === 0) {
      map.setView(UK_CENTER, UK_ZOOM)
      return
    }
    map.fitBounds(points, {
      padding: [48, 48],
      maxZoom: points.length === 1 ? 14 : 13,
    })
  }, [foodBanks, map, searchedLocation])
  return null
}
export default function FoodBankMap({
  foodBanks,
  searchedLocation,
  selectedFoodBankKey,
  onSelectFoodBank,
}: FoodBankMapProps) {
  // The selected result is memoized so the map can consistently elevate the
  // matching marker without recalculating on every render.
  const selectedFoodBank = useMemo(() => {
    if (foodBanks.length === 0) {
      return null
    }
    return foodBanks.find((foodBank) => getFoodBankKey(foodBank) === selectedFoodBankKey) ?? foodBanks[0]
  }, [foodBanks, selectedFoodBankKey])
  return (
    <div className="w-full h-full rounded-lg overflow-hidden shadow-md relative">
      <MapContainer center={UK_CENTER} zoom={UK_ZOOM} scrollWheelZoom className="w-full h-full">
        <FitMapBounds foodBanks={foodBanks} searchedLocation={searchedLocation} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {searchedLocation && (
          <Marker position={[searchedLocation.lat, searchedLocation.lng]} icon={defaultIcon} zIndexOffset={900}>
            <Popup>
              <strong>Your searched location</strong>
              <div>This postcode is used as the centre point for nearby results.</div>
            </Popup>
          </Marker>
        )}
        {foodBanks.map((foodBank) => {
          // Selected markers get a higher z-index so clustered markers do not
          // visually bury the currently selected result.
          const isSelected =
            getFoodBankKey(foodBank) === (selectedFoodBank ? getFoodBankKey(selectedFoodBank) : null)
          return (
            <Marker
              key={`${foodBank.id}-${foodBank.name}-${foodBank.lat}-${foodBank.lng}`}
              position={[foodBank.lat, foodBank.lng]}
              icon={defaultIcon}
              zIndexOffset={isSelected ? 800 : 400}
              eventHandlers={{
                click: () => onSelectFoodBank(foodBank),
              }}
            >
              <Popup>
                <strong>{foodBank.name}</strong>
                <div>{foodBank.address}</div>
                <div>
                  {foodBank.systemMatched ? 'Online application available' : 'Contact this location directly'}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
      <div className="absolute bottom-4 right-4 z-[500]">
        <div className="bg-white px-3 py-2 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-2">
            <img src={markerIcon} style={{ width: 20, height: 30 }} alt="marker" />
            <span className="text-[14px] text-gray-700">Food bank location</span>
          </div>
        </div>
      </div>
    </div>
  )
}
