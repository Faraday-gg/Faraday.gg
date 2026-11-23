// La montaña se dibuja en el mismo espacio que la vía. El campo base está en y = 0.
(() => {
  const profile = [
    [-4.75, -.14, -.14, -.14], [-4.67, -.30, -.12, .05], [-4.59, -.39, -.11, .29],
    [-4.54, -.42, -.10, .42], [-4.34, -.43, -.07, .44], [-4.20, -.46, -.04, .39],
    [-4.02, -.48, .00, .43], [-3.83, -.62, .10, .49], [-3.65, -.59, .12, .68],
    [-3.42, -.78, .18, .70], [-3.18, -.82, .22, .91], [-2.96, -1.01, .22, .84],
    [-2.73, -.97, .18, 1.02], [-2.49, -1.23, .15, 1.19], [-2.20, -1.27, .04, 1.25],
    [-1.91, -1.35, -.04, 1.44], [-1.65, -1.49, -.12, 1.38], [-1.39, -1.43, -.14, 1.58],
    [-1.12, -1.55, -.12, 1.64], [-.80, -1.60, -.06, 1.69], [-.47, -1.72, .02, 1.77],
    [-.18, -1.78, .10, 1.72], [.08, -1.84, .16, 1.85], [.35, -1.94, .20, 1.91]
  ];
  const palettes = [
    { y: -4.75, shadow: [37, 61, 78], light: [151, 178, 185] },
    { y: -3.57, shadow: [37, 55, 70], light: [123, 149, 161] },
    { y: -2.69, shadow: [42, 56, 67], light: [124, 143, 149] },
    { y: -1.84, shadow: [43, 59, 61], light: [145, 147, 129] },
    { y: -.89, shadow: [44, 60, 57], light: [142, 138, 105] },
    { y: .35, shadow: [48, 60, 48], light: [157, 134, 101] }
  ];
  const ranges = [
    { color: '#8aa6a9', y: .46, shift: .012, ridge: [0, .06, .24, .14, .40, .31, .58, .37, .46, .25, .37, .16, .34, .25, .41, .52, .40, .30, .37] },
    { color: '#65878c', y: .57, shift: .032, ridge: [.11, .32, .26, .51, .43, .31, .44, .31, .13, .33, .16, .22, .09, .31, .29, .54, .36, .22, .36] },
    { color: '#4b6c73', y: .71, shift: .055, ridge: [.15, .38, .33, .23, .33, .16, .21, .06, .20, .29, .45, .26, .19, .33, .35, .24, .12, .22, .26] },
    { color: '#365963', y: .86, shift: .083, ridge: [.33, .24, .34, .16, .24, .16, .11, .22, .32, .23, .11, .13, .06, .26, .31, .22, .37, .31, .24] }
  ];
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const noise = seed => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const color = components => 'rgb(' + components.map(value => Math.round(clamp(value, 0, 255))).join(',') + ')';

  function between(rows, y, sample) {
    const right = rows.findIndex(row => sample(row) >= y);
    if (right <= 0) {
      const row = right < 0 ? rows.at(-1) : rows[0];
      return [row, row, 0];
    }
    const before = rows[right - 1], after = rows[right];
    return [before, after, (y - sample(before)) / (sample(after) - sample(before))];
  }

  function crossSection(y) {
    const [a, b, t] = between(profile, y, row => row[0]);
    return [1, 2, 3].map(index => mix(a[index], b[index], t));
  }

  function routeX(y) {
    const westFace = -.4 * clamp((y + 3.1) / 2.25);
    return westFace + .15 * Math.sin(-y * 1.62) + .065 * Math.sin(-y * 3.17);
  }

  function rockColor(y, tone, shade) {
    const [a, b, t] = between(palettes, y, stop => stop.y);
    return color(a.shadow.map((component, i) => {
      const dark = mix(component, b.shadow[i], t);
      const light = mix(a.light[i], b.light[i], t);
      return mix(dark, light, tone) + shade;
    }));
  }

  const columns = [0, .13, .31, .51, .64, .82, 1];
  const stripTones = [.22, .30, .12, .77, .94, .63];
  const rows = profile.flatMap(([y], i) => {
    const next = profile[i + 1]?.[0];
    return next === undefined ? [y] : [y, mix(y, next, .30 + noise(i + 67) * .4)];
  });
  const stones = rows.map((y, i) => {
    const [left, crest, right] = crossSection(y);
    const rough = Math.min(.12, (right - left) * .15);
    return columns.map((part, column) => {
      const offset = column === 0 || column === columns.length - 1 ? 0 : (noise(i * 11 + column) - .5) * rough;
      const x = part <= .51 ? mix(left, crest, part / .51) : mix(crest, right, (part - .51) / .49);
      const dy = column > 0 && column < columns.length - 1 && i > 0 && i < rows.length - 1 ? (noise(i * 26 + column) - .5) * .076 : 0;
      return [x + offset, y + dy];
    });
  });
  const litEdge = stones.map(row => row.at(-1));
  const silhouette = [...stones.map(row => row[0]), ...[...litEdge].reverse()];
  const bands = stones.slice(0, -1).map((row, i) => {
    const next = stones[i + 1];
    const y = (rows[i] + rows[i + 1]) / 2;
    const facets = stripTones.flatMap((tone, j) => {
      const corners = [row[j], row[j + 1], next[j + 1], next[j]];
      const shade = (noise(i * 21 + j * 29) - .5) * 18, colors = [rockColor(y, tone, shade), rockColor(y, tone, shade * .56 - 5)];
      const shapes = (i + j) % 3 ? [[0, 1, 3], [1, 2, 3]] : [[0, 1, 2], [0, 2, 3]];
      return shapes.map((shape, index) => ({ path: shape.map(corner => corners[corner]), color: colors[index] }));
    });
    return { top: rows[i] - .05, bottom: rows[i + 1] + .05, facets };
  });

  // Aristas de nieve: se adelgazan en grietas y dejan roca a la vista.
  const snow = [
    { points: [[-.14, -4.75], [-.30, -4.67], [-.42, -4.54], [-.46, -4.33], [-.49, -4.0], [-.34, -4.04], [-.31, -4.18], [-.22, -4.19], [-.24, -4.03], [-.39, -3.79], [-.18, -3.92], [-.09, -4.10], [-.19, -4.39]], fill: '#9db6be' },
    { points: [[-.14, -4.75], [.05, -4.67], [.29, -4.59], [.43, -4.54], [.46, -4.40], [.33, -4.43], [.37, -4.22], [.43, -4.02], [.52, -3.78], [.38, -3.85], [.36, -3.75], [.23, -3.90], [.19, -3.88], [.20, -3.68], [.08, -3.79], [.10, -3.58], [.00, -3.76], [-.08, -3.68], [-.06, -3.91], [-.01, -4.10], [-.10, -4.05], [-.10, -4.27], [-.19, -4.39]], fill: '#d9e2db' },
    { points: [[-.14, -4.75], [.05, -4.67], [.29, -4.59], [.43, -4.54], [.23, -4.50], [.07, -4.57], [-.15, -4.60]], fill: '#f3eee0' },
    { points: [[.31, -4.43], [.39, -4.38], [.37, -4.22], [.43, -4.02], [.52, -3.78], [.38, -3.85], [.36, -3.75], [.28, -3.84], [.35, -3.92], [.25, -4.24]], fill: '#a8bdc0' },
    { points: [[.36, -3.55], [.51, -3.67], [.66, -3.68], [.68, -3.58], [.53, -3.55], [.47, -3.43], [.39, -3.47], [.31, -3.36]], fill: '#bccbcc' },
    { points: [[-.61, -3.71], [-.48, -3.75], [-.41, -3.72], [-.51, -3.66], [-.53, -3.54], [-.61, -3.60], [-.67, -3.53]], fill: '#78959f' },
    { points: [[.55, -3.29], [.70, -3.40], [.79, -3.33], [.67, -3.30], [.61, -3.19]], fill: '#a7bfc2' },
    { points: [[-.22, -3.49], [-.05, -3.57], [.04, -3.53], [-.07, -3.46], [-.10, -3.35], [-.16, -3.45]], fill: '#acc0c2' },
    { points: [[-.75, -3.32], [-.65, -3.39], [-.55, -3.35], [-.67, -3.27], [-.69, -3.19], [-.79, -3.17]], fill: '#7f9ca3' }
  ];
  const seams = bands.flatMap(({ top, bottom }, i) => Array.from({ length: 8 }, (_, j) => {
    const n = i * 23 + j;
    const y = mix(top + .05, bottom - .05, noise(n + 41));
    const [left, , right] = crossSection(y);
    const x = mix(left, right, .06 + noise(n + 83) * .90);
    const length = .018 + noise(n + 89) * .092;
    const direction = noise(n + 104) > .45 ? 1 : -1;
    return {
      y, points: [[x, y], [x + direction * length, y - .028], [x + direction * (length + .015), y - .050]],
      ink: j % 3 ? '#dae2d020' : '#142a3660'
    };
  }));
  const trees = Array.from({ length: 69 }, (_, i) => {
    const y = mix(-.64, .33, noise(i + 71)), [left, , right] = crossSection(y);
    const x = i % 2 ? mix(.54, right - .08, noise(i + 12)) : mix(left + .08, -.46, noise(i + 19));
    return { x, y, size: .034 + noise(i + 172) * .10, ink: ['#233f3b', '#365247', '#4e6550', '#526d55'][i % 4] };
  }).sort((a, b) => a.y - b.y);

  function shape(ctx, points, fill, stroke, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
    if (fill) {
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function atmosphere(ctx, width, height, altitude, origin, unit) {
    const high = clamp(altitude / 7000);
    const sky = ctx.createLinearGradient(0, 0, width * .14, height);
    sky.addColorStop(0, color([63 - high * 15, 101 - high * 20, 117 + high * 6]));
    sky.addColorStop(.56, color([166 - high * 39, 196 - high * 20, 184 + high * 4]));
    sky.addColorStop(1, '#e9d4a4');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const sunX = width * .22, sunY = height * (.27 + high * .22);
    const sunRadius = Math.min(width, height) * .047;
    const glow = ctx.createRadialGradient(sunX, sunY, sunRadius * .18, sunX, sunY, sunRadius * 5);
    glow.addColorStop(0, '#ffe5a9c7');
    glow.addColorStop(1, '#ffe5a900');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffeaba';
    ctx.fill();

    for (let i = 0; i < 5; i++) {
      const y = height * (.16 + i * .12 + high * .22), start = width * (i % 2 ? .58 : -.10);
      const span = width * (.34 + noise(i + 117) * .25);
      ctx.beginPath();
      ctx.moveTo(start, y + height * .014);
      ctx.bezierCurveTo(start + span * .38, y - height * .012, start + span * .57, y + height * .005, start + span, y);
      ctx.bezierCurveTo(start + span * .57, y + height * .021, start + span * .25, y + height * .026, start, y + height * .014);
      ctx.fillStyle = i % 2 ? '#f7e8c144' : '#e9e7cc50';
      ctx.fill();
    }

    // Solo el fondo tiene paralaje. Las formas de la ladera permanecen en el mundo.
    const drift = clamp((origin[0] - width / 2) / Math.max(1, unit), -2, 2) * width;
    for (const range of ranges) {
      const y = height * (range.y + high * .21);
      const points = range.ridge.map((peak, i) => [
        width * (i / (range.ridge.length - 1) * 1.22 - .11) + drift * range.shift,
        y - height * peak * .29
      ]);
      shape(ctx, [...points, [points.at(-1)[0], height], [points[0][0], height]], range.color);
      if (range === ranges[0]) {
        for (const index of [4, 6, 8, 15]) {
          const [x, peak] = points[index];
          const left = points[index - 1], right = points[index + 1];
          shape(ctx, [[mix(x, left[0], .39), mix(peak, left[1], .39)], [x, peak],
            [mix(x, right[0], .45), mix(peak, right[1], .45)], [x + width * .009, peak + height * .019]],
          '#d1ded3');
        }
      }
    }

    const haze = ctx.createLinearGradient(0, height * .57, 0, height);
    haze.addColorStop(0, '#b8cbbc00');
    haze.addColorStop(.54, '#b8cbbc36');
    haze.addColorStop(1, '#26444b38');
    ctx.fillStyle = haze;
    ctx.fillRect(0, height * .57, width, height * .43);
  }

  function conifer(ctx, { x, y, size, ink }) {
    const half = size * .27;
    shape(ctx, [[x, y - size * 1.30], [x + half * .58, y - size * .67], [x + half * .22, y - size * .73],
      [x + half, y - size * .17], [x + half * .32, y - size * .25], [x + half * .08, y], [x - half * .08, y],
      [x - half * .30, y - size * .25], [x - half, y - size * .13], [x - half * .21, y - size * .71],
      [x - half * .53, y - size * .67]], ink);
  }

  function draw(ctx, { width, height, project, unit, altitude }) {
    if (!(width > 0 && height > 0 && unit > 0)) return;
    const origin = project([0, 0]);
    atmosphere(ctx, width, height, altitude, origin, unit);
    const top = -origin[1] / unit, bottom = (height - origin[1]) / unit;
    ctx.save();
    ctx.translate(...origin);
    ctx.scale(unit, unit);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    shape(ctx, silhouette, '#475960');
    ctx.save();
    ctx.clip();
    for (const band of bands) {
      if (band.bottom < top || band.top > bottom) continue;
      for (const facet of band.facets) {
        shape(ctx, facet.path, facet.color, facet.color, .65 / unit);
      }
    }
    if (top < -3.12) {
      for (const patch of snow) shape(ctx, patch.points, patch.fill);
    }
    for (const seam of seams) {
      if (seam.y < top - .08 || seam.y > bottom + .08 || (unit < 88 && seam.ink !== '#142a3660')) continue;
      shape(ctx, seam.points, null, seam.ink, Math.max(.0024, .60 / unit));
    }
    if (bottom > -.81) {
      for (const tree of trees) conifer(ctx, tree);
    }
    ctx.restore();
    shape(ctx, litEdge, null, '#efe8c766', 1.2 / unit);
    ctx.restore();
  }

  window.AscensionTerrain = { draw, routeX };
})();
