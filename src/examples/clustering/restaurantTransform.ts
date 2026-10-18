export type Restaurant = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  cuisine?: string;
};

const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

export function parseRestaurants(response: unknown): Restaurant[] {
  if (!isRecord(response) || !Array.isArray(response.elements)) {
    throw new Error('Restaurant data has an invalid response format.');
  }

  return response.elements.flatMap((value: unknown) => {
    if (!isRecord(value)) return [];

    const center = isRecord(value.center) ? value.center : undefined;
    const latitude = value.lat ?? center?.lat;
    const longitude = value.lon ?? center?.lon;
    if (
      !isLatitude(latitude) ||
      !isLongitude(longitude) ||
      typeof value.id !== 'number' ||
      !Number.isSafeInteger(value.id)
    ) {
      return [];
    }

    const tags = isRecord(value.tags) ? value.tags : undefined;
    const name = typeof tags?.name === 'string' ? tags.name : 'Restaurant';
    const cuisine = typeof tags?.cuisine === 'string' ? tags.cuisine : undefined;

    return [{
      id: value.id,
      name,
      ...(cuisine ? { cuisine } : {}),
      lat: latitude,
      lng: longitude,
    }];
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character]);
}
