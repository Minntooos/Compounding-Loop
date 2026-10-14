import { litresNeeded } from './lib/paint.js';

const form = document.querySelector('form');
const out = document.querySelector('#result');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const litres = litresNeeded(Number(form.elements.area.value), Number(form.elements.coverage.value), Number(form.elements.coats.value));
    out.textContent = `Buy ${litres} litres`;
  } catch (error) {
    out.textContent = error.message;
  }
});
