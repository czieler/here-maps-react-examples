type RouteSection = {
  polyline: string;
  length: number;
  duration: number;
};

export type RouteData = {
  sections: RouteSection[];
  length: number;
  duration: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function parseRouteResponse(response: unknown): RouteData {
  if (!isRecord(response) || !Array.isArray(response.routes) || response.routes.length === 0) {
    throw new Error('Route data does not contain a route.');
  }

  const firstRoute: unknown = response.routes[0];
  if (
    !isRecord(firstRoute) ||
    !Array.isArray(firstRoute.sections) ||
    firstRoute.sections.length === 0
  ) {
    throw new Error('Route data does not contain any route sections.');
  }

  const sections = firstRoute.sections.map((section: unknown): RouteSection => {
    if (!isRecord(section) || typeof section.polyline !== 'string' || !isRecord(section.summary)) {
      throw new Error('A route section has an invalid format.');
    }

    const { length, duration } = section.summary;
    if (!isNonNegativeNumber(length) || !isNonNegativeNumber(duration)) {
      throw new Error('A route section is missing its distance or duration.');
    }
    return { polyline: section.polyline, length, duration };
  });

  return {
    sections,
    length: sections.reduce((total, section) => total + section.length, 0),
    duration: sections.reduce((total, section) => total + section.duration, 0),
  };
}
