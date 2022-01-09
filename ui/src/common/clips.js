export function clipCSS(coords) {
  return `polygon(${clipPoints(coords).join(', ')})`;
}

export function clipPoints(coords) {
  return coords.map((i) => {
    return i
      .map((o) => {
        return o + '%';
      })
      .join(' ');
  });
}
