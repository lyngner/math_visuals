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

  function configureMathLiveOffline() {
    if (typeof window === 'undefined') {
      return;
    }

    disableSounds(window.MathfieldElement);
    disableSounds(window.mathVirtualKeyboard);
  }

  configureMathLiveOffline();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configureMathLiveOffline, { once: true });
  }
})();
