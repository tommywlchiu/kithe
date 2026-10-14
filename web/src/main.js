import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config.js';
import { isReason, sanitizeRef, uuidV4, validateSignup } from './validate.js';

const ref = sanitizeRef(new URLSearchParams(window.location.search).get('ref'));

const HEADERS = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };

// The database functions answer the same way whether or not an email is already listed,
// so the page never reveals who signed up.
async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(args),
  });
  if (res.ok) return;
  const error = new Error(`${fn} failed (${res.status})`);
  error.status = res.status;
  throw error;
}

function failureMessage(error) {
  if (error.status === 400) return 'Please double-check your email and try again.';
  if (error.status === 401 || error.status === 403 || error.status === 404) {
    return "Something's wrong on our side. Please email marqueofficialhq@gmail.com and we'll add you by hand.";
  }
  return 'Something went wrong saving your spot. Please try again in a minute.';
}

const form = document.querySelector('#waitlist-form');
const formSection = document.querySelector('#form-section');
const thanks = document.querySelector('#thanks');
const status = document.querySelector('#form-status');
const submit = form.querySelector('button[type="submit"]');
const reasonStatus = document.querySelector('#reason-status');
const reasonButtons = () => document.querySelectorAll('#reasons button');
let signupId = null;

function showErrors(errors) {
  for (const field of ['email', 'phone', 'age']) {
    const el = document.querySelector(`#${field}-error`);
    el.textContent = errors[field] ?? '';
    el.hidden = !errors[field];
  }
  const first = ['email', 'phone', 'age'].find((f) => errors[f]);
  if (first) document.querySelector(`[data-field="${first}"]`).focus();
}

function showThanks() {
  formSection.hidden = true;
  thanks.hidden = false;
  thanks.focus();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  // Honeypot: real visitors never see this field. Bots get the normal thank-you screen.
  if (data.get('kithe_hp')) {
    showThanks();
    return;
  }

  const result = validateSignup({
    email: data.get('email'),
    phone: data.get('phone'),
    isAdult: data.get('adult') === 'yes',
  });
  showErrors(result.ok ? {} : result.errors);
  if (!result.ok) return;

  submit.disabled = true;
  status.textContent = 'Saving your spot...';
  try {
    const id = uuidV4();
    await rpc('join_waitlist', {
      p_id: id,
      p_email: result.value.email,
      p_phone: result.value.phone,
      p_is_adult: true,
      p_ref: ref,
    });
    signupId = id;
    showThanks();
  } catch (error) {
    status.textContent = failureMessage(error);
    submit.disabled = false;
  }
});

document.querySelector('#reasons').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-reason]');
  if (!button || !signupId || !isReason(button.dataset.reason)) return;
  for (const b of reasonButtons()) b.disabled = true;
  try {
    await rpc('answer_waitlist', { p_signup_id: signupId, p_reason: button.dataset.reason });
    reasonStatus.textContent = 'Thank you, that really helps.';
  } catch {
    reasonStatus.textContent = "That didn't save. Tap your answer again?";
    for (const b of reasonButtons()) b.disabled = false;
  }
});
