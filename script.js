document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const homeScreen = document.getElementById('home-screen');
  const playersScreen = document.getElementById('players-screen');
  const gameScreen = document.getElementById('game-screen');

  const playerForm = document.getElementById('player-form');
  const playerNameInput = document.getElementById('player-name');
  const playerList = document.getElementById('player-list');
  const startGameBtn = document.getElementById('start-game-btn');

  const currentPlayerName = document.getElementById('current-player-name');
  const prevPlayerBtn = document.getElementById('prev-player-btn');
  const nextPlayerBtn = document.getElementById('next-player-btn');

  const players = [];
  let currentPlayerIndex = 0;

  function switchToScreen(screen) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    screen.classList.add('active');
  }

  function updateStartGameBtn() {
    startGameBtn.disabled = players.length < 2;
  }

  function renderPlayers() {
    playerList.innerHTML = "";
    players.forEach((name, idx) => {
      const li = document.createElement('li');
      li.textContent = name;

      const removeBtn = document.createElement('button');
      removeBtn.innerHTML = "&#10060;";
      removeBtn.className = "remove-player";
      removeBtn.setAttribute("aria-label", "Supprimer " + name);
      removeBtn.addEventListener('click', () => {
        players.splice(idx, 1);
        renderPlayers();
        savePlayers();
        updateStartGameBtn();
      });

      li.appendChild(removeBtn);
      playerList.appendChild(li);
    });
    updateStartGameBtn();
  }

  function savePlayers() {
    localStorage.setItem('yamsPlayers', JSON.stringify(players));
  }

  function loadPlayers() {
    const saved = localStorage.getItem('yamsPlayers');
    if (saved) {
      players.splice(0, players.length, ...JSON.parse(saved));
      renderPlayers();
    }
  }

  function showCurrentPlayer() {
    currentPlayerName.textContent = players[currentPlayerIndex];
  }

  startBtn.addEventListener('click', () => {
    switchToScreen(playersScreen);
    loadPlayers();
  });

  playerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim();
    if (name !== "" && !players.includes(name)) {
      players.push(name);
      renderPlayers();
      savePlayers();
      playerNameInput.value = "";
      updateStartGameBtn();
    }
  });

  startGameBtn.addEventListener('click', () => {
    currentPlayerIndex = 0;
    showCurrentPlayer();
    switchToScreen(gameScreen);
  });

  prevPlayerBtn.addEventListener('click', () => {
    currentPlayerIndex = (currentPlayerIndex - 1 + players.length) % players.length;
    showCurrentPlayer();
  });

  nextPlayerBtn.addEventListener('click', () => {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    showCurrentPlayer();
  });
});
