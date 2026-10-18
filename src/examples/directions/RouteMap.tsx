import mapLayout from '../../shared/maps/MapLayout.module.css';
import { useEffect, useState } from 'react';
import H from '@here/maps-api-for-javascript';
import { useHereMap } from '../../shared/maps/useHereMap';
import { loadRoute } from './routeData';
import styles from './RouteMap.module.css';
import { createPinIcon } from '../../shared/maps/pinIcon';

type RouteMapProps = {
  apiKey: string;
};

type Stop = {
  label: string;
  address: string;
  lat: number;
  lng: number;
};

const stops: Stop[] = [
  { label: 'Start', address: 'Downtown Franklin, IN', lat: 39.4806, lng: -86.055 },
  { label: 'Stop 1', address: 'Greenwood, IN', lat: 39.6137, lng: -86.1067 },
  { label: 'Destination', address: 'Downtown Indianapolis, IN', lat: 39.7684, lng: -86.1581 },
];

const mapConfiguration = {
  center: { lat: stops[1].lat, lng: stops[1].lng },
  zoom: 10,
  padding: { top: 140, right: 48, bottom: 48, left: 48 },
};

export function RouteMap({ apiKey }: RouteMapProps) {
  const { containerRef, map } = useHereMap(apiKey, mapConfiguration);
  const [summary, setSummary] = useState('Loading route…');

  useEffect(() => {
    if (!map) return;

    let cancelled = false;
    let routeGroup: H.map.Group | undefined;
    loadRoute(apiKey)
      .then((route) => {
        if (cancelled) return;

        const lineStrings = route.sections.map((section) =>
          H.geo.LineString.fromFlexiblePolyline(section.polyline),
        );
        const routeGeometry = new H.geo.MultiLineString(lineStrings);
        const routeLine = new H.map.Polyline(routeGeometry, {
          style: {
            strokeColor: '#315eea',
            lineWidth: 6,
            lineCap: 'round',
          },
          data: null,
        });
        const markers = stops.map((stop, index) => {
          const isDestination = index === stops.length - 1;
          const label = index === 0 ? 'A' : isDestination ? 'B' : '1';
          const icon = createPinIcon(label);
          return new H.map.Marker({ lat: stop.lat, lng: stop.lng }, { icon, data: null });
        });
        routeGroup = new H.map.Group();
        routeGroup.addObjects([routeLine, ...markers]);
        map.addObject(routeGroup);
        const bounds = routeGroup.getBoundingBox();
        if (bounds) {
          map.getViewPort().setPadding(160, 60, 60, 60);
          map.getViewModel().setLookAtData({ bounds });
        }
        setSummary(`${formatDistance(route.length)} · ${formatDuration(route.duration)}`);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Could not load the route.', error);
        setSummary('Could not calculate the route. Check the connection and try again.');
      });

    return () => {
      cancelled = true;
      if (routeGroup) map.removeObject(routeGroup);
    };
  }, [apiKey, map]);

  return (
    <section className={`${mapLayout.mapRegion} ${styles.fullHeightRegion}`}>
      <div className={styles.routeCard}>
        <div className={styles.routeSummary}>
          <strong>Route</strong>
          <span>{summary}</span>
        </div>
        {stops.map((stop, index) => (
          <div className={styles.routeStop} key={stop.label}>
            <span
              className={`${styles.stopIcon} ${
                index === stops.length - 1 ? styles.destination : ''
              }`}
            >
              {index === 0 ? 'A' : index === stops.length - 1 ? 'B' : '1'}
            </span>
            <span>
              <strong>{stop.label}</strong>
              <small>{stop.address}</small>
            </span>
          </div>
        ))}
      </div>
      <div
        ref={containerRef}
        className={mapLayout.map}
        aria-label="Interactive HERE directions map"
      />
    </section>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}

function formatDistance(meters: number): string {
  return `${(meters / 1609.344).toFixed(1)} mi`;
}

