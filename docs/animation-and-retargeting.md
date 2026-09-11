# How 3D bodies move

A **mesh** describes a surface. A **rig** supplies a hierarchy of joints and
controls. **Skinning** makes a deformable surface follow that hierarchy, while
**animation** supplies joint transforms over time. Retargeting transfers motion
to another rig; it does not automatically create that rig or its skin weights.

## What the archive now demonstrates

Robot records load their actual URDF links, joint frames, axes, and limits.
Changing one angle moves downstream links by forward kinematics. Rigid robot
parts follow their own link transforms; the viewer does not simulate motors,
gravity, balance, contact forces, or collision response.

The front joint map projects the current joint pivots. Dots show their exact
projected positions. Numbers are displaced only to avoid overlapping controls,
with lines connecting them back to their pivots. Several axes of a shoulder or
hip can legitimately occupy the same point.

iCub uses a different initial heading in its source description. The archive
applies a 180-degree rotation about its source vertical axis for display.
The downloaded URDF and its joint coordinates remain unchanged.

The SMPL record provides a **procedural pose demonstrator** with the standard
24-joint ordering. Its body proportions and capsule geometry are authored for
this website. It does not contain a learned SMPL mesh, joint regressor, skin
weights, pose correctives, or shape parameters. Sliders use local XYZ Euler
rotations; pose export converts their quaternions into 24 axis-angle vectors
(72 values, in radians), along with joint names and root translation.

The T-pose, reach, wave, and crouch examples illustrate hierarchical articulation.
They are not motion-capture clips or physically validated robot trajectories.
Exported poses use the SMPL joint order, but applying them to another rig still
requires checking that rig's rest frames, units, and coordinate conventions.

SMPL+H, SMPL-X and STAR now have procedural demonstrators too. The human layouts
have 52, 55 and 24 pose joints respectively. Hand maps preserve canonical indices
while showing just the selected wrist and finger chains; SMPL-X also exposes its
jaw and eye pose joints. Blink and smile are illustrative surface controls,
separate from learned SMPL-X expression coefficients.

The SMPL+H page defaults to a separately labelled Sharpa hybrid. It mounts the
right Sharpa Wave browser URDF from las manos on the right wrist and a mirrored
copy on the left. Its 22 body joints have 66 rotation parameters; its hands have
44 scalar robot joint positions. It does not export these as native MANO hand
rotations. The `i-corpi.body-robot-hybrid.v1` schema keeps body and robot-hand
commands separate and records the mirrored placement explicitly.

All body exports carry joint names, parent indices, authored rest positions and
coordinate conventions. These aid calibration; they do not assert automatic
compatibility with licensed model rest frames. Robot map numbers start at 1 and
are site-local labels, not SDK motor IDs. Human pose indices start at 0.

## Skeletons and surfaces

Each joint has a transform relative to its parent. In a simple rig:

```text
world transform = parent's world transform × rest offset × pose rotation
```

Moving a shoulder therefore moves its elbow, wrist, and hand. Forward
kinematics computes the resulting positions from the angles. Inverse
kinematics (IK) instead finds angles that place an end effector, such as a hand,
near a requested target. IK may have many solutions or no reachable solution;
joint limits and elbow/knee direction help select a useful result. [3, 4]

A smooth character typically assigns each mesh vertex weights for several
bones. Linear blend skinning combines the corresponding bone transforms.
Vertices near an elbow can follow both the upper arm and forearm, while a rigid
robot link normally follows one link transform. Corrective shapes can improve
deformation where simple skinning produces collapsing or twisting artifacts. [1, 3]

SMPL adds learned body-shape variation, a shape-dependent joint regressor, and
pose-dependent corrections to a skinned body model. Its shape parameters
describe different bodies; its pose parameters describe articulation. Giving
a capsule rig the same joint names does not reproduce those learned parts. [1]

## Retargeting, step by step

1. **Calibrate coordinates and rest poses.** Convert units, up/forward axes, and
   conventions. Align the source and target reference poses, such as T-pose
   versus A-pose.
2. **Map equivalent joints or chains.** Match pelvis, spine, shoulders, elbows,
   wrists, hips, knees, and ankles. A chain mapping can handle different numbers
   of intermediate bones.
3. **Transfer relative motion.** Express source rotation changes relative to
   its reference pose, convert them into the target joint frames, and apply
   them relative to the target reference pose. Quaternions or rotation matrices
   avoid confusing Euler-angle axis conventions.
4. **Adapt translation and reach.** Preserve the target's bone lengths and
   adjust root motion for its proportions. A shorter character cannot place
   its wrist at every point a taller character can reach.
5. **Solve contacts and constraints.** IK can preserve planted feet, hand
   contacts, and intended reaching targets. Apply joint limits and inspect
   slipping, intersections, and unnatural bends. Game-engine retargeters
   expose chain mapping, rest-pose alignment, root-motion controls, and IK
   adjustments for these reasons. [4, 5]

For example, copying a tall person's knee rotations onto a short character may
preserve the general gesture, but the feet can slide because the strides differ.
Retargeting preserves the intended foot contact using target proportions and IK.

For a physical robot, a further controller or optimization stage must satisfy
its actuator limits, collisions, balance, and contact dynamics. A pleasing
animation alone does not establish that the robot can execute it.

## Humans, characters, and animals

| Subject | Typical representation | Retargeting considerations |
| --- | --- | --- |
| Human / SMPL | Skinned skeleton, optionally learned body shape and pose corrections | Align body frames and proportions; handle ground contacts |
| Stylized humanoid | Custom skeleton and skinning, often extra twist bones and facial blend shapes | Map chains, compensate for extreme proportions, preserve artistic constraints |
| Quadruped | Four-limb skeleton, spine, neck, and often a tail | Match species-specific joint chains, stride, spine motion, and four-foot contact timing |
| Wings, tentacles, or unusual creatures | Custom bones, spline controls, blend shapes, or simulation | Additional structures need their own controls and motion rules |

The broad ideas are shared, but a human walking clip is not automatically a
valid dog gait. The limb roles, spine motion, number of contacts, and timing
differ; additional motion design, animal motion data, or a gait controller is
needed.

SMAL applies a related parametric, skinned-model approach to several quadruped
families. Its learned shape space supports the animals represented by that
model; it is not a universal representation of every animal or fictional
creature. [2]

## Primary references

1. Loper et al., **SMPL: A Skinned Multi-Person Linear Model**, 2015.
   [Official project, paper, and model access](https://smpl.is.tue.mpg.de/).
   [Authors' reference implementation and SMPL joint order](https://github.com/vchoutas/smplx/blob/main/smplx/joint_names.py).
2. Zuffi et al., **3D Menagerie: Modeling the 3D Shape and Pose of Animals**, 2017.
   [Official SMAL project](https://smal.is.tue.mpg.de/).
3. Blender Manual, [Skinning](https://docs.blender.org/manual/en/latest/animation/armatures/skinning/index.html).
4. Blender Manual, [Inverse Kinematics Constraint](https://docs.blender.org/manual/en/latest/animation/constraints/tracking/ik_solver.html).
5. Epic Games, [IK Rig Animation Retargeting](https://dev.epicgames.com/documentation/en-us/unreal-engine/ik-rig-animation-retargeting-in-unreal-engine).

Sources checked on 2026-09-11.
