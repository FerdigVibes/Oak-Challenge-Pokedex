let emulator = null;

const canvas = document.getElementById('screen');
const romInput = document.getElementById('rom-input');

romInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const buffer = await file.arrayBuffer();

  if (emulator) {
    emulator.stop();
    emulator = null;
  }

  emulator = new Binjgb(canvas, {
    rom: new Uint8Array(buffer),
    bootrom: null, // Optional
  });

  emulator.run();
});
