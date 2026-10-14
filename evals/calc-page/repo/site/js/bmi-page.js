import { bmi } from './lib/bmi.js';

const form = document.querySelector('form');
const out = document.querySelector('#result');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const value = bmi(Number(form.elements.kg.value), Number(form.elements.m.value));
    out.textContent = `BMI ${value.toFixed(1)}`;
  } catch (error) {
    out.textContent = error.message;
  }
});
