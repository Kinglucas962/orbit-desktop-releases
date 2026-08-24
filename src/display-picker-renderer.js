const container = document.querySelector('#sources');
const cancel = document.querySelector('#cancel');
const close = document.querySelector('#close');
const systemAudio = document.querySelector('#system-audio');
const tabs = [...document.querySelectorAll('.tab')];
let activeRequestId;
let allSources = [];
let activeKind = 'screen';

function renderSources() {
  container.replaceChildren();
  const visibleSources = allSources.filter((source) => source.id.startsWith(`${activeKind}:`));

  if (visibleSources.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'loading';
    empty.textContent = activeKind === 'screen' ? 'Nenhuma tela encontrada.' : 'Nenhuma janela encontrada.';
    container.append(empty);
    return;
  }

  for (const source of visibleSources) {
    const button = document.createElement('button');
    button.className = 'source';
    button.type = 'button';
    button.title = source.name;
    const thumbnail = document.createElement('img');
    thumbnail.src = source.thumbnail;
    thumbnail.alt = '';
    const name = document.createElement('span');
    name.textContent = source.name;
    button.append(thumbnail, name);
    button.addEventListener('click', () => window.orbitDisplayPicker.select(
      activeRequestId,
      source.id,
      systemAudio.checked
    ));
    container.append(button);
  }
}

window.orbitDisplayPicker.onSources(({ requestId, sources, audioRequested }) => {
  activeRequestId = requestId;
  allSources = sources;
  systemAudio.checked = Boolean(audioRequested);
  systemAudio.disabled = !audioRequested;
  systemAudio.closest('label').hidden = !audioRequested;
  renderSources();
});

tabs.forEach((tab) => tab.addEventListener('click', () => {
  activeKind = tab.dataset.kind;
  tabs.forEach((item) => item.classList.toggle('active', item === tab));
  renderSources();
}));

function cancelPicker() {
  if (activeRequestId) window.orbitDisplayPicker.cancel(activeRequestId);
  else window.close();
}

cancel.addEventListener('click', cancelPicker);
close.addEventListener('click', cancelPicker);
