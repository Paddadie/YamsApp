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
  const scoreTables = document.getElementById('score-tables');

  const players = [];
  let currentPlayerIndex = 0;

  function switchToScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
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
    homeScreen.style.display = 'none';
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
    generateScoreTables();
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

  const scoreConfig = {
    haut: {
      '1': [0, 1, 2, 3, 4, 5],
      '2': [0, 2, 4, 6, 8, 10],
      '3': [0, 3, 6, 9, 12, 15],
      '4': [0, 4, 8, 12, 16, 20],
      '5': [0, 5, 10, 15, 20, 25],
      '6': [0, 6, 12, 18, 24, 30],
      'Bonus': [],
      'Total Haut': [],
    },
    bas: {
      'Brelan': Array.from({ length: 31 }, (_, i) => i),
      'Full': [0, 25],
      'Carré': [0, 40],
      'Petite Suite': [0, 30],
      'Grande Suite': [0, 40],
      'Chance': Array.from({ length: 31 }, (_, i) => i),
      'Yams': [0, 50],
      'Total Bas': [],
    },
    total: {
      'Total': [],
    }
  };

  function generateScoreTables() {
    scoreTables.innerHTML = "";

    for (const section in scoreConfig) {
      const table = document.createElement('table');
      table.className = 'score-table';

      for (const lineName in scoreConfig[section]) {
        const values = scoreConfig[section][lineName];
        const tr = document.createElement('tr');

        const labelCell = document.createElement('td');
        labelCell.textContent = lineName;

        const scoreCell = document.createElement('td');
        if (values.length > 0) {
          const container = document.createElement('div');
          container.className = 'dropdown-container';

          const button = document.createElement('button');
          button.className = 'dropdown-btn';
          button.textContent = '▼';

          const select = document.createElement('select');
          select.className = 'score-select';
          select.innerHTML = `<option value=\"\">--</option>` + values.map(v => `<option value=\"${v}\">${v}</option>`).join('');

          container.appendChild(button);
          container.appendChild(select);
          scoreCell.appendChild(container);

          button.addEventListener('click', () => {
            document.querySelectorAll('.score-select').forEach(sel => sel.classList.remove('open'));
            select.classList.toggle('open');
          });

          select.addEventListener('change', () => {
            button.textContent = select.value || '▼';
            select.classList.remove('open');
          });
        } else {
          scoreCell.textContent = '-';
        }

        tr.appendChild(labelCell);
        tr.appendChild(scoreCell);
        table.appendChild(tr);
      }

      scoreTables.appendChild(table);
    }
  }
});
