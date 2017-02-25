/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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
import * as path from 'path';
import {Analyzer} from 'polymer-analyzer';
import {FSUrlLoader} from 'polymer-analyzer/lib/url-loader/fs-url-loader';

import {DomModuleAfterPolymer} from '../../html/dom-module-after-polymer';
import {Linter} from '../../linter';
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.resolve(path.join(__dirname, '../../../test'));

suite('DomModuleAfterPolymer', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrettyPrinter(analyzer);
    linter = new Linter([new DomModuleAfterPolymer()], analyzer);
  });

  test('finds dom-modules defined after polymer', async() => {
    const warnings = await linter.lint(
        ['dom-module-after-polymer/dom-module-after-polymer.html']);

    assert.deepEqual(await warningPrinter.prettyPrint(warnings), [`
<dom-module id="dom-module-after-polymer"></dom-module>
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`]);
    assert.equal(
        warnings[0].message,
        'dom-module for dom-module-after-polymer should' +
            'be a parent of it or earlier in the document');
  });
});
