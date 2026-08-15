// ZeekFit 3D beta: loads the published Mixamo character and animation
// and retargets the animation onto the character's actual skeleton.
(async () => {
  const CHARACTER_URL = 'https://github.com/ObikeZeek/ZeekFit/releases/download/3d-beta/Ch31_nonPBR.fbx';
  const PUSHUP_URL = 'https://github.com/ObikeZeek/ZeekFit/releases/download/3d-beta/Push.Up.1.fbx';

  const loadThree = async () => {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    const { FBXLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js');
    const { OrbitControls } = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js');
    const SkeletonUtils = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/SkeletonUtils.js');
    return { THREE, FBXLoader, OrbitControls, SkeletonUtils };
  };

  let libs;
  try {
    libs = await loadThree();
  } catch (error) {
    console.error('ZeekFit 3D: Three.js failed to load.', error);
    return;
  }

  const { THREE, FBXLoader, OrbitControls, SkeletonUtils } = libs;
  const viewers = new WeakMap();

  // Find the skinned mesh that owns the character's actual skeleton.
  const findSkin = (root) => {
    let skin = null;
    root.traverse((object) => {
      if (!skin && object.isSkinnedMesh && object.skeleton) skin = object;
    });
    return skin;
  };

  const makePanel = (modal) => {
    if (!modal) return null;
    const avatar = modal.querySelector('.avatarbox');
    if (!avatar) return null;

    let canvas = avatar.querySelector('.zeek3d-canvas');
    let badge = avatar.querySelector('.zeek3d-status');

    if (!canvas) {
      avatar.innerHTML = '';
      avatar.style.position = 'relative';

      badge = document.createElement('div');
      badge.className = 'zeek3d-status';
      badge.style.cssText = 'position:absolute;z-index:2;left:12px;top:12px;background:rgba(8,9,11,.82);border:1px solid #2a2f38;padding:7px 10px;border-radius:11px;font-size:12px;color:#bfc7d2';
      badge.textContent = 'Loading 3D trainer…';

      canvas = document.createElement('canvas');
      canvas.className = 'zeek3d-canvas';
      canvas.style.cssText = 'width:100%;height:100%;display:block';

      avatar.appendChild(badge);
      avatar.appendChild(canvas);
    }

    return { canvas, badge };
  };

  async function show3D(modal, animationName) {
    const panel = makePanel(modal);
    if (!panel) return;

    const { canvas, badge } = panel;
    const old = viewers.get(modal);
    if (old) old.dispose();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08090b);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const controls = new OrbitControls( camera, canvas );
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 20;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x20242b, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(4, 7, 5);
    scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5, 64),
      new THREE.MeshStandardMaterial({ color: 0x15191f, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    let disposed = false;
    let mixer = null;
    let currentAction = null;
    const clock = new THREE.Clock();
    const loader = new FBXLoader();

    const loadModel = (url) => new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

    badge.textContent = 'Loading Mixamo character…';

    try {
      const model = await loadModel(CHARACTER_URL);
      if (disposed) return;

      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      scene.add(model);

      // Find the target skeleton before applying any animation.
      const targetSkin = findSkin(model);
      if (!targetSkin) {
        throw new Error('The character FBX does not contain a usable skinned mesh.');
      }

      // Normalize the character to fit the existing ZeekFit exercise window.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z) || 1;

      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box.min.y;

      const scale = 2.2 / maxDimension;
      model.scale.setScalar(scale);

      camera.position.set(2.8, 1.5, 3.2);
      controls.target.set(0, 1.0, 0);
      controls.update();

      if (animationName === 'pushup') {
        badge.textContent = 'Loading push-up animation…';
        const animationModel = await loadModel(PUSHUP_URL);
        if (disposed) return;

        const sourceSkin = findSkin(animationModel);
        const clip = animationModel.animations?.[0];

        if (!sourceSkin || !clip) {
          throw new Error('The push-up FBX did not contain a usable animation skeleton/clip.');
        }

        // The previous version applied the raw animation clip directly to the
        // character root. That can scramble a Mixamo rig because the clip's
        // tracks belong to the source skeleton. Retarget the clip explicitly
        // to the character's SkinnedMesh, then animate that target mesh.
        const retargetedClip = SkeletonUtils.retargetClip(
          targetSkin,
          sourceSkin,
          clip,
          {
            hip: 'mixamorigHips',
            useFirstFramePosition: true,
            preservePosition: true,
            preserveHipPosition: true
          }
        );

        mixer = new THREE.AnimationMixer(targetSkin);
        currentAction = mixer.clipAction(retargetedClip);
        currentAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
        badge.textContent = '3D push-up trainer ready';
      } else {
        badge.textContent = '3D trainer loaded';
      }
    } catch (error) {
      console.error('ZeekFit 3D asset/animation load failed.', error);
      badge.textContent = '3D animation setup failed';
    }

    const tick = () => {
      if (disposed) return;
      requestAnimationFrame(tick);
      const delta = Math.min(clock.getDelta(), 0.05);
      if (mixer) mixer.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    viewers.set(modal, {
      dispose() {
        disposed = true;
        if (currentAction) currentAction.stop();
        if (mixer) mixer.stopAllAction();
        renderer.dispose();
        controls.dispose();
        window.removeEventListener('resize', onResize);
        scene.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          }
        });
      }
    });
  }

  // Watch the existing app's modal state. The main app stays untouched.
  const observer = new MutationObserver(() => {
    const exerciseModal = document.getElementById('exerciseModal');
    if (exerciseModal?.classList.contains('open')) {
      const title = document.getElementById('exTitle')?.textContent || '';
      show3D(exerciseModal, /push-up/i.test(title) ? 'pushup' : null);
    }

    const workoutModal = document.getElementById('workoutModal');
    if (workoutModal?.classList.contains('open')) {
      const title = document.getElementById('sessionTitle')?.textContent || '';
      show3D(workoutModal, /push-up/i.test(title) ? 'pushup' : null);
    }
  });

  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
})();