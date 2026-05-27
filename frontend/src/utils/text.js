export function pluralize(count, singular, plural) {
  return Number(count) === 1 ? singular : plural;
}

export function transactionLabel(count) {
  const n = Number(count) || 0;
  return `${n} ${pluralize(n, 'transação', 'transações')}`;
}
