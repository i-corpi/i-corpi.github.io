"use client";

import { useState } from "react";
import { BodyModelViewer } from "../../components/BodyModelViewer";
import { URDFViewer } from "../../components/URDFViewer";
import { MODELS, displayValue } from "../../lib/models";
import { sitePath, sitePathMap } from "../../lib/site-path";

const fieldRows = [
  { label: "Model class", value: (id: string) => MODELS.find((m) => m.id === id)!.family },
  { label: "Primary formats", value: (id: string) => MODELS.find((m) => m.id === id)!.formats.join(" · ") },
  { label: "Pose / actuated DoF", value: (id: string) => displayValue(MODELS.find((m) => m.id === id)!.dof) },
  { label: "Joints", value: (id: string) => displayValue(MODELS.find((m) => m.id === id)!.joints) },
  { label: "Mesh vertices", value: (id: string) => displayValue(MODELS.find((m) => m.id === id)!.vertices) },
  { label: "Height", value: (id: string) => displayValue(MODELS.find((m) => m.id === id)!.heightM, " m") },
  { label: "Mass", value: (id: string) => displayValue(MODELS.find((m) => m.id === id)!.weightKg, " kg") },
  { label: "Parametric space", value: (id: string) => MODELS.find((m) => m.id === id)!.parameters ?? "Not applicable" },
  { label: "Variants", value: (id: string) => MODELS.find((m) => m.id === id)!.variants },
  { label: "Licence", value: (id: string) => MODELS.find((m) => m.id === id)!.license },
  { label: "Archive access", value: (id: string) => MODELS.find((m) => m.id === id)!.accessLabel },
];

export function CompareClient() {
  const [leftId, setLeftId] = useState("unitree-g1");
  const [rightId, setRightId] = useState("unitree-h2");
  const left = MODELS.find((model) => model.id === leftId)!;
  const right = MODELS.find((model) => model.id === rightId)!;

  return (
    <section className="compare-shell" aria-label="Model comparison">
      <div className="compare-pickers">
        {[{ side: "A", model: left, value: leftId, setter: setLeftId }, { side: "B", model: right, value: rightId, setter: setRightId }].map((item) => (
          <label key={item.side}>Model {item.side}
            <select value={item.value} onChange={(event) => item.setter(event.target.value)}>
              {MODELS.map((model) => <option value={model.id} key={model.id}>{model.name} — {model.maker}</option>)}
            </select>
          </label>
        ))}
      </div>

      <div className="compare-figures">
        {[left, right].map((model, index) => (
          <article key={`${index}-${model.id}`}>
            <div className="compare-model-visual">
              {model.kind === "body" ? (
                <BodyModelViewer model={model} compact key={model.id} />
              ) : model.hostedPath ? (
                <URDFViewer src={sitePath(model.hostedPath)} name={model.name} packages={sitePathMap(model.packageMap)} compact key={model.id} />
              ) : null}
            </div>
            <p className="eyebrow">{model.kind === "robot" ? "Humanoid robot" : "Parametric body"}</p>
            <h2>{model.name}</h2>
            <p>{model.tagline}</p>
          </article>
        ))}
      </div>

      {left.kind !== right.kind && (
        <div className="compare-note"><strong>Cross-domain comparison.</strong><p>Robot DoF count actuators or movable joints; body-model DoF parameterize pose. The numbers are useful context, not equivalent capability scores.</p></div>
      )}

      <div className="compare-table" role="table" aria-label={`${left.name} and ${right.name} comparison`}>
        <div className="compare-row heading" role="row"><span role="columnheader">Attribute</span><strong role="columnheader">{left.name}</strong><strong role="columnheader">{right.name}</strong></div>
        {fieldRows.map((row) => (
          <div className="compare-row" role="row" key={row.label}><span role="rowheader">{row.label}</span><b role="cell">{row.value(leftId)}</b><b role="cell">{row.value(rightId)}</b></div>
        ))}
      </div>
    </section>
  );
}
