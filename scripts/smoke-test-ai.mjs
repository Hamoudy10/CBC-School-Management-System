// scripts/smoke-test-ai.mjs
// Smoke test for AI features - tests Groq API connectivity + each endpoint
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load .env.local manually (Next.js style)
function loadEnv() {
  try {
    const envPath = resolve(root, '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      // Remove surrounding quotes
      const clean = value.replace(/^["']|["']$/g, '');
      process.env[key] = clean;
    }
  } catch (err) {
    console.error('WARN: Could not load .env.local:', err.message);
  }
}

loadEnv();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function test(name, fn) {
  return async () => {
    process.stdout.write(`  ${name} ... `);
    try {
      await fn();
      console.log('PASS');
      passed++;
    } catch (err) {
      console.log('FAIL');
      console.log(`    ${err.message}`);
      failed++;
    }
  };
}

// ─── Groq API Direct Test ──────────────────────────────

const testGroqConnection = test('Groq API key is set', async () => {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
  if (GROQ_API_KEY.length < 10) throw new Error('GROQ_API_KEY looks invalid (too short)');
});

const testGroqSimpleCompletion = test('Groq simple text completion', async () => {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Reply with a single word.' },
        { role: 'user', content: 'Say hello' },
      ],
      max_tokens: 10,
      temperature: 0,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('No content in response');
  }
  console.log(`\n    Response: "${data.choices[0].message.content.trim()}"`);
  console.log(`    Model: ${data.model}, Tokens: ${data.usage?.total_tokens || '?'}`);
});

const testGroqJsonCompletion = test('Groq JSON completion', async () => {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Reply in JSON format. Only output the JSON object, no other text.' },
        { role: 'user', content: 'Return a JSON object with keys: name, score (number 1-4), subject' },
      ],
      max_tokens: 100,
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in response');
  const parsed = JSON.parse(content);
  if (!parsed.name || !parsed.score || !parsed.subject) {
    throw new Error(`Missing expected keys. Got: ${content.slice(0, 200)}`);
  }
  console.log(`\n    Parsed: ${JSON.stringify(parsed)}`);
  console.log(`    Score range OK: ${parsed.score >= 1 && parsed.score <= 4}`);
});

// ─── Supabase Connection Test ──────────────────────────

const testSupabaseConnection = test('Supabase connection', async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase credentials not set');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { 'apikey': SUPABASE_KEY },
  });
  console.log(`\n    URL reachable: ${SUPABASE_URL} (HTTP ${res.status})`);
});

const testSupabaseSchools = test('Supabase - list schools', async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/schools?select=*&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(`\n    Schools found: ${data.length}`);
  if (data.length > 0) {
    const keys = Object.keys(data[0]);
    console.log(`    Columns: ${keys.join(', ')}`);
    console.log(`    PK type: ${keys.includes('school_id') ? 'school_id' : keys.includes('id') ? 'id' : 'unknown'}`);
  }
});

// ─── Voice Mark Entry (AI parsing test) ───────────────

const testVoiceParsingAI = test('Voice Mark Entry - AI parses dictation', async () => {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a CBC assessment mark entry assistant.
Extract student_name, subject, strand, and score (1-4) from dictation.
Return JSON with exactly these keys: student_name, subject, strand, score.`,
        },
        {
          role: 'user',
          content: 'John Kamau scores 3 in mathematics, strand: measurements',
        },
      ],
      max_tokens: 200,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content');
  const parsed = JSON.parse(content);
  const key = parsed.studentName ?? parsed.student_name;
  if (!key) throw new Error(`No student name found. Got: ${content.slice(0, 200)}`);
  if (parsed.score === undefined && parsed.score === null) throw new Error('No score found');
  console.log(`\n    Input: "John Kamau scores 3 in mathematics, strand: measurements"`);
  console.log(`    Parsed: ${JSON.stringify(parsed)}`);
});

// ─── Adaptive Homework (AI generation test) ───────────

const testAdaptiveHomeworkAI = test('Adaptive Homework - AI generates worksheet', async () => {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a CBC assessment assistant for Kenyan schools.
Generate a practice worksheet for a student struggling with measurements.
Questions should be CBC-aligned for Grade 5 Mathematics.
Respond in JSON format with questions array.`,
        },
        {
          role: 'user',
          content: 'Generate 3 practice questions on measurements for a Grade 5 student who scored 2/4.',
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content');
  const parsed = JSON.parse(content);
  console.log(`\n    AI Response preview: ${JSON.stringify(parsed).slice(0, 300)}...`);
});

// ─── Fee Predictor (AI analysis test) ─────────────────

const testFeePredictorAI = test('Fee Predictor - AI analyzes payment patterns', async () => {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a school fee collection analyst.
Analyze the payment pattern and return risk level (low/medium/high), factors, and recommendations.
Respond in JSON format.`,
        },
        {
          role: 'user',
          content: `Student payment history: 3 late payments out of 6 total, 
last payment 45 days ago, average delay 12 days.
Current balance: KES 5,000 overdue.`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content');
  const parsed = JSON.parse(content);
  console.log(`\n    Risk analysis: ${JSON.stringify(parsed).slice(0, 300)}...`);
});

// ─── Run all tests ─────────────────────────────────────

const allTests = [
  ['GROQ_API_KEY', testGroqConnection],
  ['Groq Text Completion', testGroqSimpleCompletion],
  ['Groq JSON Completion', testGroqJsonCompletion],
  ['Supabase Connection', testSupabaseConnection],
  ['Supabase Schools', testSupabaseSchools],
  ['Voice Mark AI Parsing', testVoiceParsingAI],
  ['Adaptive Homework AI', testAdaptiveHomeworkAI],
  ['Fee Predictor AI', testFeePredictorAI],
];

(async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║    AI Features Smoke Test Suite          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  for (const [name, fn] of allTests) {
    await fn();
  }

  const total = passed + failed;
  console.log('');
  console.log('─'.repeat(40));
  console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
})();
