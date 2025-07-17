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

  // Scores stored per player, initialized empty at game start
  let playerScores = {};

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
    switchToScreen(playersScreen);
    loadPlayers();
    homeScreen.style.display = 'none';
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
    players.forEach(name => {
      playerScores[name] = {};
    });
    showCurrentPlayer();
    generateScoreTables();
    switchToScreen(gameScreen);
  });

  prevPlayerBtn.addEventListener('click', () => {
    currentPlayerIndex = (currentPlayerIndex - 1 + players.length) % players.length;
    showCurrentPlayer();
    generateScoreTables();
  });

  nextPlayerBtn.addEventListener('click', () => {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    showCurrentPlayer();
    generateScoreTables();
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

    const playerName = players[currentPlayerIndex];
    const scores = playerScores[playerName];

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
          button.textContent = scores[lineName] !== undefined ? scores[lineName] : '▼';

          const select = document.createElement('select');
          select.className = 'score-select';
          select.innerHTML = `<option value="">--</option>` + values.map(v => `<option value="${v}">${v}</option>`).join('');

          if (scores[lineName] !== undefined) {
            select.value = scores[lineName];
          }

          container.appendChild(button);
          container.appendChild(select);
          scoreCell.appendChild(container);

          button.addEventListener('click', () => {
            select.classList.add('show');
            select.focus();
            select.size = Math.min(values.length, 6);
          });

          select.addEventListener('change', () => {
            if (select.value === "") {
              delete scores[lineName];
              button.textContent = '▼';
            } else {
              scores[lineName] = parseInt(select.value, 10);
              button.textContent = select.value;
            }
            select.classList.remove('show');
            updateTotals();
          });

          select.addEventListener('blur', () => {
            select.classList.remove('show');
          });
        } else {
          scoreCell.textContent = getCalculatedScore(playerName, lineName);
          scoreCell.style.fontWeight = 'bold';
        }

        tr.appendChild(labelCell);
        tr.appendChild(scoreCell);
        table.appendChild(tr);
      }

      scoreTables.appendChild(table);
    }
  }

  function getCalculatedScore(playerName, lineName) {
    const scores = playerScores[playerName];
    if (!scores) return '';

    if (lineName === 'Bonus') {
      let sum = 0;
      for (let i = 1; i <= 6; i++) {
        sum += scores[i] || 0;
      }
      return sum >= 63 ? 35 : 0;
    } else if (lineName === 'Total Haut') {
      let sum = 0;
      for (let i = 1; i <= 6; i++) {
        sum += scores[i] || 0;
      }
      sum += getCalculatedScore(playerName, 'Bonus') || 0;
      return sum;
    } else if (lineName === 'Total Bas') {
      const basLines = ['Brelan', 'Full', 'Carré', 'Petite Suite', 'Grande Suite', 'Chance', 'Yams'];
      let sum = 0;
      basLines.forEach(name => {
        sum += scores[name] || 0;
      });
      return sum;
    } else if (lineName === 'Total') {
      const haut = getCalculatedScore(playerName, 'Total Haut') || 0;
      const bas = getCalculatedScore(playerName, 'Total Bas') || 0;
      return haut + bas;
    }
    return '';
  }

  function updateTotals() {
    generateScoreTables();
  }
});
