import { useEffect } from 'react';
import H from '@here/maps-api-for-javascript';
import { useHereMap } from '../../shared/maps/useHereMap';
import styles from '../clustering/RestaurantMap.module.css';
import mapLayout from '../../shared/maps/MapLayout.module.css';
import { bubbleAnchorAbovePin, createPinIcon } from '../../shared/maps/pinIcon';

type InfoBubbleMapProps = { apiKey: string };
const location = { lat: 39.7684, lng: -86.1581 };

/** One marker, one info bubble: independent of restaurant clustering. */
export function InfoBubbleMap({ apiKey }: InfoBubbleMapProps) {
  const { containerRef, map, ui } = useHereMap(apiKey, { center: location, zoom: 13 });

  useEffect(() => {
    if (!map || !ui) return;

    const marker = new H.map.Marker(location, { icon: createPinIcon(), data: null });
    map.addObject(marker);

    const openInfoBubble = () => {
      // Keep only one bubble open when the marker is clicked repeatedly.
      ui.getBubbles().forEach((bubble) => ui.removeBubble(bubble));
      const bubble = new H.ui.InfoBubble(bubbleAnchorAbovePin(map, location), {
        content: '<div style="min-width:150px;padding:4px"><strong>Indianapolis, Indiana</strong><div>Example map marker</div></div>',
      });
      ui.addBubble(bubble);
    };

    marker.addEventListener('tap', openInfoBubble);
    return () => {
      marker.removeEventListener('tap', openInfoBubble);
      ui.getBubbles().forEach((bubble) => ui.removeBubble(bubble));
      map.removeObject(marker);
    };
  }, [map, ui]);

  return <section className={mapLayout.mapRegion}>
    <div className={styles.status}>Click the marker to open its info bubble</div>
    <div ref={containerRef} className={mapLayout.map} aria-label="HERE map with one clickable marker" />
  </section>;
}
