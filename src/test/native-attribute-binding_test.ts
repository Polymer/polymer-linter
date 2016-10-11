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
import {Severity, Warning} from 'polymer-analyzer/lib/warning/warning';

import {Linter} from '../linter';
import {NativeAttributeBinding} from '../rules/native-attribute-binding';

suite('NativeAttributeBinding', () => {

  test('bind to class', async() => {
    const linter: Linter = new Linter([new NativeAttributeBinding()]);
    const warnings: Warning[] =
        (await linter.lint(['test/sample/imports/bind-to-class.html']))
            .filter((warning) => warning.code === 'native-attribute-binding');

    assert.equal(warnings.length, 1);

    assert.deepEqual(warnings[0], {
      code: 'native-attribute-binding',
      message:
          'The expression [[myVars]] bound to attribute \'class\' should use $= instead of =',
      severity: Severity.ERROR,
      sourceRange: {
        end: {column: 28, line: 11},
        file: 'test/sample/imports/bind-to-class.html',
        start: {column: 10, line: 11}
      }
    });
  });

  test('bind to data', async() => {
    const linter: Linter = new Linter([new NativeAttributeBinding()]);
    const warnings: Warning[] =
        (await linter.lint(['test/sample/imports/bind-to-data.html']))
            .filter((warning) => warning.code === 'native-attribute-binding');

    assert.equal(warnings.length, 1);

    assert.deepEqual(warnings[0], {
      code: 'native-attribute-binding',
      message:
          'The expression [[myVars]] bound to attribute \'data-page\' should ' +
          'use $= instead of =',
      severity: Severity.ERROR,
      sourceRange: {
        end: {column: 32, line: 11},
        file: 'test/sample/imports/bind-to-data.html',
        start: {column: 10, line: 11}
      }
    });
  });
});
