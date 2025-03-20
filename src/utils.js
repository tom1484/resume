export function filterDataByTitles(data, titles) {
  return data.map(entry => [titles.indexOf(entry.title), entry]).filter(item => item[0] !== -1).sort().map(item => item[1]);
}
