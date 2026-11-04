"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Box = { left: number; top: number; right: number; bottom: number };
type Track = { found: boolean; box?: Box; maskPath?: string; maskBounds?: Box; maskSize?: { width: number; height: number } };
type Shot = { dataUrl: string; width: number; height: number };

type Props = {
  gameId: string;
  stationId: string;
  objectName: string;
  /** Checks the first sighting is the real object (SAM 3.1 + Spark). */
  onVerify: (shot: Shot) => Promise<{ correct: boolean; message?: string }>;
  /** The object has been found and confirmed: it wakes up. */
  onAwake: () => void;
  awake: boolean;
  speaking: boolean;
};

/** Soft things sway like leaves; hard things bob and breathe. */
const SOFT = /plant|leaf|leaves|flower|fern|palm|grass|pampas|bouquet|tree|ivy|curtain|cushion|pillow|blanket|throw|rug|towel|scarf|feather|basket/i;

const TRACK_EVERY_MS = 900;
const SMALL = 448;

const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.,1.); }`;
const FRAG = `precision mediump float;
uniform sampler2D video; uniform sampler2D mask; uniform float t; uniform float amp; uniform float soft; uniform vec4 box;
varying vec2 uv;
void main(){
  float m = texture2D(mask, uv).r;
  vec2 d = vec2(0.0);
  float h = clamp((box.w - uv.y) / max(box.w - box.y, 0.001), 0.0, 1.0);
  if (soft > 0.5) {
    // Leaves: a slow sway anchored at the base, with a quick rustle on top.
    d.x = sin(t * 1.6) * 0.014 * h * h + sin(uv.y * 55.0 + t * 7.0) * 0.0035 * h;
    d.y = cos(uv.x * 47.0 + t * 5.0) * 0.0022 * h;
  } else {
    // Hard things: breathe and bob from the bottom centre.
    vec2 c = vec2((box.x + box.z) * 0.5, box.w);
    d = (uv - c) * (sin(t * 7.0) * 0.022 + 0.008) ;
    d.y += sin(t * 7.0) * 0.004 * h;
  }
  vec2 q = uv - d * amp * m;
  vec4 col = texture2D(video, q);
  // A faint lantern glow on the object while it is awake.
  col.rgb += vec3(0.10, 0.07, 0.0) * m * min(amp, 1.0);
  gl_FragColor = col;
}`;

/**
 * The object you're pointing at comes alive in the live camera picture. SAM 3.1
 * finds it about once a second; inside its outline the real pixels sway or bob,
 * harder while it talks, and a face follows it. Look away and it falls still.
 */
export function TalkingLens({ gameId, stationId, objectName, onVerify, onAwake, awake, speaking }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const maskCanvas = useRef<HTMLCanvasElement | null>(null);
  const small = useRef<HTMLCanvasElement | null>(null);
  const state = useRef({ amp: 0, target: 0, box: [0.3, 0.3, 0.7, 0.8] as [number, number, number, number], maskDirty: false, misses: 0 });
  const [camera, setCamera] = useState<"asking" | "on" | "blocked">("asking");
  const [inView, setInView] = useState(false);
  const [face, setFace] = useState<{ x: number; y: number; w: number } | null>(null);
  const [note, setNote] = useState(`Point your camera at the ${objectName}`);
  const verifying = useRef(false);
  const awakeRef = useRef(awake);
  const speakingRef = useRef(speaking);
  awakeRef.current = awake;
  speakingRef.current = speaking;
  const soft = SOFT.test(objectName);

  // Camera on.
  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false })
      .then(async (s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setCamera("on");
      })
      .catch(() => setCamera("blocked"));
    if (!navigator.mediaDevices) setCamera("blocked");
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  // Draw loop: live video through the shader.
  useEffect(() => {
    if (camera !== "on") return;
    const v = video.current!;
    const c = canvas.current!;
    const gl = c.getContext("webgl", { premultipliedAlpha: false });
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit: number) => {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };
    const videoTex = tex(0);
    const maskTex = tex(1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.uniform1i(gl.getUniformLocation(prog, "video"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "mask"), 1);
    const uT = gl.getUniformLocation(prog, "t");
    const uAmp = gl.getUniformLocation(prog, "amp");
    const uSoft = gl.getUniformLocation(prog, "soft");
    const uBox = gl.getUniformLocation(prog, "box");
    gl.uniform1f(uSoft, soft ? 1 : 0);

    let raf = 0;
    const start = performance.now();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (v.readyState < 2) return;
      if (c.width !== v.videoWidth) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        gl.viewport(0, 0, c.width, c.height);
      }
      const s = state.current;
      s.target = awakeRef.current && s.misses < 2 ? (speakingRef.current ? 1.6 : 0.7) : 0;
      s.amp += (s.target - s.amp) * 0.06;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, videoTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      if (s.maskDirty && maskCanvas.current) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, maskTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas.current);
        s.maskDirty = false;
      }
      gl.uniform1f(uT, (performance.now() - start) / 1000);
      gl.uniform1f(uAmp, s.amp);
      gl.uniform4f(uBox, ...s.box);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [camera, soft]);

  // Paints SAM's outline into the mask texture (soft-edged) and moves the face.
  const applyTrack = useCallback((t: Track, sw: number, shh: number) => {
    const s = state.current;
    const v = video.current;
    if (!t.found || !t.box || !v) {
      s.misses += 1;
      if (s.misses >= 2) setInView(false);
      return;
    }
    s.misses = 0;
    setInView(true);
    const b = t.box;
    s.box = [b.left / sw, b.top / shh, b.right / sw, b.bottom / shh];
    const mw = 256;
    const mh = Math.round((256 * shh) / sw);
    const m = maskCanvas.current ?? document.createElement("canvas");
    maskCanvas.current = m;
    m.width = mw;
    m.height = mh;
    const ctx = m.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, mw, mh);
    ctx.filter = "blur(5px)";
    ctx.fillStyle = "#fff";
    const k = mw / sw;
    if (t.maskPath && t.maskBounds && t.maskSize) {
      const sx = ((t.maskBounds.right - t.maskBounds.left) / t.maskSize.width) * k;
      const sy = ((t.maskBounds.bottom - t.maskBounds.top) / t.maskSize.height) * k;
      ctx.setTransform(sx, 0, 0, sy, t.maskBounds.left * k, t.maskBounds.top * k);
      ctx.fill(new Path2D(t.maskPath));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.beginPath();
      ctx.ellipse(((b.left + b.right) / 2) * k, ((b.top + b.bottom) / 2) * k, ((b.right - b.left) / 2) * k, ((b.bottom - b.top) / 2) * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = "none";
    s.maskDirty = true;

    // Face position on screen: the canvas is shown with object-fit: cover.
    const el = canvas.current;
    if (el) {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const scale = Math.max(cw / sw, ch / shh);
      const ox = (cw - sw * scale) / 2;
      const oy = (ch - shh * scale) / 2;
      const w = (b.right - b.left) * scale;
      const h = (b.bottom - b.top) * scale;
      setFace({ x: ox + (b.left * scale + w / 2), y: oy + b.top * scale + h * (soft ? 0.45 : 0.38), w });
    }
  }, [soft]);

  // Tracking loop: a small frame to SAM about once a second.
  useEffect(() => {
    if (camera !== "on") return;
    let stop = false;
    const loop = async () => {
      while (!stop) {
        const started = Date.now();
        const v = video.current;
        if (v && v.readyState >= 2 && v.videoWidth) {
          const scale = SMALL / Math.max(v.videoWidth, v.videoHeight);
          const sw = Math.round(v.videoWidth * scale);
          const shh = Math.round(v.videoHeight * scale);
          const cv = small.current ?? document.createElement("canvas");
          small.current = cv;
          cv.width = sw;
          cv.height = shh;
          cv.getContext("2d")!.drawImage(v, 0, 0, sw, shh);
          const dataUrl = cv.toDataURL("image/jpeg", 0.72);
          try {
            const res = await fetch(`/api/games/${gameId}/play/track`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stationId, dataUrl, width: sw, height: shh }),
            });
            const t = (await res.json()) as Track;
            if (stop) return;
            applyTrack(t, sw, shh);
            // First sighting: confirm it's the real thing before it wakes up.
            if (t.found && !awakeRef.current && !verifying.current) {
              verifying.current = true;
              setNote("Is that it? Checking with SAM 3.1…");
              const full = document.createElement("canvas");
              const fs = 1024 / Math.max(v.videoWidth, v.videoHeight);
              full.width = Math.round(v.videoWidth * fs);
              full.height = Math.round(v.videoHeight * fs);
              full.getContext("2d")!.drawImage(v, 0, 0, full.width, full.height);
              onVerify({ dataUrl: full.toDataURL("image/jpeg", 0.85), width: full.width, height: full.height })
                .then((r) => {
                  if (r.correct) onAwake();
                  else setNote(r.message ?? `That doesn’t look like the ${objectName}.`);
                })
                .catch(() => setNote("That check failed. Hold still and try again."))
                .finally(() => {
                  verifying.current = false;
                });
            }
          } catch {
            /* a dropped frame; try the next one */
          }
        }
        await new Promise((r) => setTimeout(r, Math.max(150, TRACK_EVERY_MS - (Date.now() - started))));
      }
    };
    loop();
    return () => {
      stop = true;
    };
  }, [camera, gameId, stationId, objectName, applyTrack, onVerify, onAwake]);

  const showFace = awake && inView && face;
  const eye = face ? Math.max(14, Math.min(46, face.w * 0.13)) : 20;

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-ink-line bg-night-deep">
      <video ref={video} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover opacity-0" />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full object-cover" />

      <AnimatePresence>
        {showFace ? (
          <motion.div
            key="face"
            className="pointer-events-none absolute"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1, left: face.x, top: face.y }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            style={{ x: "-50%", y: "-50%" }}
          >
            <div className="flex flex-col items-center" style={{ gap: eye * 0.35 }}>
              <div className="flex" style={{ gap: eye * 0.7 }}>
                {[0, 1].map((i) => (
                  <motion.div
                    key={i}
                    className="relative rounded-full border-2 border-[#1b1a17] bg-white shadow-md"
                    style={{ width: eye, height: eye * 1.1 }}
                    animate={{ scaleY: [1, 1, 0.1, 1] }}
                    transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.9, 0.95, 1] }}
                  >
                    <span className="absolute rounded-full bg-[#1b1a17]" style={{ width: eye * 0.45, height: eye * 0.45, left: eye * 0.3, top: eye * 0.35 }} />
                  </motion.div>
                ))}
              </div>
              <motion.div
                className="rounded-full border-2 border-[#1b1a17] bg-[#3a1414]"
                style={{ width: eye * 0.9 }}
                animate={speaking ? { height: [eye * 0.15, eye * 0.6, eye * 0.25, eye * 0.7, eye * 0.15] } : { height: eye * 0.18 }}
                transition={speaking ? { duration: 0.55, repeat: Infinity } : { duration: 0.2 }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between">
        {camera === "on" ? (
          <span className="flex items-center gap-1.5 rounded-full bg-night/70 px-2.5 py-1 text-xs font-semibold backdrop-blur">
            <motion.span className="size-2 rounded-full bg-danger" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
            Live · SAM 3.1
          </span>
        ) : (
          <span />
        )}
      </div>

      {!awake || !inView ? (
        <div className="pointer-events-none absolute inset-x-6 bottom-5 rounded-2xl bg-night/75 px-4 py-3 text-center text-sm backdrop-blur">
          {camera === "blocked"
            ? "The camera is off. Allow it in your browser settings, or use “I can’t reach it”."
            : awake
              ? `${objectName[0].toUpperCase()}${objectName.slice(1)} went quiet. Point the camera back at it.`
              : note}
        </div>
      ) : null}
    </div>
  );
}
