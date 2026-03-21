import * as THREE from 'three';

export function createSceneRuntime(viewportEl, mapDefinition) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(mapDefinition.visualModel.skyColor);
  scene.fog = new THREE.FogExp2(mapDefinition.visualModel.skyColor, mapDefinition.visualModel.fogDensity);

  let camSize = 8.6;
  let cameraAngle = Math.PI / 4;
  const cameraElevation = Math.atan(1 / Math.sqrt(2));

  const camera = new THREE.OrthographicCamera(-1, 1, camSize, -camSize, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewportEl.insertBefore(renderer.domElement, viewportEl.firstChild);

  scene.add(new THREE.AmbientLight(0x99aabb, 0.45));
  const sunLight = new THREE.DirectionalLight(0xfff0d0, 0.9);
  sunLight.position.set(10, 18, 8);
  sunLight.castShadow = true;
  sunLight.shadow.camera.left = -14;
  sunLight.shadow.camera.right = 14;
  sunLight.shadow.camera.top = 14;
  sunLight.shadow.camera.bottom = -14;
  sunLight.shadow.mapSize.set(1024, 1024);
  scene.add(sunLight);
  const fillLight = new THREE.DirectionalLight(0xaaccff, 0.25);
  fillLight.position.set(-8, 10, -6);
  scene.add(fillLight);

  function resize() {
    const rect = viewportEl.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    camera.left = -camSize * aspect;
    camera.right = camSize * aspect;
    camera.top = camSize;
    camera.bottom = -camSize;
    camera.position.set(
      Math.cos(cameraAngle) * Math.cos(cameraElevation) * 40,
      Math.sin(cameraElevation) * 40,
      Math.sin(cameraAngle) * Math.cos(cameraElevation) * 40,
    );
    camera.lookAt(0, 0, -2.4);
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height);
  }

  function rotate(deltaX) {
    cameraAngle += deltaX * 0.006;
    resize();
  }

  function zoom(deltaY) {
    camSize = Math.max(4.2, Math.min(13.5, camSize + deltaY * 0.004));
    resize();
  }

  resize();

  return {
    scene,
    camera,
    renderer,
    resize,
    rotate,
    zoom,
    get cameraAngle() {
      return cameraAngle;
    },
  };
}
