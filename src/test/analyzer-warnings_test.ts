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

import {Linter} from '../linter';
import {AnalyzerWarnings} from '../rules/analyzer-warnings';

suite('AnalyzerWarnings', () => {

  test('could-not-load', async() => {
    const linter = new Linter([new AnalyzerWarnings()]);
    const warnings =
        await linter.lint(['test/sample/my-element-collection.html'].concat(
            fs.readdirSync('test/sample/imports')
                .map((f) => `test/sample/imports/${f}`)));

    const couldNotLoadWarnings =
        warnings.filter((w) => w.code === 'could-not-load');

    assert.equal(couldNotLoadWarnings.length, 4);

    const couldNotLoadUrls =
        couldNotLoadWarnings.map((w) => w.sourceRange.file).sort();

    assert.deepEqual(couldNotLoadUrls, [
      'test/sample/imports/dom-module-after-polymer.html',
      'test/sample/imports/element-not-defined.html',
      'test/sample/imports/external-script-error.html',
      'test/sample/my-element-collection.html'
    ]);

    assert(
        couldNotLoadWarnings.every((w) => !!w.message.match(/polymer.html/)));
  });
});
