async function run() {
  const pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5";
  const evals = [40, 52, 45, 50, 48, 55, 60, 62, 50, 45, 55, 60, 58, 65, 70, 72, 60, 55, 65, 70];
  const prompt = `You are an expert chess coach. Analyze the following game and provide a detailed review in Russian language, pointing out key moments and giving recommendations, as a coach would do.
  
IMPORTANT: Do NOT output any reasoning or thinking steps. ONLY output the final review in Russian. Keep your response CONCISE and to the point.

PGN: ${pgn}
Evaluations (centipawns): ${JSON.stringify(evals)}`;
  const response = await fetch('https://text.pollinations.ai/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });
  const root = await response.json();
  console.log(JSON.stringify(root, null, 2));
}
run();
