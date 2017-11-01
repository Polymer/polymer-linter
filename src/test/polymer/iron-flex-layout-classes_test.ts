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
import {applyEdits, makeParseLoader} from '../../warning';
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

const ruleId = 'iron-flex-layout-classes';

suite(ruleId, () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrettyPrinter();
    linter = new Linter(registry.getRules([ruleId]), analyzer);
  });

  test('works in the trivial case', async() => {
    const warnings = await linter.lint([]);
    assert.deepEqual(warnings, []);
  });

  test('warns for the proper cases and with the right messages', async() => {
    const warnings = await linter.lint([`${ruleId}/before-fixes.html`]);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
<dom-module id="no-style">
~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
<dom-module id="with-style">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
<dom-module id="with-include">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
<dom-module id="with-partial-include">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      `Style module is used but not imported:

  iron-flex

Import it in the template style include.`,
      `Style module is used but not imported:

  iron-flex

Import it in the template style include.`,
      `Style module is used but not imported:

  iron-flex

Import it in the template style include.`,
      `Style modules are used but not imported:

  iron-flex-reverse iron-flex-factors

Import them in the template style include.`,
    ]);
  });

  test('applies automatic-safe fixes', async() => {
    const warnings = await linter.lint([`${ruleId}/before-fixes.html`]);
    const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
    const loader = makeParseLoader(analyzer);
    const result = await applyEdits(edits, loader);
    assert.deepEqual(
        result.editedFiles.get(`${ruleId}/before-fixes.html`),
        (await loader(`${ruleId}/after-fixes.html`)).contents);
  });
});
