import katex from 'katex';
import 'katex/dist/katex.min.css';

export function Formula({ value, block = false }: { value: string; block?: boolean }) {
  const html = katex.renderToString(value, {
    throwOnError: false,
    displayMode: block,
    output: 'html',
  });
  const Tag = block ? 'div' : 'span';
  return <Tag className={block ? 'overflow-x-auto rounded bg-gray-50 p-3 text-sm dark:bg-gray-900' : ''} dangerouslySetInnerHTML={{ __html: html }} />;
}
