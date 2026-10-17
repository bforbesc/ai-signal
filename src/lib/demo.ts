import type { Newsletter } from './gmail';
function sample(id: string, sender: string, subject: string, snippet: string, html: string, daysAgo: number): Newsletter {
  return { id, source: { id: 'demo-alphasignal', name: 'AlphaSignal', address: '', listId: '' }, sender, subject, snippet, html, date: Date.now() - daysAgo * 86400000, text: '', address: '', readMinutes: 3, isRead: false };
}
// Original, fictional content. No private messages, recipient addresses or tracking links are bundled.
export const DEMO: Newsletter[] = [
  sample('demo-1', 'AlphaSignal · sample', 'The next chapter of AI is about working together.', 'Smaller models, better tools, and a new way to think about agents. Here are the ideas worth making time for today.', `
    <p>Good morning.</p><p>Some of the most interesting progress in AI is happening between the models: how they share work, use tools, and help people keep track of the result.</p>
    <h2>When one task becomes a team effort</h2><p>Imagine a coding assistant that can investigate a bug, read the documentation, and prepare a fix in separate workspaces. The challenge becomes less about doing everything at once and more about making each result easy to review.</p><p>The useful question is simple: does the extra coordination make the work clearer, or just busier?</p>
    <h2>Small models, useful places</h2><p>A smaller model running on a laptop can make an everyday feature feel immediate. Searching a personal collection of notes is a good example: the best experience might be the one you barely notice.</p>
    <h2>One thing to try</h2><p>Choose a task you repeat each week. Write down its steps before reaching for a tool. A clear workflow is often the most useful starting point.</p>
    `, 0),
  sample('demo-2', 'AlphaSignal · sample', 'A useful question: what would make this easier to trust?', 'A short reading note on evaluating AI systems, with room to slow down and think beyond the headline.', `
    <p>There is a difference between a compelling demonstration and a tool you can rely on every day.</p><h2>Start with an ordinary task</h2><p>Try the same task several times. Keep the inputs and the criteria clear. Notice where the result helps and where someone still needs to check it.</p><p>That small habit can tell you more than a long list of impressive features.</p><h2>Keep people in the loop</h2><p>Good tools make it easy to see what happened, correct a mistake, and decide what comes next. Those details deserve as much attention as the model itself.</p>`, 1),
  sample('demo-3', 'AlphaSignal · sample', 'Less scrolling for news. More time to understand it.', 'One label, a few good newsletters, and a quieter place to read. That is the whole idea behind AI Signal.', `
    <p>Your inbox is a good place for messages. A reading feed can be a better place for newsletters.</p><h2>Keep the good parts</h2><p>Label the editions you want to read in Gmail. Open AI Signal when you have a quiet moment. Read one thing at a time.</p><p>No extra folders to manage. No generated summaries between you and the original writing.</p>`, 2),
];
