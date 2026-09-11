// Orthographic silhouettes from the same meshes as the 3D view. Convex hulls
// are suitable for Olaf's small rigid primitives; they are not a skinning model.
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function hull(points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const half = sequence => {
    const result = [];
    for (const point of sequence) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

export function projectSurfaces({ THREE, surfaceRoot, right, front }) {
  const result = [];
  const point = new THREE.Vector3();
  surfaceRoot.traverseVisible(mesh => {
    const positions = mesh.geometry?.attributes.position;
    if (!mesh.isMesh || !positions) return;
    const points = [];
    let depth = 0;
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
      points.push({ x: point.dot(right), y: point.y });
      depth += point.dot(front);
    }
    result.push({ points: hull(points), depth: depth / positions.count,
      color: `#${mesh.material.color.getHexString()}` });
  });
  return result.sort((a, b) => a.depth - b.depth);
}
