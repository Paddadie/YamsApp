document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const homeScreen = document.getElementById('home-screen');
  const playersScreen = document.getElementById('players-screen');
  const playerForm = document.getElementById('player-form');
  const playerNameInput = document.getElementById('player-name');
  const playerList = document.getElementById('player-list');

  startBtn.addEventListener('click', () => {
    homeScreen.classList.remove('active');
    playersScreen.classList.add('active');
  });

  playerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim();
    if (name !== "") {
      const li = document.createElement('li');
      li.textContent = name;
      playerList.appendChild(li);
      playerNameInput.value = "";
    }
  });
});
