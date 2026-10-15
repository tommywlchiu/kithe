// Phase 0 concept art via the Gemini image model ("Nano Banana"), following
// docs/art/concept-prompts.md. Reads GEMINI_API_KEY from .env.local (never printed).
//   node scripts/gen-pup-art.mjs models
//   node scripts/gen-pup-art.mjs one <breed> <pose> <outFile> [referencePng] [model]
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const key = readFileSync(join(root, '.env.local'), 'utf8')
  .split(/\r?\n/)
  .map((l) => l.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/)?.[1])
  .find(Boolean);
if (!key || key === 'paste-your-key-here') {
  console.error('GEMINI_API_KEY is missing from .env.local');
  process.exit(1);
}

const API = 'https://generativelanguage.googleapis.com/v1beta';
const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' };

const STYLE =
  'Storybook realism, 2D digital painting of a single puppy, soft painterly shading with visible brush texture, warm natural light, realistic dog proportions and body language, slightly enlarged gentle eyes, subtle paper grain, palette of oat, cream, terracotta and sage, plain cream background (#F6F1E7), no text, no border, centered, whole body visible.';
const BREEDS = {
  beagle:
    'a young beagle puppy, tricolor coat (black saddle, tan, white chest and paws), long floppy ears, white-tipped tail',
  golden:
    'a young golden retriever puppy, fluffy light golden coat, soft feathered ears, round face',
  corgi:
    'a young Pembroke Welsh corgi puppy, red and white coat, big upright ears, short legs, fluffy rear',
};
const POSES = {
  thriving: 'standing in a playful bow, tail up mid-wag, bright eyes, mouth open in a happy pant',
  content: 'sitting calmly, relaxed ears, soft attentive expression, tail resting',
  mopey:
    'lying down with chin on paws, ears low, eyes looking up softly; calm and a little bored, not sad or sick',
  sleeping: 'curled up asleep on a small knitted blanket, eyes closed, peaceful',
  eating: 'head lowered into a simple terracotta food bowl, tail wagging',
};

async function listModels() {
  const res = await fetch(`${API}/models?pageSize=200`, { headers });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${body.error?.message ?? ''}`);
  for (const m of body.models ?? []) {
    if (/image/i.test(m.name)) console.log(m.name, '|', m.displayName);
  }
}

async function generate(breed, pose, outFile, referencePng, model) {
  const prompt = [
    STYLE,
    BREEDS[breed],
    POSES[pose],
    referencePng
      ? 'Match the attached reference image exactly in art style, brushwork, lighting, palette, background, framing and level of detail. Only the dog breed and pose change.'
      : '',
    'Square 1:1 image. The pup fills about 70% of the image height.',
  ]
    .filter(Boolean)
    .join(' ');
  const parts = [{ text: prompt }];
  if (referencePng) {
    parts.push({
      inline_data: {
        mime_type: /\.jpe?g$/i.test(referencePng) ? 'image/jpeg' : 'image/png',
        data: readFileSync(referencePng).toString('base64'),
      },
    });
  }
  const res = await fetch(`${API}/${model}:generateContent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${body.error?.message ?? JSON.stringify(body)}`);
  const image = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  const data = image?.inlineData?.data ?? image?.inline_data?.data;
  if (!data) throw new Error(`no image returned: ${JSON.stringify(body).slice(0, 300)}`);
  // Gemini may answer with JPEG even when asked for PNG; name the file after what came back,
  // because Android release builds reject an image whose extension lies.
  const mime = image?.inlineData?.mimeType ?? image?.inline_data?.mime_type ?? 'image/png';
  const saved = outFile.replace(/\.(png|jpe?g)$/i, mime === 'image/jpeg' ? '.jpg' : '.png');
  mkdirSync(dirname(saved), { recursive: true });
  writeFileSync(saved, Buffer.from(data, 'base64'));
  console.log(`saved ${saved}`);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === 'models') await listModels();
  else if (cmd === 'one') {
    const [breed, pose, outFile, reference, model = 'models/gemini-2.5-flash-image'] = args;
    if (!BREEDS[breed] || !POSES[pose] || !outFile)
      throw new Error('usage: one <breed> <pose> <outFile> [ref] [model]');
    await generate(
      breed,
      pose,
      outFile,
      reference && reference !== '-' ? reference : undefined,
      model,
    );
  } else throw new Error('usage: models | one ...');
} catch (error) {
  console.error(String(error.message ?? error));
  process.exit(1);
}
