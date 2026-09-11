// Original procedural character study. See /characters/olaf/ATTRIBUTION.md.
// These joint indices and proportions are authored here, not Disney rig data.
export const OLAF_JOINTS = [
  ["root", -1, [0, .48, 0]], ["chest", 0, [0, .99, 0]],
  ["neck", 1, [0, 1.22, 0]], ["head", 2, [0, 1.42, 0]],
  ["left_shoulder", 1, [.18, 1.04, 0]], ["left_elbow", 4, [.45, 1.09, 0]],
  ["left_wrist", 5, [.68, 1.14, 0]],
  ["right_shoulder", 1, [-.18, 1.04, 0]], ["right_elbow", 7, [-.45, 1.09, 0]],
  ["right_wrist", 8, [-.68, 1.14, 0]],
  ["left_foot", 0, [.17, .10, .12]], ["right_foot", 0, [-.17, .10, .12]],
  ["jaw", 3, [0, 1.49, .225]],
  ["left_eye", 3, [.085, 1.72, .215]], ["right_eye", 3, [-.085, 1.72, .215]],
  ["nose", 3, [0, 1.63, .255]],
];

export function createOlafRig(THREE) {
  const rig = new THREE.Group();
  rig.name = "Olaf · procedural snowman study";
  rig.joints = {};
  rig.expression = { blink: 0, smile: 0 };
  rig.layout = {
    name: "Olaf", joints: OLAF_JOINTS, authoredCharacter: true, bodyJointCount: 12,
    expressive: true, detailedHands: false, hybrid: false,
    eyeNames: ["left_eye", "right_eye"],
    faceJointNames: ["head", "jaw", "left_eye", "right_eye", "nose"],
  };
  const snow = new THREE.MeshStandardMaterial({ color: 0xf8faf5, roughness: .92 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x392719, roughness: .95 });
  const coal = new THREE.MeshStandardMaterial({ color: 0x191a18, roughness: .9 });
  const carrot = new THREE.MeshStandardMaterial({ color: 0xed6f19, roughness: .85 });
  const nodes = [];
  const shape = (parent, scale, offset, material = snow) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), material);
    mesh.scale.fromArray(scale); mesh.position.fromArray(offset); parent.add(mesh);
    return mesh;
  };
  const twig = (parent, points, radius = .012) => {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    parent.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, radius, 7, false), wood));
  };
  OLAF_JOINTS.forEach(([name, parent, rest], index) => {
    const node = new THREE.Group();
    node.name = name; node.position.fromArray(rest);
    if (parent >= 0) node.position.sub(new THREE.Vector3(...OLAF_JOINTS[parent][2]));
    (nodes[parent] || rig).add(node); nodes.push(node); rig.joints[name] = node;
    if (/elbow|wrist/.test(name)) twig(nodes[parent], [[0, 0, 0], node.position.toArray()], .018);
    if (name.includes("shoulder")) twig(nodes[parent], [[0, 0, 0], node.position.toArray()], .022);
    if (name === "root") {
      shape(node, [.36, .39, .32], [0, 0, 0]);
      for (const [y, z] of [[.14, .304], [-.15, .302]]) {
        const button = new THREE.Mesh(new THREE.IcosahedronGeometry(.054, 1), coal);
        button.position.set(0, y, z); button.scale.set(1, 1.15, .65); node.add(button);
      }
    }
    if (name === "chest") {
      shape(node, [.23, .24, .215], [0, 0, 0]);
      const button = new THREE.Mesh(new THREE.IcosahedronGeometry(.05, 1), coal);
      button.position.set(0, .045, .207); node.add(button);
    }
    if (name === "head") {
      const profile = [[0, -.20], [.13, -.195], [.205, -.14], [.245, -.02],
        [.235, .15], [.205, .30], [.14, .39], [.055, .415], [0, .415]];
      node.add(new THREE.Mesh(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 40), snow));
      // Cheeks, twig hair and eyebrows make the snowman readable at thumbnail size.
      shape(node, [.20, .075, .16], [0, -.015, .07]);
      for (const [x, dx, height] of [[-.035, -.045, .16], [0, .015, .21], [.035, .075, .14]]) {
        twig(node, [[x, .39, 0], [x + dx * .5, .46, -.005], [x + dx, .39 + height, .01]], .008);
      }
      for (const sign of [-1, 1]) {
        twig(node, [[sign * .035, .365, .175], [sign * .075, .385, .175], [sign * .12, .355, .175]], .009);
      }
    }
    if (name.includes("foot")) shape(node, [.145, .10, .195], [0, 0, 0]);
    if (name.includes("wrist")) {
      const sign = name.startsWith("left") ? 1 : -1;
      for (const dy of [-.045, 0, .045]) {
        twig(node, [[0, 0, 0], [.065 * sign, dy * .4, 0], [.14 * sign, dy, .005]], .009);
      }
      twig(node, [[0, 0, 0], [.035 * sign, .04, 0], [.065 * sign, .10, .005]], .010);
    }
    if (name.includes("_eye")) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.044, 24, 16), snow);
      node.add(eye);
      shape(eye, [.018, .022, .011], [0, 0, .038], coal);
      shape(eye, [.005, .006, .003], [-.005, .008, .048], snow);
      node.userData.eye = eye;
    }
    if (name === "nose") {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(.043, .29, 24), carrot);
      mesh.rotation.x = Math.PI / 2; mesh.position.z = .13; node.add(mesh);
    }
    if (name === "jaw") {
      rig.mouth = shape(node, [.117, .065, .018], [0, -.02, .025], coal);
      rig.mouth.userData.baseScaleY = .065;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(.060, .058, .020), snow);
      tooth.position.set(0, .011, .045); node.add(tooth);
    }
  });
  return rig;
}
