/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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
import * as assert from 'assert';
import * as fs from 'fs';
import {Warning} from 'polymer-analyzer/lib/warning/warning';

import {Linter} from '../linter';
import {AnalyzerWarnings} from '../rules/analyzer-warnings';

suite('AnalyzerWarnings', () => {

  let linter: Linter;
  let warnings: Warning[];

  before(async() => {
    linter = new Linter([new AnalyzerWarnings()]);
    warnings =
        await linter.lint(['test/sample/my-element-collection.html'].concat(
            fs.readdirSync('test/sample/imports')
                .map((f) => `test/sample/imports/${f}`)));
  });

  test('could-not-load', async() => {

    const couldNotLoadWarnings =
        warnings.filter((w) => w.code === 'could-not-load');
    assert.equal(couldNotLoadWarnings.length, 4);
    assert.deepEqual(
        couldNotLoadWarnings.map((w) => w.sourceRange.file).sort(), [
          'test/sample/imports/dom-module-after-polymer.html',
          'test/sample/imports/element-not-defined.html',
          'test/sample/imports/external-script-error.html',
          'test/sample/my-element-collection.html'
        ]);
    assert.equal(
        couldNotLoadWarnings.every((w) => !!w.message.match(/polymer.html/)),
        true);
  });
});
