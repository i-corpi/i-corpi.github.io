# Olaf procedural character study

Character reference: [Disney's Olaf videos](https://video.disney.com/olaf).
Olaf is a Disney character. This is an unofficial, original procedural
interpretation authored for i corpi; it is not a Disney production asset.

The geometry, rest positions, joint hierarchy and poses in
`assets/js/olaf-rig.js` are created in this repository. No Disney mesh, animation
rig, motion-capture data, texture, or robot description has been imported.
This record does not specify a separate asset reuse licence or grant rights
to the underlying character.

The rig has 16 authored joints, numbered from 0, with three local rotation
controls per joint:

| Index | Joint |
| --- | --- |
| 0 | root |
| 1 | chest |
| 2 | neck |
| 3 | head |
| 4–6 | left shoulder, elbow, wrist |
| 7–9 | right shoulder, elbow, wrist |
| 10–11 | left and right foot |
| 12 | jaw |
| 13–14 | left and right eye |
| 15 | carrot nose |

These are site-defined character-rig indices, not SMPL indices, Disney
animation-rig identifiers or robot motor IDs. Blink and smile are separate
illustrative controls. The body is assembled from rigid procedural surfaces;
it does not use a learned parametric body model or simulate a physical robot.

The joint map projects the rig's actual snow and twig geometry. Its numbered
dots are rotation pivots, which need not lie at the centre of a visible part.
For example, the head rotates around its lower pivot. Only the articulated
twig arms have connecting bone lines. Feet 10 and 11 are floating snow shapes
parented to the root; there are no hidden hip or knee joints. The side map makes
forward/back foot offsets visible. Both maps follow the pose and centre on
the character, independently of travel through the scene.

**Move Olaf** provides continuous walking, a 0.30 m step, speed, heading,
camera follow, and a position readout. At heading zero forward is +Z; at
+90 degrees it is +X. Heading uses the existing root joint's Y rotation,
so it does not add another numbered joint. Translation moves the rig through
the scene. Each foot alternates between a planted stance and a lifted swing;
its local translation offsets compensate for root motion and body bob during
straight walking. This is an authored animation in `assets/js/olaf-motion.js`,
not a learned locomotion policy or a dynamics/contact solver.

Pause preserves the current step. Editing a pose stops walking. Reset pose
restores local rotations and offsets while preserving scene position;
Reset position also returns travel and heading to zero. Reset view changes
only the camera. Animation pauses when the tab is hidden.

Exports use `i-corpi.olaf-pose.v2` with named axis-angle rotations in radians,
parent indices, authored rest positions and a Y-up/Z-forward coordinate system.
The original 16 indices remain unchanged. Version 2 adds
`jointTranslationOffsets` (one XYZ vector per joint, in parent-local metres)
to capture foot placement and root bob. Reconstruct a joint's local position
as its rest position minus its parent's rest position, plus that offset;
the root has no parent rest position to subtract. Apply `translation` to the
whole rig in the authored scene frame, then evaluate the hierarchy with
the exported local rotations. The viewer's display framing offset is not
part of the pose. `locomotion` records phase, speed and travelled distance;
the export is a single pose snapshot, not a motion clip or simulation state.
Proportions and mounting frames are authored for display, not physical
measurements of an official character robot.
