#!/usr/bin/env node
import { isRecipeId, recipeIds, runRecipe, type Variant } from './recipes.js';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: agent-failure-recipes [duplicate-action|premature-done|retry-storm] [--variant broken|repaired] [--json]\nWithout --variant, verifies that broken fails and repaired passes. Explicit broken exits 1. Invalid input exits 2.');
} else {
  try {
    const json = args.includes('--json');
    const remaining = args.filter(arg => arg !== '--json');
    const first = remaining[0];
    const ids = first && !first.startsWith('--') ? [remaining.shift()!] : [...recipeIds];
    let variant: Variant | undefined;
    if (remaining.length) {
      if (remaining.length !== 2 || remaining[0] !== '--variant' || !['broken', 'repaired'].includes(remaining[1]!)) throw new Error('Use --help for supported arguments');
      variant = remaining[1] as Variant;
    }
    if (ids.some(id => !isRecipeId(id))) throw new Error('Unknown recipe. Use --help for IDs');
    const results = [];
    for (const id of ids) if (isRecipeId(id)) for (const selection of variant ? [variant] : ['broken', 'repaired'] as const) results.push(await runRecipe(id, selection));
    console.log(json ? JSON.stringify(results, null, 2) : results.map(result => `${result.check.passed ? 'PASS' : 'FAIL (expected for broken)'}  ${result.recipe} / ${result.variant}\n  ${result.check.evidence}`).join('\n'));
    process.exitCode = results.every(result => variant ? result.check.passed : result.check.passed === (result.variant === 'repaired')) ? 0 : 1;
  } catch (error) { console.error(error instanceof Error ? error.message : 'Recipe failed'); process.exitCode = 2; }
}
