const message = document.querySelector('#message');
const detail = document.querySelector('#detail');
const bar = document.querySelector('#bar');
const fill = document.querySelector('#fill');
const actions = document.querySelector('#actions');
const button = (label, action, secondary = false) => { const el = document.createElement('button'); el.textContent = label; el.className = secondary ? 'secondary' : ''; el.onclick = action; actions.append(el); };
function setActions(items = []) { actions.replaceChildren(); items.forEach((item) => button(...item)); }
window.orbitUpdate.onEvent((event) => {
  if (event.type === 'checking') { message.textContent = 'Procurando atualizações…'; detail.textContent = ''; bar.classList.add('hidden'); setActions([['Fechar', () => window.orbitUpdate.close(), true]]); }
  if (event.type === 'available') { message.textContent = `A versão ${event.version} está disponível.`; detail.textContent = 'Você pode baixar agora e continuar usando o Orbit.'; setActions([['Baixar atualização', () => window.orbitUpdate.download()], ['Depois', () => window.orbitUpdate.close(), true]]); }
  if (event.type === 'not-available') { message.textContent = 'O Orbit já está atualizado.'; detail.textContent = ''; setActions([['Fechar', () => window.orbitUpdate.close(), true]]); }
  if (event.type === 'progress') { message.textContent = 'Baixando atualização…'; detail.textContent = `${event.percent}%`; bar.classList.remove('hidden'); fill.style.width = `${event.percent}%`; setActions(); }
  if (event.type === 'downloaded') { message.textContent = 'Atualização pronta!'; detail.textContent = `Orbit ${event.version} será instalado após reiniciar.`; bar.classList.add('hidden'); setActions([['Reiniciar e atualizar', () => window.orbitUpdate.install()]]); }
  if (event.type === 'error') { message.textContent = 'Não foi possível verificar a atualização.'; detail.textContent = event.message || 'Tente novamente mais tarde.'; setActions([['Fechar', () => window.orbitUpdate.close(), true]]); }
});
