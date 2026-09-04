"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ModelRecord } from "../lib/models";
import { sitePath, siteRoute } from "../lib/site-path";

const FRAME_COUNT = 16;
const DRAG_PIXELS_PER_FRAME = 18;

const wrapFrame = (frame: number) => (frame % FRAME_COUNT + FRAME_COUNT) % FRAME_COUNT;
const frameSource = (id: string, frame: number) =>
  sitePath(`/gallery/turntables/${id}/${String(wrapFrame(frame)).padStart(2, "0")}.png`);

export function TurntableCard({ model, index }: { model: ModelRecord; index: number }) {
  const [frame, setFrame] = useState(0);
  const dragRef = useRef<{ x: number; frame: number; pointerId: number } | null>(null);

  useEffect(() => {
    [frame - 1, frame + 1].forEach((nearbyFrame) => {
      const image = new window.Image();
      image.src = frameSource(model.id, nearbyFrame);
    });
  }, [frame, model.id]);

  const step = (amount: number) => setFrame((current) => wrapFrame(current + amount));

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = { x: event.clientX, frame, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.x;
    setFrame(wrapFrame(drag.frame - Math.round(distance / DRAG_PIXELS_PER_FRAME)));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    step(event.key === "ArrowRight" ? 1 : -1);
  };

  return (
    <article className="gallery-card">
      <div
        className="gallery-image turntable-stage"
        role="group"
        tabIndex={0}
        aria-label={`${model.name} 360 degree turntable, angle ${frame + 1} of ${FRAME_COUNT}. Drag or use the arrow keys to rotate.`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKey}
      >
        <img
          src={frameSource(model.id, frame)}
          alt={model.imageAlt ?? `${model.name} URDF render`}
          draggable={false}
          loading={index < 3 ? "eager" : "lazy"}
        />
        <span>{String(index + 1).padStart(2, "0")}</span>
        <b>16-angle URDF</b>
        <div className="turntable-controls" aria-hidden="true">
          <i>Drag to rotate</i>
          <em>{String(frame + 1).padStart(2, "0")} / {FRAME_COUNT}</em>
        </div>
      </div>
      <div className="turntable-buttons">
        <button type="button" onClick={() => step(-1)} aria-label={`Previous angle of ${model.name}`}>←</button>
        <span aria-hidden="true">360° turntable</span>
        <button type="button" onClick={() => step(1)} aria-label={`Next angle of ${model.name}`}>→</button>
      </div>
      <div className="gallery-card-head"><p className="eyebrow">{model.family}</p><em>{model.dof} DoF</em></div>
      <h2>{model.name}</h2>
      <p>{model.maker} · {model.country}</p>
      <a className="gallery-open" href={`${siteRoute("/archive")}#${model.id}`}>Open 3D review + joint map →</a>
    </article>
  );
}
