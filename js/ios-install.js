(() => {
  const runtime=document.createElement('script');
  runtime.src='js/cursos-runtime-fix.js?v=1';
  runtime.dataset.cursosRuntimeFix='1';
  document.head.append(runtime);
})();

(() => {
  'use strict';

  // Correções complementares para os cursos já integrados nativamente ao Mural.
  // Não interfere nos QR Codes.
  let coursesByTitle = null;
  let loadingCourses = null;

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  function ensureCoursePanelStyles() {
    if (document.getElementById('course-panel-fixes')) return;
    const style = document.createElement('style');
    style.id = 'course-panel-fixes';
    style.textContent = `
      .course-slide .event-image { width:100%!important; height:100%!important; object-fit:cover!important; object-position:center!important; }
      .course-slide .badge.city { display:inline-flex!important; align-items:center; justify-content:center; width:auto!important; min-width:0!important; max-width:none!important; white-space:nowrap!important; overflow:visible!important; text-overflow:clip!important; line-height:1!important; }
      .course-slide .source-url a { color:inherit; text-decoration:underline; text-underline-offset:.18em; overflow-wrap:anywhere; }
    `;
    document.head.append(style);
  }

  function loadCourses() {
    if (coursesByTitle) return Promise.resolve(coursesByTitle);
    if (loadingCourses) return loadingCourses;
    loadingCourses = fetch(`cursos.json?v=${Date.now()}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(data => {
        coursesByTitle = new Map();
        for (const course of Array.isArray(data?.cursos) ? data.cursos : []) {
          const key = normalize(course?.titulo);
          if (key) coursesByTitle.set(key, course);
        }
        return coursesByTitle;
      })
      .catch(error => { console.warn('Não foi possível carregar os links dos cursos.', error); coursesByTitle = new Map(); return coursesByTitle; });
    return loadingCourses;
  }

  function patchCourseSlide() {
    const slide = document.querySelector('#app .slide');
    if (!slide) return;
    const category = slide.querySelector('.badge.category');
    if (normalize(category?.textContent) !== 'curso') { slide.classList.remove('course-slide'); return; }
    slide.classList.add('course-slide');
    const city = slide.querySelector('.badge.city');
    if (city) { city.hidden = false; city.textContent = 'ONLINE'; }
    const title = normalize(slide.querySelector('.event-title')?.textContent);
    if (!title) return;
    loadCourses().then(map => {
      if (!slide.isConnected || !slide.classList.contains('course-slide')) return;
      const course = map.get(title);
      const url = String(course?.url || course?.link || '').trim();
      if (!/^https?:\/\//i.test(url)) return;
      const source = slide.querySelector('.source-url');
      if (!source) return;
      const anchor = document.createElement('a');
      anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = 'Acessar página deste curso';
      source.replaceChildren(anchor);
    });
  }

  ensureCoursePanelStyles();
  patchCourseSlide();
  new MutationObserver(() => window.requestAnimationFrame(patchCourseSlide))
    .observe(document.getElementById('app') || document.body, { childList:true, subtree:true, characterData:true });
})();

(() => {
  'use strict';
  function isIosDevice(){const ua=navigator.userAgent||'',platform=navigator.platform||'',touchMac=platform==='MacIntel'&&navigator.maxTouchPoints>1;return /iPad|iPhone|iPod/.test(ua)||touchMac}
  function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
  function ensureStyles(){if(document.getElementById('ios-install-styles'))return;const style=document.createElement('style');style.id='ios-install-styles';style.textContent=`.ios-install-overlay[hidden]{display:none!important}.ios-install-overlay{position:fixed;inset:0;z-index:9999;display:grid;align-items:end;background:rgba(3,10,18,.72);backdrop-filter:blur(6px);padding:16px}.ios-install-panel{width:min(100%,520px);margin:0 auto;background:#0d1b2a;color:#f4f7fb;border:1px solid rgba(255,255,255,.14);border-radius:22px;box-shadow:0 22px 70px rgba(0,0,0,.42);padding:20px}.ios-install-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}.ios-install-header h2{margin:0;font-size:1.28rem}.ios-install-header p{margin:6px 0 0;color:rgba(244,247,251,.72);line-height:1.45}.ios-install-close{border:0;background:rgba(255,255,255,.09);color:inherit;width:38px;height:38px;border-radius:999px;font-size:1.35rem}.ios-install-steps{list-style:none;padding:0;margin:0;display:grid;gap:10px;counter-reset:ios-install-step}.ios-install-steps li{counter-increment:ios-install-step;display:grid;grid-template-columns:34px 1fr;align-items:start;gap:10px;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);line-height:1.4}.ios-install-steps li::before{content:counter(ios-install-step);display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:rgba(255,255,255,.13);font-weight:700}.ios-install-share-icon{display:inline-block;margin:0 4px;font-size:1.15em}.ios-install-note{margin:14px 2px 0;color:rgba(244,247,251,.68);font-size:.9rem;line-height:1.45}@media(min-width:700px){.ios-install-overlay{align-items:center}}`;document.head.append(style)}
  function ensurePanel(){let overlay=document.querySelector('.ios-install-overlay');if(overlay)return overlay;overlay=document.createElement('div');overlay.className='ios-install-overlay';overlay.hidden=true;overlay.innerHTML=`<section class="ios-install-panel" role="dialog" aria-modal="true" aria-labelledby="ios-install-title"><header class="ios-install-header"><div><h2 id="ios-install-title">Instalar o Mural Cultural</h2><p>No iPhone e no iPad, a instalação é feita pelo menu de compartilhamento do Safari.</p></div><button class="ios-install-close" type="button" aria-label="Fechar">×</button></header><ol class="ios-install-steps"><li>Toque em <strong>Compartilhar <span class="ios-install-share-icon" aria-hidden="true">⇧</span></strong> na barra do Safari.</li><li>Escolha <strong>Adicionar à Tela de Início</strong>.</li><li>Confirme <strong>Abrir como App da Web</strong> e toque em <strong>Adicionar</strong>.</li></ol><p class="ios-install-note">Se “Adicionar à Tela de Início” não estiver visível, role o menu de compartilhamento até o fim e use “Editar Ações”.</p></section>`;const close=()=>{overlay.hidden=true;document.body.style.removeProperty('overflow')};overlay.querySelector('.ios-install-close').addEventListener('click',close);overlay.addEventListener('click',e=>{if(e.target===overlay)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});document.body.append(overlay);return overlay}
  function openPanel(){const overlay=ensurePanel();overlay.hidden=false;document.body.style.overflow='hidden';overlay.querySelector('.ios-install-close')?.focus()}
  function prepareInstallButtons(){if(!isIosDevice()||isStandalone())return;document.querySelectorAll('.install-app-btn').forEach(button=>{button.hidden=false;button.dataset.iosInstall='1';if(button.dataset.iosInstallBound==='1')return;button.dataset.iosInstallBound='1';button.addEventListener('click',openPanel)})}
  if(!isIosDevice()||isStandalone())return;ensureStyles();prepareInstallButtons();new MutationObserver(()=>window.requestAnimationFrame(prepareInstallButtons)).observe(document.documentElement,{childList:true,subtree:true});
})();
