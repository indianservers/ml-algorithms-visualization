import katex from 'katex';
import 'katex/dist/katex.min.css';

const formulaDefinitions: Array<[RegExp, string]> = [
  [/y\s*=\s*m\s*x\s*\+\s*b/i, 'predicted value = slope times input plus intercept'],
  [/\\hat\{?y\}?|y_hat/i, 'predicted value from the model'],
  [/\\theta|theta/i, 'model parameters being learned'],
  [/\\eta|learning_rate/i, 'learning rate, or how large each update step is'],
  [/\\nabla|gradient/i, 'gradient, the direction that changes the loss fastest'],
  [/\\frac\{1\}\{n\}\\sum|mean squared error|mse/i, 'average prediction error across all examples'],
  [/Q\(s,a\)/i, 'expected long-term value of taking action a in state s'],
  [/\\sigma|sigmoid/i, 'sigmoid function that turns a score into a probability'],
];

function explainFormula(value: string) {
  return formulaDefinitions.find(([pattern]) => pattern.test(value))?.[1]
    ?? 'Plain English: this formula describes how the algorithm transforms inputs, parameters, and errors into the value shown on the page.';
}

export function Formula({ value, block = false, explanation }: { value: string; block?: boolean; explanation?: string }) {
  const html = katex.renderToString(value, {
    throwOnError: false,
    displayMode: block,
    output: 'html',
  });
  const Tag = block ? 'div' : 'span';
  return (
    <Tag
      className={`${block ? 'overflow-x-auto rounded bg-gray-50 p-3 text-sm dark:bg-gray-900' : ''} cursor-help`}
      title={explanation ?? explainFormula(value)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
