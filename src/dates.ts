// Affichage des dates du Hall of Fame : relatif jusqu'à 30 jours, puis en
// clair (« 19 juil. 2026 »). Les dates stockées sont au format `jj/mm/aaaa`
// (toLocaleDateString fr-FR) ; on tolère aussi l'ISO au cas où.

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
