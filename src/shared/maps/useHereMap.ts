import { useEffect, useRef, useState } from 'react';
import H from '@here/maps-api-for-javascript';

type MapConfiguration = {
  center: { lat: number; lng: number };
  zoom: number;
  padding?: { top: number; right: number; bottom: number; left: number };
};

type HereMapInstance = {
  map: H.Map;
  ui: H.ui.UI;
};

export function useHereMap(apiKey: string, configuration: MapConfiguration) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [instance, setInstance] = useState<HereMapInstance | null>(null);
  const { center, zoom, padding } = configuration;
  const centerLat = center.lat;
  const centerLng = center.lng;
  const hasPadding = padding !== undefined;
  const paddingTop = padding?.top;
  const paddingRight = padding?.right;
  const paddingBottom = padding?.bottom;
  const paddingLeft = padding?.left;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const platform = new H.service.Platform({ apikey: apiKey });
    const layers = platform.createDefaultLayers();
    const map = new H.Map(container, layers.vector.normal.map, {
      center: { lat: centerLat, lng: centerLng },
      zoom,
      pixelRatio: window.devicePixelRatio || 1,
      ...(hasPadding
        ? {
            padding: {
              top: paddingTop ?? 0,
              right: paddingRight ?? 0,
              bottom: paddingBottom ?? 0,
              left: paddingLeft ?? 0,
            },
          }
        : {}),
    });
    const mapEvents = new H.mapevents.MapEvents(map);
    const behavior = new H.mapevents.Behavior(mapEvents);
    const ui = H.ui.UI.createDefault(map, layers);
    const resizeObserver = new ResizeObserver(() => map.getViewPort().resize());
    resizeObserver.observe(container);
    setInstance({ map, ui });

    return () => {
      resizeObserver.disconnect();
      behavior.dispose();
      ui.dispose();
      map.dispose();
      setInstance(null);
    };
  }, [
    apiKey,
    centerLat,
    centerLng,
    zoom,
    hasPadding,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
  ]);

  return { containerRef, map: instance?.map ?? null, ui: instance?.ui ?? null };
}
