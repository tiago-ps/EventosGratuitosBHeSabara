(() => {
  'use strict';

  // Compatibilidade temporária com renderCourseSlide em app.js.
  // Essas funções eram chamadas pelo renderizador de cursos, mas não existiam.
  window.updateCounter = function updateCounter() {
    const slide = document.querySelector('#app .slide');
    const counter = slide?.querySelector('.counter');
    if (!counter) return;
    // O contador correto já é mantido pelos renderizadores nativos de evento/livro.
    // No curso, preserva o valor existente em vez de interromper toda a interface.
  };

  window.restartProgress = function restartProgress() {
    const progress = document.querySelector('#app .progress span');
    if (!progress) return;
    progress.style.animation = 'none';
    // Força reflow para reiniciar a animação CSS sem gerar exceção.
    void progress.offsetWidth;
    progress.style.removeProperty('animation');
  };
})();
