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

import {Linter} from '../../linter';
import {UnknownEventHandlerDeclarations} from '../../polymer/unknown-event-handler-declarations';
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.resolve(path.join(__dirname, '../../../test'));

suite('UnknownEventHandlerDeclarations', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrettyPrinter(analyzer);
    linter = new Linter([new UnknownEventHandlerDeclarations()], analyzer);
  });

  test('finds unknown event handler declarations', async() => {
    const warnings = await linter.lint([
      'unknown-event-handler-declarations/unknown-event-handler-declarations.html'
    ]);

    assert.deepEqual(await warningPrinter.prettyPrint(warnings), [`
      on-non-existent="foo"
      ~~~~~~~~~~~~~~~`]);
    assert.equal(
        warnings[0].message, 'Tag unknown-event-handler-declarations is not known to emit an event named non-existent');
  });
});
