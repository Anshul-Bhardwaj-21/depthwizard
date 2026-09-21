import numpy as np
from scipy import ndimage
from skimage import measure

def _compute_derivatives(height_array, resolution_m=1.0):
    # Sobel filter applied
    dzdx = ndimage.sobel(height_array, axis=1) / (8.0 * resolution_m)
    dzdy = ndimage.sobel(height_array, axis=0) / (8.0 * resolution_m)
    return dzdx, dzdy

def compute_slope_aspect(height_array, resolution_m=1.0):
    dzdx, dzdy = _compute_derivatives(height_array, resolution_m)
    
    slope = np.arctan(np.hypot(dzdx, dzdy))
    slope_deg = np.degrees(slope)
    
    aspect = np.arctan2(-dzdx, dzdy)
    aspect_deg = (np.degrees(aspect) + 360) % 360 # normalized to 0-360 compass degrees
    
    return slope_deg, aspect_deg

def compute_hillshade(slope_deg, aspect_deg, azimuth=315.0, elevation=45.0):
    azimuth_rad = np.radians(360.0 - azimuth + 90.0)
    elevation_rad = np.radians(elevation)
    slope_rad = np.radians(slope_deg)
    aspect_rad = np.radians(aspect_deg)
    
    shaded = np.sin(elevation_rad) * np.cos(slope_rad) + \
             np.cos(elevation_rad) * np.sin(slope_rad) * \
             np.cos(azimuth_rad - aspect_rad)
    
    return np.clip(shaded, 0, 1)

def get_geojson_contours(height_array, bounds=None, interval=10.0, base=0.0):
    """
    bounds: [west, south, east, north] in EPSG:4326 if georeferenced, else None.
    If none, returns pixel coordinates.
    """
    min_h = max(base, np.floor(np.nanmin(height_array) / interval) * interval)
    max_h = np.ceil(np.nanmax(height_array) / interval) * interval
    levels = np.arange(min_h, max_h + interval, interval)
    
    h, w = height_array.shape
    
    if bounds:
        west, south, east, north = bounds
        col_scale = (east - west) / w
        row_scale = (south - north) / h
    
    features = []
    for level in levels:
        contours = measure.find_contours(height_array, level)
        for c in contours:
            coords = []
            for (row, col) in c:
                if bounds:
                    lon = west + col * col_scale
                    lat = north + row * row_scale
                    coords.append([lon, lat])
                else:
                    coords.append([float(col), float(row)])
            
            # Close the ring if it's almost closed, or just add it
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords
                },
                "properties": {"elevation": float(level)}
            })
            
    return {
        "type": "FeatureCollection",
        "features": features
    }
