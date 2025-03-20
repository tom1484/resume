export function filterDataByTitles(data, titles) {
  data = data.map(entry => [titles.indexOf(entry.title), entry]).filter(item => item[0] !== -1)
  data.sort();
  return data.map(item => item[1]);
}
