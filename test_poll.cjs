async function run() {
  const prompt = `Translate "hello" to Russian.`;
  const response = await fetch('https://text.pollinations.ai/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const root = await response.json();
  console.log(JSON.stringify(root, null, 2));
}
run();
