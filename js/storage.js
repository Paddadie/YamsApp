export function loadFromStorage(key) {
  return JSON.parse(localStorage.getItem(key)) || [];
}

export function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
