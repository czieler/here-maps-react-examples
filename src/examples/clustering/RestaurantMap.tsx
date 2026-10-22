import mapLayout from '../../shared/maps/MapLayout.module.css';
import { useEffect, useMemo } from 'react';
import H from '@here/maps-api-for-javascript';
import { useHereMap } from '../../shared/maps/useHereMap';
import { loadRestaurants } from './restaurantData';
import styles from './RestaurantMap.module.css';
import restaurantPin from '../../assets/restaurant-pin.png';
import { PIN_COLOR } from '../../shared/maps/pinIcon';

type RestaurantMapProps = {
  apiKey: string;
};

const mapConfiguration = {
  center: { lat: 39.7684, lng: -86.1581 },
  zoom: 9,
};

export function RestaurantMap({ apiKey }: RestaurantMapProps) {
  const { containerRef, map } = useHereMap(apiKey, mapConfiguration);

  // The sample list never changes, so it's loaded once up front (not on every
  // render) rather than inside the map-setup effect below.
  const restaurants = useMemo(() => loadRestaurants(), []);
  const status = `${restaurants.length.toLocaleString()} restaurants · zoom in to split clusters`;

  useEffect(() => {
    if (!map) return;

    let provider: H.clustering.Provider | undefined;
    let onTap: ((event: H.mapevents.Event) => void) | undefined;
    let clusterLayer: H.map.layer.ObjectLayer | undefined;

    const pinIcon = new H.map.Icon(restaurantPin, {
      size: { w: 34, h: 45 },
      anchor: { x: 17, y: 44 },
    });

    {
        const points = restaurants.map((restaurant) =>
          new H.clustering.DataPoint(restaurant.lat, restaurant.lng, 1, restaurant),
        );
        provider = new H.clustering.Provider(points, {
          clusteringOptions: { eps: 42, minWeight: 2 },
          theme: {
            getClusterPresentation(cluster: H.clustering.ICluster) {
              const count = cluster.getWeight();
              const diameter = count >= 100 ? 52 : count >= 10 ? 44 : 38;
              const radius = diameter / 2;
              const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}" viewBox="0 0 ${diameter} ${diameter}"><circle cx="${radius}" cy="${radius}" r="${radius - 2}" fill="${PIN_COLOR}" stroke="#ffffff" stroke-width="3"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-size="${count >= 100 ? 14 : 16}" font-weight="700" fill="white">${count}</text></svg>`;
              const marker = new H.map.Marker(cluster.getPosition(), {
                icon: new H.map.Icon(svg, { size: { w: diameter, h: diameter }, anchor: { x: radius, y: radius } }),
                min: cluster.getMinZoom(), max: cluster.getMaxZoom(), data: cluster,
              });
              marker.setData(cluster);
              return marker;
            },
            getNoisePresentation(point: H.clustering.INoisePoint) {
              const marker = new H.map.Marker(point.getPosition(), { icon: pinIcon, data: point });
              marker.setData(point);
              return marker;
            },
          },
        });

        onTap = (event) => {
          if (!(event.target instanceof H.map.Marker)) return;
          const marker = event.target;
          const result = marker.getData() as H.clustering.IResult;

          if (result.isCluster()) {
            map.setCenter(result.getPosition(), true);
            map.setZoom(Math.min(map.getZoom() + 2, 20), true);
          }
        };
        provider.addEventListener('tap', onTap);
        clusterLayer = new H.map.layer.ObjectLayer(provider);
        map.addLayer(clusterLayer);

        if (points.length > 0) {
          const bounds = new H.geo.MultiPoint(points).getBoundingBox();
          if (bounds) {
            map.getViewPort().setPadding(48, 48, 48, 48);
            map.getViewModel().setLookAtData({ bounds });
          }
        }
    }

    return () => {
      if (provider && onTap) provider.removeEventListener('tap', onTap);
      if (clusterLayer) map.removeLayer(clusterLayer);
    };
  }, [map, restaurants]);

  return (
    <section className={mapLayout.mapRegion}>
      <div className={styles.status} role="status" aria-live="polite">{status}</div>
      <div
        ref={containerRef}
        className={mapLayout.map}
        aria-label="Interactive HERE restaurant cluster map"
      />
    </section>
  );
}

