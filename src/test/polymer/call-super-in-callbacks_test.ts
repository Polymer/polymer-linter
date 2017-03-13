/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {assert} from 'chai';
import * as path from 'path';
import {Analyzer, FSUrlLoader} from 'polymer-analyzer';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

suite('call-super-in-callbacks', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrettyPrinter(analyzer);
    linter =
        new Linter(registry.getRules(['call-super-in-callbacks']), analyzer);
  });

  test('works in the trivial case', async() => {
    const warnings = await linter.lint([]);
    assert.deepEqual(warnings, []);
  });

  test('gives no warnings for a perfectly fine file', async() => {
    const warnings = await linter.lint(['perfectly-fine/polymer-element.html']);
    assert.deepEqual(warnings, []);
  });

  test('warns for the proper cases and with the right messages', async() => {
    const warnings = await linter.lint(
        ['call-super-in-callbacks/call-super-in-callbacks.html']);
    assert.deepEqual(await warningPrinter.prettyPrint(warnings), [
      `
    constructor() {/* BadSuper */ }
    ~~~~~~~~~~~`,
      `
    connectedCallback() { /* BadSuper */ }
    ~~~~~~~~~~~~~~~~~`,
      `
    disconnectedCallback() {/* BadSuper */ }
    ~~~~~~~~~~~~~~~~~~~~`,
      `
    attributeChangedCallback() {/* BadSuper */ }
    ~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
    connectedCallback() { /* ReassignedBad */ }
    ~~~~~~~~~~~~~~~~~`,
      `
    connectedCallback() { /* BadMixin1 */ }
    ~~~~~~~~~~~~~~~~~`,
      `
    connectedCallback() { /* BadMixin2 */ }
    ~~~~~~~~~~~~~~~~~`,
      `
    disconnectedCallback() { /* BadMixin2 */ }
    ~~~~~~~~~~~~~~~~~~~~`,
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      'Elements that extend Polymer.Element must call super() in their ' +
          'constructor.',
      'Elements that extend Polymer.Element must call ' +
          'super.connectedCallback() in their ' +
          'connectedCallback method override.',
      'Elements that extend Polymer.Element must call ' +
          'super.disconnectedCallback() in their ' +
          'disconnectedCallback method override.',
      'Elements that extend Polymer.Element must call ' +
          'super.attributeChangedCallback() in their ' +
          'attributeChangedCallback method override.',
      'Elements that extend Polymer.Element must call ' +
          'super.connectedCallback() in their ' +
          'connectedCallback method override.',
      'Elements that extend Polymer.Element must call ' +
          'super.connectedCallback() in their ' +
          'connectedCallback method override.',
      'Elements that extend Polymer.Element must call ' +
          'super.connectedCallback() in their ' +
          'connectedCallback method override.',
      'Elements that extend Polymer.Element must call ' +
          'super.disconnectedCallback() in their ' +
          'disconnectedCallback method override.',
    ]);
  });
});
