import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config.js';
import { isReason, sanitizeRef, validateSignup } from './validate.js';

const ref = sanitizeRef(new URLSearchParams(window.location.search).get('ref'));

function headers() {
  const h = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
  // Legacy anon keys are JWTs and also go in Authorization; new publishable keys do not.
  if (SUPABASE_PUBLISHABLE_KEY.startsWith('eyJ')) {
    h.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
  }
  return h;
}

/** @returns {Promise<'created' | 'duplicate'>} */
async function insert(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(row),
  });
  if (res.ok) return 'created';
  if (res.status === 409) return 'duplicate';
  throw new Error(`waitlist insert failed (${res.status})`);
}

const form = document.querySelector('#waitlist-form');
const formSection = document.querySelector('#form-section');
const thanks = document.querySelector('#thanks');
const thanksTitle = document.querySelector('#thanks-title');
const status = document.querySelector('#form-status');
const submit = form.querySelector('button[type="submit"]');
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  if (data.get('website')) return; // honeypot: humans never see this field

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
    signupId = crypto.randomUUID();
    const outcome = await insert('waitlist_signups', {
      id: signupId,
      email: result.value.email,
      phone: result.value.phone,
      is_adult: true,
      ref,
    });
    if (outcome === 'duplicate') {
      signupId = null;
      thanksTitle.textContent = "You're already on the list! Watch your inbox for your invite.";
    }
    formSection.hidden = true;
    thanks.hidden = false;
    thanks.focus();
  } catch {
    status.textContent = 'Something went wrong saving your spot. Please try again in a minute.';
    submit.disabled = false;
  }
});

document.querySelector('#reasons').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-reason]');
  if (!button || !signupId) {
    if (button) document.querySelector('#reason-status').textContent = 'Thank you!';
    return;
  }
  const reason = button.dataset.reason;
  if (!isReason(reason)) return;
  for (const b of document.querySelectorAll('#reasons button')) b.disabled = true;
  try {
    await insert('waitlist_answers', { signup_id: signupId, reason });
  } catch {
    // Optional question; the signup is already saved.
  }
  document.querySelector('#reason-status').textContent = 'Thank you, that really helps.';
});
