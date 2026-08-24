(() => {
  'use strict';

  const contestsContent = window.MuralCultural.contents.contests;
  const list = document.getElementById('lista');
  const search = document.getElementById('busca');
  const formation = document.getElementById('formacao');
  const uf = document.getElementById('uf');
  const deadline = document.getElementById('prazo');
  const summary = document.getElementById('resumo');
  const status = document.getElementById('estado');
  let contests = [];

  function render() {
    const items = contestsContent.filter(contests, {
      query: search.value,
      formation: formation.value,
      uf: uf.value,
      deadline: deadline.value
    });

    summary.textContent = `${items.length} de ${contests.length} oportunidades compatíveis com as formações acompanhadas.`;
    status.hidden = items.length > 0;
    status.textContent = items.length ? '' : 'Nenhum concurso corresponde aos filtros.';

    list.innerHTML = items.map(contest => {
      const location = [contest.cidade, contest.uf].filter(Boolean).join(' / ');
      const positions = (contest.cargos_compativeis || []).slice(0, 5);
      const image = contest.imagem || contestsContent.FALLBACK_IMAGE;
      const escape = contestsContent.escapeHtml;

      return `<article class="card"><img class="card-imagem" src="${escape(image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${contestsContent.FALLBACK_IMAGE}'"><div class="card-corpo"><div class="badges"><span>CONCURSO</span>${(contest.formacoes_compativeis || []).map(item => `<span class="formacao">${escape(item)}</span>`).join('')}</div><h2>${escape(contest.titulo)}</h2>${location ? `<p><strong>Localidade:</strong> ${escape(location)}</p>` : ''}${contest.inscricoes_texto ? `<p><strong>Inscrições:</strong> ${escape(contest.inscricoes_texto)}</p>` : '<p class="dado-pendente"><strong>Inscrições:</strong> consulte o edital</p>'}${contest.remuneracao_faixa_texto ? `<p><strong>Faixa de remuneração do concurso:</strong> ${escape(contest.remuneracao_faixa_texto)}</p>` : ''}${positions.length ? `<div class="cargos"><strong>Cargos possivelmente compatíveis:</strong><ul>${positions.map(item => `<li>${escape(item.cargo)}${item.vagas_texto ? ` — ${escape(item.vagas_texto)}` : ''}</li>`).join('')}</ul></div>` : ''}<p class="fonte">Fonte: PCI Concursos · seleção automática. Confirme requisitos, remuneração e vagas no edital.</p><a href="${escape(contest.url)}" target="_blank" rel="noopener noreferrer">Ver concurso e edital ↗</a></div></article>`;
    }).join('');
  }

  fetch('concursos.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      const source = Array.isArray(data.concursos) ? data.concursos : [];
      contests = source
        .filter(contestsContent.isValid)
        .map(contestsContent.publicRecord);

      for (const [, label] of contestsContent.formationOptions(contests)) {
        formation.add(new Option(label, label));
      }
      for (const [, label] of contestsContent.ufOptions(contests)) {
        uf.add(new Option(label, label));
      }
      render();
    })
    .catch(error => {
      summary.textContent = 'Não foi possível carregar a base de concursos.';
      status.hidden = false;
      status.textContent = `Erro: ${error.message}`;
    });

  [search, formation, uf, deadline].forEach(element => {
    element.addEventListener(element === search ? 'input' : 'change', render);
  });
})();
