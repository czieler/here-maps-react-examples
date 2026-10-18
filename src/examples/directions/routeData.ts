import H from '@here/maps-api-for-javascript';
import { parseRouteResponse, type RouteData } from './routeTransform';

export { parseRouteResponse } from './routeTransform';
export type { RouteData } from './routeTransform';

export function loadRoute(apiKey: string): Promise<RouteData> {
  return requestRoute(apiKey);
}

function requestRoute(apiKey: string): Promise<RouteData> {
  return new Promise((resolve, reject) => {
    const platform = new H.service.Platform({ apikey: apiKey });
    const router = platform.getRoutingService();
    const stops = [
      { lat: 39.4806, lng: -86.055 },
      { lat: 39.6137, lng: -86.1067 },
      { lat: 39.7684, lng: -86.1581 },
    ];
    const params = {
      routingMode: 'fast',
      transportMode: 'car',
      origin: `${stops[0].lat},${stops[0].lng}`,
      destination: `${stops[2].lat},${stops[2].lng}`,
      via: new H.service.Url.MultiValueQueryParameter([`${stops[1].lat},${stops[1].lng}`]),
      return: 'polyline,summary',
    };

    router.calculateRoute(
      params,
      (response: unknown) => {
        try {
          resolve(parseRouteResponse(response));
        } catch (error) {
          reject(error);
        }
      },
      (error: unknown) => reject(error),
    );
  });
}
