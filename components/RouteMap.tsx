import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';

type RouteMapProps = {
  origin: { address: string; name: string; lat?: number; lng?: number };
  destination: { address: string; name: string; lat?: number; lng?: number };
  polyline?: string;
  routeSummary?: string;
};

export default function RouteMap({ origin, destination, polyline, routeSummary }: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', // Free dark theme
      center: [-87.9065, 43.0389], // Default to Wisconsin
      zoom: 10,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers and route
    const existingMarkers = document.querySelectorAll('.maplibregl-marker');
    existingMarkers.forEach(marker => marker.remove());
    
    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Add origin marker (green)
    if (origin.lat && origin.lng) {
      const originEl = document.createElement('div');
      originEl.className = 'route-marker origin-marker';
      originEl.innerHTML = '🟢';
      originEl.style.fontSize = '24px';
      
      new maplibregl.Marker({ element: originEl })
        .setLngLat([origin.lng, origin.lat])
        .setPopup(new maplibregl.Popup().setHTML(`<strong>Start:</strong><br>${origin.name}`))
        .addTo(map.current);
    }

    // Add destination marker (red)
    if (destination.lat && destination.lng) {
      const destEl = document.createElement('div');
      destEl.className = 'route-marker dest-marker';
      destEl.innerHTML = '🔴';
      destEl.style.fontSize = '24px';
      
      new maplibregl.Marker({ element: destEl })
        .setLngLat([destination.lng, destination.lat])
        .setPopup(new maplibregl.Popup().setHTML(`<strong>End:</strong><br>${destination.name}`))
        .addTo(map.current);

      // Fit map to show both points
      if (origin.lat && origin.lng) {
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend([origin.lng, origin.lat]);
        bounds.extend([destination.lng, destination.lat]);
        
        map.current.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 13,
        });
      }
    }

    // Draw route line if polyline is provided
    if (polyline && origin.lat && origin.lng && destination.lat && destination.lng) {
      const decodedPath = decodePolyline(polyline);
      
      map.current.addSource('route', {
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

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#25f4ee',
          'line-width': 4,
          'line-opacity': 0.8,
        },
      });
    }
  }, [mapLoaded, origin, destination, polyline]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div 
        ref={mapContainer} 
        style={{ 
          width: '100%', 
          height: '100%',
          borderRadius: '8px'
        }} 
      />
      {routeSummary && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            padding: '6px 12px',
            background: 'rgba(0,0,0,0.8)',
            borderRadius: '6px',
            fontSize: '0.8rem',
            color: 'white',
            fontWeight: '600',
            backdropFilter: 'blur(4px)',
          }}
        >
          {routeSummary}
        </div>
      )}
    </div>
  );
}

// Decode Google's encoded polyline format
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

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

  return points;
}