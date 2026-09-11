// Parameter indices, not detector keypoints or robot motor addresses.
// Sources: vchoutas/smplx (joint_names.py, body_models.py) and the STAR paper.
// All rest positions here are authored illustrations, not model data.
export const SMPL_JOINTS = [
  ["pelvis", -1, [0, 1, 0]],
  ["left_hip", 0, [.10, .95, 0]], ["right_hip", 0, [-.10, .95, 0]],
  ["spine1", 0, [0, 1.15, 0]],
  ["left_knee", 1, [.10, .55, 0]], ["right_knee", 2, [-.10, .55, 0]],
  ["spine2", 3, [0, 1.30, 0]],
  ["left_ankle", 4, [.10, .12, 0]], ["right_ankle", 5, [-.10, .12, 0]],
  ["spine3", 6, [0, 1.44, 0]],
  ["left_foot", 7, [.10, .07, .13]], ["right_foot", 8, [-.10, .07, .13]],
  ["neck", 9, [0, 1.59, 0]],
  ["left_collar", 9, [.10, 1.48, 0]], ["right_collar", 9, [-.10, 1.48, 0]],
  ["head", 12, [0, 1.70, 0]],
  ["left_shoulder", 13, [.22, 1.48, 0]], ["right_shoulder", 14, [-.22, 1.48, 0]],
  ["left_elbow", 16, [.49, 1.48, 0]], ["right_elbow", 17, [-.49, 1.48, 0]],
  ["left_wrist", 18, [.74, 1.48, 0]], ["right_wrist", 19, [-.74, 1.48, 0]],
  ["left_hand", 20, [.84, 1.48, 0]], ["right_hand", 21, [-.84, 1.48, 0]],
];

export function bodyLayout(model) {
  if (!["smpl24", "smplh52", "smplx55", "star24"].includes(model.posePreview)) {
    throw new Error("Unknown procedural body layout");
  }
  const expressive = model.posePreview === "smplx55";
  const detailedHands = expressive || model.posePreview === "smplh52";
  const hybrid = model.posePreview === "smplh52" && (model.previewHandMode || "sharpa") === "sharpa";
  const joints = (detailedHands ? SMPL_JOINTS.slice(0, 22) : SMPL_JOINTS).map(j => [...j]);
  if (expressive) joints.push(
    ["jaw", 15, [0, 1.715, .07]],
    ["left_eye_smplhf", 15, [.04, 1.80, .09]],
    ["right_eye_smplhf", 15, [-.04, 1.80, .09]],
  );
  if (detailedHands && !hybrid) {
    for (const [side, sign, wrist] of [["left", 1, 20], ["right", -1, 21]]) {
      // MANO/SMPL+H parameter order is index, middle, pinky, ring, thumb.
      for (const [finger, offset, start, lengths] of [
        ["index", .026, .83, [.038, .025]], ["middle", .003, .84, [.042, .028]],
        ["pinky", -.043, .81, [.028, .021]], ["ring", -.020, .83, [.037, .025]],
        ["thumb", .06, .785, [.027, .025]],
      ]) {
        let x = start;
        for (let segment = 1; segment <= 3; segment++) {
          const parent = segment === 1 ? wrist : joints.length - 1;
          joints.push([`${side}_${finger}${segment}`, parent,
            [sign * x, 1.48 + offset + (finger === "thumb" ? (segment - 1) * .014 : 0), .01]]);
          x += lengths[segment - 1] || 0;
        }
      }
    }
  }
  return { joints, expressive, detailedHands, hybrid, name: hybrid ? "SMPL-layout body + Sharpa Wave" : model.name };
}
