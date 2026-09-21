import { useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { OrbitView } from "@deck.gl/core";
import { TerrainLayer } from "@deck.gl/geo-layers";

// Our backend writes an 8-bit grayscale PNG (0-255) as the height map, not
// the Mapbox Terrain-RGB encoding deck.gl defaults to -- this decoder tells
// TerrainLayer to read elevation straight out of the red channel.
// maxHeightMeters should match roughly the tallest structure you expect in
// frame; tune it per scene, or wire it through from the /predict response
// once you're calibrating against SRTM (use calibration.scale/offset there
// instead of a fixed max).
function makeElevationDecoder(maxHeightMeters = 60) {
  return { rScaler: maxHeightMeters / 255, gScaler: 0, bScaler: 0, offset: 0 };
}

const INITIAL_VIEW_STATE = {
  target: [0, 0, 0],
  rotationX: 45,
  rotationOrbit: 30,
  zoom: 0,
};

export default function TerrainViewer({ apiBase, result }) {
  const layers = useMemo(() => {
    if (!result) return [];

    const elevationUrl = `${apiBase}${result.height_map_url}`;
    const textureUrl = `${apiBase}${result.texture_url}`;

    // Non-georeferenced inputs have no real-world bounds -- use a unit
    // square in local scene coordinates purely so the mesh has an extent to
    // render at. Georeferenced inputs get their true WGS84 bounds.
    const bounds = result.georeferenced && result.bounds_wgs84
      ? result.bounds_wgs84
      : [-1, -1, 1, 1];

    return [
      new TerrainLayer({
        id: "depthwizard-terrain",
        elevationData: elevationUrl,
        texture: textureUrl,
        bounds,
        elevationDecoder: makeElevationDecoder(),
        meshMaxError: 4,
        color: [255, 255, 255],
      }),
    ];
  }, [apiBase, result]);

  return (
    <div className="panel" style={{ height: "100%", position: "relative", overflow: "hidden" }}>
      {!result && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-dim)",
            fontSize: 13,
          }}
        >
          Upload an image to generate the 3D flythrough
        </div>
      )}
      <DeckGL
        views={new OrbitView({ orbitAxis: "Y" })}
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}

/*
 * Navigation note: this uses deck.gl's OrbitView (drag to rotate, scroll to
 * zoom, right-drag to pan) rather than a true first-person WASD flythrough.
 * It satisfies "navigable from arbitrary aerial perspectives" and is far
 * less code to get right in a short build window. If you have time left
 * over, upgrading to @deck.gl/core's FirstPersonView + a keydown/keyup
 * controller hook is the natural next step -- don't attempt it as your
 * first working version.
 */
