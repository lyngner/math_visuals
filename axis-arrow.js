(function (global) {
  const X_AXIS_ARROW_SVG_TEMPLATE =
    '<svg width="17" height="30" viewBox="0 0 17 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.1421 16.1421C16.9231 15.3611 16.9231 14.0948 16.1421 13.3137L3.41417 0.5858C2.63313 -0.195248 1.3668 -0.195248 0.585748 0.5858C-0.195301 1.36685 -0.195301 2.63318 0.585748 3.41423L11.8995 14.7279L0.585748 26.0416C-0.195301 26.8227 -0.195301 28.089 0.585748 28.8701C1.3668 29.6511 2.63313 29.6511 3.41417 28.8701L16.1421 16.1421ZM14.7278 14.7279V16.7279H14.7279V14.7279V12.7279H14.7278V14.7279Z" fill="{{COLOR}}"/></svg>';
  const Y_AXIS_ARROW_SVG_TEMPLATE =
    '<svg width="30" height="17" viewBox="0 0 30 17" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.1422 0.585778C15.3612 -0.195271 14.0949 -0.195271 13.3138 0.585778L0.585892 13.3137C-0.195157 14.0947 -0.195157 15.3611 0.585892 16.1421C1.36694 16.9232 2.63327 16.9232 3.41432 16.1421L14.728 4.82842L26.0417 16.1421C26.8228 16.9232 28.0891 16.9232 28.8702 16.1421C29.6512 15.3611 29.6512 14.0947 28.8702 13.3137L16.1422 0.585778ZM14.728 2.00009L16.728 2.00009V1.99999L14.728 1.99999L12.728 1.99999V2.00009L14.728 2.00009Z" fill="{{COLOR}}"/></svg>';

  const BASE_DIMENSIONS = {
    x: { width: 17, height: 30, thicknessAxis: 'height' },
    y: { width: 30, height: 17, thicknessAxis: 'width' }
  };

  function sanitizeColor(color, fallback) {
    if (typeof color === 'string') {
      const trimmed = color.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    return typeof fallback === 'string' && fallback ? fallback : '#000000';
  }

  function getTemplate(axis) {
    return axis === 'y' ? Y_AXIS_ARROW_SVG_TEMPLATE : X_AXIS_ARROW_SVG_TEMPLATE;
  }

  function getBaseDimensions(axis) {
    return BASE_DIMENSIONS[axis === 'y' ? 'y' : 'x'];
  }

  function getSvgData(axis, color, fallbackColor) {
    const template = getTemplate(axis);
    const tint = sanitizeColor(color, fallbackColor);
    return `data:image/svg+xml;utf8,${encodeURIComponent(template.replace(/{{COLOR}}/g, tint))}`;
  }

  function getNativeSize(axis) {
    const dims = getBaseDimensions(axis);
    if (!dims) {
      return { width: 0, height: 0 };
    }
    return { width: dims.width, height: dims.height };
  }

  function getScaledSize(axis, targetThickness) {
    const dims = getBaseDimensions(axis);
    if (!dims) {
      return { width: 0, height: 0 };
    }
    const thicknessKey = dims.thicknessAxis;
    const thickness = dims[thicknessKey];
    if (!Number.isFinite(targetThickness) || targetThickness <= 0) {
      return { width: dims.width, height: dims.height };
    }
    const scale = targetThickness / thickness;
    return {
      width: dims.width * scale,
      height: dims.height * scale
    };
  }

  const api = {
    getSvgData,
    getNativeSize,
    getScaledSize
  };

  if (global && typeof global === 'object') {
    global.MathVisualsAxisArrow = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
