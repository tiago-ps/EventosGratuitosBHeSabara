(() => {
  if (document.querySelector('script[data-cursos-mural]')) return;
  const css=document.createElement('link');css.rel='stylesheet';css.href='css/cursos-mural.css?v=1';css.dataset.cursosMural='1';document.head.append(css);
  const js=document.createElement('script');js.src='js/cursos-mural.js?v=1';js.dataset.cursosMural='1';document.head.append(js);
})();
