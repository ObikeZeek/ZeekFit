// ZeekFit 3D beta: replaces the existing exercise avatar with a real Mixamo
// FBX viewer when the model files are present, while leaving the existing app
// as a fallback if they are not yet uploaded.
(async () => {
  const loadThree = async () => {
    const three = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    const { FBXLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js');
    const { OrbitControls } = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js');
    return { THREE: three, FBXLoader, OrbitControls };
  };

  const makePanel = (modal) => {
    if (!modal || modal.dataset.zeek3d) return null;
    const avatar = modal.querySelector('.avatarbox');
    if (!avatar) return null;
    modal.dataset.zeek3d = '1';
    avatar.innerHTML = '<div class="zeek3d-status">Loading 3D trainer…</div><canvas class="zeek3d-canvas"></canvas>';
    avatar.style.position = 'relative';
    const canvas = avatar.querySelector('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    const badge = avatar.querySelector('.zeek3d-status');
    badge.style.cssText = 'position:absolute;z-index:2;left:12px;top:12px;background:rgba(8,9,11,.78);border:1px solid #2a2f38;padding:7px 10px;border-radius:11px;font-size:12px;color:#bfc7d2';
    return { canvas, badge };
  };

  let libs;
  try { libs = await loadThree(); } catch (_) { return; }
  const { THREE, FBXLoader, OrbitControls } = libs;
  const viewers = new WeakMap();

  async function show3D(modal, animationName) {
    const panel = makePanel(modal);
    if (!panel) return;
    const { canvas, badge } = panel;
    const old = viewers.get(modal);
    if (old) old.dispose();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08090b);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x20242b, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(4, 7, 5);
    scene.add(key);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 64), new THREE.MeshStandardMaterial({ color:0x15191f, roughness:.9 }));
    floor.rotation.x = -Math.PI/2;
    scene.add(floor);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(r.height, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);
    let disposed = false;
    let mixer = null;
    const clock = new THREE.Clock();
    const loader = new FBXLoader();

    badge.textContent = 'Loading Mixamo character…';
    loader.load('./models/character.fbx', model => {
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const max = Math.max(size.x, size.y, size.z);
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box.min.y;
      camera.position.set(max * 2.5, max * 1.1, max * 2.5);
      controls.target.set(0, max * .45, 0);
      controls.update();
      badge.textContent = animationName ? 'Loading push-up animation…' : '3D trainer loaded';

      if (animationName === 'pushup') {
        loader.load('./models/pushup.fbx', animModel => {
          const clip = animModel.animations && animModel.animations[0];
          if (!clip) { badge.textContent = 'Character loaded · no animation clip'; return; }
          mixer = new THREE.AnimationMixer(model);
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
          badge.textContent = '3D push-up trainer ready';
        }, undefined, () => { badge.textContent = 'Character loaded · animation unavailable'; });
      }
    }, undefined, () => {
      badge.textContent = '3D asset not installed — using existing fallback';
    });

    const tick = () => {
      if (disposed) return;
      requestAnimationFrame(tick);
      if (mixer) mixer.update(clock.getDelta());
      controls.update();
      renderer.render(scene, camera);
    };
    tick();
    viewers.set(modal, { dispose() { disposed = true; renderer.dispose(); controls.dispose(); window.removeEventListener('resize', resize); } });
  }

  const observer = new MutationObserver(() => {
    const ex = document.getElementById('exerciseModal');
    if (ex?.classList.contains('open')) {
      const title = document.getElementById('exTitle')?.textContent || '';
      show3D(ex, /push-up/i.test(title) ? 'pushup' : null);
    }
    const session = document.getElementById('workoutModal');
    if (session?.classList.contains('open')) {
      const title = document.getElementById('sessionTitle')?.textContent || '';
      show3D(session, /push-up/i.test(title) ? 'pushup' : null);
    }
  });
  observer.observe(document.body, { subtree:true, attributes:true, attributeFilter:['class'] });
})();