document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const homeScreen = document.getElementById('home-screen');
  const playersScreen = document.getElementById('players-screen');
  const playerForm = document.getElementById('player-form');
  const playerNameInput = document.getElementById('player-name');
  const playerList = document.getElementById('player-list');
  const startGameBtn = document.getElementById('start-game-btn');

  const players = [];

  function updateStartGameBtn() {
    startGameBtn.disabled = players.length < 2; // Minimum 2 joueurs
  }

  function renderPlayers() {
    playerList.innerHTML = "";
    players.forEach((name, idx) => {
      const li = document.createElement('li');
      li.textContent = name;

      // Bouton suppression
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

  startBtn.addEventListener('click', () => {
    homeScreen.classList.remove('active');
    playersScreen.classList.add('active');
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
    // Ici, vous pouvez afficher l'écran de jeu ou démarrer la partie
    alert("La partie commence !");
  });
});