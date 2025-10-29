import { SVG } from '@svgdotjs/svg.js';
import { Svg } from '@svgdotjs/svg.js';

export function KikoraSetupSvgInstance(svg: Svg): Svg {
  const filterNode = document.createElementNS('http://www.w3.org/2000/svg', 'filter');

  filterNode.setAttribute('height', '130%');

  const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  feGaussianBlur.setAttribute('in', 'sourceAlpha');
  feGaussianBlur.setAttribute('stdDeviation', '5');

  const feOffset = document.createElementNS('http://www.w3.org/2000/svg', 'feOffset');
  feOffset.setAttribute('dx', '3');
  feOffset.setAttribute('dy', '3');
  feOffset.setAttribute('result', 'offsetblur');

  const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
  const feMergeNodeBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');

  feMergeNodeBlur.setAttribute('in', 'offsetBlur');
  feMerge.appendChild(feMergeNodeBlur);

  const feMergeNode = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');

  feMergeNode.setAttribute('in', 'SourceGraphic');
  feMerge.appendChild(feMergeNode);

  filterNode.id = 'dropShadow';
  filterNode.appendChild(feGaussianBlur);
  filterNode.appendChild(feOffset);
  filterNode.appendChild(feMerge);
  svg.node.appendChild(filterNode);

  const hatched = SVG().pattern(10, 10);
  hatched.rect(10, 10);
  hatched.line(0, 0, 0, 10);
  hatched.node.id = 'diagonalHatch';
  hatched.node.setAttribute('patternUnits', 'userSpaceOnUse');
  hatched.node.setAttribute('patternTransform', 'rotate(45 0 0 )');
  svg.add(hatched);

  const spotted = SVG().pattern(10, 10);
  spotted.rect(10, 10);
  spotted.circle(3).center(5, 5);
  spotted.node.id = 'spottedPattern';
  svg.add(spotted);
  svg.attr({ 'aria-hidden': true });
  return svg;
}
