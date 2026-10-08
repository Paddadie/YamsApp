// Les dates du palmarès, des records et du post-it « Dernière victoire ».
//
// Écrites en ISO LOCAL (`2026-10-08T21:14`, `dateStamp`) depuis le 08/10/2026 :
// triables, et lisibles par n'importe quel code. Avant, c'était le texte
// d'affichage `jj/mm/aaaa` (toLocaleDateString fr-FR), sans heure ; la
// migration v8 les convertit (`isoFromFrench`), et `formatDate` lit encore les
// deux. Locale et non UTC : une partie finie à 0 h 30 à Paris est du jour même,
// pas de la veille.
//
// Affichage : relatif jusqu'à 30 jours, puis en clair (« 19 juil. 2026 »).

const DAY_MS = 86_400_000;

function parse(raw: string): Date | null {
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (fr) return new Date(+fr[3], +fr[2] - 1, +fr[1]);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  return null;
}

export function formatDate(raw: string): string {
  const d = parse(raw);
  if (!d || Number.isNaN(d.getTime())) return raw;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - d.getTime()) / DAY_MS);

  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days <= 30) return `il y a ${days} jours`;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Maintenant, en ISO local à la minute : la date à enregistrer.
export function dateStamp(now: Date = new Date()): string {
  const two = (n: number): string => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}` +
    `T${two(now.getHours())}:${two(now.getMinutes())}`
  );
}

// `jj/mm/aaaa` → `aaaa-mm-jj` (migration v8). Tout autre texte est rendu tel
// quel : une date qu'on ne sait pas lire n'est pas effacée.
export function isoFromFrench(raw: string): string {
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!fr) return raw;
  return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
}
