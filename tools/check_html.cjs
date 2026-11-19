const fs = require('fs');
const html = fs.readFileSync('C:/apps-flavio/Sistema de Vacaciones/index.html', 'utf8');

// Check how many times 'Enlace Celular' appears
const matches = html.split('Enlace Celular');
console.log('Occurrences of Enlace Celular:', matches.length - 1);

// Check unclosed tags
const openDivs = (html.match(/<div\b/gi) || []).length;
const closeDivs = (html.match(/<\/div>/gi) || []).length;
console.log('Open divs:', openDivs, 'Close divs:', closeDivs);

