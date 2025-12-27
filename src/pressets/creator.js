export function createScenePreset(name, steps) {
  return {
    id: "user-" + Date.now(),
    name,
    type: "scene",
    steps
  };
}

export async function saveScenePreset(preset) {
  await window.electron.saveUserPreset(preset);
}
