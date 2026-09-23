import numpy as np

def bilinear_sample(array: np.ndarray, x: float, y: float) -> float:
    h, w = array.shape
    x0 = int(np.floor(x))
    x1 = min(x0 + 1, w - 1)
    y0 = int(np.floor(y))
    y1 = min(y0 + 1, h - 1)

    wx = x - x0
    wy = y - y0

    v00 = array[y0, x0]
    v10 = array[y0, x1]
    v01 = array[y1, x0]
    v11 = array[y1, x1]

    v0 = v00 * (1 - wx) + v10 * wx
    v1 = v01 * (1 - wx) + v11 * wx
    return float(v0 * (1 - wy) + v1 * wy)

def compute_profile(height_array, points, bounds=None):
    """
    points: [[lat, lon], ...] if bounds is given, else pixel coords [[y, x], ...]
    Returns dict of distances, elevations, total_distance
    """
    total_dist = 0.0
    distances = [0.0]
    elevations = []

    h, w = height_array.shape

    # Helper to convert point to pixel coordinates
    def to_pixel(pt):
        if bounds:
            lat, lon = pt
            west, south, east, north = bounds
            x = (lon - west) / (east - west) * w
            y = (lat - north) / (south - north) * h
            return x, y
        else:
            return pt[1], pt[0] # assuming input was [y, x]

    # Helper for distance in meters utilizing Haversine if bounds is provided
    def dist_m(pt1, pt2):
        if bounds:
            lat1, lon1 = pt1
            lat2, lon2 = pt2
            r = 6371000 # radius of Earth in meters
            phi1, phi2 = np.radians(lat1), np.radians(lat2)
            dphi = np.radians(lat2 - lat1)
            dlambda = np.radians(lon2 - lon1)
            a = np.sin(dphi/2)**2 + np.cos(phi1)*np.cos(phi2)*np.sin(dlambda/2)**2
            return 2 * r * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
        else:
            return np.hypot(pt2[0]-pt1[0], pt2[1]-pt1[1]) # just pixel distance

    # First point
    x, y = to_pixel(points[0])
    elevations.append(bilinear_sample(height_array, x, y))

    for i in range(1, len(points)):
        pt1 = points[i-1]
        pt2 = points[i]
        
        # interpolate segment -> roughly 10 points
        d = dist_m(pt1, pt2)
        n_segments = max(2, int(d / (10 if bounds else 2))) # every 10m or 2px
        
        for j in range(1, n_segments + 1):
            f = j / n_segments
            interp_pt = [pt1[k] * (1 - f) + pt2[k] * f for k in (0, 1)]
            
            x, y = to_pixel(interp_pt)
            elevations.append(bilinear_sample(height_array, np.clip(x, 0, w-1), np.clip(y, 0, h-1)))
            distances.append(distances[-1] + dist_m(
                [pt1[k] * (1 - (f - 1/n_segments)) + pt2[k] * (f - 1/n_segments) for k in (0,1)],
                interp_pt
            ))
            
        total_dist += d

    return {
        "distances_m": distances,
        "elevations": elevations,
        "total_distance_m": total_dist
    }
