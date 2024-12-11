import { expect, test } from '@jest/globals';
import { generateSimplifiedDom } from './simplifyDom';

test('generateSimplifiedDom permits and IDs only interactive elements', () => {
  const rootElement = document.createElement('div');
  rootElement.setAttribute('data-visible', 'true');
  rootElement.innerHTML = `
    <div data-visible="true" data-interactive="true" data-id="1">
      <span>Hello</span>
      <p>World</p>
    </div>
    <div data-visible="false">
      <span>Hidden</span>
    </div>
    <div data-visible="true">
      <span>Visible</span>
    </div>
  `;

  // Let's create an element <div id=1 />
  const div = document.createElement('div');
  div.setAttribute('id', '1');

  expect(generateSimplifiedDom(rootElement, [])).toEqual(div);
});
