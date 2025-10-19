(() => {
  function disableSounds(target) {
    if (!target) {
      return;
    }

    if ('soundsDirectory' in target) {
      try {
        target.soundsDirectory = null;
      } catch (error) {
        // Ignore: the property may be read-only on this object.
      }
    }

    if ('keypressSound' in target) {
      try {
        target.keypressSound = null;
      } catch (error) {
        // Ignore: fall back to disabling individual sound slots if available.
        const slots = ['spacebar', 'return', 'delete', 'default'];
        for (const slot of slots) {
          if (target.keypressSound && slot in target.keypressSound) {
            target.keypressSound[slot] = null;
          }
        }
      }
    }

    if ('plonkSound' in target) {
      try {
        target.plonkSound = null;
      } catch (error) {
        // Ignore attempts to reset immutable properties.
      }
    }

    if ('keypressVibration' in target && typeof target.keypressVibration === 'boolean') {
      try {
        target.keypressVibration = false;
      } catch (error) {
        // Ignore failures when the property is read-only.
      }
    }
  }

  const ASSET_BASE_PATH = '/vendor/cdn/mathlive';
  const mathfieldAssetConfig = {
    fontsDirectory: `${ASSET_BASE_PATH}/fonts`,
    soundsDirectory: `${ASSET_BASE_PATH}/sounds`,
    virtualKeyboardLayout: `${ASSET_BASE_PATH}/virtual-keyboards`,
    customVirtualKeyboardLayers: `${ASSET_BASE_PATH}/virtual-keyboards/layers`,
    customVirtualKeyboards: `${ASSET_BASE_PATH}/virtual-keyboards/layouts`,
    virtualKeyboardToolbar: `${ASSET_BASE_PATH}/virtual-keyboards/toolbar`,
  };

  const keyboardAssetConfig = {
    soundsDirectory: `${ASSET_BASE_PATH}/sounds`,
  };

  function applyOfflineConfig(target, config) {
    if (!target) {
      return;
    }

    for (const [property, value] of Object.entries(config)) {
      try {
        target[property] = value;
      } catch (error) {
        // Ignore: some properties may be read-only or unsupported in this context.
      }
    }
  }

  let isConfigured = false;

  async function configureMathLiveOffline() {
    if (typeof window === 'undefined' || isConfigured) {
      return;
    }

    if (window.customElements && typeof window.customElements.whenDefined === 'function') {
      try {
        await window.customElements.whenDefined('math-field');
      } catch (error) {
        // Ignore failures: we'll attempt to configure with whatever is available.
      }
    }

    if (!window.MathfieldElement) {
      return;
    }

    isConfigured = true;

    applyOfflineConfig(window.MathfieldElement, mathfieldAssetConfig);
    applyOfflineConfig(window.mathVirtualKeyboard, keyboardAssetConfig);

    disableSounds(window.MathfieldElement);
    disableSounds(window.mathVirtualKeyboard);
  }

  configureMathLiveOffline();

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configureMathLiveOffline, { once: true });
  }
})();
