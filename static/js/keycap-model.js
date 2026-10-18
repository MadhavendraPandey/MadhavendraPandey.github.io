// A single sculpted keycap mesh. The three legends follow its actual surfaces.
// WebGL is used only for this object; the existing CSS keycap remains the fallback.
const vertexShader = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec2 aUV;
  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProjection;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  varying vec2 vUV;
  void main() {
    vec4 world = uModel * vec4(aPosition, 1.0);
    vPosition = world.xyz;
    vLocalPosition = aPosition;
    vLocalNormal = aNormal;
    vNormal = mat3(uModel) * aNormal;
    vUV = aUV;
    gl_Position = uProjection * uView * world;
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  varying vec2 vUV;
  uniform sampler2D uLegends;
  uniform sampler2D uSurface;
  uniform mat4 uModel;
  uniform float uText;
  void main() {
    // Object-space grain stays attached to the plastic as the cap turns.
    // Mipmaps filter the fine relief at smaller screen sizes.
    vec3 localNormal = normalize(vLocalNormal);
    vec3 weights = pow(abs(localNormal), vec3(4.0));
    weights /= weights.x + weights.y + weights.z;
    vec3 gx = texture2D(uSurface, vLocalPosition.zy / 72.0).rgb;
    vec3 gy = texture2D(uSurface, vLocalPosition.xz / 72.0).rgb;
    vec3 gz = texture2D(uSurface, vLocalPosition.xy / 72.0).rgb;
    vec3 relief = vec3(0.0, gx.g - .5, gx.r - .5) * weights.x
      + vec3(gy.r - .5, 0.0, gy.g - .5) * weights.y
      + vec3(gz.r - .5, gz.g - .5, 0.0) * weights.z;
    float grain = dot(vec3(gx.b, gy.b, gz.b), weights);
    vec3 n = normalize(mat3(uModel) * (localNormal + relief * .24));
    vec3 keyLight = normalize(vec3(-0.55, 0.87, 0.88));
    vec3 fillLight = normalize(vec3(0.75, 0.35, -0.40));
    float key = max(dot(n, keyLight), 0.0);
    float fill = max(dot(n, fillLight), 0.0);
    float shade = 0.70 + 0.32 * key + 0.13 * fill;
    // A little ambient occlusion at the stem-side edge gives the cap weight.
    shade *= mix(0.86, 1.0, smoothstep(-78.0, -32.0, vLocalPosition.y));
    float seam = 1.0 - smoothstep(.12, .65, abs(vLocalPosition.y + 74.4));
    shade *= 1.0 - seam * .045 * (1.0 - abs(localNormal.y));
    shade *= 1.0 + (grain - .5) * .075;
    if (uText > 0.5) {
      float coverage = texture2D(uLegends, vUV).a;
      if (coverage < 0.025) discard;
      gl_FragColor = vec4(vec3(0.115, 0.112, 0.105) * shade * coverage, coverage);
    } else {
      vec3 cream = vec3(0.96, 0.945, 0.91);
      vec3 view = normalize(vec3(0.0, 0.0, 1.0) - vPosition / 600.0);
      vec3 halfVector = normalize(keyLight + view);
      float softHighlight = pow(max(dot(n, halfVector), 0.0), mix(24.0, 42.0, grain)) * 0.075;
      gl_FragColor = vec4(min(cream * shade + softHighlight, 1.0), 1.0);
    }
  }
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(error);
  }
  return shader;
}

function multiply(a, b) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) result[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return result;
}

function rotation(x, y, z) {
  const rx = x * Math.PI / 180;
  const ry = y * Math.PI / 180;
  const rz = z * Math.PI / 180;
  const sx = Math.sin(rx), cx = Math.cos(rx);
  const sy = Math.sin(ry), cy = Math.cos(ry);
  const sz = Math.sin(rz), cz = Math.cos(rz);
  const xMatrix = new Float32Array([1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
  const yMatrix = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
  const zMatrix = new Float32Array([cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return multiply(multiply(xMatrix, yMatrix), zMatrix);
}

function projection(aspect) {
  const near = 1, far = 1500;
  // Hold the horizontal field of view while giving taller caps vertical room.
  const f = aspect / Math.tan(36 * Math.PI / 360);
  return new Float32Array([
    f / aspect, 0, 0, 0, 0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, 2 * far * near / (near - far), 0
  ]);
}

function roundedSquare(angle, half) {
  // Flat walls meet at tight molded corners, with only a small physical bevel.
  const radius = Math.min(4, half * .06);
  const segment = angle / (Math.PI / 4);
  const section = Math.floor(segment);
  const t = segment - section;
  const flat = half - radius;
  // Sample the straight edges too, so the finger dish has curved geometry
  // across the whole top instead of four broad, nearly planar triangles.
  if (section === 0) return [half, -flat + 2 * flat * t];
  if (section === 2) return [flat - 2 * flat * t, half];
  if (section === 4) return [-half, flat - 2 * flat * t];
  if (section === 6) return [-flat + 2 * flat * t, -half];
  const corner = (section - 1) / 2;
  const arc = (corner + t) * Math.PI / 2;
  const centerX = (corner === 0 || corner === 3 ? 1 : -1) * flat;
  const centerZ = (corner < 2 ? 1 : -1) * flat;
  return [centerX + radius * Math.cos(arc), centerZ + radius * Math.sin(arc)];
}

function topHeight(x, z) {
  const u = (x / 121) ** 2, v = (z / 121) ** 2;
  return 52 + 14 * (u + v - u * v);
}

function topNormal(x, y, z) {
  return [-28 * x / 121 ** 2 * (1 - (z / 121) ** 2), 1,
    -28 * z / 121 ** 2 * (1 - (x / 121) ** 2)];
}

const rings = [
  [150, -78], [152.5, -77.3], [153, -75], [152.7, -72.5],
  [128, 63], [127.6, 65.5], [126.5, 67], [124.5, 68],
  [122.5, 67.5], [121, 66],
  ...Array.from({length: 16}, (_, i) => {
    const half = 120 - i * 8;
    return [half, topHeight(half, 0)];
  })
];

function halfAtHeight(y) {
  for (let i = 0; i < 7; i++) {
    if (y <= rings[i + 1][1]) {
      const t = Math.max(0, Math.min(1, (y - rings[i][1]) / (rings[i + 1][1] - rings[i][1])));
      return rings[i][0] + (rings[i + 1][0] - rings[i][0]) * t;
    }
  }
  return rings[7][0];
}

function edgeAt(center, half) {
  const radius = Math.min(4, half * .06);
  const offset = Math.max(0, Math.min(radius, Math.abs(center) - (half - radius)));
  return half - radius + Math.sqrt(radius ** 2 - offset ** 2);
}

function geometry(gridRows, gridColumns, position, uvRange) {
  const vertices = [], uv = [], indices = [];
  for (let row = 0; row <= gridRows; row++) {
    for (let column = 0; column <= gridColumns; column++) {
      const u = column / gridColumns, v = row / gridRows;
      vertices.push(...position(u, v));
      uv.push(uvRange ? u : 0, uvRange ? (1 - (uvRange.row + 1) / 4 + v / 4) : 0);
      if (row < gridRows && column < gridColumns) {
        const a = row * (gridColumns + 1) + column;
        const b = a + gridColumns + 1;
        // A common ordering for all text quads, corrected by the supplied face normal.
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  return {vertices, uv, indices};
}

function makeBody() {
  const segments = 256;
  const vertices = [], indices = [];
  for (const [ring, [half, y]] of rings.entries()) {
    for (let i = 0; i < segments; i++) {
      const [x, z] = roundedSquare(i * Math.PI * 2 / segments, half);
      vertices.push(x, ring >= 9 ? topHeight(x, z) : y, z);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let i = 0; i < segments; i++) {
      const a = ring * segments + i;
      const b = ring * segments + (i + 1) % segments;
      const c = a + segments, d = b + segments;
      indices.push(a, c, b, b, c, d);
    }
  }
  // Bottom cap closes the shell, even when the visitor turns it.
  const centerIndex = vertices.length / 3;
  vertices.push(0, rings[0][1], 0);
  for (let i = 0; i < segments; i++) indices.push(centerIndex, i, (i + 1) % segments);
  return {vertices, indices, uv: new Array(vertices.length / 3 * 2).fill(0)};
}

function createLegendCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#1d1d1b';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  ['BUILD', 'BREAK', 'SECURE'].forEach((label, index) => {
    context.font = `700 ${size * 380 / 2048}px Arial, Helvetica, sans-serif`;
    const measured = context.measureText(label).width;
    const target = size * 1830 / 2048;
    context.save();
    context.translate(size / 2, size / 8 + size / 4 * index);
    context.scale(Math.min(1, target / measured), 1);
    context.fillText(label, 0, size / 128);
    context.restore();
  });
  return canvas;
}

function createPlasticTexture(gl) {
  const size = 256, heights = new Float32Array(size * size);
  let seed = 59317;
  for (let i = 0; i < heights.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    heights[i] = seed / 4294967296;
  }
  const pixels = new Uint8Array(size * size * 4);
  const at = (x, y) => heights[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      pixels[i] = Math.round(128 + (at(x + 1, y) - at(x - 1, y)) * 100);
      pixels[i + 1] = Math.round(128 + (at(x, y + 1) - at(x, y - 1)) * 100);
      pixels[i + 2] = Math.round(at(x, y) * 255);
      pixels[i + 3] = 255;
    }
  }
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.activeTexture(gl.TEXTURE0);
}

function createMesh(gl, data, normalDirection) {
  const {vertices, uv, indices} = data;
  const normals = new Float32Array(vertices.length);
  if (normalDirection) {
    for (let i = 0; i < normals.length; i += 3) {
      const n = normalDirection(vertices[i], vertices[i + 1], vertices[i + 2]);
      normals.set(n, i);
    }
  } else {
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const ab = [vertices[b] - vertices[a], vertices[b + 1] - vertices[a + 1], vertices[b + 2] - vertices[a + 2]];
      const ac = [vertices[c] - vertices[a], vertices[c + 1] - vertices[a + 1], vertices[c + 2] - vertices[a + 2]];
      const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      for (const vertex of [a, b, c]) for (let axis = 0; axis < 3; axis++) normals[vertex + axis] += n[axis];
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    for (let axis = 0; axis < 3; axis++) normals[i + axis] /= length;
  }
  const buffer = (target, values) => {
    const result = gl.createBuffer();
    gl.bindBuffer(target, result);
    gl.bufferData(target, values, gl.STATIC_DRAW);
    return result;
  };
  return {
    position: buffer(gl.ARRAY_BUFFER, new Float32Array(vertices)),
    normal: buffer(gl.ARRAY_BUFFER, normals),
    uv: buffer(gl.ARRAY_BUFFER, new Float32Array(uv)),
    indices: buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices)),
    count: indices.length
  };
}

export function initKeycapModel(scene, key) {
  const canvas = key.querySelector('.keycap-canvas');
  if (!canvas) return null;
  const gl = canvas.getContext('webgl', {alpha: true, antialias: true, premultipliedAlpha: true});
  if (!gl) return null;

  try {
    const program = gl.createProgram();
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    const body = createMesh(gl, makeBody());
    const top = createMesh(gl, geometry(22, 38, (u, v) => {
      const x = (u - .5) * 240, z = (.5 - v) * 68;
      return [x, topHeight(x, z) + .75, z];
    }, {row: 0}), topNormal);
    const front = createMesh(gl, geometry(16, 42, (u, v) => {
      const x = (u - .5) * 230, y = -7 + (v - .5) * 60;
      return [x, y, edgeAt(x, halfAtHeight(y)) + 1];
    }, {row: 1}), () => [0, .182, 1]);
    const side = createMesh(gl, geometry(16, 42, (u, v) => {
      const z = (u - .5) * 229, y = -7 + (v - .5) * 60;
      return [-edgeAt(z, halfAtHeight(y)) - 1, y, z];
    }, {row: 2}), () => [-1, .182, 0]);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // 4K lettering stays crisp on high-density screens; respect older GPUs.
    const textureSize = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, createLegendCanvas(textureSize));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
    if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    createPlasticTexture(gl);

    const locations = {
      position: gl.getAttribLocation(program, 'aPosition'),
      normal: gl.getAttribLocation(program, 'aNormal'),
      uv: gl.getAttribLocation(program, 'aUV'),
      model: gl.getUniformLocation(program, 'uModel'),
      view: gl.getUniformLocation(program, 'uView'),
      projection: gl.getUniformLocation(program, 'uProjection'),
      text: gl.getUniformLocation(program, 'uText'),
      legends: gl.getUniformLocation(program, 'uLegends'),
      surface: gl.getUniformLocation(program, 'uSurface')
    };
    const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -5, -680, 1]);
    gl.uniformMatrix4fv(locations.view, false, view);
    gl.uniform1i(locations.legends, 0);
    gl.uniform1i(locations.surface, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    function draw(mesh, ink) {
      for (const [attribute, buffer, size] of [
        [locations.position, mesh.position, 3], [locations.normal, mesh.normal, 3], [locations.uv, mesh.uv, 2]
      ]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 0, 0);
      }
      gl.uniform1f(locations.text, ink ? 1 : 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }

    scene.classList.add('keycap-enhanced');
    key.style.transform = 'scale(var(--key-scale))';
    let lost = false;
    let lastRotation = [-36, -20, -3];
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      lost = true;
      scene.classList.remove('keycap-enhanced');
      key.style.transform = `rotateX(${lastRotation[0]}deg) rotateY(${lastRotation[1]}deg) rotateZ(${lastRotation[2]}deg) scale(var(--key-scale))`;
    });
    return {
      render(cssX, cssY, cssZ) {
        if (lost) return;
        lastRotation = [cssX, cssY, cssZ];
        const bounds = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 3);
        const limit = Math.min(4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
        const width = Math.min(limit, Math.max(1, Math.round(bounds.width * ratio)));
        const height = Math.min(limit, Math.max(1, Math.round(bounds.height * ratio)));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
          gl.uniformMatrix4fv(locations.projection, false, projection(width / height));
        }
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // CSS uses downward Y; the actual 3D mesh uses upward Y.
        gl.uniformMatrix4fv(locations.model, false, rotation(-cssX, cssY, cssZ));
        gl.depthMask(true);
        draw(body, false);
        gl.depthMask(false);
        draw(top, true);
        draw(front, true);
        draw(side, true);
        gl.depthMask(true);
      }
    };
  } catch (error) {
    console.warn('Keycap WebGL unavailable; using CSS fallback.', error);
    return null;
  }
}
