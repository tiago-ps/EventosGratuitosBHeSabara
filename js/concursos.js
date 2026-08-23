(() => {
  'use strict';
  const lista=document.getElementById('lista'), busca=document.getElementById('busca'), formacao=document.getElementById('formacao'), resumo=document.getElementById('resumo'), estado=document.getElementById('estado');
  let concursos=[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function render(){
    const q=norm(busca.value), f=formacao.value;
    const itens=concursos.filter(c=>(!f||(c.formacoes_compativeis||[]).includes(f))&&(!q||norm([c.titulo,...(c.formacoes_compativeis||[])].join(' ')).includes(q)));
    resumo.textContent=`${itens.length} de ${concursos.length} oportunidades compatíveis com as formações acompanhadas.`;
    estado.hidden=itens.length>0; estado.textContent=itens.length?'':'Nenhum concurso corresponde aos filtros.';
    lista.innerHTML=itens.map(c=>`<article class="card"><div class="badges"><span>CONCURSO</span>${(c.formacoes_compativeis||[]).map(x=>`<span class="formacao">${esc(x)}</span>`).join('')}</div><h2>${esc(c.titulo)}</h2>${c.remuneracao_texto?`<p><strong>Remuneração:</strong> ${esc(c.remuneracao_texto)}</p>`:''}${c.inscricoes_texto?`<p><strong>Inscrições:</strong> ${esc(c.inscricoes_texto)}</p>`:''}<p class="fonte">Fonte: PCI Concursos · seleção automática por requisito/formação</p><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Ver concurso e edital ↗</a></article>`).join('');
  }
  fetch('concursos.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(data=>{
    concursos=Array.isArray(data.concursos)?data.concursos:[];
    const fs=[...new Set(concursos.flatMap(c=>c.formacoes_compativeis||[]))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    formacao.insertAdjacentHTML('beforeend',fs.map(f=>`<option>${esc(f)}</option>`).join('')); render();
  }).catch(e=>{resumo.textContent='Não foi possível carregar a base de concursos.'; estado.hidden=false; estado.textContent=`Erro: ${e.message}`});
  busca.addEventListener('input',render); formacao.addEventListener('change',render);
})();
