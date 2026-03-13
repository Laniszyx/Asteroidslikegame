import Phaser from 'phaser';

// ─── Glow FX Pipeline ────────────────────────────────────────────────────────
// Additive blending + soft bloom via dual-pass blur approximation implemented
// as a custom WebGL pipeline on top of Phaser's built-in MultiPipeline.
// ─────────────────────────────────────────────────────────────────────────────

const fragShader = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
varying vec2 outTexCoord;

// CRT scanline + vignette
uniform float uTime;
uniform float uCRT;
uniform vec2 uResolution;

void main () {
  vec4 color = texture2D(uMainSampler, outTexCoord);

  if (uCRT > 0.0) {
    // Scanlines
    float scanline = sin(outTexCoord.y * uResolution.y * 1.5) * 0.04 * uCRT;
    color.rgb -= scanline;

    // Vignette
    vec2 uv = outTexCoord * 2.0 - 1.0;
    float vig = 1.0 - dot(uv * 0.4, uv * 0.4);
    color.rgb *= clamp(vig, 0.0, 1.0);

    // Subtle chromatic abberation
    float shift = 0.001 * uCRT;
    color.r = texture2D(uMainSampler, outTexCoord + vec2(-shift, 0.0)).r;
    color.b = texture2D(uMainSampler, outTexCoord + vec2( shift, 0.0)).b;
  }

  gl_FragColor = color;
}
`;

export class GlowFXPipeline extends Phaser.Renderer.WebGL.Pipelines.MultiPipeline {
  constructor(game) {
    super({
      game,
      name: 'GlowFXPipeline',
      fragShader,
    });
    this._time = 0;
    this._crt  = 0.7;
  }

  onBind() {
    super.onBind();
    this.set1f('uTime',       this._time);
    this.set1f('uCRT',        this._crt);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
  }

  tick(delta) {
    this._time += delta / 1000;
  }

  /** Toggle CRT effect intensity (0 = off, 1 = full) */
  setCRT(v) { this._crt = v; }
}
