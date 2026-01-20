// components/TrafficMap.tsx
import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';

type Location = {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
};

type Route = {
  summary: string;
  polyline: string;
  distance: string;
  duration: string;
  durationInTraffic: string;
};

type TrafficMapProps = {
  origin: Location;
  destination: Location;
  routes: Route[];
  selectedRouteIndex: number | null;
};

export default function TrafficMap({ 
  origin, 
  destination, 
  routes, 
  selectedRouteIndex 
}: TrafficMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log('Initializing map...');

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-93.50941374478553, 45.14271645766171],
      zoom: 10,
      attributionControl: false, // No attribution
      scrollZoom: false,
      boxZoom: false,
      dragRotate: false,
      dragPan: false,
      keyboard: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
    });

    // Wait for BOTH load and style.load events
    let loadComplete = false;
    let styleComplete = false;

    const checkReady = () => {
      if (loadComplete && styleComplete) {
        console.log('Map fully loaded and ready');
        setMapLoaded(true);
      }
    };

    map.current.on('load', () => {
      console.log('Map load event fired');
      loadComplete = true;
      checkReady();
    });

    map.current.on('style.load', () => {
      console.log('Style load event fired');
      styleComplete = true;
      checkReady();
    });

    map.current.on('error', (e) => {
      console.error('Map error:', e);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update routes and markers when data changes
  useEffect(() => {
    if (!map.current || !mapLoaded) {
      console.log('Map not ready yet');
      return;
    }

    // Additional safety check - make sure style is loaded
    if (!map.current.isStyleLoaded()) {
      console.log('Style not loaded yet, waiting...');
      return;
    }

    console.log('Updating routes:', {
      routeCount: routes.length,
      selectedIndex: selectedRouteIndex,
      origin,
      destination
    });

    // Clear existing markers
    const existingMarkers = document.querySelectorAll('.maplibregl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Remove existing route layers and sources
    routes.forEach((_, index) => {
      try {
        if (map.current!.getLayer(`route-${index}`)) {
          map.current!.removeLayer(`route-${index}`);
        }
        if (map.current!.getSource(`route-${index}`)) {
          map.current!.removeSource(`route-${index}`);
        }
      } catch (e) {
        console.warn(`Error removing route ${index}:`, e);
      }
    });

    // Add all route lines
    routes.forEach((route, index) => {
      if (!route.polyline) {
        console.warn(`Route ${index} has no polyline`);
        return;
      }

      const decodedPath = decodePolyline(route.polyline);
      console.log(`Route ${index} decoded to ${decodedPath.length} points`);
      
      if (decodedPath.length === 0) {
        console.warn(`Route ${index} polyline decoded to 0 points`);
        return;
      }

      const isSelected = selectedRouteIndex === index;
      
      // Add source
      map.current!.addSource(`route-${index}`, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: decodedPath,
          },
        },
      });

      // Add layer with higher opacity for unselected routes
      map.current!.addLayer({
        id: `route-${index}`,
        type: 'line',
        source: `route-${index}`,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': isSelected ? '#25f4ee' : '#888888',
          'line-width': isSelected ? 6 : 3,
          'line-opacity': isSelected ? 1 : 0.5,
        },
      });

      console.log(`Added route ${index}, selected: ${isSelected}`);
    });

    // Add origin marker if coordinates exist
    if (origin.lat && origin.lng) {
      const originEl = document.createElement('div');
      originEl.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          background: #00bf63;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>
      `;
      
      new maplibregl.Marker({ element: originEl, anchor: 'center' })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map.current);
      
      console.log('Added origin marker at', [origin.lng, origin.lat]);
    }

    // Add destination marker if coordinates exist
    if (destination.lat && destination.lng) {
      const destEl = document.createElement('div');
      destEl.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          background: #ff6b6b;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>
      `;
      
      new maplibregl.Marker({ element: destEl, anchor: 'center' })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map.current);

      console.log('Added destination marker at', [destination.lng, destination.lat]);
    }

    // Fit map bounds
    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;

    if (selectedRouteIndex !== null && routes[selectedRouteIndex]) {
      // Zoom to selected route only
      console.log(`Zooming to selected route ${selectedRouteIndex}`);
      const selectedPath = decodePolyline(routes[selectedRouteIndex].polyline);
      selectedPath.forEach(coord => {
        bounds.extend(coord);
        hasPoints = true;
      });
      
      if (hasPoints) {
        map.current.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 13,
          duration: 800,
        });
      }
    } else {
      // Show all routes
      console.log('Fitting to all routes');
      routes.forEach(route => {
        const decodedPath = decodePolyline(route.polyline);
        decodedPath.forEach(coord => {
          bounds.extend(coord);
          hasPoints = true;
        });
      });
      
      if (hasPoints) {
        map.current.fitBounds(bounds, {
          padding: { top: 40, bottom: 40, left: 40, right: 40 },
          maxZoom: 12,
          duration: 800,
        });
      }
    }

    if (!hasPoints) {
      console.warn('No points to fit bounds to');
    }

  }, [mapLoaded, origin, destination, routes, selectedRouteIndex]);

  return (
    <div 
      ref={mapContainer} 
      style={{ 
        width: '100%', 
        height: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#0a0a0a'
      }} 
    />
  );
}

// Decode Google's encoded polyline format
function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) return [];
  
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push([lng / 1e5, lat / 1e5]);
    }
  } catch (e) {
    console.error('Error decoding polyline:', e);
  }

  return points;
}