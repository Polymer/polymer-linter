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
import {Analyzer} from 'polymer-analyzer';
import {FSUrlLoader} from 'polymer-analyzer/lib/url-loader/fs-url-loader';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

suite('databind-with-unknown-property', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrettyPrinter(analyzer);
    linter = new Linter(
        registry.getRules(['databind-with-unknown-property']), analyzer);
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
        ['databind-with-unknown-property/databind-with-unknown-property.html']);
    assert.deepEqual(await warningPrinter.prettyPrint(warnings), [
      `
    <div id="[[onlyReadFrom]]"></div>
               ~~~~~~~~~~~~`,
      `
    <div id="{{referencedOnlyOnce}}"></div>
               ~~~~~~~~~~~~~~~~~~`
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      'onlyReadFrom is not declared and is only read from, never written to. If it\'s part of the element\'s API it should be a declared property.',
      'referencedOnlyOnce is not declared or used more than once. Did you mean: translate'
    ]);
  });
});
