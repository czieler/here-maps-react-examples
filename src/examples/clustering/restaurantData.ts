import restaurantData from '../../data/restaurants.json';
import { parseRestaurants } from './restaurantTransform';
import type { Restaurant } from './restaurantTransform';

export { parseRestaurants, escapeHtml } from './restaurantTransform';
export type { Restaurant } from './restaurantTransform';

// Fixed sample locations keep the clustering demo predictable and offline-friendly.
export function loadRestaurants(): Restaurant[] {
  return parseRestaurants(restaurantData);
}
